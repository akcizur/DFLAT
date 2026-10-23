import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createMainBuildingWorld } from "../src/game/main-building.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIRECTORY = path.join(ROOT, "public", "data");
const JSON_OUTPUT = path.join(OUTPUT_DIRECTORY, "main-building-vertices.json");
const CSV_OUTPUT = path.join(OUTPUT_DIRECTORY, "main-building-vertices.csv");
const EPSILON = 1e-6;
const EXPECTED = Object.freeze({
  width: 28,
  depth: 12,
  floors: 8,
  floorHeight: 2.8,
  roofHeight: 22.4,
  origin: { x: 0, y: 0, z: -22 },
  footprint: { minX: -14, maxX: 14, minZ: -28, maxZ: -16 }
});

function closeTo(actual, expected, label, epsilon = EPSILON) {
  assert.ok(Number.isFinite(actual), `${label}: value is not finite (${actual})`);
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, received ${actual}`
  );
}

function isFinitePoint(point) {
  return point && ["x", "y", "z"].every(axis => Number.isFinite(point[axis]));
}

function assertFinitePoint(point, label) {
  assert.ok(isFinitePoint(point), `${label}: invalid coordinate ${JSON.stringify(point)}`);
}

function round(value) {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Instantiate the exact geometry used by the browser game. This is deliberately
// not a parallel architectural model, and it does not use the Blender generators.
const scene = new THREE.Scene();
const state = { currentFloor: 0, mainBuildingScene: true };
const ui = { showToast() {}, updateObjective() {} };
const world = createMainBuildingWorld({ THREE, scene, state, ui });
scene.updateMatrixWorld(true);

const data = world.getCoordinateData();
const csv = world.exportCoordinateCSV();
const meshes = world.meshes;
assert.ok(Array.isArray(meshes) && meshes.length > 500, "The main-building scene should contain the complete architectural assembly.");
assert.ok(data && Array.isArray(data.objects) && Array.isArray(data.anchors), "The runtime coordinate API returned an incomplete manifest.");
assert.equal(data.units, "metres", "Coordinate values must use metres.");
assert.equal(data.building.width, EXPECTED.width);
assert.equal(data.building.depth, EXPECTED.depth);
assert.equal(data.building.floors, EXPECTED.floors);
closeTo(data.building.floorHeight, EXPECTED.floorHeight, "Floor-to-floor height");
closeTo(data.building.height, EXPECTED.roofHeight, "Roof datum height");
closeTo(data.coordinateSystem.buildingWorldOrigin.x, EXPECTED.origin.x, "Building origin X");
closeTo(data.coordinateSystem.buildingWorldOrigin.y, EXPECTED.origin.y, "Building origin Y");
closeTo(data.coordinateSystem.buildingWorldOrigin.z, EXPECTED.origin.z, "Building origin Z");

const anchorById = new Map(data.anchors.map(anchor => [anchor.id, anchor]));
assert.equal(anchorById.size, data.anchors.length, "Semantic anchor IDs must be unique.");
for (const requiredId of [
  "building-origin",
  "front-left-ground", "front-right-ground",
  "rear-left-ground", "rear-right-ground",
  "roof-datum",
  "entrance-left-bottom", "entrance-right-top",
  "floor-datum-0", "floor-datum-8",
  "balcony-door-f0-c2", "balcony-door-f0-c5",
  "balcony-f0-xL", "balcony-f0-xR",
  "stair-mid-landing-f0", "stair-arrival-f1",
  "lift-left-rear-base", "lift-right-front-top",
  "elevator-interaction-f0",
  "roof-hatch-left-rear", "roof-hatch-right-front"
]) {
  assert.ok(anchorById.has(requiredId), `Missing semantic anchor: ${requiredId}`);
}
for (const anchor of data.anchors) assertFinitePoint(anchor.position, `Anchor ${anchor.id}`);
for (const object of data.objects) {
  assertFinitePoint(object.center, `Object center ${object.id}`);
  assertFinitePoint(object.bounds?.min, `Object min bound ${object.id}`);
  assertFinitePoint(object.bounds?.max, `Object max bound ${object.id}`);
  assert.ok(Array.isArray(object.corners) && object.corners.length >= 2, `Object ${object.id} has no geometric vertices.`);
  for (const corner of object.corners) assertFinitePoint(corner, `Object corner ${object.id}`);
}

const frontLeft = anchorById.get("front-left-ground").position;
const frontRight = anchorById.get("front-right-ground").position;
const rearLeft = anchorById.get("rear-left-ground").position;
const rearRight = anchorById.get("rear-right-ground").position;
const roof = anchorById.get("roof-datum").position;
closeTo(frontRight.x - frontLeft.x, EXPECTED.width, "Front footprint width");
closeTo(rearRight.x - rearLeft.x, EXPECTED.width, "Rear footprint width");
closeTo(frontLeft.z - rearLeft.z, EXPECTED.depth, "Left footprint depth");
closeTo(frontRight.z - rearRight.z, EXPECTED.depth, "Right footprint depth");
closeTo(roof.y, EXPECTED.roofHeight, "Semantic roof datum");
closeTo(anchorById.get("floor-datum-8").position.y, EXPECTED.roofHeight, "Top-level datum");
closeTo(
  anchorById.get("stair-mid-landing-f0").position.x,
  world.navigation.stairs.landingCenterX,
  "Landing semantic X must equal the navigation geometry's true center"
);
closeTo(world.navigation.coreOpening.maxZ, -22.52, "Core opening front datum");
closeTo(anchorById.get("lift-left-front-base").position.z, world.navigation.coreOpening.maxZ, "Lift threshold and core opening must share Z");
const stairLandingDepth = world.navigation.stairs.landingDepth;
closeTo(
  world.navigation.stairs.landingCenterZ - stairLandingDepth / 2,
  world.navigation.stairs.firstZ - world.navigation.stairs.treadDepth / 2,
  "Stair landing rear edge must meet lower flight"
);
closeTo(
  world.navigation.stairs.landingCenterZ + stairLandingDepth / 2,
  world.navigation.coreOpening.maxZ,
  "Stair landing front edge must meet the core opening and lift threshold"
);

const windowDoorAnchors = data.anchors.filter(anchor => anchor.id.startsWith("balcony-door-f"));
assert.equal(windowDoorAnchors.length, EXPECTED.floors * 2, "Each occupied storey needs two real balcony door anchors.");

// Verify that the physical cabin, landing panels and door collision volumes all follow a floor change.
const cabinFloor = meshes.find(mesh => mesh.name === "Výtah / podlaha kabiny");
assert.ok(cabinFloor, "Elevator cabin floor is missing.");
const initialCabinY = cabinFloor.position.y;
const liftFloor = 2;
state.onElevatorMoved?.(liftFloor);
closeTo(cabinFloor.position.y, initialCabinY + liftFloor * EXPECTED.floorHeight, "Elevator cabin travel");
const destinationDoors = meshes.filter(mesh =>
  mesh.name === "Výtah / otevřené dveře" &&
  Math.abs(mesh.position.y - (liftFloor * EXPECTED.floorHeight + 1.08)) < EPSILON
);
assert.equal(destinationDoors.length, 2, "The served floor needs two open lift door panels.");
const destinationDoorCollider = world.colliders.find(collider =>
  collider.floor === liftFloor &&
  Math.abs(collider.minX - (2.2 - 1.42 / 2)) < EPSILON &&
  Math.abs(collider.maxX - (2.2 + 1.42 / 2)) < EPSILON &&
  Math.abs(collider.minZ - (-22.52 - 0.12 / 2)) < EPSILON
);
assert.ok(destinationDoorCollider, "The lift needs a collision volume for the landing opening.");
assert.equal(destinationDoorCollider.active, false, "Destination lift doors must open a passable collision volume.");
state.onElevatorMoved?.(0);
closeTo(cabinFloor.position.y, initialCabinY, "Elevator return to ground floor");

const facadePassages = [
  { minX: -1.82 / 2, maxX: 1.82 / 2, label: "entrance" },
  { minX: -4.9 - 1.36 / 2, maxX: -4.9 + 1.36 / 2, label: "left balcony" },
  { minX: 4.9 - 1.36 / 2, maxX: 4.9 + 1.36 / 2, label: "right balcony" }
];
for (const passage of facadePassages) {
  const wallBlocksOpening = world.colliders.some(collider =>
    !Number.isInteger(collider.floor) &&
    Math.abs(collider.minZ - (-16 - 0.28 / 2)) < EPSILON &&
    Math.abs(collider.maxZ - (-16 + 0.28 / 2)) < EPSILON &&
    collider.minX < passage.maxX - EPSILON &&
    collider.maxX > passage.minX + EPSILON
  );
  assert.equal(wallBlocksOpening, false, `The front collision wall must leave the ${passage.label} opening clear.`);
}

const interactionPoints = world.interactables.map(item => ({
  id: item.id,
  name: item.name,
  x: round(item.x),
  z: round(item.z),
  range: round(item.range)
}));
const collisionVolumes = world.colliders.map((collider, index) => ({
  id: `collider-${String(index + 1).padStart(4, "0")}`,
  ...Object.fromEntries(Object.entries(collider).map(([key, value]) => [
    key, typeof value === "number" ? round(value) : value
  ]))
}));
const manifest = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  provenance: {
    runtimeGeometry: "src/game/main-building.js",
    playerNavigation: "src/game/player.js",
    exportMethod: "world.getCoordinateData() and world.exportCoordinateCSV()",
    confidence: "Meshes and anchors are measured from runtime Three.js geometry. Values labelled as design dimensions are validated against those meshes; this does not claim measured architectural surveying of a specific physical building."
  },
  coordinateSystem: {
    units: "metres",
    handedness: "Three.js right-handed world coordinates",
    worldOrigin: { x: 0, y: 0, z: 0 },
    buildingOriginWorld: EXPECTED.origin,
    localToWorld: "x_world=x_local; y_world=y_local; z_world=z_local-22",
    worldToBuildingLocal: "x_local=x_world; y_local=y_world; z_local=z_world+22",
    axes: {
      x: "across the 28 m front facade; centerline x=0",
      y: "vertical; finished ground-floor datum y=0",
      z: "depth; entrance/front facade z=-16; rear facade z=-28"
    }
  },
  validatedDesignDimensions: {
    width: data.building.width,
    depth: data.building.depth,
    storeys: data.building.floors,
    floorToFloor: data.building.floorHeight,
    roofDatumY: data.building.height,
    wallThickness: data.building.wallThickness,
    nominalFootprint: EXPECTED.footprint,
    windowCentersX: [-11.4, -8.15, -4.9, -1.65, 1.65, 4.9, 8.15, 11.4],
    windowWidth: 1.36,
    normalWindowSill: 0.78,
    windowHead: 2.28,
    balconyDoorBottom: 0,
    entranceWidth: 1.82,
    entranceHeight: 2.5,
    stairNavigation: world.navigation.stairs,
    coreOpening: world.navigation.coreOpening,
    elevator: { centerX: 2.2, leftX: 1.05, rightX: 3.35, rearZ: -25, frontZ: -22.52, width: 2.3, depth: 2.48, doorWidth: 1.42, doorHeight: 2.1 }
  },
  counts: {
    objects: data.counts.objects,
    logicalCornerVertices: data.counts.logicalCorners,
    semanticAnchors: data.counts.semanticAnchors,
    collisionVolumes: collisionVolumes.length,
    interactionPoints: interactionPoints.length,
    balconyDoorAnchors: windowDoorAnchors.length,
    doorPanelsPerServedElevatorFloor: 2
  },
  validation: {
    status: "passed",
    assertions: [
      "Building dimensions and roof height match the runtime design",
      "All mesh corners, object bounds and semantic points are finite",
      "Front and rear footprint widths/depth agree",
      "Ground, floor and roof datums match the 2.8 m storey pitch",
      "Balcony-door semantic points exist on both sides of all eight storeys",
      "Stair landing anchor equals the navigation geometry center",
      "Elevator cabin and landing doors follow the active level",
      "Entrance and balcony doorways are clear in the horizontal collision model"
    ]
  },
  interactionPoints,
  collisionVolumes,
  geometry: data
};

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");
await writeFile(CSV_OUTPUT, csv, "utf8");

console.log(
  `Coordinate export validated: ${manifest.counts.objects} objects, ${manifest.counts.logicalCornerVertices} object-corner records, ${manifest.counts.semanticAnchors} named anchors, ${manifest.counts.collisionVolumes} collision volumes.`
);
console.log(`JSON: ${path.relative(ROOT, JSON_OUTPUT)}`);
console.log(`CSV:  ${path.relative(ROOT, CSV_OUTPUT)}`);

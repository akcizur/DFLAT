import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { PANELAK_LAYOUT } from "../src/game/panelak-config.js";
import { createMainBuildingWorld } from "../src/game/main-building.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIRECTORY = path.join(ROOT, "public", "data");
const JSON_OUTPUT = path.join(OUTPUT_DIRECTORY, "main-building-vertices.json");
const CSV_OUTPUT = path.join(OUTPUT_DIRECTORY, "main-building-vertices.csv");
const EPSILON = 1e-6;
const EXPECTED = Object.freeze({
  width: 18,
  depth: 12,
  floors: 4,
  floorHeight: 2.8,
  roofHeight: 11.2,
  origin: { x: 0, y: 0, z: -22 },
  footprint: { minX: -9, maxX: 9, minZ: -28, maxZ: -16 }
});

function closeTo(actual, expected, label, epsilon = EPSILON) {
  assert.ok(Number.isFinite(actual), label + ": value is not finite (" + actual + ")");
  assert.ok(Math.abs(actual - expected) <= epsilon,
    label + ": expected " + expected + ", received " + actual);
}
function finitePoint(point) {
  return point && ["x", "y", "z"].every(axis => Number.isFinite(point[axis]));
}
function assertFinitePoint(point, label) {
  assert.ok(finitePoint(point), label + ": invalid coordinate " + JSON.stringify(point));
}
function round(value) {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}

const scene = new THREE.Scene();
const state = { currentFloor: 0, mainBuildingScene: true };
const ui = { showToast() {}, updateObjective() {} };
const world = createMainBuildingWorld({ THREE, scene, state, ui });
scene.updateMatrixWorld(true);

const data = world.getCoordinateData();
const csv = world.exportCoordinateCSV();
assert.ok(Array.isArray(world.meshes) && world.meshes.length > 500,
  "The five-module architectural assembly must include facade, interiors, loggias and stairs.");
assert.ok(data && Array.isArray(data.objects) && Array.isArray(data.anchors),
  "Runtime coordinate API returned an incomplete manifest.");
assert.equal(data.units, "metres");
assert.equal(data.schemaVersion, "2.0");
assert.equal(data.building.width, EXPECTED.width);
assert.equal(data.building.depth, EXPECTED.depth);
assert.equal(data.building.floors, EXPECTED.floors);
assert.equal(data.building.modules, 5);
assert.equal(data.building.moduleWidth, 3.6);
assert.equal(data.building.apartmentsPerFloor, 2);
assert.equal(data.building.elevator, false);
closeTo(data.building.floorHeight, EXPECTED.floorHeight, "Floor-to-floor height");
closeTo(data.building.height, EXPECTED.roofHeight, "Roof datum height");
closeTo(data.coordinateSystem.buildingWorldOrigin.x, EXPECTED.origin.x, "Building origin X");
closeTo(data.coordinateSystem.buildingWorldOrigin.y, EXPECTED.origin.y, "Building origin Y");
closeTo(data.coordinateSystem.buildingWorldOrigin.z, EXPECTED.origin.z, "Building origin Z");
closeTo(PANELAK_LAYOUT.calculatedRoomArea, 65.4, "Reconciled declared room-area sum", 0.01);
closeTo(PANELAK_LAYOUT.hallDepth, PANELAK_LAYOUT.bathDepth, "Mirrored support-zone depth");

const anchorById = new Map(data.anchors.map(anchor => [anchor.id, anchor]));
assert.equal(anchorById.size, data.anchors.length, "Semantic anchor IDs must be unique.");
for (const id of [
  "building-origin", "front-left-ground", "front-right-ground",
  "rear-left-ground", "rear-right-ground", "roof-datum",
  "entrance-left-bottom", "entrance-right-top",
  "floor-datum-0", "floor-datum-4",
  "stair-mid-landing-f0", "stair-arrival-f1",
  "loggia-door-f0-xL", "loggia-door-f0-xR",
  "loggia-door-f3-xL", "loggia-door-f3-xR"
]) assert.ok(anchorById.has(id), "Missing semantic anchor: " + id);

for (const anchor of data.anchors) assertFinitePoint(anchor.position, "Anchor " + anchor.id);
for (const object of data.objects) {
  assertFinitePoint(object.center, "Object center " + object.id);
  assertFinitePoint(object.bounds?.min, "Object minimum " + object.id);
  assertFinitePoint(object.bounds?.max, "Object maximum " + object.id);
  assert.ok(Array.isArray(object.corners) && object.corners.length >= 2,
    "Object " + object.id + " has no corner records.");
  for (const corner of object.corners) assertFinitePoint(corner, "Object corner " + object.id);
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
closeTo(anchorById.get("floor-datum-4").position.y, EXPECTED.roofHeight, "Top floor datum");

const doorAnchors = data.anchors.filter(anchor => anchor.id.startsWith("loggia-door-f"));
assert.equal(doorAnchors.length, EXPECTED.floors * 2,
  "Both mirrored apartments need a loggia doorway on each occupied level.");

const stair = world.navigation.stairs;
closeTo(stair.landingCenterX, stair.highX + stair.treadOverlap / 2 + stair.landingWidth / 2, "Landing center X");
closeTo(stair.landingCenterZ - stair.landingDepth / 2,
  stair.firstZ - stair.treadDepth / 2, "Landing rear edge");
closeTo(stair.landingCenterZ + stair.landingDepth / 2,
  world.navigation.coreOpening.maxZ, "Landing front edge and stair core edge");
closeTo(world.navigation.coreOpening.minX, -1.8, "Core left edge");
closeTo(world.navigation.coreOpening.maxX, 1.8, "Core right edge");
closeTo(world.navigation.floors, 4, "Navigation floor count");

const stairLowerTreads = world.meshes.filter(mesh => mesh.name === "Schodiště / dolní rameno / stupeň");
const stairUpperTreads = world.meshes.filter(mesh => mesh.name === "Schodiště / horní rameno / stupeň");
assert.equal(stairLowerTreads.length, (EXPECTED.floors - 1) * 8);
assert.equal(stairUpperTreads.length, (EXPECTED.floors - 1) * 8);
assert.equal(world.interactables.some(item => item.id === "elevator"), false,
  "The 4 NP section is not meant to include an elevator.");
assert.equal(world.meshes.some(mesh => /výtah|elevator/i.test(mesh.name)), false,
  "Elevator geometry must not survive in the active model.");

const frontZ = EXPECTED.footprint.maxZ;
const rearZ = EXPECTED.footprint.minZ;
const doorwayRanges = [
  { center: 0, width: 1.76, z: frontZ, label: "main entrance" },
  { center: -3.6, width: 1.48, z: rearZ, label: "left loggia" },
  { center: 3.6, width: 1.48, z: rearZ, label: "right loggia" }
];
for (const passage of doorwayRanges) {
  const blocked = world.colliders.some(collider =>
    Number.isInteger(collider.floor) &&
    Math.abs((collider.minZ + collider.maxZ) / 2 - passage.z) < 0.10 &&
    collider.minX < passage.center + passage.width / 2 - EPSILON &&
    collider.maxX > passage.center - passage.width / 2 + EPSILON
  );
  assert.equal(blocked, false, "Collision wall overlaps the " + passage.label + " opening.");
}

const interactionPoints = world.interactables.map(item => ({
  id: item.id, name: item.name, x: round(item.x), z: round(item.z), range: round(item.range)
}));
const collisionVolumes = world.colliders.map((collider, index) => ({
  id: "collider-" + String(index + 1).padStart(4, "0"),
  ...Object.fromEntries(Object.entries(collider).map(([key, value]) => [
    key, typeof value === "number" ? round(value) : value
  ]))
}));

const manifest = {
  schemaVersion: "2.0.0",
  generatedAt: new Date().toISOString(),
  provenance: {
    runtimeGeometry: "src/game/main-building.js",
    designConfig: "src/game/panelak-config.js",
    playerNavigation: "src/game/player.js",
    confidence: "Coordinates are measured from the runtime Three.js geometry. The model is T06B-inspired and conceptual; it is not a surveyed existing building or a signed construction document."
  },
  coordinateSystem: {
    units: "metres",
    handedness: "Three.js right-handed world coordinates",
    worldOrigin: { x: 0, y: 0, z: 0 },
    buildingOriginWorld: EXPECTED.origin,
    localToWorld: "x_world=x_local; y_world=y_local; z_world=z_local-22",
    worldToBuildingLocal: "x_local=x_world; y_local=y_world; z_local=z_world+22",
    axes: {
      x: "across the 18 m five-module facade; centerline x=0",
      y: "vertical; finished ground-floor datum y=0",
      z: "depth; entrance facade z=-16, rear facade z=-28"
    }
  },
  validatedDesignDimensions: {
    system: "T06B-inspired",
    width: data.building.width,
    depth: data.building.depth,
    occupiedStoreys: data.building.floors,
    basementLevels: data.building.basementFloors,
    floorToFloor: data.building.floorHeight,
    roofDatumY: data.building.height,
    wallThickness: PANELAK_LAYOUT.exteriorWall,
    nominalFootprint: EXPECTED.footprint,
    moduleWidth: data.building.moduleWidth,
    moduleCount: data.building.modules,
    apartmentsPerFloor: data.building.apartmentsPerFloor,
    targetApartmentArea: data.building.targetApartmentArea,
    calculatedRoomArea: data.building.correctedNominalRoomArea,
    hallAndWetCoreDepth: PANELAK_LAYOUT.hallDepth,
    elevator: false,
    stairNavigation: world.navigation.stairs,
    coreOpening: world.navigation.coreOpening,
    recessedLoggiaDoorCentersX: [-3.6, 3.6],
    recessedLoggiaDepth: 1.72
  },
  counts: {
    objects: data.counts.objects,
    logicalCornerVertices: data.counts.logicalCorners,
    semanticAnchors: data.counts.semanticAnchors,
    collisionVolumes: collisionVolumes.length,
    interactionPoints: interactionPoints.length,
    loggiaDoorAnchors: doorAnchors.length,
    floors: EXPECTED.floors,
    apartments: EXPECTED.floors * 2
  },
  validation: {
    status: "passed",
    assertions: [
      "The footprint is 18 m by 12 m with five 3.6 m modules",
      "The model contains four occupied storeys plus a basement plinth",
      "The design includes two flats per floor and no elevator",
      "Mesh corners, bounds and named anchors contain finite coordinates",
      "Stair treads, landing and the stair-core opening share exact datums",
      "All eight loggia-door anchors exist",
      "The main entry and both loggia thresholds are clear in horizontal collision geometry",
      "Declared room dimensions reconcile to approximately 65.4 square metres"
    ]
  },
  interactionPoints,
  collisionVolumes,
  geometry: data,
  csvFile: path.basename(CSV_OUTPUT)
};

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");
await writeFile(CSV_OUTPUT, csv + "\n", "utf8");

console.log("Coordinate export validated: " + manifest.counts.objects + " objects, " +
  manifest.counts.logicalCornerVertices + " object-corner records, " +
  manifest.counts.semanticAnchors + " named anchors, " +
  manifest.counts.collisionVolumes + " collision volumes.");
console.log("JSON: " + path.relative(ROOT, JSON_OUTPUT));
console.log("CSV:  " + path.relative(ROOT, CSV_OUTPUT));

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createMainBuildingWorld } from "../src/game/main-building.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "data");
const JSON_PATH = path.join(OUT_DIR, "main-building-vertices.json");
const CSV_PATH = path.join(OUT_DIR, "main-building-vertices.csv");
const BUILDING_ORIGIN = { x: 0, y: 0, z: -22 };
const FLOOR_HEIGHT = 2.8;
const FLOOR_COUNT = 8;
const EPSILON = 1e-6;

function closeTo(actual, expected, label, tolerance = EPSILON) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

function rounded(value) {
  const result = Number(value.toFixed(6));
  return Object.is(result, -0) ? 0 : result;
}

function vec3(x, y, z) {
  return { x: rounded(x), y: rounded(y), z: rounded(z) };
}

function csvCell(value) {
  const string = String(value ?? "");
  return /[",\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function boundsFromCorners(corners) {
  return {
    min: vec3(
      Math.min(...corners.map(point => point.world.x)),
      Math.min(...corners.map(point => point.world.y)),
      Math.min(...corners.map(point => point.world.z))
    ),
    max: vec3(
      Math.max(...corners.map(point => point.world.x)),
      Math.max(...corners.map(point => point.world.y)),
      Math.max(...corners.map(point => point.world.z))
    )
  };
}

const scene = new THREE.Scene();
const state = { currentFloor: 0, changeFloor() {} };
const ui = { showToast() {}, updateObjective() {} };
const world = createMainBuildingWorld({ THREE, scene, state, ui });
scene.updateMatrixWorld(true);

const meshes = [];
scene.traverse(object => {
  if (object.isMesh && object.geometry?.isBufferGeometry) meshes.push(object);
});
assert.ok(meshes.length > 500, `Too few meshes were generated: ${meshes.length}`);

const findMeshes = name => meshes.filter(mesh => mesh.name === name);
const first = name => {
  const mesh = meshes.find(candidate => candidate.name === name);
  assert.ok(mesh, `Missing required geometry: ${name}`);
  return mesh;
};

function getWorldCorners(mesh) {
  mesh.geometry.computeBoundingBox();
  const { min, max } = mesh.geometry.boundingBox;
  const corners = [];
  for (let index = 0; index < 8; index++) {
    const local = new THREE.Vector3(
      (index & 1) ? max.x : min.x,
      (index & 2) ? max.y : min.y,
      (index & 4) ? max.z : min.z
    );
    const worldPoint = local.clone().applyMatrix4(mesh.matrixWorld);
    corners.push({
      vertexIndex: index,
      world: vec3(worldPoint.x, worldPoint.y, worldPoint.z),
      local: vec3(
        worldPoint.x - BUILDING_ORIGIN.x,
        worldPoint.y - BUILDING_ORIGIN.y,
        worldPoint.z - BUILDING_ORIGIN.z
      )
    });
  }
  return corners;
}

function localSize(mesh) {
  mesh.geometry.computeBoundingBox();
  const { min, max } = mesh.geometry.boundingBox;
  return vec3(max.x - min.x, max.y - min.y, max.z - min.z);
}

// Structural checks use the actual generated Three.js meshes rather than parsing
// comments or trusting a second, separately maintained set of dimensions.
assert.equal(findMeshes("Hlavní budova / přízemní podlaha").length, 1, "Ground-floor slab must exist exactly once.");
assert.equal(findMeshes("Podlaží / vstupní chodba").length, FLOOR_COUNT, "Each floor and the roof must have a corridor-side slab segment.");
assert.equal(findMeshes("Schodiště / dolní rameno / stupeň").length, FLOOR_COUNT * 8, "Each floor needs eight lower stair treads.");
assert.equal(findMeshes("Schodiště / horní rameno / stupeň").length, FLOOR_COUNT * 8, "Each floor needs eight upper stair treads.");
assert.equal(findMeshes("Schodiště / mezipodesta").length, FLOOR_COUNT, "Each storey needs an intermediate landing.");
assert.equal(findMeshes("Balkon / betonová deska").length, FLOOR_COUNT * 2, "Two balconies are required per storey.");
assert.equal(findMeshes("Výtah / podlaha kabiny").length, 1, "Exactly one movable elevator cabin floor must exist.");
assert.equal(findMeshes("Výtah / otevřené dveře").length, 2, "The ground-floor elevator doors must start open.");
assert.equal(findMeshes("Výtah / dveře patra").length, (FLOOR_COUNT - 1) * 2, "All upper elevator landing doors must start closed.");
assert.equal(findMeshes("Vchod / zasklení dveří").length, 0, "No glass panel may block the visibly open main entrance.");
assert.equal(findMeshes("Balkonové dveře / zasklení").length, 0, "No glass panel may block an open balcony doorway.");
assert.equal(findMeshes("Balkonové dveře / otevřené levé křídlo").length, FLOOR_COUNT, "Each balcony needs an open left door leaf.");
assert.equal(findMeshes("Balkonové dveře / otevřené pravé křídlo").length, FLOOR_COUNT, "Each balcony needs an open right door leaf.");

const groundSlab = first("Hlavní budova / přízemní podlaha");
groundSlab.geometry.computeBoundingBox();
closeTo(groundSlab.position.y + groundSlab.geometry.boundingBox.max.y, 0, "Ground-floor finished level");
const roofCorridorSlab = findMeshes("Podlaží / vstupní chodba").at(-1);
roofCorridorSlab.geometry.computeBoundingBox();
closeTo(
  roofCorridorSlab.position.z + roofCorridorSlab.geometry.boundingBox.min.z,
  -22.52,
  "Corridor slab edge must meet the lift and stairwell threshold"
);

const stairLanding = first("Schodiště / mezipodesta");
const stairLandingCorners = getWorldCorners(stairLanding);
const landingBounds = boundsFromCorners(stairLandingCorners);
closeTo(landingBounds.min.z, -25.68, "Stair landing rear edge");
closeTo(landingBounds.max.z, -22.52, "Stair landing front edge");
const liftDoorFrame = first("Výtah / nadpraží otvoru");
closeTo(liftDoorFrame.position.z, -22.52, "Lift threshold Z");
const stepEdges = findMeshes("Schodiště / horní rameno / stupeň");
for (let index = 1; index < stepEdges.length; index++) {
  const a = stepEdges[index - 1];
  const b = stepEdges[index];
  closeTo(localSize(a).x, 0.3, "Upper stair tread run");
  closeTo(localSize(b).x, 0.3, "Upper stair tread run");
}
const equipment = first("Hlavní budova / strojovna výtahu");
equipment.geometry.computeBoundingBox();
closeTo(equipment.position.y + equipment.geometry.boundingBox.min.y, FLOOR_COUNT * FLOOR_HEIGHT, "Lift machine room must sit on roof");
const vent = first("Hlavní budova / větrací komín");
vent.geometry.computeBoundingBox();
closeTo(vent.position.y + vent.geometry.boundingBox.min.y, FLOOR_COUNT * FLOOR_HEIGHT, "Roof vent must sit on roof");

const pathMesh = first("Mapa / přístupová cesta");
const platformMesh = first("Mapa / vstupní plošina");
pathMesh.geometry.computeBoundingBox();
platformMesh.geometry.computeBoundingBox();
closeTo(
  pathMesh.position.z + pathMesh.geometry.boundingBox.min.z,
  platformMesh.position.z + platformMesh.geometry.boundingBox.max.z,
  "Approach path must meet the entrance platform"
);

// Verify that the lift car, landing doors and collision state all follow a floor change.
const liftCabinFloor = first("Výtah / podlaha kabiny");
const initialCabinY = liftCabinFloor.position.y;
const groundLeftDoor = findMeshes("Výtah / otevřené dveře").find(mesh => mesh.position.x < 2.2);
const floorTwoLeftDoor = findMeshes("Výtah / dveře patra").find(
  mesh => Math.abs(mesh.position.y - (2 * FLOOR_HEIGHT + 1.08)) < EPSILON && mesh.position.x < 2.2
);
assert.ok(groundLeftDoor, "Ground-floor left lift door is missing.");
assert.ok(floorTwoLeftDoor, "Third-floor left lift door is missing.");
state.onElevatorMoved(2);
closeTo(liftCabinFloor.position.y, initialCabinY + 2 * FLOOR_HEIGHT, "Elevator cabin vertical travel");
closeTo(groundLeftDoor.position.x, 2.2 - 1.42 / 4, "Previously served door must close");
closeTo(floorTwoLeftDoor.position.x, 2.2 - (1.42 / 2 + 1.42 / 4), "Destination door must open");
const doorColliderAtDestination = world.colliders.find(collider =>
  collider.floor === 2 &&
  Math.abs(collider.minX - (2.2 - 1.42 / 2)) < EPSILON &&
  Math.abs(collider.maxX - (2.2 + 1.42 / 2)) < EPSILON &&
  Math.abs(collider.minZ - (-22.52 - 0.12 / 2)) < EPSILON
);
assert.ok(doorColliderAtDestination, "Destination-floor elevator door collider is missing.");
assert.equal(doorColliderAtDestination.active, false, "Destination-floor door must be passable while open.");
state.onElevatorMoved(0);
closeTo(liftCabinFloor.position.y, initialCabinY, "Elevator cabin returns to the ground floor");

// Extract the exact transformed corners of every mesh from the generated scene.
scene.updateMatrixWorld(true);
let nextPointIndex = 0;
const points = [];
const meshRecords = meshes.map((mesh, meshIndex) => {
  const corners = getWorldCorners(mesh);
  const centerWorld = new THREE.Vector3();
  mesh.getWorldPosition(centerWorld);
  const size = localSize(mesh);
  const firstPoint = nextPointIndex;
  for (const corner of corners) {
    points.push({
      pointId: `P${String(nextPointIndex + 1).padStart(6, "0")}`,
      meshId: `M${String(meshIndex + 1).padStart(5, "0")}`,
      meshName: mesh.name || "(unnamed mesh)",
      vertexIndex: corner.vertexIndex,
      world: corner.world,
      buildingLocal: corner.local
    });
    nextPointIndex++;
  }
  return {
    meshId: `M${String(meshIndex + 1).padStart(5, "0")}`,
    name: mesh.name || "(unnamed mesh)",
    primitive: mesh.geometry.type,
    positionWorld: vec3(centerWorld.x, centerWorld.y, centerWorld.z),
    positionBuildingLocal: vec3(
      centerWorld.x - BUILDING_ORIGIN.x,
      centerWorld.y - BUILDING_ORIGIN.y,
      centerWorld.z - BUILDING_ORIGIN.z
    ),
    sizeLocal: size,
    rotationRadians: vec3(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z),
    boundsWorld: boundsFromCorners(corners),
    firstPointIndex: firstPoint,
    pointCount: corners.length
  };
});

const csvRows = [
  ["point_id","mesh_id","mesh_name","vertex_index","world_x","world_y","world_z","building_x","building_y","building_z"].join(",")
];
for (const point of points) {
  csvRows.push([
    point.pointId, point.meshId, point.meshName, point.vertexIndex,
    point.world.x, point.world.y, point.world.z,
    point.buildingLocal.x, point.buildingLocal.y, point.buildingLocal.z
  ].map(csvCell).join(","));
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  generator: "tools/export-building-coordinates.mjs",
  sourceGeometry: "src/game/main-building.js",
  coordinateSystem: {
    units: "metres",
    handedness: "Three.js right-handed world coordinates",
    worldOrigin: { x: 0, y: 0, z: 0 },
    buildingLocalOriginWorld: BUILDING_ORIGIN,
    axes: {
      x: "horizontal width; negative and positive sides of the facade",
      y: "vertical height; finished ground-floor level is y=0",
      z: "depth; front entrance facade is at z=-16 and faces toward positive Z; rear facade is at z=-28"
    },
    buildingLocalTransform: "buildingX=worldX, buildingY=worldY, buildingZ=worldZ+22"
  },
  designDimensions: {
    storeys: FLOOR_COUNT,
    floorToFloor: FLOOR_HEIGHT,
    buildingNominalWidth: 28,
    buildingNominalDepth: 12,
    buildingFootprintWorld: { minX: -14, maxX: 14, minZ: -28, maxZ: -16 },
    buildingRoofLevel: FLOOR_COUNT * FLOOR_HEIGHT,
    facadeWallThickness: 0.28,
    floorSlabThickness: 0.16,
    windowCentersX: [-11.4, -8.15, -4.9, -1.65, 1.65, 4.9, 8.15, 11.4],
    windowWidth: 1.36,
    normalWindowSill: 0.78,
    windowHead: 2.28,
    balconyDoorSill: 0.04,
    groundEntranceWidth: 1.82,
    groundEntranceHeight: 2.5,
    coreOpening: { minX: -3.8, maxX: 3.8, minZ: -26, maxZ: -22.52 },
    stairs: {
      xMin: -3.2, xMax: -0.8,
      lowerRunCenterZ: -25.1, upperRunCenterZ: -23.1,
      flightsPerStorey: 2, treadsPerFlight: 8,
      treadRun: 0.3, risePerTread: 0.175,
      intermediateLandingX: { min: -0.8, max: 0.48 },
      intermediateLandingZ: { min: -25.68, max: -22.52 }
    },
    elevator: {
      centerX: 2.2, minX: 1.05, maxX: 3.35,
      rearZ: -25, frontZ: -22.52,
      shaftWidth: 2.3, shaftDepth: 2.48,
      doorWidth: 1.42, doorHeight: 2.1
    },
    interactionPoints: world.interactables.map(item => ({
      id: item.id, name: item.name,
      x: rounded(item.x), z: rounded(item.z), range: rounded(item.range)
    }))
  },
  validation: {
    status: "passed",
    assertions: [
      "Expected storey slab segments, stair treads and landings exist",
      "Ground slab and roof equipment meet their intended levels",
      "Stair landing, lift threshold and corridor slab edge align in Z",
      "Approach path and entrance platform touch without a gap",
      "Open entrance and balcony-door openings are not blocked by a cross-pane",
      "Elevator cabin, landing doors and door collision move together by floor"
    ]
  },
  counts: {
    meshCount: meshRecords.length,
    uniqueCornerPointCount: points.length,
    storeys: FLOOR_COUNT,
    floorSlabGroups: 1 + FLOOR_COUNT,
    balconyDecks: findMeshes("Balkon / betonová deska").length,
    lowerStairTreads: findMeshes("Schodiště / dolní rameno / stupeň").length,
    upperStairTreads: findMeshes("Schodiště / horní rameno / stupeň").length,
    intermediateLandings: findMeshes("Schodiště / mezipodesta").length,
    elevatorDoorPanels: findMeshes("Výtah / otevřené dveře").length + findMeshes("Výtah / dveře patra").length,
    colliderCount: world.colliders.length,
    interactableCount: world.interactables.length
  },
  method: "Each BoxGeometry is represented by its eight unique geometric corners transformed into world coordinates. Three.js stores duplicated per-face vertices for normal/UV seams; duplicates at the same corner are reported once per mesh. All positions are rounded to 1 micrometre (six decimal places).",
  meshes: meshRecords,
  points,
  colliders: world.colliders.map((collider, index) => ({
    colliderId: `C${String(index + 1).padStart(5, "0")}`,
    ...Object.fromEntries(Object.entries(collider).map(([key, value]) => [
      key, typeof value === "number" ? rounded(value) : value
    ]))
  }))
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(JSON_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
await writeFile(CSV_PATH, csvRows.join("\n") + "\n", "utf8");

console.log(`Coordinate export passed: ${manifest.counts.meshCount} meshes, ${manifest.counts.uniqueCornerPointCount} unique corner points, ${manifest.counts.colliderCount} collider volumes.`);
console.log(`JSON: ${path.relative(ROOT, JSON_PATH)}`);
console.log(`CSV:  ${path.relative(ROOT, CSV_PATH)}`);

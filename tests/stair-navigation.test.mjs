import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createMainBuildingWorld } from "../src/game/main-building.js";
import { createPlayerController } from "../src/game/player.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playerSource = readFileSync(path.join(root, "src/game/player.js"), "utf8");
const buildingSource = readFileSync(path.join(root, "src/game/main-building.js"), "utf8");
const mainSource = readFileSync(path.join(root, "src/main.js"), "utf8");

const navigation = {
  floorHeight: 2.8,
  floors: 8,
  coreOpening: { minX: -4.0, maxX: 3.8, minZ: -26.0, maxZ: -22.35 },
  stairs: {
    lowX: -3.2, highX: -0.8, firstZ: -25.1, secondZ: -23.1, steps: 8,
    stepRise: 0.175, stepRun: 0.3, treadDepth: 1.16, treadOverlap: 0.025,
    treadWidth: 0.325, landingWidth: 1.8375, landingDepth: 3.16,
    landingCenterX: 0.13125, landingCenterZ: -24.1,
    floorLanding: { minX: -3.93, maxX: -3.2125, minZ: -26.0, maxZ: -22.35 }
  }
};

function makeController(start = { x: 0, z: 9.2, elevation: 0, floor: 0 }) {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: start.floor };
  const ui = { updateObjective() {}, showToast() {} };
  const scene = new THREE.Scene();
  const world = createMainBuildingWorld({ THREE, scene, state, ui });
  const liveNavigation = world.navigation;
  const controller = createPlayerController({
    camera, colliders: world.colliders, interactables: world.interactables,
    state, ui, navigation: liveNavigation
  });
  Object.assign(controller.player, start);
  controller.player.jumpHeight = 0;
  controller.player.onStairs = false;
  controller.player.yaw = 0;
  return { controller, camera, state, world, navigation: liveNavigation };
}

function walk(controller, code, frames, step = 1 / 60) {
  controller.keysDown[code] = true;
  for (let i = 0; i < frames; i++) controller.update(step);
  controller.keysDown[code] = false;
}

test("building shares its real stair and core coordinates with the controller", () => {
  assert.match(buildingSource, /navigation,/);
  assert.match(buildingSource, /stepRise,/);
  assert.match(buildingSource, /const landingStartX = stair\.highX \+ stairTreadOverlap \/ 2/);
  assert.match(mainSource, /navigation: world\.navigation/);
  assert.match(playerSource, /player\.elevation \+ 1\.68/);
});

test("the intermediate landing meets the flight ends instead of overlapping several treads", () => {
  assert.match(buildingSource, /mezipodesta", landingCenterX/);
  assert.match(playerSource, /const landingMinX = stair\.landingCenterX - stair\.landingWidth \/ 2/);
});

test("walking the lower flight, landing, then upper flight moves the player up one real storey with real wall colliders", () => {
  const { controller, state, world, navigation: liveNavigation } = makeController({
    x: navigation.stairs.lowX, z: navigation.stairs.firstZ, elevation: 0, floor: 0
  });

  assert.equal(world.colliders.length > 5, true, "the fixture must use architectural collision volumes, not an empty collider list");
  assert.equal(liveNavigation.stairs.landingDepth, 3.16);
  walk(controller, "KeyD", 40);
  assert.ok(Math.abs(controller.player.x - navigation.stairs.highX) < 0.02);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);
  assert.equal(controller.player.onStairs, true);

  walk(controller, "KeyS", 33);
  assert.ok(Math.abs(controller.player.z - navigation.stairs.secondZ) < 0.08);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyA", 40);
  assert.ok(Math.abs(controller.player.x - navigation.stairs.lowX) < 0.02);
  assert.ok(Math.abs(controller.player.elevation - 2.8) < 0.03);
  assert.equal(controller.player.floor, 1);
  assert.equal(state.currentFloor, 1);
});

test("the same two flights can be walked down to the previous storey", () => {
  const { controller, state } = makeController({
    x: navigation.stairs.lowX, z: navigation.stairs.secondZ, elevation: 2.8, floor: 1
  });

  walk(controller, "KeyD", 40);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyW", 33);
  assert.ok(Math.abs(controller.player.z - navigation.stairs.firstZ) < 0.08);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyA", 40);
  assert.ok(Math.abs(controller.player.x - navigation.stairs.lowX) < 0.02);
  assert.ok(Math.abs(controller.player.elevation) < 0.03);
  assert.equal(controller.player.floor, 0);
  assert.equal(state.currentFloor, 0);
});

test("the open stairwell has no walkable support away from the stairs or landing", () => {
  const { controller } = makeController({ x: 0, z: -24.1, elevation: 2.8, floor: 1 });
  const before = { x: controller.player.x, z: controller.player.z };
  walk(controller, "KeyW", 20);
  assert.equal(controller.player.x, before.x);
  assert.equal(controller.player.z, before.z);
  assert.equal(controller.player.elevation, 2.8);
});


test("the runtime stairwell has actual enclosing walls and clear openings at both flight ends", () => {
  const { world, navigation: live } = makeController();
  const stair = live.stairs;
  const walls = world.meshes.filter(mesh => mesh.name === "Schodiště / stěna jádra");
  const liftSideWalls = world.meshes.filter(mesh => /Schodiště \/ stěna jádra u výtahu/.test(mesh.name));
  const lintels = world.meshes.filter(mesh => mesh.name === "Schodiště / nadpraží otvoru");
  const balusters = world.meshes.filter(mesh => mesh.name === "Schodiště / svislý sloupek zábradlí");
  assert.ok(walls.length >= live.floors * 3 - 2, "stairwell needs continuous wall segments on each storey");
  assert.equal(liftSideWalls.length, 2, "lift shaft side must close the stairwell at the rear and front edges");
  assert.equal(lintels.length, (live.floors - 1) * 2, "seven storey changes need fourteen headed doorway openings");
  assert.ok(balusters.length >= (live.floors - 1) * (stair.steps + 1) * 4);
  const passages = [
    ...Array.from({ length: live.floors - 1 }, (_, floor) => ({ z: stair.firstZ, floor })),
    ...Array.from({ length: live.floors - 1 }, (_, i) => ({ z: stair.secondZ, floor: i + 1 }))
  ];
  for (const { z, floor } of passages) {
    const openingBottom = floor * live.floorHeight;
    const openingTop = openingBottom + 2.12;
    const coveredByWall = walls.some(wall => {
      if (Math.abs(wall.position.x - live.coreOpening.minX) > 1e-6) return false;
      const wallHeight = wall.geometry.parameters.height;
      const wallBottom = wall.position.y - wallHeight / 2;
      const wallTop = wall.position.y + wallHeight / 2;
      if (wallTop <= openingBottom + 1e-5 || wallBottom >= openingTop - 1e-5) return false;
      const halfDepth = wall.geometry.parameters.depth / 2;
      return wall.position.z - halfDepth < z + stair.treadDepth / 2 - 1e-5 &&
        wall.position.z + halfDepth > z - stair.treadDepth / 2 + 1e-5;
    });
    assert.equal(coveredByWall, false,
      "a stairwell wall must not overlap the floor-level passage at floor=" + floor + ", z=" + z);
  }
});

test("the intermediate platform meets the last lower tread and the lift-side wall exactly", () => {
  const { world, navigation: live } = makeController();
  const stair = live.stairs;
  const lowerTreads = world.meshes.filter(mesh => mesh.name === "Schodiště / dolní rameno / stupeň");
  const landing = world.meshes.find(mesh => mesh.name === "Schodiště / mezipodesta");
  assert.equal(lowerTreads.length, (live.floors - 1) * stair.steps);
  const last = lowerTreads[stair.steps - 1];
  const lowerTreadEnd = last.position.x + last.geometry.parameters.width / 2;
  const landingStart = landing.position.x - landing.geometry.parameters.width / 2;
  const landingEnd = landing.position.x + landing.geometry.parameters.width / 2;
  const liftLeftInnerFace = 2.2 - 2.3 / 2 + 0.12;
  assert.ok(Math.abs(lowerTreadEnd - landingStart) < 1e-6, "there must be no overlap or slit at the tread/landing joint");
  assert.ok(Math.abs(landingEnd - liftLeftInnerFace) < 1e-6, "landing must meet the inner face of the lift wall");
  assert.equal(landing.geometry.parameters.depth, Math.abs(stair.firstZ - stair.secondZ) + stair.treadDepth);
});

test("the storey-level connector platform remains walkable between the two floor-level ends", () => {
  const { controller, navigation: live } = makeController({
    x: (liveFloorLanding => (liveFloorLanding.minX + liveFloorLanding.maxX) / 2)(navigation.stairs.floorLanding),
    z: navigation.stairs.secondZ, elevation: 2.8, floor: 1
  });
  const startZ = controller.player.z;
  walk(controller, "KeyW", 30);
  assert.ok(controller.player.z < startZ - 1.0, "the connecting floor platform must allow movement between the stair ends");
  assert.equal(controller.player.elevation, 2.8, "the connector is a level landing, not a half-storey surface");
});


test("the top-floor connector remains supported at the eighth-floor datum", () => {
  const { controller, navigation: live } = makeController({
    x: (navigation.stairs.floorLanding.minX + navigation.stairs.floorLanding.maxX) / 2,
    z: navigation.stairs.secondZ, elevation: 7 * navigation.floorHeight, floor: 7
  });
  const startingElevation = controller.player.elevation;
  walk(controller, "KeyW", 25);
  assert.ok(controller.player.z < navigation.stairs.secondZ - 1.0);
  assert.equal(controller.player.elevation, startingElevation);
  assert.equal(controller.player.floor, 7);
});

test("teleport-based floor changes still reset foot elevation and the jump state", () => {
  const { controller, state } = makeController();
  controller.player.jumpHeight = 0.8;
  controller.goToFloor(3, "Výtah");
  assert.equal(controller.player.floor, 3);
  assert.ok(Math.abs(controller.player.elevation - 8.4) < 1e-9);
  assert.equal(controller.player.jumpHeight, 0);
  assert.equal(state.currentFloor, 3);
});

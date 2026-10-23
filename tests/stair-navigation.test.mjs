import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPlayerController } from "../src/game/player.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playerSource = readFileSync(path.join(root, "src/game/player.js"), "utf8");
const buildingSource = readFileSync(path.join(root, "src/game/main-building.js"), "utf8");
const mainSource = readFileSync(path.join(root, "src/main.js"), "utf8");

const navigation = {
  floorHeight: 2.8,
  floors: 8,
  coreOpening: { minX: -3.8, maxX: 3.8, minZ: -26.0, maxZ: -22.52 },
  stairs: {
    lowX: -3.2, highX: -0.8, firstZ: -25.1, secondZ: -23.1, steps: 8,
    stepRise: 0.175, stepRun: 0.3, treadDepth: 1.16, treadOverlap: 0.025,
    landingWidth: 1.28, landingDepth: 3.16,
    landingCenterX: -0.16, landingCenterZ: -24.1
  }
};

function makeController(start = { x: 0, z: 9.2, elevation: 0, floor: 0 }) {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: start.floor };
  const ui = { updateObjective() {}, showToast() {} };
  const controller = createPlayerController({ camera, colliders: [], interactables: [], state, ui, navigation });
  Object.assign(controller.player, start);
  controller.player.jumpHeight = 0;
  controller.player.onStairs = false;
  controller.player.yaw = 0;
  return { controller, camera, state };
}

function walk(controller, code, frames, step = 1 / 60) {
  controller.keysDown[code] = true;
  for (let i = 0; i < frames; i++) controller.update(step);
  controller.keysDown[code] = false;
}

test("building shares its real stair and core coordinates with the controller", () => {
  assert.match(buildingSource, /navigation,/);
  assert.match(buildingSource, /stepRise,/);
  assert.match(buildingSource, /landingCenterX: stair\.highX \+ 1\.28 \/ 2/);
  assert.match(mainSource, /navigation: world\.navigation/);
  assert.match(playerSource, /player\.elevation \+ 1\.68/);
});

test("the intermediate landing meets the flight ends instead of overlapping several treads", () => {
  assert.match(buildingSource, /mezipodesta", stair\.highX \+ landingWidth \/ 2/);
  assert.match(playerSource, /const landingMinX = stair\.landingCenterX - stair\.landingWidth \/ 2/);
});

test("walking the lower flight, landing, then upper flight moves the player up one real storey", () => {
  const { controller, state } = makeController({
    x: navigation.stairs.lowX, z: navigation.stairs.firstZ, elevation: 0, floor: 0
  });

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

test("teleport-based floor changes still reset foot elevation and the jump state", () => {
  const { controller, state } = makeController();
  controller.player.jumpHeight = 0.8;
  controller.goToFloor(3, "Výtah");
  assert.equal(controller.player.floor, 3);
  assert.ok(Math.abs(controller.player.elevation - 8.4) < 1e-9);
  assert.equal(controller.player.jumpHeight, 0);
  assert.equal(state.currentFloor, 3);
});

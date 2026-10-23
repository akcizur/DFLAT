import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createMainBuildingWorld } from "../src/game/main-building.js";
import { createPlayerController } from "../src/game/player.js";

function makeFixture(start = { x: 0, z: 9.2, elevation: 0, floor: 0 }) {
  const scene = new THREE.Scene();
  const state = { currentFloor: start.floor, started: true, paused: false, mainBuildingScene: true };
  const ui = { updateObjective() {}, showToast() {} };
  const world = createMainBuildingWorld({ THREE, scene, state, ui });
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const controller = createPlayerController({
    camera,
    colliders: [],
    interactables: world.interactables,
    state,
    ui,
    navigation: world.navigation
  });
  Object.assign(controller.player, start);
  controller.player.jumpHeight = 0;
  controller.player.onStairs = false;
  controller.player.yaw = 0;
  return { world, controller, state, camera };
}

function walk(controller, code, frames, step = 1 / 60) {
  controller.keysDown[code] = true;
  for (let i = 0; i < frames; i++) controller.update(step);
  controller.keysDown[code] = false;
}

test("the player controller uses the runtime staircase dimensions", () => {
  const { world } = makeFixture();
  const stair = world.navigation.stairs;
  assert.equal(world.navigation.floors, 4);
  assert.equal(stair.stepRise, 0.175);
  assert.equal(stair.stepRun, 0.225);
  assert.equal(stair.landingCenterX, stair.highX + stair.landingWidth / 2);
  assert.equal(stair.landingCenterZ, (stair.firstZ + stair.secondZ) / 2);
  assert.ok(Math.abs(stair.landingDepth - (Math.abs(stair.firstZ - stair.secondZ) + stair.treadDepth)) < 1e-9);
});

test("walking both flights and the shared landing raises the player one storey", () => {
  const { world, controller, state } = makeFixture({ x: -1.35, z: -25.3, elevation: 0, floor: 0 });
  const stair = world.navigation.stairs;
  walk(controller, "KeyD", Math.ceil((stair.highX - stair.lowX) / 3.6 * 60));
  assert.ok(Math.abs(controller.player.x - stair.highX) < 0.08);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);
  assert.equal(controller.player.onStairs, true);

  walk(controller, "KeyS", Math.ceil((stair.secondZ - stair.firstZ) / 3.6 * 60));
  assert.ok(Math.abs(controller.player.z - stair.secondZ) < 0.08);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyA", Math.ceil((stair.highX - stair.lowX) / 3.6 * 60));
  assert.ok(Math.abs(controller.player.x - stair.lowX) < 0.08);
  assert.ok(Math.abs(controller.player.elevation - 2.8) < 0.03);
  assert.equal(controller.player.floor, 1);
  assert.equal(state.currentFloor, 1);
});

test("the same staircase can be walked down to the previous storey", () => {
  const { world, controller, state } = makeFixture({ x: -1.35, z: -21.8, elevation: 2.8, floor: 1 });
  const stair = world.navigation.stairs;
  walk(controller, "KeyD", Math.ceil((stair.highX - stair.lowX) / 3.6 * 60));
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyW", Math.ceil((stair.secondZ - stair.firstZ) / 3.6 * 60));
  assert.ok(Math.abs(controller.player.z - stair.firstZ) < 0.08);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyA", Math.ceil((stair.highX - stair.lowX) / 3.6 * 60));
  assert.ok(Math.abs(controller.player.x - stair.lowX) < 0.08);
  assert.ok(Math.abs(controller.player.elevation) < 0.03);
  assert.equal(controller.player.floor, 0);
  assert.equal(state.currentFloor, 0);
});

test("the open stair core has no floor support away from the steps and landing", () => {
  const { controller } = makeFixture({ x: 0, z: -23.55, elevation: 2.8, floor: 1 });
  const before = { x: controller.player.x, z: controller.player.z };
  walk(controller, "KeyW", 20);
  assert.equal(controller.player.x, before.x);
  assert.equal(controller.player.z, before.z);
  assert.equal(controller.player.elevation, 2.8);
});

test("the building has three stair transitions and no elevator interaction", () => {
  const { world } = makeFixture();
  const lowerTreads = world.meshes.filter(mesh => mesh.name === "Schodiště / dolní rameno / stupeň");
  const upperTreads = world.meshes.filter(mesh => mesh.name === "Schodiště / horní rameno / stupeň");
  assert.equal(lowerTreads.length, 24);
  assert.equal(upperTreads.length, 24);
  assert.equal(world.interactables.some(item => item.id === "stairs"), true);
  assert.equal(world.interactables.some(item => item.id === "elevator"), false);
});

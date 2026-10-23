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
    colliders: world.colliders,
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
  assert.equal(stair.landingCenterX, stair.highX + stair.treadOverlap / 2 + stair.landingWidth / 2);
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


test("the stair core walls have clear doorways at both flight ends on each storey", () => {
  const { world } = makeFixture();
  const stair = world.navigation.stairs;
  const walls = world.meshes.filter(mesh => mesh.name === "Schodiště / stěna jádra");
  assert.ok(walls.length > 8, "two continuous stairwell side walls must exist on every storey");
  for (const x of [-1.8, 1.8]) {
    for (const z of [stair.firstZ, stair.secondZ]) {
      const blocked = walls.some(wall => {
        if (Math.abs(wall.position.x - x) > 1e-5) return false;
        const minZ = wall.position.z - wall.geometry.parameters.depth / 2;
        const maxZ = wall.position.z + wall.geometry.parameters.depth / 2;
        return minZ < z + stair.treadDepth / 2 - 1e-5 &&
          maxZ > z - stair.treadDepth / 2 + 1e-5;
      });
      assert.equal(blocked, false, "stairwell wall blocks the stair entrance at x=" + x + ", z=" + z);
    }
  }
  for (const wall of walls) {
    assert.equal(wall.geometry.parameters.height, world.navigation.floorHeight - 0.16,
      "stairwell wall should meet the underside of the next floor slab");
  }
});

test("the intermediate landing meets the final lower tread and the inner wall face without a gap", () => {
  const { world } = makeFixture();
  const stair = world.navigation.stairs;
  const lower = world.meshes.filter(mesh => mesh.name === "Schodiště / dolní rameno / stupeň");
  const landing = world.meshes.find(mesh => mesh.name === "Schodiště / mezipodesta");
  const finalLowerTread = lower[7];
  const treadEnd = finalLowerTread.position.x + finalLowerTread.geometry.parameters.width / 2;
  const landingStart = landing.position.x - landing.geometry.parameters.width / 2;
  const landingEnd = landing.position.x + landing.geometry.parameters.width / 2;
  const innerWallFace = world.navigation.coreOpening.maxX - 0.28 / 2;
  assert.ok(Math.abs(treadEnd - landingStart) < 1e-6, "the last step and landing must meet without overlapping coplanar tops");
  assert.ok(Math.abs(landingEnd - innerWallFace) < 1e-6, "landing must reach the inside face of the concrete wall");
  assert.equal(stair.landingWidth, landing.geometry.parameters.width);
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

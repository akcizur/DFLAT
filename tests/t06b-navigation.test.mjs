import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerController } from "../src/game/player.js";

const navigation = {
  floorHeight: 2.8,
  floors: 4,
  coreOpening: { minX: -1.5, maxX: 1.5, minZ: -24.2, maxZ: -19.8 },
  stairs: {
    lowX: -1.5, highX: 0.9, firstZ: -21.2, secondZ: -23.5, steps: 8,
    stepRise: 0.175, stepRun: 0.3, treadDepth: 1.2, treadOverlap: 0.025,
    landingWidth: 0.6, landingDepth: 4.3,
    landingCenterX: 1.2, landingCenterZ: -22.0
  }
};

function makeController(start = { x: 0, z: 9.2, elevation: 0, floor: 0 }) {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: start.floor };
  const ui = { updateObjective() {}, showToast() {} };
  const controller = createPlayerController({
    camera, colliders: [], interactables: [], state, ui, navigation
  });
  Object.assign(controller.player, start);
  controller.player.jumpHeight = 0;
  controller.player.onStairs = false;
  controller.player.yaw = 0;
  return { controller, state };
}

function walk(controller, code, frames, dt = 1/60) {
  controller.keysDown[code] = true;
  for (let i = 0; i < frames; i++) controller.update(dt);
  controller.keysDown[code] = false;
}

test("T06B lower flight, half-storey landing and upper flight connect floor 0 to floor 1", () => {
  const { controller, state } = makeController({
    x: navigation.stairs.lowX, z: navigation.stairs.firstZ, elevation: 0, floor: 0
  });
  walk(controller, "KeyD", 40);
  assert.ok(Math.abs(controller.player.x - navigation.stairs.highX) < 0.03);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);
  assert.equal(controller.player.onStairs, true);

  walk(controller, "KeyW", 38);
  assert.ok(Math.abs(controller.player.z - navigation.stairs.secondZ) < 0.10);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyA", 40);
  assert.ok(Math.abs(controller.player.x - navigation.stairs.lowX) < 0.03);
  assert.ok(Math.abs(controller.player.elevation - 2.8) < 0.03);
  assert.equal(controller.player.floor, 1);
  assert.equal(state.currentFloor, 1);
});

test("T06B upper flight, landing and lower flight connect floor 1 back to floor 0", () => {
  const { controller, state } = makeController({
    x: navigation.stairs.lowX, z: navigation.stairs.secondZ, elevation: 2.8, floor: 1
  });
  walk(controller, "KeyD", 40);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyS", 38);
  assert.ok(Math.abs(controller.player.z - navigation.stairs.firstZ) < 0.10);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);

  walk(controller, "KeyA", 40);
  assert.ok(Math.abs(controller.player.x - navigation.stairs.lowX) < 0.03);
  assert.ok(Math.abs(controller.player.elevation) < 0.03);
  assert.equal(controller.player.floor, 0);
  assert.equal(state.currentFloor, 0);
});

test("T06B four-storey navigation blocks unsupported movement through the central void", () => {
  const { controller } = makeController({ x: 0, z: -22.0, elevation: 2.8, floor: 1 });
  const before = { x: controller.player.x, z: controller.player.z, elevation: controller.player.elevation };
  walk(controller, "KeyW", 20);
  assert.deepEqual(
    { x: controller.player.x, z: controller.player.z, elevation: controller.player.elevation },
    before
  );
});

test("T06B stair landing spans both flight lanes but not the outer apartment floor", () => {
  const { controller } = makeController({
    x: navigation.stairs.highX, z: navigation.stairs.firstZ, elevation: 1.4, floor: 0
  });
  walk(controller, "KeyW", 20);
  assert.ok(controller.player.z < navigation.stairs.firstZ);
  assert.ok(Math.abs(controller.player.elevation - 1.4) < 0.03);
});

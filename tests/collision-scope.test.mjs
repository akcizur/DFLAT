import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerController } from "../src/game/player.js";

const navigation = {
  floorHeight: 2.8,
  floors: 8,
  coreOpening: { minX: -3.8, maxX: 3.8, minZ: -26, maxZ: -22.52 },
  stairs: {
    lowX: -3.2, highX: -0.8, firstZ: -25.1, secondZ: -23.1, steps: 8,
    stepRise: 0.175, stepRun: 0.3, treadDepth: 1.16, treadOverlap: 0.025,
    landingWidth: 1.28, landingDepth: 3.16,
    landingCenterX: -0.16, landingCenterZ: -24.1
  }
};

function makeController(collider) {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: 0 };
  const ui = { updateObjective() {}, showToast() {} };
  const controller = createPlayerController({
    camera, colliders: [collider], interactables: [], state, ui, navigation
  });
  controller.player.yaw = 0;
  return controller;
}

function walkBackward(controller, frames = 40) {
  controller.keysDown.KeyS = true;
  for (let i = 0; i < frames; i++) controller.update(1 / 60);
  controller.keysDown.KeyS = false;
}

const wall = {
  minX: -1, maxX: 1,
  minZ: 10, maxZ: 10.6
};

test("colliders from another storey do not block the current floor", () => {
  const controller = makeController({ ...wall, floor: 1, active: true });
  walkBackward(controller);
  assert.ok(controller.player.z > 10.6, `player stopped at z=${controller.player.z}`);
});

test("inactive lift-door colliders leave the open doorway passable", () => {
  const controller = makeController({ ...wall, floor: 0, active: false });
  walkBackward(controller);
  assert.ok(controller.player.z > 10.6, `player stopped at z=${controller.player.z}`);
});

test("active colliders on the current floor still stop the player", () => {
  const controller = makeController({ ...wall, floor: 0, active: true });
  walkBackward(controller);
  assert.ok(controller.player.z < 9.75, `player crossed a closed collider at z=${controller.player.z}`);
  assert.ok(controller.player.z > 9.2, "player should approach the wall before being stopped");
});

test("unscoped architectural colliders remain active on every floor", () => {
  const controller = makeController(wall);
  walkBackward(controller);
  assert.ok(controller.player.z < 9.75, `player crossed a static wall at z=${controller.player.z}`);
});

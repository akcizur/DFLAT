import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerController } from "../src/game/player.js";

function makeController() {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const ui = { updateObjective() {}, showToast() {} };
  return createPlayerController({ camera, colliders: [], interactables: [], state: { started: true, paused: false, currentFloor: 0 }, ui });
}

test("empty map has no stair navigation and the compatibility elevator action is inert", () => {
  const controller = makeController();
  controller.goToFloor(7);
  assert.equal(controller.player.elevation, 0);
  controller.keysDown.KeyW = true;
  const z = controller.player.z;
  controller.update(1 / 60);
  assert.notEqual(controller.player.z, z);
  assert.equal(controller.player.elevation, 0);
});

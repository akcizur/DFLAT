import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerController } from "../src/game/player.js";

function makeController() {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: 0 };
  const ui = { updateObjective() {}, showToast() {} };
  return { controller: createPlayerController({ camera, colliders: [], interactables: [], state, ui }), camera, state };
}

function advance(controller, frames = 30) {
  for (let i = 0; i < frames; i++) controller.update(1 / 60);
}

test("idle stance has subtle breathing camera movement", () => {
  const { controller, camera } = makeController();
  const values = [];
  for (let i = 0; i < 180; i++) { controller.update(1 / 60); values.push(camera.position.y); }
  const range = Math.max(...values) - Math.min(...values);
  assert.ok(range > 0.006 && range < 0.03, "breathing should remain subtle");
});

test("running produces a stronger forward posture than walking", () => {
  const walking = makeController();
  walking.controller.keysDown.KeyW = true;
  advance(walking.controller, 30);
  const running = makeController();
  running.controller.keysDown.KeyW = true;
  running.controller.keysDown.ShiftLeft = true;
  advance(running.controller, 30);
  assert.ok(running.camera.rotation.x > walking.camera.rotation.x);
  assert.ok(running.controller.player.z < 9.2);
  assert.ok(walking.controller.player.z < 9.2);
});

test("strafing adds a small body roll and settles when movement stops", () => {
  const { controller, camera } = makeController();
  controller.keysDown.KeyD = true;
  advance(controller, 24);
  assert.ok(camera.rotation.z < -0.01);
  controller.keysDown.KeyD = false;
  advance(controller, 75);
  assert.ok(Math.abs(camera.rotation.z) < 0.004);
});

test("open-map movement stays at ground elevation", () => {
  const { controller, camera } = makeController();
  controller.keysDown.KeyW = true;
  advance(controller, 30);
  assert.equal(controller.player.elevation, 0);
  assert.equal(controller.player.elevation, 0);
  assert.equal(camera.rotation.z, 0);
});

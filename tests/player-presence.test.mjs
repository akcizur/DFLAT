import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createPlayerController } from "../src/game/player.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/game/player.js"), "utf8");

function makeController() {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: 0 };
  const ui = { updateObjective() {}, showToast() {} };
  const controller = createPlayerController({
    camera, colliders: [], interactables: [], state, ui
  });
  return { controller, camera, state };
}

function advance(controller, frames = 30) {
  for (let i = 0; i < frames; i++) controller.update(1 / 60);
}

test("idle stance has restrained breathing rather than a perfectly static camera", () => {
  const { controller, camera } = makeController();
  const values = [];
  for (let i = 0; i < 180; i++) {
    controller.update(1 / 60);
    values.push(camera.position.y);
  }
  const range = Math.max(...values) - Math.min(...values);
  assert.ok(range > 0.006, `expected subtle breathing movement, received ${range.toFixed(5)} m`);
  assert.ok(range < 0.03, `breathing should remain subtle, received ${range.toFixed(5)} m`);
});

test("running produces a stronger forward posture than normal walking", () => {
  const walking = makeController();
  walking.controller.keysDown.KeyW = true;
  advance(walking.controller, 30);

  const running = makeController();
  running.controller.keysDown.KeyW = true;
  running.controller.keysDown.ShiftLeft = true;
  advance(running.controller, 30);

  assert.ok(
    running.camera.rotation.x > walking.camera.rotation.x,
    "run posture should lean forward more than walking"
  );
  assert.ok(running.controller.player.z < 9.2);
  assert.ok(walking.controller.player.z < 9.2);
});

test("strafing adds a small body roll and returns to neutral when movement stops", () => {
  const { controller, camera } = makeController();
  controller.keysDown.KeyD = true;
  advance(controller, 24);
  assert.ok(camera.rotation.z < -0.01, "right strafe should produce a restrained lean");

  controller.keysDown.KeyD = false;
  advance(controller, 75);
  assert.ok(Math.abs(camera.rotation.z) < 0.004, "body roll should settle back to neutral");
});

test("camera posture is softly coupled to actual stair ascent and descent", () => {
  assert.match(source, /stairPitchTarget = player\.onStairs && Math\.abs\(elevationDelta\) > 0\.001/);
  assert.match(source, /elevationDelta > 0 \? -0\.018 : 0\.014/);
  assert.match(source, /cameraPitch \+ bodyLean \* 0\.60 \+ stairPitch/);
  assert.match(source, /const breathing = Math\.sin\(breathTime \* 1\.35\) \* 0\.008/);
});

test("posture state resets when the player changes floor", () => {
  const { controller, camera } = makeController();
  controller.keysDown.KeyW = true;
  controller.keysDown.ShiftLeft = true;
  advance(controller, 15);
  controller.goToFloor(2, "Výtah");
  assert.equal(controller.player.elevation, 5.6);
  assert.equal(camera.rotation.z, 0);
});

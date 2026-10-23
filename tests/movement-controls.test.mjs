import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPlayerController } from "../src/game/player.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputSource = readFileSync(path.join(root, "src/game/input.js"), "utf8");
const htmlSource = readFileSync(path.join(root, "index.html"), "utf8");

function createController() {
  const camera = {
    position: {
      x: 0, y: 0, z: 0,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: 0 };
  const ui = { updateObjective() {}, showToast() {} };
  const controller = createPlayerController({
    camera, colliders: [], interactables: [], state, ui
  });
  return { controller, camera, state };
}

test("walking uses the faster 3.6 m/s base speed", () => {
  const { controller } = createController();
  assert.equal(controller.player.speed, 3.6);
  controller.keysDown.KeyW = true;
  const beforeZ = controller.player.z;
  controller.update(0.1);
  assert.ok(beforeZ - controller.player.z > 0.34);
});

test("holding either Shift key gives a consistent 1.8x run multiplier", () => {
  const walk = createController().controller;
  walk.keysDown.KeyW = true;
  const walkStart = walk.player.z;
  walk.update(0.1);
  const walkDistance = walkStart - walk.player.z;

  const run = createController().controller;
  run.keysDown.KeyW = true;
  run.keysDown.ShiftLeft = true;
  const runStart = run.player.z;
  run.update(0.1);
  const runDistance = runStart - run.player.z;

  assert.ok(Math.abs(runDistance / walkDistance - 1.8) < 0.01);
  const rightShift = createController().controller;
  rightShift.keysDown.KeyW = true;
  rightShift.keysDown.ShiftRight = true;
  const startZ = rightShift.player.z;
  rightShift.update(0.1);
  assert.ok(Math.abs((startZ - rightShift.player.z) / walkDistance - 1.8) < 0.01);
});

test("Space jump has gravity, cannot be retriggered mid-air, and returns to ground", () => {
  const { controller, camera } = createController();
  assert.equal(controller.isGrounded, true);
  assert.equal(controller.jump(), true);
  assert.equal(controller.isGrounded, false);
  controller.update(1 / 60);
  assert.ok(controller.player.jumpHeight > 0);
  assert.ok(camera.position.y > 1.68);
  assert.equal(controller.jump(), false);

  for (let frame = 0; frame < 90; frame++) controller.update(1 / 60);
  assert.equal(controller.player.jumpHeight, 0);
  assert.equal(controller.isGrounded, true);
  assert.ok(Math.abs(camera.position.y - 1.68) < 0.02);
});

test("jump is disabled while paused or before gameplay starts", () => {
  const { controller, state } = createController();
  state.paused = true;
  assert.equal(controller.jump(), false);
  state.paused = false;
  state.started = false;
  assert.equal(controller.jump(), false);
});

test("keyboard input uses Space for jump and prevents page scrolling", () => {
  assert.match(inputSource, /event\.code === "Space"/);
  assert.match(inputSource, /controller\.jump\?\.\(\)/);
  assert.match(inputSource, /event\.preventDefault\(\);\n\s+if \(!event\.repeat && state\.started && !state\.paused\)/);
});

test("the game menu and HUD explain sprint and jump controls", () => {
  assert.match(htmlSource, /SHIFT <b>RUN<\/b>/);
  assert.match(htmlSource, /SPACE <b>JUMP<\/b>/);
  assert.match(htmlSource, /SHIFT \/ BĚH/);
  assert.match(htmlSource, /SPACE \/ SKOK/);
});

test("transient action keys are cleared when movement is reset", () => {
  assert.match(inputSource, /keysDown\.ShiftLeft = false/);
  assert.match(inputSource, /keysDown\.ShiftRight = false/);
  assert.match(inputSource, /keysDown\.Space = false/);
});

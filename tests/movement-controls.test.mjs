import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPlayerController } from "../src/game/player.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputSource = readFileSync(path.join(root, "src/game/input.js"), "utf8");
const htmlSource = readFileSync(path.join(root, "index.html"), "utf8");

function createController(navigation = null, colliders = []) {
  const camera = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const state = { started: true, paused: false, currentFloor: 0 };
  const ui = { updateObjective() {}, showToast() {} };
  return { controller: createPlayerController({ camera, colliders, interactables: [], state, ui, navigation }), camera, state };
}


test("imported-world spawn relocates the player and synchronizes the camera before play", () => {
  const { controller, camera } = createController({
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }
  });
  assert.equal(controller.setSpawn({ x: 4.95, z: 2.32, yaw: 0.25 }), true);
  assert.equal(controller.player.x, 4.95);
  assert.equal(controller.player.z, 2.32);
  assert.equal(controller.player.yaw, 0.25);
  assert.ok(Math.abs(camera.position.x - 4.95) < 1e-9);
  assert.ok(Math.abs(camera.position.z - 2.32) < 1e-9);
  assert.equal(camera.rotation.y, 0.25);
});

test("spawn relocation refuses points outside imported bounds or inside a collider", () => {
  const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const { controller } = createController(bounds, [
    { minX: 1, maxX: 3, minZ: 1, maxZ: 3 }
  ]);
  assert.equal(controller.setSpawn({ x: 12, z: 0 }), false);
  assert.equal(controller.setSpawn({ x: 2, z: 2 }), false);
  assert.equal(controller.player.x, 0);
  assert.equal(controller.player.z, 100);
});

test("walking uses the faster 3.6 m/s base speed on the open map", () => {
  const { controller } = createController();
  assert.equal(controller.player.speed, 3.6);
  controller.keysDown.KeyW = true;
  const beforeZ = controller.player.z;
  controller.update(0.1);
  assert.ok(beforeZ - controller.player.z > 0.34);
});

test("holding Shift produces a 1.8x run multiplier", () => {
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
  assert.ok(Math.abs((runStart - run.player.z) / walkDistance - 1.8) < 0.01);
});

test("Space jump rises, obeys gravity and lands back on the empty map", () => {
  const { controller, camera } = createController();
  assert.equal(controller.isGrounded, true);
  assert.equal(controller.jump(), true);
  controller.update(1 / 60);
  assert.ok(controller.player.jumpHeight > 0);
  assert.ok(camera.position.y > 1.68);
  assert.equal(controller.jump(), false);
  for (let frame = 0; frame < 90; frame++) controller.update(1 / 60);
  assert.equal(controller.player.jumpHeight, 0);
  assert.equal(controller.isGrounded, true);
});

test("jump is disabled while paused or before gameplay starts", () => {
  const { controller, state } = createController();
  state.paused = true;
  assert.equal(controller.jump(), false);
  state.paused = false;
  state.started = false;
  assert.equal(controller.jump(), false);
});

test("keyboard input binds Space to jump and prevents page scrolling", () => {
  assert.match(inputSource, /event\.code === "Space"/);
  assert.match(inputSource, /controller\.jump\?\.\(\)/);
  assert.match(inputSource, /event\.preventDefault\(\);\n\s+if \(!event\.repeat && state\.started && !state\.paused\)/);
});

test("menu and HUD identify run and jump controls", () => {
  assert.match(htmlSource, /SHIFT \/ BĚH/);
  assert.match(htmlSource, /SPACE \/ SKOK/);
});

test("transient movement keys are cleared on reset", () => {
  assert.match(inputSource, /keysDown\.ShiftLeft = false/);
  assert.match(inputSource, /keysDown\.ShiftRight = false/);
  assert.match(inputSource, /keysDown\.Space = false/);
});

test("touch joystick and action buttons keep independent input sources", () => {
  assert.match(inputSource, /touchStick: Object\.create\(null\)/);
  assert.match(inputSource, /touchButtons: Object\.create\(null\)/);
  assert.match(inputSource, /Object\.values\(sources\)\.some/);
  assert.match(inputSource, /setKey\("KeyW", y < -dead, "touchStick"\)/);
  assert.match(inputSource, /setKey\("ShiftLeft", true, "touchButtons"\)/);
});

test("touch controls release on pointer cancellation, lost capture and page lifecycle", () => {
  assert.match(inputSource, /moveStick\.addEventListener\("pointercancel", releaseStick\)/);
  assert.match(inputSource, /lookZone\.addEventListener\("pointercancel", endLook\)/);
  assert.match(inputSource, /runButton\?\.addEventListener\("pointercancel", releaseRun\)/);
  assert.match(inputSource, /window\.addEventListener\("pagehide", resetTransientInput\)/);
  assert.match(inputSource, /document\.addEventListener\("visibilitychange"/);
});

test("pausing or clearing input releases both active touch pointers", () => {
  assert.match(inputSource, /function clearMovement\(\)[\s\S]*?releaseStick\(\);[\s\S]*?endLook\(\);/);
  assert.match(inputSource, /function pauseGame\(\)[\s\S]*?clearMovement\(\);/);
});

test("one pointer owns each joystick and camera-look gesture", () => {
  assert.match(inputSource, /stickPointer !== null\) return/);
  assert.match(inputSource, /\|\| touchLook\) return/);
});

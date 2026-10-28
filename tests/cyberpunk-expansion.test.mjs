import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CYBERPUNK_LAYERS } from "../src/game/cyberpunk-expansion.js";

const playerSource = readFileSync(new URL("../src/game/player.js", import.meta.url), "utf8");
const inputSource = readFileSync(new URL("../src/game/input.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const expansionSource = readFileSync(new URL("../src/game/cyberpunk-expansion.js", import.meta.url), "utf8");

test("vertical city has ordered connected level definitions", () => {
  assert.deepEqual(CYBERPUNK_LAYERS.map(level => level.y), [0, 5.5, 11, 17]);
  assert.ok(CYBERPUNK_LAYERS.every(level => level.id && level.label));
});

test("expansion provides street cars, hover cars, flying cars and manipulable props", () => {
  assert.match(expansionSource, /type: "car"/);
  assert.match(expansionSource, /type: "hover"/);
  assert.match(expansionSource, /type: "flying"/);
  assert.match(expansionSource, /heldObject/);
  assert.match(expansionSource, /elevationTarget/);
});

test("camera switching and arcade vehicle movement are wired into existing controls", () => {
  assert.match(inputSource, /event\.code === "KeyV"/);
  assert.match(playerSource, /function toggleCameraMode\(\)/);
  assert.match(playerSource, /state\.vehicleType === "flying"/);
  assert.match(mainSource, /createCyberpunkExpansion\(/);
  assert.match(mainSource, /cyberpunk\.update\(deltaSeconds, controller\.player\)/);
});

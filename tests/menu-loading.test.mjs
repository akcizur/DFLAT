import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath => readFileSync(path.join(root, relativePath), "utf8");
const html = read("index.html");
const css = read("styles-cinematic.css");
const main = read("src/main.js");
const input = read("src/game/input.js");
const boot = read("boot.js");
const browserSmoke = read("scripts/smoke-browser.mjs");

test("the start screen is centered with a single-column menu layout", () => {
  assert.match(css, /#startScreen\.nexus-menu \.nexus-content\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /#startScreen\.nexus-menu \.nexus-menu\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(css, /#startScreen\.nexus-menu\s*\{[\s\S]*?animation-delay:\s*0s/);
  assert.match(html, /id="startButton"/);
});

test("loading screen communicates progress and has a responsive reduced-motion fallback", () => {
  assert.match(html, /id="loadingScreen"[^>]*role="status"/);
  assert.match(html, /role="progressbar"[^>]*id="loadingProgress"/);
  assert.match(html, /id="loadingProgressBar"/);
  assert.match(css, /\.loading-screen\s*\{[\s\S]*?place-items:\s*center/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("loading completes only after the first scene frame and panorama success or fallback", () => {
  assert.match(main, /function finishStartupWhenReady\(\)/);
  assert.match(main, /!firstSceneFrame \|\| !panoramaResolved/);
  assert.match(main, /const panoramaFallbackTimer/);
  assert.match(main, /firstSceneFrame = true/);
  assert.match(main, /state\.ready = true/);
  assert.match(main, /highestLoadingProgress/);
});

test("clicking, Enter and other inputs cannot start the game before readiness", () => {
  assert.match(input, /state\.started \|\| !state\.ready/);
  assert.match(boot, /window\.addEventListener\("keydown", dismissBoot, \{ once: true, capture: true \}\)/);
  assert.doesNotMatch(boot, /startButton.*click/);
  assert.match(browserSmoke, /waitForSelector\("#loadingScreen\[hidden\]"/);
});

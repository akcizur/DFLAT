import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "package.json",
  "vite.config.js",
  "index.html",
  "vendor/three.module.min.js",
  "vendor/THREE-LICENSE.txt",
  "styles.css",
  "styles-cinematic.css",
  "src/main.js",
  "src/boot-debug.js",
  "src/game/main-building.js",
  "src/game/player.js",
  "src/game/ui.js",
  "src/game/input.js"
];

function fail(message) {
  console.error("Architecture check failed: " + message);
  process.exitCode = 1;
}

for (const relativePath of required) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    fail("missing required file: " + relativePath);
  }
}

const html = await readFile(path.join(root, "index.html"), "utf8");
if (!/href="\.\/styles\.css(?:\?v=\d+)?"/.test(html)) fail("index.html must load styles.css");
if (!/src="\.\/src\/main\.js\?v=\d+"/.test(html)) fail("index.html must load src/main.js with a cache-busting version");
if (!html.includes('type="importmap"') || !html.includes('"three": "./vendor/three.module.min.js"')) {
  fail("static hosting fallback must map Three.js to the local vendored r169 module");
}
if (/<style(?:\s|>)/i.test(html)) fail("inline CSS remains in index.html");
if (/<script\b(?![^>]*\bsrc=)(?![^>]*\btype=["']importmap["'])[^>]*>/i.test(html)) fail("inline JavaScript remains in index.html");

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageJson.scripts?.build !== "vite build") fail("package.json must provide the Vite production build");
if (packageJson.dependencies?.three !== "0.169.0") fail("Three.js must be installed locally at the tested game-compatible version");
if (packageJson.devDependencies?.vite !== "6.4.5") fail("Vite must be installed as a local dev dependency at version 6.4.5");

const mainSource = await readFile(path.join(root, "src/main.js"), "utf8");
if (!html.includes('id="loadingScreen"') || !html.includes('id="loadingProgressBar"')) fail("a visible loading screen with progress must be present");
if (!html.includes('id="startButton" disabled aria-disabled="true"')) fail("Start must be disabled until the loading flow completes");
if (!mainSource.includes("function finishStartupWhenReady()") || !mainSource.includes("state.ready = true")) fail("Start must wait for the panorama and first rendered scene frame");
if (!mainSource.includes("firstSceneFrame") || !mainSource.includes("panoramaResolved")) fail("loading completion must wait for real startup milestones");
const startupInputSource = await readFile(path.join(root, "src/game/input.js"), "utf8");
if (!startupInputSource.includes("if (state.started || !state.ready) return;")) fail("keyboard and gamepad Start activation must be blocked until ready");
const startupStylesSource = await readFile(path.join(root, "styles-cinematic.css"), "utf8");
if (!startupStylesSource.includes("place-items: center") || !startupStylesSource.includes(".loading-panel")) fail("the start menu and loading panel must be centred");
if (!startupStylesSource.includes("z-index: 30")) fail("loading overlay must cover the menu until startup completes");
if (/from\s+["']https?:\/\//i.test(mainSource)) fail("runtime modules must be bundled locally; remove CDN imports");
if (!mainSource.includes("createMainBuildingWorld({ THREE, scene })")) fail("gameplay must load the empty map");
if (!mainSource.includes("emptyMap: true")) fail("the active world must be marked as an empty map");
if (mainSource.includes("createPixelPostProcess") || mainSource.includes("postFx.")) fail("screen-wide post-processing must be removed");
if (mainSource.includes("style.filter =")) fail("game canvas CSS filters must be removed");
const playerSource = await readFile(path.join(root, "src/game/player.js"), "utf8");
if (!playerSource.includes("function tryMoveTo(x, z)")) fail("free movement is required in the empty map");
const worldSource = await readFile(path.join(root, "src/game/main-building.js"), "utf8");
if (!worldSource.includes("Empty world ground")) fail("empty map ground is missing");
if (worldSource.includes("Fasáda") || worldSource.includes("Schodiště") || worldSource.includes("Výtah")) fail("building geometry or building interactions remain in the world generator");

const modules = required.filter(file => file.endsWith(".js"));
for (const relativePath of modules) {
  const fullPath = path.join(root, relativePath);
  let source;
  try {
    source = await readFile(fullPath, "utf8");
  } catch {
    continue;
  }

  const check = spawnSync(process.execPath, ["--check", fullPath], { encoding: "utf8" });
  if (check.status !== 0) {
    fail("JavaScript syntax error in " + relativePath + ": " + (check.stderr || check.stdout).trim());
  }

  const imports = source.matchAll(/from\s+["'](\.\/[^"']+)["']/g);
  for (const match of imports) {
    const importPath = path.resolve(path.dirname(fullPath), match[1]);
    try {
      await access(importPath);
    } catch {
      fail(relativePath + " imports missing file: " + match[1]);
    }
  }
}

if (!process.exitCode) console.log("Architecture check passed: required files, external entry points, local imports and JavaScript syntax are valid.");

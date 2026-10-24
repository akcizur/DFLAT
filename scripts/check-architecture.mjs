import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "package.json", "vite.config.js", "index.html", "vendor/three.module.min.js",
  "vendor/THREE-LICENSE.txt", "styles.css", "styles-cinematic.css",
  "src/main.js", "src/boot-debug.js", "src/game/empty-world.js",
  "src/game/player.js", "src/game/ui.js", "src/game/input.js"
];

function fail(message) {
  console.error("Empty-map check failed: " + message);
  process.exitCode = 1;
}

for (const relativePath of required) {
  try { await access(path.join(root, relativePath)); }
  catch { fail("missing required file: " + relativePath); }
}

const html = await readFile(path.join(root, "index.html"), "utf8");
if (!/href="\.\/styles\.css(?:\?v=\d+)?"/.test(html)) fail("index.html must load styles.css");
if (!/src="\.\/src\/main\.js\?v=\d+"/.test(html)) fail("index.html must load src/main.js with cache-busting");
if (!html.includes('type="importmap"') || !html.includes('"three": "./vendor/three.module.min.js"')) fail("local Three.js import map is missing");
if (/<style(?:\s|>)/i.test(html)) fail("inline CSS remains in index.html");
if (/<script\b(?![^>]*\bsrc=)(?![^>]*\btype=["']importmap["'])[^>]*>/i.test(html)) fail("inline JavaScript remains in index.html");

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageJson.scripts?.build !== "vite build") fail("Vite production build script is missing");
if (packageJson.dependencies?.three !== "0.169.0") fail("Three.js version changed unexpectedly");
if (packageJson.devDependencies?.vite !== "6.4.5") fail("Vite version changed unexpectedly");

const mainSource = await readFile(path.join(root, "src/main.js"), "utf8");
if (!html.includes('id="loadingScreen"') || !html.includes('id="loadingProgressBar"')) fail("loading progress UI is missing");
if (!html.includes('id="startButton" disabled aria-disabled="true"')) fail("start button must wait for world initialization");
if (!mainSource.includes("function finishStartupWhenReady()") || !mainSource.includes("state.ready = true")) fail("startup readiness flow is missing");
if (!mainSource.includes("firstSceneFrame")) fail("first rendered frame must gate start");
const inputSource = await readFile(path.join(root, "src/game/input.js"), "utf8");
if (!inputSource.includes("if (state.started || !state.ready) return;")) fail("start must be blocked until the scene is ready");
if (/from\s+["']https?:\/\//i.test(mainSource)) fail("runtime must not import modules from a CDN");
if (!mainSource.includes("createEmptyWorld({ THREE, scene })")) fail("empty world generator must be loaded");
if (!mainSource.includes("emptyMap: true")) fail("state must identify the empty map");
if (!mainSource.includes("renderer.render(scene, camera)")) fail("the scene must render directly");
if (!mainSource.includes("preserveDrawingBuffer: true")) fail("frame buffer must remain available for smoke checks");
if (!mainSource.includes('imageRendering: "pixelated"')) fail("low-res pixel rendering must remain enabled");
if (mainSource.includes("createPixelPostProcess") || mainSource.includes("postFx.")) fail("post-processing must remain removed");
if (mainSource.includes("style.filter =")) fail("CSS canvas filters must remain removed");

const worldSource = await readFile(path.join(root, "src/game/empty-world.js"), "utf8");
if (!worldSource.includes("Empty world ground")) fail("empty-map ground is missing");
if (/building|fasáda|schodiště|výtah|panelák|architecture/i.test(worldSource)) fail("building-specific code remains in the world generator");
const playerSource = await readFile(path.join(root, "src/game/player.js"), "utf8");
if (!playerSource.includes("function tryMoveTo(x, z)")) fail("free movement handler is missing");

for (const relativePath of required.filter(file => file.endsWith(".js"))) {
  const fullPath = path.join(root, relativePath);
  const check = spawnSync(process.execPath, ["--check", fullPath], { encoding: "utf8" });
  if (check.status !== 0) fail("JavaScript syntax error in " + relativePath + ": " + (check.stderr || check.stdout).trim());
  const source = await readFile(fullPath, "utf8");
  for (const match of source.matchAll(/from\s+["'](\.\/[^"']+)["']/g)) {
    try { await access(path.resolve(path.dirname(fullPath), match[1])); }
    catch { fail(relativePath + " imports missing file: " + match[1]); }
  }
}

if (!process.exitCode) console.log("Architecture check passed: empty world, required entry points, local imports and JavaScript syntax are valid.");

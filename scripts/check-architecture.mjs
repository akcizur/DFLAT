import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "package.json", "vite.config.js", "index.html", "vendor/three.module.min.js",
  "vendor/THREE-LICENSE.txt", "styles.css", "styles-cinematic.css",
  "src/main.js", "src/boot-debug.js", "src/game/open-world.js",
  "src/game/model-library.js", "src/game/player.js", "src/game/ui.js", "src/game/input.js",
  "scripts/prepare-open-models.mjs", "scripts/smoke-browser.mjs",
  "assets/OPEN_SOURCE_MODELS.md", "assets/DEPOO_WORLD.md"
];

function fail(message) {
  console.error("Project check failed: " + message);
  process.exitCode = 1;
}
for (const relativePath of required) {
  try { await access(path.join(root, relativePath)); }
  catch { fail("missing required file: " + relativePath); }
}

const html = await readFile(path.join(root, "index.html"), "utf8");
if (!/<title>DEPOO — Outer Rim Cargo Depot<\/title>/.test(html)) fail("DEPOO title is missing");
if (!/href="\.\/styles\.css(?:\?v=\d+)?"/.test(html)) fail("styles.css is missing");
if (!/src="\.\/src\/main\.js\?v=\d+"/.test(html)) fail("main.js cache-busting is missing");
if (!html.includes('type="importmap"') || !html.includes('"three": "./vendor/three.module.min.js"')) fail("local Three.js import map is missing");
if (/<style(?:\s|>)/i.test(html)) fail("inline CSS remains in index.html");
if (/<script\b(?![^>]*\bsrc=)(?![^>]*\btype=["']importmap["'])[^>]*>/i.test(html)) fail("inline JavaScript remains in index.html");
for (const id of ["modelLibraryScreen","modelLibraryButton","modelLibraryMenuButton","modelLibrarySearch","modelLibraryPack","modelLibraryCount","modelLibraryGrid","modelLibraryPlace"]) {
  if (!html.includes('id="' + id + '"')) fail("model-library UI element is missing: " + id);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageJson.name !== "depoo-outer-rim") fail("package identity is not DEPOO");
if (!String(packageJson.scripts?.build || "").includes("vite build")) fail("Vite build script is missing");
if (!String(packageJson.scripts?.dev || "").includes("prepare-open-models.mjs")) fail("dev must prepare the local model bundle");
if (!String(packageJson.scripts?.build || "").includes("prepare-open-models.mjs")) fail("build must prepare the local model bundle");
if (packageJson.dependencies?.three !== "0.169.0") fail("unexpected Three.js version");
if (packageJson.devDependencies?.vite !== "6.4.5") fail("unexpected Vite version");

const mainSource = await readFile(path.join(root, "src/main.js"), "utf8");
if (!mainSource.includes("function finishStartupWhenReady()") || !mainSource.includes("state.ready = true")) fail("startup readiness flow is missing");
if (!mainSource.includes("firstSceneFrame") || !mainSource.includes("worldReady")) fail("startup must wait for a rendered frame and loaded assets");
if (!mainSource.includes("createOpenWorld({")) fail("DEPOO world generator is not connected");
if (!mainSource.includes("createModelLibrary({")) fail("model browser is not initialized");
if (!mainSource.includes("world.tick?.(deltaSeconds)")) fail("world lighting animation is not updated");
if (!mainSource.includes('imageRendering: "pixelated"')) fail("pixel rendering is missing");
const inputSource = await readFile(path.join(root, "src/game/input.js"), "utf8");
if (!inputSource.includes("if (state.started || !state.ready) return;")) fail("game start must wait for readiness");
if (!inputSource.includes('event.code === "KeyM"')) fail("M key must open the model browser");
if (!inputSource.includes('document.getElementById("modelLibraryClose")')) fail("Escape must close the model browser");

const worldSource = await readFile(path.join(root, "src/game/open-world.js"), "utf8");
if (!worldSource.includes('ground.name = "DEPOO outer-rim ground"')) fail("DEPOO ground is missing");
if (!worldSource.includes('theme: "DEPOO"')) fail("world diagnostics must identify DEPOO");
if (!worldSource.includes('fetch(APP_BASE + "models/manifest.json")')) fail("the local Space Kit manifest is not loaded");
if (worldSource.includes("panelak") || worldSource.includes("apartment")) fail("legacy residential world code remains connected");
const modelPrep = await readFile(path.join(root, "scripts/prepare-open-models.mjs"), "utf8");
for (const id of ["space-kit/hangar-largea","space-kit/monorail-trackstraight","space-kit/craft-cargoa","space-kit/machine-generatorlarge"]) {
  if (!worldSource.includes(id) || !modelPrep.includes(id)) fail("required DEPOO component is not bundled: " + id);
}
if (!modelPrep.includes('model.license !== "CC0-1.0"')) fail("asset downloader must verify CC0 license");
if (!modelPrep.includes('model.author !== "Kenney"')) fail("asset downloader must verify artist");
if (!modelPrep.includes("model.size")) fail("asset downloader must verify file size");

const library = await readFile(path.join(root, "src/game/model-library.js"), "utf8");
if (!library.includes('fetch(SOURCE_ROOT + "/catalog.json")') || !library.includes("PAGE_SIZE = 48")) fail("searchable paginated CC0 catalog is missing");
const player = await readFile(path.join(root, "src/game/player.js"), "utf8");
if (!player.includes("function tryMoveTo(x, z)") || !player.includes("function nearestInteractable()")) fail("first-person movement/interactions are missing");

for (const relativePath of required.filter(file => file.endsWith(".js") || file.endsWith(".mjs"))) {
  const fullPath = path.join(root, relativePath);
  const check = spawnSync(process.execPath, ["--check", fullPath], { encoding: "utf8" });
  if (check.status !== 0) fail("JavaScript syntax error in " + relativePath + ": " + (check.stderr || check.stdout).trim());
  const source = await readFile(fullPath, "utf8");
  for (const match of source.matchAll(/from\s+["'](\.\/[^"']+)["']/g)) {
    try { await access(path.resolve(path.dirname(fullPath), match[1])); }
    catch { fail(relativePath + " imports missing file: " + match[1]); }
  }
}
if (!process.exitCode) console.log("Project architecture check passed: DEPOO Space Kit scene, CC0 pipeline, model browser and controls are valid.");

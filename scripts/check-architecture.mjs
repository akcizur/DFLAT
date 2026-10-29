import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "package.json", "vite.config.js", "index.html", "vendor/three.module.min.js",
  "vendor/THREE-LICENSE.txt", "styles.css", "styles-cinematic.css",
  "src/main.js", "src/boot-debug.js", "src/game/open-world.js", "src/game/panelak.js", "src/game/panelak-interior.js",
  "src/game/model-library.js", "src/game/player.js", "src/game/ui.js", "src/game/input.js",
  "scripts/prepare-open-models.mjs", "scripts/smoke-browser.mjs", "assets/OPEN_SOURCE_MODELS.md"
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
if (!/href="\.\/styles\.css(?:\?v=\d+)?"/.test(html)) fail("index.html must load styles.css");
if (!/src="\.\/src\/main\.js\?v=\d+"/.test(html)) fail("index.html must load src/main.js with cache-busting");
if (!html.includes('type="importmap"') || !html.includes('"three": "./vendor/three.module.min.js"')) fail("local Three.js import map is missing");
if (/<style(?:\s|>)/i.test(html)) fail("inline CSS remains in index.html");
if (/<script\b(?![^>]*\bsrc=)(?![^>]*\btype=["']importmap["'])[^>]*>/i.test(html)) fail("inline JavaScript remains in index.html");
for (const id of ["modelLibraryScreen", "modelLibraryButton", "modelLibraryMenuButton", "modelLibrarySearch", "modelLibraryPack", "modelLibraryCount", "modelLibraryGrid", "modelLibraryPlace"]) {
  if (!html.includes('id="' + id + '"')) fail("model-library UI element is missing: " + id);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (!String(packageJson.scripts?.build || "").includes("vite build")) fail("Vite production build script is missing");
if (!String(packageJson.scripts?.dev || "").includes("prepare-open-models.mjs")) fail("dev must prepare pinned open models before Vite starts");
if (!String(packageJson.scripts?.build || "").includes("prepare-open-models.mjs")) fail("build must prepare pinned open models before Vite build");
if (packageJson.dependencies?.three !== "0.169.0") fail("Three.js version changed unexpectedly");
if (packageJson.devDependencies?.vite !== "6.4.5") fail("Vite version changed unexpectedly");

const mainSource = await readFile(path.join(root, "src/main.js"), "utf8");
if (!html.includes('id="loadingScreen"') || !html.includes('id="loadingProgressBar"')) fail("loading progress UI is missing");
if (!html.includes('id="startButton" disabled aria-disabled="true"')) fail("start button must wait for world initialization");
if (!mainSource.includes("function finishStartupWhenReady()") || !mainSource.includes("state.ready = true")) fail("startup readiness flow is missing");
if (!mainSource.includes("firstSceneFrame") || !mainSource.includes("worldReady")) fail("start must wait for the first frame and the open-world assets");
const inputSource = await readFile(path.join(root, "src/game/input.js"), "utf8");
if (!inputSource.includes("if (state.started || !state.ready) return;")) fail("start must be blocked until the scene is ready");
if (!inputSource.includes('event.code === "KeyM"')) fail("M must open the in-game model browser");
if (!inputSource.includes('document.getElementById("modelLibraryClose")')) fail("Escape must close the model browser");
if (/from\s+["']https?:\/\//i.test(mainSource)) fail("runtime must not import modules from a CDN");
if (!mainSource.includes("createOpenWorld({")) fail("open-world generator must be loaded");
if (!mainSource.includes("openWorld: true")) fail("state must identify the modelled open world");
if (!mainSource.includes("createModelLibrary({")) fail("the searchable model library must be initialized");
if (!mainSource.includes("renderer.render(scene, camera)")) fail("the scene must render directly");
if (!mainSource.includes("preserveDrawingBuffer: true")) fail("frame buffer must remain available for smoke checks");
if (!mainSource.includes('imageRendering: "pixelated"')) fail("low-res pixel rendering must remain enabled");
if (mainSource.includes("createPixelPostProcess") || mainSource.includes("postFx.")) fail("post-processing must remain removed");
if (mainSource.includes("style.filter =")) fail("CSS canvas filters must remain removed");

const worldSource = await readFile(path.join(root, "src/game/open-world.js"), "utf8");
if (!worldSource.includes("CC0 neighbourhood ground")) fail("world ground is missing");
if (!worldSource.includes("WORLD_LAYOUT")) fail("the curated asset-backed world layout is missing");
if (!worldSource.includes('fetch(APP_BASE + "models/manifest.json")')) fail("the local asset manifest must load at runtime");
if (!worldSource.includes("createPanelakDistrict({ THREE, scene })")) fail("the procedural panelák district must be present");
const panelakSource = await readFile(path.join(root, "src/game/panelak.js"), "utf8");
if (!panelakSource.includes("PANELAK_LAYOUT") || !panelakSource.includes("floors: 4")) fail("four-storey panelák layout is missing");
if (!panelakSource.includes("InstancedMesh")) fail("procedural architecture should batch repeated facade geometry");
const interiorSource = await readFile(path.join(root, "src/game/panelak-interior.js"), "utf8");
if (!interiorSource.includes("PANELAK_INTERIOR_LAYOUT")) fail("panelák interior layout contract is missing");
if (!interiorSource.includes("PointLight")) fail("interior lighting must use real point lights");
if (!interiorSource.includes("pivot.rotation.y")) fail("interactive hinged doors are missing");
if (!interiorSource.includes("Bedroom rug") || !interiorSource.includes("Bathroom tiled floor") || !interiorSource.includes("Kitchen counter")) fail("the first apartment must include furnished rooms");
if (!worldSource.includes("createPanelakInterior({ THREE, scene, colliders, interactables })")) fail("the panelák interior is not connected to the world");
const librarySource = await readFile(path.join(root, "src/game/model-library.js"), "utf8");
if (!librarySource.includes('fetch(SOURCE_ROOT + "/catalog.json")')) fail("the searchable upstream catalog is missing");
if (!librarySource.includes("PAGE_SIZE = 48")) fail("the asset browser must paginate its model cards");
const downloadSource = await readFile(path.join(root, "scripts/prepare-open-models.mjs"), "utf8");
if (!downloadSource.includes('model.license !== "CC0-1.0"')) fail("the downloader must validate the CC0 license");
if (!downloadSource.includes("model.size")) fail("the downloader must validate the source model size");
const playerSource = await readFile(path.join(root, "src/game/player.js"), "utf8");
if (!playerSource.includes("function tryMoveTo(x, z)")) fail("free movement handler is missing");

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

if (!process.exitCode) console.log("Project architecture check passed: local entry points, CC0 asset pipeline, open-world generator, model browser and JavaScript syntax are valid.");

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
  "assets/city-sunset.webp",
  "assets/bg-scene-hq.png",
  "src/main.js",
  "src/game/pixel-post.js",
  "src/game/materials.js",
  "src/game/world.js",
  "src/game/player.js",
  "src/game/ui.js",
  "src/game/input.js",
  "tools/generate_socialist_block_17.py",
  "tools/VP_OS_Building_Architecture_v4.py"
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
if (!html.includes('href="./styles.css"')) fail("index.html must load styles.css");
if (!html.includes('<script type="module" src="./src/main.js?v=10"></script>')) fail("index.html must load src/main.js");
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
if (/from\s+["']https?:\/\//i.test(mainSource)) fail("runtime modules must be bundled locally; remove CDN imports");
if (!mainSource.includes("createEmptyApartment({ THREE, scene, M })")) fail("gameplay must boot into the unfurnished apartment shell");
if (!mainSource.includes("const SIMULATION_HZ = 60")) fail("game simulation must target 60 Hz");
if (!mainSource.includes("const SCENE_RENDER_HZ = 60")) fail("scene raster must target 60 FPS");
if (!mainSource.includes("postFx.renderScene(scene, camera")) fail("scene must use the buffered depth-aware pixel renderer");
if (!mainSource.includes("postFx.present(now / 1000)")) fail("pixel compositor must present independently from scene raster");
const compositorSource = await readFile(path.join(root, "src/game/pixel-post.js"), "utf8");
if (!compositorSource.includes('getContext("2d"')) fail("stable Canvas2D pixel compositor is required");
if (compositorSource.includes("shadowBlur") || compositorSource.includes("shadowColor")) fail("CRT compositor must not use glow or shadows");
if (!compositorSource.includes("new THREE.WebGLRenderTarget")) fail("depth-aware blur needs a GPU scene target");
if (!compositorSource.includes("new THREE.DepthTexture")) fail("depth-aware blur needs a depth texture");
if (!compositorSource.includes("new THREE.ShaderMaterial")) fail("distance-based Gaussian blur shader is required");
if (!compositorSource.includes("smoothstep(blurStart, blurEnd, distanceToCamera)")) fail("depth blur must use configurable near/far ramp distances");
if (!compositorSource.includes("uniform float blurX;") || !compositorSource.includes("uniform float blurY;")) fail("blur must expose independent X and Y controls");
if (!compositorSource.includes("#include <common>") || !compositorSource.includes("#include <colorspace_fragment>")) fail("shader must use Three.js shader include chunks");
if (!compositorSource.includes("function setBlur(options = {})")) fail("runtime blur settings system is required");
if (!compositorSource.includes("texture2D(tDiffuse, uv + vec2(-px.x, -px.y))")) fail("Gaussian blur must use a symmetric sample kernel in distorted UV space");
if (!mainSource.includes("preserveDrawingBuffer: true")) fail("WebGL frame buffer must be preserved for pixel compositing");
if (!mainSource.includes('object.geometry.setAttribute("uv2", object.geometry.attributes.uv.clone())')) fail("mesh UV2 channels are required for baked light maps");

const worldSource = await readFile(path.join(root, "src/game/world.js"), "utf8");
if (!worldSource.includes("export function createEmptyApartment")) fail("playable empty-apartment map shell is required");
if (!worldSource.includes("wall(-4.375, 6, 7.25, wallT)")) fail("entrance wall must align to the door-frame opening");
if (!worldSource.includes("localBox(doorPivot, .69, 1.40, 0, 1.38, 2.80")) fail("front door leaf must fit the clear entrance width");
if (!worldSource.includes("wallH - 2.22, 1.2, M.wall")) fail("interior door header infill must meet its lintel without a gap");
if (!worldSource.includes("wallH - 2.92")) fail("entrance wall block must join the entrance lintel to the ceiling");
if (!worldSource.includes("box('Stěna nad lodžií'")) fail("loggia door header must connect to the ceiling wall");
if (!worldSource.includes("new THREE.BoxGeometry(0.32, 0.07, 0.32)")) fail("each room needs a simple cube light fixture");
if (!worldSource.includes("const roomFixtureMaterial")) fail("room light fixtures should share one basic material");
for (const room of ["obývák", "kuchyně", "ložnice", "koupelna", "chodba"]) {
  if (!worldSource.includes(`name: 'Světlo / ${room}'`)) fail("missing basic light source for " + room);
}
const blenderGenerator = await readFile(path.join(root, "tools/generate_socialist_block_17.py"), "utf8");
if (!blenderGenerator.includes("wall_faces = []")) fail("Blender generator must initialise wall_faces");
if (!blenderGenerator.includes("v_slab = [(x, y, 0.0) for x, y in outline]")) fail("Blender generator must define complete v_slab vertices");
if (!blenderGenerator.includes("FLOOR_COUNT = 8")) fail("Blender generator must build exactly 8 storeys");
if (!blenderGenerator.includes("FLOOR_TO_FLOOR = 2.8")) fail("Blender generator storey spacing must be 2.8 metres");
if (!blenderGenerator.includes("WALL_THICKNESS = 0.20")) fail("Blender generator perimeter panel thickness must be 200 mm");
if (!blenderGenerator.includes("modifier.count = count")) fail("Blender Array helper must accept explicit repeat counts");
if (!blenderGenerator.includes('_add_array(upper_walls, "Upper storeys | 2.8 m pitch", FLOOR_COUNT - 1)')) fail("Ground floor and 7 upper floors must total 8 storeys without duplicating the entrance");
if (!blenderGenerator.includes("modifier.constant_offset_displace = (0.0, 0.0, FLOOR_TO_FLOOR)")) fail("Blender Array modifier must use a 2.8 m vertical offset");
if (!blenderGenerator.includes("WINDOW_WIDTH = 1.30") || !blenderGenerator.includes("def _build_facade_segment(")) fail("Blender generator must make real window openings in facade geometry");
if (!blenderGenerator.includes("include_entry=True") || !blenderGenerator.includes("DOOR_WIDTH = 1.80")) fail("Ground-floor facade must have a separate actual entrance opening");
if (!blenderGenerator.includes('boolean.solver = "EXACT"')) fail("Stairwell and roof-hatch cuts must use Blender's exact Boolean solver");
if (!blenderGenerator.includes("STAIR_FLIGHTS_PER_STOREY = 2") || !blenderGenerator.includes("STEPS_PER_FLIGHT = 8")) fail("Blender generator must create switch-back stairs between storeys");
if (!blenderGenerator.includes("STAIRWELL_SIZE = (3.98, 3.93)")) fail("Floor slabs must include the stairwell opening");
if (!blenderGenerator.includes("rail_vertex_offset = len(stair_vertices)") || !blenderGenerator.includes("index + rail_vertex_offset")) fail("Stair handrails must use valid shared-mesh vertex indices");
if (!blenderGenerator.includes("ROOF_HATCH_SIZE = (1.05, 1.05)") || !blenderGenerator.includes("def _build_roof_ladder(")) fail("Roof must have a ladder hatch and fixed ladder");
if (!blenderGenerator.includes("Fixed ladder from top floor to roof hatch")) fail("Roof ladder object must be included in the generated collection");
if (!blenderGenerator.includes("def _build_exterior_finish(")) fail("Blender generator must add finished exterior details");
if (!blenderGenerator.includes("Repeated horizontal facade belt courses") || !blenderGenerator.includes("Fine vertical facade panel joints")) fail("Facade panel rhythm and joints must be modelled");
if (!blenderGenerator.includes("Continuous roof parapet") || !blenderGenerator.includes("Overhanging parapet coping")) fail("Roof perimeter must have a parapet and coping");
if (!blenderGenerator.includes("Eight full-height rainwater downpipes")) fail("Exterior rainwater downpipes are required");
if (!blenderGenerator.includes("Rooftop ventilation housings") || !blenderGenerator.includes("Raised roof exhausts")) fail("Rooftop ventilation equipment is required");
if (!blenderGenerator.includes('text_curve.body = "VCHOD 01"') || !blenderGenerator.includes("21 | Entrance plaque")) fail("Ground entrance needs visible lettering and a plaque");
if (!blenderGenerator.includes("def _create_scene_preview(") || !blenderGenerator.includes("camera_data.type = \"ORTHO\"")) fail("Generator must create a useful architectural preview camera");
if (!blenderGenerator.includes("scene.render.resolution_y = 1600") || !blenderGenerator.includes("camera_data.ortho_scale = 26.0") || !blenderGenerator.includes("Large warm key light")) fail("Generator must frame the 8-storey model in its portrait preview and configure architectural lighting");
if (!blenderGenerator.includes('principled.inputs["Base Color"].default_value = rgba')) fail("Generated materials must use their configured colors in rendered output");
const v4Generator = await readFile(path.join(root, "tools/VP_OS_Building_Architecture_v4.py"), "utf8");
if (!v4Generator.includes("H_CLR, H_STR, SLAB, FAC = 2615, 2800, 150, 300")) fail("VP-OS v4 storey and slab dimensions are missing");
if (!v4Generator.includes("arr.count = 15")) fail("VP-OS v4 must repeat 15 typical floors");
if (!v4Generator.includes("def boolean_cut(") || !v4Generator.includes("mod.solver = 'EXACT'")) fail("VP-OS v4 openings must use exact Boolean cuts");
if (!v4Generator.includes("def build_vertical_core_story()") || !v4Generator.includes("def cut_core_openings_from_slab(")) fail("VP-OS v4 must define stairs, lift and floor-plate openings");
if (!v4Generator.includes("def lodzie_stitni_east(") || !v4Generator.includes("def build_roof_details()")) fail("VP-OS v4 must include east loggias and detailed roof geometry");
if (!v4Generator.includes('VP_OS_Building_Architecture_v4.blend')) fail("VP-OS v4 must save a standalone Blender project");

const materialsSource = await readFile(path.join(root, "src/game/materials.js"), "utf8");
if (!materialsSource.includes("function bakedLightTexture()") || !materialsSource.includes("lightMapIntensity")) {
  fail("procedural baked-light gradients are not configured on the material palette");
}

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

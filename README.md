# DFLAT — Main Building

A compact first-person, low-poly exploration scene built with Three.js, Vite and Bun. The active game starts outdoors on an intentionally sparse map: one eight-storey Czech/Slovak socialist-era apartment block, a road, sidewalks and a short entrance path. The building includes repeated floor slabs, a common corridor, apartment entry openings, switchback stairs and an elevator shaft with a visible ground-floor cabin.

The building is generated from native Three.js box geometry at runtime, so the live game does not need GLB/GLTF/FBX assets. The separate Blender scripts in `tools/` remain editable architectural modelling tools and are not loaded by the browser game.

## Run locally

Install [Bun](https://bun.sh/) if needed, then run from the project root:

```sh
bun install
bun run dev
```

For a production build and preview:

```sh
bun run check:syntax
bun run check
bun run build
bun run preview
```

## Map and rendering

- **Empty outdoor map:** open terrain, one main building, a single approach path and a road. No surrounding buildings, vehicles or furniture.
- **Main building:** eight storeys with wall sections around actual window/entrance openings, repeated concrete façade bands, low-poly windows, balconies and roof parapet.
- **Interior circulation:** upper slabs have a core void, switchback flights and landings repeat between levels, apartment entries open from the common corridor, and the lift shaft has doors on all eight floors.
- **Vertical navigation:** use `E` near the stairs or elevator to move between storeys; the HUD displays the active floor.
- **Pixel-grid WebGL:** the scene renders into a compact canvas and scales with nearest-neighbour sampling. Antialiasing is disabled.
- **Direct rendering:** no screen-wide CRT, VHS, PS1, blur or post-processing effects.
- **Stable simulation:** movement updates target 60 Hz and rendering is capped at 60 FPS.
- **Input:** keyboard, mouse, touch and Gamepad API support remain enabled; fullscreen is available in the HUD.

## Runtime coordinate export

Every production build exports the coordinates of the actual Three.js scene, not a parallel handwritten model. The exporter measures geometry created by `src/game/main-building.js` and validates important dimensions, named points, collision openings, stairs and elevator travel.

Generated files:

- `public/data/main-building-vertices.json`: complete object bounds and corners, named architectural points, world/local coordinate convention, interaction points and collision volumes.
- `public/data/main-building-vertices.csv`: object, vertex/corner and semantic-anchor records suitable for spreadsheet or GIS-style inspection.

Coordinates are in metres. The world origin is `(0, 0, 0)`; the building origin is `(0, 0, -22)`. The X axis crosses the front facade, Y is vertical, and Z is depth. The front facade is at `Z=-16`, rear facade at `Z=-28`. Building-local coordinates are converted with `x_local=x_world`, `y_local=y_world`, `z_local=z_world+22`.

The current runtime design defines an 8-storey block, 28 m wide and 12 m deep, with a 2.8 m floor-to-floor pitch and nominal roof datum at `Y=22.4` m. These are implementation dimensions, not a survey of a named real building. Separate Blender generators remain independent of the browser scene.

To regenerate coordinate files directly:

```sh
bun install
node tools/export-building-coordinates.mjs
```

The files are produced automatically by `bun run build`.

## GitHub Pages

The deployment workflow builds the static site into `dist/` and deploys to [akcizur.github.io/DFLAT](https://akcizur.github.io/DFLAT/). For the first deployment, select **GitHub Actions** under **Repository Settings → Pages → Build and deployment → Source**. The Vite base path is `/DFLAT/` in GitHub Actions and `/` during local development.

## Controls

- `W A S D` / arrow keys: move
- Mouse: look around
- `Esc`: pause or resume
- Touch screens: on-screen movement/look controls
- Gamepad: left stick to move, right stick to look

The map is currently a free-roam environment. There is no objective beyond exploring the exterior and approaching the main building.

## Active Blender-authored panelák: T06B V2

The browser game uses the Blender-generated model `public/models/t06b-panelak-v2.glb` when that asset is present. The intended typology is a five-module section (`5 × 3.6 m = 18.0 m)), 11.4 m deep, with four above-ground storeys, one cellar, eight flats, recessed loggias, luxfer stair glazing and **no lift**. The procedural eight-storey building is retained only as a fallback for local sessions in which the GLB has not been generated.

Generate the editable Blender project, the runtime GLB and its measured coordinate manifest:

```sh
blender --background --python tools/generate_t06b_panelak_v2.py
bun run test
bun run build
```

Outputs are `T06B_Panelak_V2.blend`, `public/models/t06b-panelak-v2.glb`, and `public/data/t06b-panelak-v2.json`. The build validates the measured geometry and writes `public/data/main-building-vertices.json` plus CSV coordinates. GitHub Actions installs Blender, generates the asset and tests the production build before deployment.

The room footprint schedule totals approximately 65.4 m² by its nominal dimensions. This is a **visualisation concept, not construction documentation or a certification of compliance with ČSN 73 4301**. Room clear dimensions, acoustic/fire separation, structural panel layout, sunlight, accessibility and the precise T06B variant require a properly dimensioned architectural design and qualified review.

### Retained independent Blender generators

`tools/generate_socialist_block_17.py` creates an eight-storey concept model; `tools/VP_OS_Building_Architecture_v4.py` generates a separate VP-OS study. They are retained as reference tools and are not the active browser asset. The supplied legacy `SCENE.BUILDING.glb` remains a separate interchange file.

## Project structure

- `index.html`: game shell and start/pause menus.
- `src/main.js`: Three.js renderer, lights, camera, fixed-step simulation and runtime bootstrap.
- `src/game/main-building.js`: empty outdoor map and main building geometry.
- `src/game/player.js`: first-person movement and collision handling.
- `src/game/input.js`: keyboard, pointer lock, touch and gamepad.
- `src/game/ui.js`: overlays, notifications and map label.
- `src/game/world.js`: retained legacy apartment and empty-apartment generators, not used by the active runtime.
- `src/game/materials.js`: procedural pixel textures and the material palette.
- `vendor/three.module.min.js`: local Three.js r169 fallback for unbundled static hosting.
- `tools/generate_t06b_panelak_v2.py`: active Blender model, GLB and measured coordinate-manifest generator.
- `tools/export-building-coordinates.mjs`: geometry validation and JSON/CSV coordinate export.

## Checks

```sh
bun run check:syntax
bun run check
bun run build
```

GitHub Actions runs Python/JavaScript syntax checks, geometry and navigation regression tests, Blender model generation, coordinate validation, a production build and a Chromium smoke test on pull requests. Successful validated builds from `main` are deployed to GitHub Pages.

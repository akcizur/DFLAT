# DFLAT — Main Building

A compact first-person, low-poly exploration scene built with Three.js, Vite and Bun. The active game starts outdoors beside a T06B-inspired four-storey Czech/Slovak panelák section, with five 3.6 m planning modules across an 18 m facade. Its plan includes two mirrored flats per floor, recessed loggias, břízolit-style panels, stairwell luxfer glazing, a basement plinth and a central switchback stair. It intentionally has no elevator.

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
- **Main building:** four occupied storeys over a shallow basement plinth, an 18 × 12 m five-module section, two flats per floor, recessed loggias, luxfer stair glazing, old-fashioned metal railings and weathered concrete/břízolit panels.
- **Interior circulation:** three connecting stair runs link all four floors; apartment entries face the central core. There is no elevator.
- **Vertical navigation:** walk the switchback stairs using `W A S D`; the HUD displays the active floor.
- **Pixel-grid WebGL:** the scene renders into a compact canvas and scales with nearest-neighbour sampling. Antialiasing is disabled.
- **Direct rendering:** no screen-wide CRT, VHS, PS1, blur or post-processing effects.
- **Stable simulation:** movement updates target 60 Hz and rendering is capped at 60 FPS.
- **Dynamic environment:** an accelerated day/night clock, continuously blended daylight, four weather states (clear, overcast, rain and mist), rain particles and weather-aware fog/light changes.
- **Stable building base:** the playable ground slab sits just above the terrain; the foundation is a four-sided perimeter ring, avoiding coplanar faces that can make the floor flicker.
- **Input:** keyboard, mouse, touch and Gamepad API support remain enabled; fullscreen is available in the HUD.

## Runtime coordinate export

Every production build exports the coordinates of the actual Three.js scene, not a parallel handwritten model. The exporter measures geometry created by `src/game/main-building.js` and validates the five-module footprint, four floor datums, room-area budget, loggia openings and stairs.

Generated files:

- `public/data/main-building-vertices.json`: complete object bounds and corners, named architectural points, world/local coordinate convention, interaction points and collision volumes.
- `public/data/main-building-vertices.csv`: object, vertex/corner and semantic-anchor records suitable for spreadsheet or GIS-style inspection.

Coordinates are in metres. The world origin is `(0, 0, 0)`; the building origin is `(0, 0, -22)`. The X axis crosses the front facade, Y is vertical, and Z is depth. The front facade is at `Z=-16`, rear facade at `Z=-28`. Building-local coordinates are converted with `x_local=x_world`, `y_local=y_world`, `z_local=z_world+22`.

The runtime design defines an 18 m wide, 12 m deep, four-storey T06B-inspired section with 3.6 m modules, a 2.8 m floor-to-floor pitch and nominal roof datum at `Y=11.2` m. The declared apartment room-area budget is reconciled to about 65.4 m²; the resulting hall and wet-core depths are stored in `src/game/panelak-config.js`. These are conceptual design dimensions, not a survey of a named real building. Separate Blender generators remain independent authoring assets and are not yet loaded into the browser runtime.

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

## Optional Blender generators

### Socialist-era concrete apartment block (separate Blender authoring asset)

```sh
blender --background --python tools/generate_socialist_block_17.py
```

This standalone modelling tool writes `DFLAT_socialist_block_8.blend` to the current working directory unless `DFLAT_BLOCK_OUTPUT` points elsewhere. It generates a separate editable architectural model; it does not replace or load the browser scene.

### VP-OS building architecture v4

```sh
blender --background --python tools/VP_OS_Building_Architecture_v4.py
```

This independent generator writes `tools/VP_OS_Building_Architecture_v4.blend` and a preview render under `tools/renders/`. The supplied `SCENE.BUILDING.glb` is also a separate interchange asset and is not connected to the runtime.

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
- `tools/`: standalone Blender model generators.

## Checks

```sh
bun run check:syntax
bun run check
bun run build
```

GitHub Actions runs syntax and architecture checks plus a production build on pushes and pull requests, and deploys successful builds from `main`.

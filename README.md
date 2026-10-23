# DFLAT — Main Building

A compact first-person, low-poly exploration scene built with Three.js, Vite and Bun. The active game starts outdoors on an intentionally sparse map: one eight-storey Czech/Slovak socialist-era apartment block, a road, sidewalks and a short entrance path. There is no playable apartment interior, furniture, keys or scripted mission in the current scene.

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
- **Main building:** eight storeys, repeating concrete façade bands, panel joints, low-poly windows, open balconies, roof parapet and a ground-floor entrance canopy.
- **Pixel-grid WebGL:** the scene renders into a compact canvas and scales with nearest-neighbour sampling. Antialiasing is disabled.
- **Direct rendering:** no screen-wide CRT, VHS, PS1, blur or post-processing effects.
- **Stable simulation:** movement updates target 60 Hz and rendering is capped at 60 FPS.
- **Input:** keyboard, mouse, touch and Gamepad API support remain enabled; fullscreen is available in the HUD.

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

### Eight-storey concrete apartment block

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

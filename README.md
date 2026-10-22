# The Flat — DFLAT

A first-person apartment exploration game built with Three.js, Vite and Bun. Three.js is local, with no CDN dependency. Vite bundles the npm package for the production build; a version-matched vendored module plus an import map also keeps the unbundled source entry compatible with static branch hosting.

## Run locally

Install [Bun](https://bun.sh/) if needed, then run from the project root:

```sh
bun install
bun run dev
```

Open the local URL printed by Vite. For a production preview, run:

```sh
bun run check:syntax
bun run check
bun run build
bun run preview
```

## Rendering

- **Pixel-grid WebGL:** the scene renders into a compact canvas and scales with nearest-neighbour sampling for a stronger, crisp pixel look.
- **No screen-wide post-processing:** DOS palette quantization, CRT/PS1/VHS profiles, color tinting, chromatic aberration, scanlines, noise, curvature and depth blur are removed.
- **Stable simulation:** gameplay updates target 60 Hz and scene rendering is capped at 60 FPS.
- **World materials remain intact:** authored textures, material colors, lighting, fog and shadows still come from the game scene itself.

The look is produced by native low-resolution rasterization, not a screen-wide effect filter. Level geometry, movement, interactions and the UI remain unchanged.

## GitHub Pages

The deployment workflow builds the static site into `dist/` and deploys to [akcizur.github.io/DFLAT](https://akcizur.github.io/DFLAT/). For the first deployment, select **GitHub Actions** under **Repository Settings → Pages → Build and deployment → Source**. The Vite base path is `/DFLAT/` in GitHub Actions and `/` during local development.

## Controls

- `W A S D` / arrow keys — move
- Mouse — look around with reduced sensitivity
- `E` — interact
- `Enter` — start or resume
- `Esc` — pause
- Touch screens — on-screen movement/action controls and drag-to-look

## Optional Blender building generator

The Blender generator creates a separate, editable 8-storey building massing model; it is a modelling tool and is not imported into the browser game at runtime.

Run it with Blender installed:

```sh
blender --background --python tools/generate_socialist_block_17.py
```

The script saves the generated project as `DFLAT_socialist_block_8.blend` in the current working directory. Set `DFLAT_BLOCK_OUTPUT` to choose a different output path.

The generated collection contains an eight-node perimeter with mitered 200 mm corners, actual window cut-outs with frames and glazing, and a ground-floor-only entrance opening with a door, canopy and approach steps. Upper storeys repeat 7 times above the ground floor at an exact 2.8 m pitch, for 8 storeys total.

The staircase uses two switch-back flights per storey. Each intermediate floor slab has a matching stairwell opening, and the roof slab has a separate smaller hatch with a fixed ladder extending from the top floor to above the roof. The roof top is approximately 22.6 m above the base. The 8 floor/roof panels are built as 7 repeated intermediate floor slabs plus one roof panel, separate from the foundation.

The facade has repeated horizontal belt courses, narrow vertical panel joints, and downpipes at the outer chamfers. A parapet with overhanging coping, three ventilation housings and raised exhausts finish the roof. The street front gets a concrete arrival apron and approach path; the entrance is labelled `VCHOD 01` and includes a simple intercom. Materials now have Principled shaders, and the scene opens with an orthographic portrait camera, architectural area lighting and a ground/street context for a first render.

`tools/generate_socialist_block_17.py` keeps wall/floor Arrays editable, applies precise Boolean cut-outs to the slab openings, and defines the complete `wall_faces` and `v_slab` geometry. The Blender file is generated when the script is run in Blender; the website does not load this model automatically. Blender itself must be installed to render or visually inspect the generated scene.

## VP-OS Building Architecture v4 (separate Blender model)

The repository now includes a second, independent generator for the supplied VP-OS high-rise concept. It does not replace the compact 8-storey sample generator above and it is not loaded by the browser game automatically.

Run it from the repository root with Blender installed:

```sh
blender --background --python tools/VP_OS_Building_Architecture_v4.py
```

The generator writes `tools/VP_OS_Building_Architecture_v4.blend` and a render to `tools/renders/VP_OS_Building_Architecture_v4.png`. The model uses millimetre-based dimensions converted to Blender metres, 15 repeated typical floors, two upper access levels, rooftop plant details, Boolean-cut façade openings, U-shaped stairs, an open lift shaft/cabin, loggias and selected interior lights. The windows and doorways are intentionally empty openings without frames, glazing or door leaves.

The supplied `SCENE.BUILDING.glb` remains a separate interchange asset. To serve it from the live game, the binary must also be placed in the repository's `assets/` directory and connected to the game's Three.js loader; the Blender generator alone does not make it appear in the browser.

## Architecture

- `index.html` — game shell, centered BIOS menus and HUD.
- `styles.css`, `styles-cinematic.css` — responsive HUD and menu styling, separate from scene rendering.
- `assets/bg-scene-hq.png` — high-resolution panoramic exterior environment.
- `src/main.js` — fixed-step movement simulation and direct low-resolution WebGL raster.
- `vendor/three.module.min.js` — local Three.js r169 fallback for unbundled static branch hosting; its MIT license is included beside it.
- `src/game/materials.js` — pixel-gradient materials and procedural baked-light map.
- `src/game/world.js` — apartment geometry, lights, collision volumes and interactables.
- `src/game/player.js` — movement, collision response and camera synchronization.
- `src/game/input.js` — keyboard, pointer lock, mouse/touch look and interaction.
- `src/game/ui.js` — objective, inventory, notifications, menus and in-game clock.
- `scripts/check-architecture.mjs` — validates entry points, direct rendering, local imports and the Blender generator settings.
- `tools/generate_socialist_block_17.py` — standalone Blender script for the 8-storey concrete apartment-block model.

## Checks

```sh
bun run check:syntax
bun run check
bun run build
```

GitHub Actions runs syntax and architecture checks plus a production build on pushes and pull requests, and deploys successful builds from `main`.

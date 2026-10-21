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

## Pixel rendering model

- **60 Hz simulation and render target:** keyboard/mouse movement, camera synchronization, door easing, object animation, UI and the world render loop target 60 FPS.
- **Low-resolution pixel raster:** the apartment renders into a compact WebGL canvas with antialiasing disabled and nearest-neighbour scaling for sharp PS1-style pixels.
- **Depth-aware Gaussian blur:** the GPU depth buffer drives a symmetric Gaussian-like 13-tap filter. Nearby geometry stays sharp; blur fades in at 2.0 m and reaches full strength by about 3.2 m. Nearest sampling preserves the blocky pixel raster.
- **60 Hz Canvas2D CRT presentation:** the processed WebGL frame is copied to a presentation canvas with nearest-neighbour sampling and thin scanlines. Low-amplitude flicker is disabled for reduced-motion users; no bloom or compositor shadows are used.
- **Pixel textures and baked-light gradients:** compact nearest-filtered textures blend quantized warm/cool gradients and deterministic dither. A shared low-energy procedural light map adds stable, baked-style light pools; real lamps, sun lighting and shadowing still contribute depth.

The 60 FPS setting is a target, not a guarantee; actual performance depends on GPU, browser, display refresh rate and scene complexity.

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

The Blender generator creates a separate, editable 17-storey building massing model; it is a modelling tool and is not imported into the browser game at runtime.

Run it with Blender installed:

```sh
blender --background --python tools/generate_socialist_block_17.py
```

The script saves the generated project as `DFLAT_socialist_block_17.blend` in the current working directory. Set `DFLAT_BLOCK_OUTPUT` to choose a different output path.

The generated collection contains an eight-node perimeter with mitered 200 mm corners, actual window cut-outs with frames and glazing, and a ground-floor-only entrance opening with a door, canopy and approach steps. Upper storeys repeat 16 times above the ground floor at an exact 2.8 m pitch, for 17 storeys total.

The staircase uses two switch-back flights per storey. Each intermediate floor slab has a matching stairwell opening, and the roof slab has a separate smaller hatch with a fixed ladder extending from the top floor to above the roof. The roof top is approximately 47.8 m above the base. The 17 floor/roof panels are built as 16 repeated floor slabs plus one roof panel, separate from the foundation.

`tools/generate_socialist_block_17.py` keeps wall/floor Arrays editable, applies precise Boolean cut-outs to the slab openings, and defines the complete `wall_faces` and `v_slab` geometry. The Blender file is generated when the script is run in Blender; the website does not load this model automatically.

## Architecture

- `index.html` — game shell, centered BIOS menus and HUD.
- `styles.css`, `styles-cinematic.css` — responsive pixel/CRT interface.
- `assets/bg-scene-hq.png` — high-resolution panoramic exterior environment.
- `src/main.js` — 60 Hz fixed-step simulation, low-resolution scene raster and presentation cadence.
- `vendor/three.module.min.js` — local Three.js r169 fallback for unbundled static branch hosting; its MIT license is included beside it.
- `src/game/pixel-post.js` — depth-texture Gaussian blur pass plus Canvas2D CRT scanline presentation.
- `src/game/materials.js` — pixel-gradient materials and procedural baked-light map.
- `src/game/world.js` — apartment geometry, lights, collision volumes and interactables.
- `src/game/player.js` — movement, collision response and camera synchronization.
- `src/game/input.js` — keyboard, pointer lock, mouse/touch look and interaction.
- `src/game/ui.js` — objective, inventory, notifications, menus and in-game clock.
- `scripts/check-architecture.mjs` — validates entry points, local dependencies, rendering targets and the Blender generator settings.
- `tools/generate_socialist_block_17.py` — standalone Blender script for the complete 17-storey concrete apartment-block massing.

## Checks

```sh
bun run check:syntax
bun run check
bun run build
```

GitHub Actions runs syntax and architecture checks plus a production build on pushes and pull requests, and deploys successful builds from `main`.

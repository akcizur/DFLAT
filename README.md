# The Flat — DFLAT

A first-person apartment exploration game built with Three.js, Vite and Bun. Three.js is bundled locally; the runtime does not import the 3D engine from a CDN.

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

- **60 Hz simulation:** keyboard/mouse movement, camera synchronization, door easing, object animation and UI state update on a fixed 60 Hz step.
- **15 FPS world raster:** the apartment is rasterized into a low-resolution buffer fifteen times per second.
- **60 Hz pixel compositor:** Canvas2D presents the captured WebGL frame and progressively reveals it from top to bottom over the previous frame with a restrained amber scan line and pixelated sampling. It uses no custom GLSL shader, so a fragment-shader compile issue cannot blank the game.
- **Pixel textures and baked-light gradients:** compact nearest-filtered textures blend quantized warm/cool gradients and deterministic dither. A shared low-energy procedural light map adds stable, baked-style light pools; real lamps, sun lighting and shadowing still contribute depth.

The 15 FPS target describes the scene raster. Actual rate can be lower if the device cannot render in time. The presentation pass is separately capped at 60 Hz.

## GitHub Pages

The deployment workflow builds the static site into `dist/` and deploys to [akcizur.github.io/DFLAT](https://akcizur.github.io/DFLAT/). For the first deployment, select **GitHub Actions** under **Repository Settings → Pages → Build and deployment → Source**. The Vite base path is `/DFLAT/` in GitHub Actions and `/` during local development.

## Controls

- `W A S D` / arrow keys — move
- Mouse — look around with reduced sensitivity
- `E` — interact
- `Enter` — start or resume
- `Esc` — pause
- Touch screens — on-screen movement/action controls and drag-to-look

## Architecture

- `index.html` — game shell, centered BIOS menus and HUD.
- `styles.css`, `styles-cinematic.css` — responsive pixel/CRT interface.
- `assets/bg-scene-hq.png` — high-resolution panoramic exterior environment.
- `src/main.js` — 60 Hz fixed-step game loop, 15 FPS scene raster and presentation cadence.
- `src/game/pixel-post.js` — two saved frame buffers and a shader-free progressive Canvas2D scanline compositor.
- `src/game/materials.js` — pixel-gradient materials and procedural baked-light map.
- `src/game/world.js` — apartment geometry, lights, collision volumes and interactables.
- `src/game/player.js` — movement, collision response and camera synchronization.
- `src/game/input.js` — keyboard, pointer lock, mouse/touch look and interaction.
- `src/game/ui.js` — objective, inventory, notifications, menus and in-game clock.
- `scripts/check-architecture.mjs` — validates entry points, local dependencies and rendering targets.

## Checks

```sh
bun run check:syntax
bun run check
bun run build
```

GitHub Actions runs syntax and architecture checks plus a production build on pushes and pull requests, and deploys successful builds from `main`.

# DFLAT | Open Model World

A first-person low-poly neighbourhood built with Three.js, Vite and Bun. The game keeps the existing keyboard, mouse-look, jumping, touch and gamepad controls while using open model assets instead of the former empty map.

## Open model library

- Search and browse **1,883 CC0 1.0 Kenney models** from 19 packs in the in-game model browser.
- The build downloads a curated bundle of **32 pinned GLB assets**; the initial neighbourhood places a subset of them and the rest remain available in the model browser.
- Additional catalog models are loaded only when selected. The entire library is not downloaded or rendered at startup.
- Press `M` or select **MODEL LIBRARY** from the menu to browse. Choose a model and insert it into the world in front of the player.
- See [assets/OPEN_SOURCE_MODELS.md](assets/OPEN_SOURCE_MODELS.md) for sources, license details and the pinned upstream commit.

The model catalog and non-bundled models require an internet connection. The selected neighbourhood assets are downloaded before Vite starts or builds the app.

## Run locally

```sh
bun install
bun run dev
```

## Checks

```sh
bun run check:syntax
bun run check
bun run test
bun run build
bun run preview
```

## Controls

- `W A S D` / arrow keys: move
- `Shift`: run
- `Space`: jump
- Mouse: look around
- `E`: interact
- `M`: open or close the model library
- `Esc`: pause / close the model library
- Touch screens: on-screen movement and look controls
- Gamepad: left stick to move, right stick to look

## GitHub Pages

The deployment workflow prepares the pinned CC0 assets, runs syntax/architecture/tests, builds the static site into `dist/` and publishes it through GitHub Pages. Set the Pages source to **GitHub Actions** in repository settings.

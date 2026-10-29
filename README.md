# DFLAT | Panelák District

A first-person low-poly neighbourhood built with Three.js, Vite and Bun. The world now combines an original procedural four-storey panelák estate with pinned CC0 street assets, while preserving keyboard, mouse-look, jumping, touch and gamepad controls.

## Open model library

- Search and browse **1,883 CC0 1.0 Kenney models** from 19 packs in the in-game model browser.
- The build downloads a curated bundle of **25 pinned GLB assets**; the initial neighbourhood places a subset of them and the rest remain available in the model browser.
- Additional catalog models are loaded only when selected. The entire library is not downloaded or rendered at startup.
- Press `M` or select **MODEL LIBRARY** from the menu to browse. Choose a model and insert it into the world in front of the player.
- See [assets/OPEN_SOURCE_MODELS.md](assets/OPEN_SOURCE_MODELS.md) for sources, license details and the pinned upstream commit.

The core panelák geometry is generated locally in Three.js: four four-storey blocks, concrete-panel seams, inset windows, stacked balconies, recessed entrances, roof utility rooms, ventilation, courtyard paths, benches, planters, curbs, street lamps and zebra crossings. Repeated facade parts are batched with instanced meshes. Imported CC0 models supply the surrounding roads, vehicles, vegetation and street props.

The model catalog and non-bundled models require an internet connection. The selected CC0 neighbourhood assets are downloaded before Vite starts or builds the app.

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

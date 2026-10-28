# DFLAT | Cyberpunk Vertical City

A low-poly cyberpunk vertical city built additively on the existing Three.js, Vite and Bun game. The original CC0 model browser, keyboard, mouse-look, jump, touch and gamepad controls remain in place. The expansion adds neon towers, elevated skyways, smooth level lifts, object pickup/drop, switchable first/third-person cameras, street cars, hover cars and flying cars with arcade handling.

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
- `E`: interact, pick up/drop props, enter/exit vehicles, use vertical lifts
- `V`: switch first-person / third-person camera
- `Space`: jump on foot; gain altitude in a flying car
- `Ctrl`: descend while flying
- `W A S D`: arcade vehicle steering while in a vehicle
- `M`: open or close the model library
- `Esc`: pause / close the model library
- Touch screens: on-screen movement and look controls
- Gamepad: left stick to move, right stick to look

## Cyberpunk expansion\n\nThe additive module `src/game/cyberpunk-expansion.js` generates a vertical district from lightweight procedural geometry. The city uses four level anchors (0, 5.5, 11 and 17 metres), emissive cyan/magenta accents and arcade lifts. Existing model-library assets and the original neighbourhood generator are not replaced. The `feature/cyberpunk-vertical-city` branch is intended for review and CI validation before merging.\n\n## GitHub Pages

The deployment workflow prepares the pinned CC0 assets, runs syntax/architecture/tests, builds the static site into `dist/` and publishes it through GitHub Pages. Set the Pages source to **GitHub Actions** in repository settings.

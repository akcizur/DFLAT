# The Flat — DFLAT

A small first-person apartment exploration game built with Three.js and hosted as a static GitHub Pages site.

## Run locally

Because the game uses JavaScript modules, serve the folder over HTTP rather than opening `index.html` directly:

```sh
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Three.js is loaded from jsDelivr, so an internet connection is required.

## Architecture

- `index.html` — semantic page shell and the existing game HUD/menus.
- `styles.css` — all presentation; no inline style block is required.
- `assets/city-sunset.webp` — panoramic exterior background projected around the apartment as a 360-degree sky.
- `src/main.js` — bootstraps Three.js, shared game state, world, controller, input and render loop.
- `src/game/materials.js` — reusable material palette.
- `src/game/world.js` — continuous wall material, solid door headers, four exterior windows, accessible balcony, lighting, collision volumes and interactables.
- `src/game/player.js` — first-person movement, collision response, nearby interaction detection and camera sync.
- `src/game/input.js` — keyboard, pointer lock and touch input.
- `src/game/ui.js` — objectives, inventory display, notifications, menus' visual state and in-game clock.
- `scripts/check-architecture.mjs` — verifies entry points, local imports and JavaScript syntax.

The supplied city-at-sunset panorama is used as a 360-degree background visible through the exterior windows and bedroom balcony door.

The site intentionally has no bundler or install-time dependency, so GitHub Pages can serve it directly.

## Checks

Requires Node.js 20 or newer; no package installation is needed:

```sh
npm run check:syntax
npm run check
```

GitHub Actions runs the same checks for pushes and pull requests to `main`.

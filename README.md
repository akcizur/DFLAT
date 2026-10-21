# The Flat — DFLAT

A first-person apartment exploration game built with Three.js, Vite and Bun. Three.js is bundled into the site during the build, so the game no longer loads its 3D engine from a CDN.

## Run locally

Install [Bun](https://bun.sh/) if it is not installed, then run these commands from the project root:

```sh
bun install
bun run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173/`). The development server provides hot reload while keeping the complete Three.js engine local in `node_modules`.

To create and test the production build:

```sh
bun run check:syntax
bun run check
bun run build
bun run preview
```

The first `bun install` creates `bun.lock`. Commit that file along with future dependency changes so installs can be reproduced with `bun ci`.

## GitHub Pages

The deployment workflow builds the static site into `dist/` and deploys it to:

- `https://akcizur.github.io/DFLAT/`

For the first deployment, open **Repository Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. After that, pushes to `main` build and deploy the game automatically. The Vite configuration uses `/DFLAT/` as the base only in GitHub Actions; local development and preview use the root path.

## Controls

- `W A S D` / arrow keys — move
- Mouse — look around (lower default sensitivity)
- `E` — interact
- `Enter` — start or resume
- `Esc` — pause
- Touch screens — on-screen movement/action controls and drag-to-look

The renderer is capped at **17 FPS** by design to preserve the intended slow, pixelated presentation. Actual FPS can be lower if the device cannot render a frame within the target interval.

## Architecture

- `index.html` — semantic page shell, centered BIOS menus and the game HUD.
- `styles.css`, `styles-cinematic.css` — interface and visual styling.
- `assets/bg-scene-hq.png` — high-resolution panoramic exterior environment.
- `src/main.js` — local Three.js bootstrap, render loop, shared state and scene updates.
- `src/game/materials.js` — reusable material palette.
- `src/game/world.js` — apartment geometry, lighting, collisions and interactables.
- `src/game/player.js` — movement, collision response and camera sync.
- `src/game/input.js` — keyboard, pointer lock, mouse/touch look and actions.
- `src/game/ui.js` — objectives, inventory, notifications, menus and in-game clock.
- `scripts/check-architecture.mjs` — validates required files, local dependencies and JavaScript syntax.

## Checks

```sh
bun run check:syntax
bun run check
bun run build
```

GitHub Actions runs project checks on pushes and pull requests, and deploys successful builds from `main`.

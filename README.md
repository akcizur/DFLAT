# DFLAT | Empty Map

A first-person low-poly free-roam prototype built with Three.js, Vite and Bun.

The active gameplay scene is an open, empty map: a flat ground plane and an open background. The active scene generator contains no building geometry, apartment interiors, stairs, elevators, roads, architectural props, imported environment models or city-backdrop objects. First-person movement, jumping and camera controls remain enabled.

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
- `Esc`: pause or resume
- Touch screens: on-screen movement and look controls
- Gamepad: left stick to move, right stick to look

## GitHub Pages

The deployment workflow builds the static site into `dist/`. Set the Pages source to **GitHub Actions** in repository settings.

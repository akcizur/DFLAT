# DFLAT — Empty Map

A first-person, low-poly free-roam prototype built with Three.js, Vite and Bun. The active scene is intentionally empty: a large flat ground plane, open sky, and no buildings, apartments, roads, architectural props, or imported environment models.

## Run locally

```sh
bun install
bun run dev
```

## Checks

```sh
bun run check:syntax
bun run check
bun run build
bun run preview
```

## Scene

- Empty outdoor world with a flat ground plane.
- No building or apartment geometry.
- No city panorama or architectural background.
- First-person movement, keyboard, mouse, touch and gamepad controls remain enabled.
- Low-resolution pixel-grid rendering remains enabled.
- No CRT/VHS post-processing effects.

## GitHub Pages

The deployment workflow builds the static site into `dist/` and deploys to [DFLAT on GitHub Pages](https://akcizur.github.io/DFLAT/). Set Pages source to **GitHub Actions** in repository settings.

## Controls

- `W A S D` / arrow keys: move
- Mouse: look around
- `Esc`: pause or resume
- Touch screens: on-screen movement/look controls
- Gamepad: left stick to move, right stick to look

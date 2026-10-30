# DEPOO | Outer Rim Cargo Depot

DEPOO is a first-person low-poly exploration game set in a remote modular freight port. The former residential district has been removed. The playable world is composed from Kenney Space Kit GLB assets: hangars, gates, loading platforms, monorail parts, cargo craft, generators, pipes, crew and lunar terrain.

## World composition

- **Arrival corridor:** modular road tiles, intersections and terminal gates.
- **Freight apron:** raised loading platforms, cargo machinery, barrels and dispatch equipment.
- **Hangar district:** one primary hangar and four secondary halls with different silhouettes.
- **Monorail:** elevated track assembled from repeated track/support modules, with a train made from separate front and cargo cars.
- **Outer rim:** terrain pieces, satellite antenna, craters, rocks and a meteor outcrop.
- **Crew and control:** astronaut figures, dispatch console and service beacon.

All structures, vehicles, machines, characters and environmental props are loaded from the curated Space Kit GLB manifest. A simple ground plane remains as the base surface. No procedural apartment geometry remains in the world generator.

## Open asset library

The in-game browser exposes **1,883 CC0 1.0 models** from 19 Kenney packs. Press `M` or select **MODEL LIBRARY** in the start menu to search by model, pack or asset id. The build downloads only the 44 Space Kit components used by the world; other catalog models load only when selected.

See [assets/OPEN_SOURCE_MODELS.md](assets/OPEN_SOURCE_MODELS.md) for upstream source, pinned revision and license details.

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
- `E`: interact with the dispatch console or relay beacon
- `M`: open or close the model library
- `Esc`: pause / close the model library
- Touch screens: on-screen movement, look, jump and run controls
- Gamepad: left stick to move, right stick to look

## GitHub Pages

The repository remains named **DFLAT**, so Vite still publishes under `/DFLAT/`. The in-game title and product identity are **DEPOO**. Set Pages source to **GitHub Actions** in repository settings.

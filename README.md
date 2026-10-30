# DEPOO | Open City

DEPOO is a first-person low-poly city exploration game built from modular Kenney CC0 city assets. The previous outer-rim depot layout has been replaced by a connected urban environment with a downtown core, civic park, residential streets, commercial buildings, skyline and street traffic.

## City districts

- **Downtown:** multi-storey commercial buildings, skyscrapers, shop details, traffic lights and a central roundabout.
- **Civic park:** trees, planters, benches and interactive public lighting.
- **Residential quarters:** varied houses, driveways and small trees arranged around the street grid.
- **Market street:** low-rise stores, awnings and public-space props.
- **City edge:** distant low-detail buildings, utility poles and a skyline.
- **Street network:** modular straight roads, crossroads, road ends and a roundabout, assembled on a consistent grid.

All visible buildings, roads, vehicles, street furniture and vegetation are loaded as independent GLB assets. The only primitive surface is the ground/navigation plane. No space hangars, monorail or freight-depot geometry remains connected to the world generator.

## Asset library

The in-game browser exposes **1,883 CC0 1.0 models** from 19 Kenney packs. Press `M` or select **MODEL LIBRARY** in the start menu to search by model, pack or asset id. The build downloads only the selected city components into `public/models/`; other catalog models load only when selected.

The curated city set uses:
- **City Kit (Roads):** streets, crossroads, roundabout, street lights, traffic lights and signs.
- **City Kit (Commercial):** shops, office buildings, skyscrapers and low-detail skyline blocks.
- **City Kit (Suburban):** houses, trees, driveways and planters.
- **Car Kit:** sedans, taxis, service vehicles and delivery traffic.
- **Nature / Furniture kits:** trees, bushes, benches and bins.

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
- `E`: interact with park or street lighting
- `M`: open or close the model library
- `Esc`: pause / close the model library
- Touch screens: on-screen movement, look, jump and run controls
- Gamepad: left stick to move, right stick to look

## GitHub Pages

The repository remains named **DFLAT**, so Vite publishes under `/DFLAT/`. The in-game title and product identity are **DEPOO**. Set Pages source to **GitHub Actions** in repository settings.

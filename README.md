# DEPOO | Complete Open City

DEPOO is a first-person low-poly city exploration game built from modular Kenney CC0 assets. It is a complete, walkable urban map rather than a single street or a themed prop scene.

## The city

The map is arranged as a **seven-by-seven connected street network** with 36 city blocks and a playable area of roughly 224 × 224 metres.

- **Street network:** 273 fitted road modules, seven north-south avenues, seven cross streets, a central roundabout, marked crossings and street ends.
- **Downtown:** five skyline towers surrounded by commercial streets and a central traffic junction.
- **Market district:** four mixed-use blocks with fourteen shop/office variations, awnings, parasols and street details.
- **Civic quarter:** public buildings, pedestrian spaces and city services.
- **Residential neighbourhoods:** 69 houses in 23 blocks, with varied building types, driveways, gardens and trees.
- **Green space:** a central park and a smaller neighbourhood garden with trees, benches, planters and paths.
- **Parking and services:** parked cars, taxi, police, delivery van, ambulance, fire engine, refuse truck and utility vehicles.
- **Public life:** twelve static pedestrians, an accessible wheelchair character, a park dog, streetlights, traffic signals, signs, bins and utility poles.
- **City edge:** low-detail skyline buildings create a visual boundary beyond the playable street grid.

The authored layout contains **621 placed world instances using 106 curated model types**. Repeated GLB components are rendered with Three.js `InstancedMesh` batches, which keeps the larger city practical to run in a browser. Building and vehicle lots retain collision bounds, while the roads and main pedestrian routes stay open.

## Asset library

The build downloads the selected city modules into `public/models/` and writes a verified `manifest.json`. Each source model is checked against the pinned catalog for Kenney authorship, CC0-1.0 licensing and exact byte size.

The in-game browser still exposes the full **1,883-model CC0 catalog** from 19 Kenney packs. Press `M` or choose **MODEL LIBRARY** in the start menu to search the catalog. Additional models are loaded only when selected.

The city uses:
- **City Kit (Roads):** road pieces, roundabout, streetlights, traffic lights, signs and construction details.
- **City Kit (Commercial):** shops, public buildings, skyscrapers, awnings and distant skyline blocks.
- **City Kit (Suburban):** 21 house types, trees, driveways and planters.
- **Car Kit:** civilian, public-safety, delivery and utility vehicles.
- **Nature Kit / Furniture Kit:** trees, shrubs, benches and bins.
- **Mini Characters / Prototype Kit:** pedestrians, wheelchair character and dog.

See [assets/DEPOO_WORLD.md](assets/DEPOO_WORLD.md) for the district plan and [assets/OPEN_SOURCE_MODELS.md](assets/OPEN_SOURCE_MODELS.md) for source and license details.

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
- `E`: interact with park or downtown lighting
- `M`: open or close the model library
- `Esc`: pause / close the model library
- Touch screens: on-screen movement, look, jump and run controls
- Gamepad: left stick to move, right stick to look

## GitHub Pages

The repository remains named **DFLAT**, so Vite publishes under `/DFLAT/`. The in-game title and product identity are **DEPOO**. Set Pages source to **GitHub Actions** in repository settings.

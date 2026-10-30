# DEPOO | Modular world blueprint

DEPOO is a low-poly outer-rim freight campus built from reusable Kenney Space Kit GLB components. The old world layout is replaced by a connected multi-district site: an arrival spine feeds a dispatch court, two service wings and a freight yard, with an elevated monorail leading toward a five-hangar crescent.

## District plan

| District | Position / extent | Purpose |
|---|---:|---|
| Arrival | x = 0, z = 12 to -28 | Spawn approach and terminal gate |
| Dispatch court | centered near (0, 0, -38) | Command desk, crew and utility modules |
| West service wing | x = -20, z = -48 to -78 | Secondary gate, satellite equipment and service access |
| East service wing | x = 20, z = -58 to -78 | Alternate access and vehicle-side operations |
| Freight yard | centered near (0, 0, -68) | Two cargo pads, loading platforms, machines and pipework |
| Monorail | x = -13, y = 5.2, z = 12 to -108 | Continuous elevated freight line and three-car train |
| Hangar crescent | z = -94 to -122 | One primary hangar and four satellite halls |
| Perimeter | x = ±34 to ±43 | Terrain modules, rocks, crater and meteor landmark |

The player spawns at (0, 0, 9.2). The dispatch console remains at (4.2, 0, -35.5), and the service beacon remains available through the existing E interaction system.

## Component pipeline

All visible buildings, vehicles, transport pieces, machinery, crew and environmental props are instances of modular Space Kit GLBs. The world layout lives in `src/game/open-world.js`; repeated modules share one GLB load per asset id. A plain ground plane is retained as the navigation surface, not as a replacement for the modular environment.

The selected 44 components are resolved against a pinned Kenney CC0-1.0 catalog and downloaded to `public/models/` by `scripts/prepare-open-models.mjs` during development/build. The searchable in-game catalog exposes the wider library of 1,883 CC0 models on demand.

> Repository note: `assets/` currently contains the RetroCRT/PS1 rendering package and this source documentation. The actual 3D GLBs are generated into `public/models/` by the verified asset-preparation script, rather than checked into Git as duplicate binaries.

## Visual direction

- Slate lunar ground with cool atmospheric fill and warm directional light.
- Low-poly silhouettes, restrained amber service beacons and cyan dispatch lighting.
- PS1-style low-resolution rendering and the existing RetroCRT shader package.
- No procedural residential blocks, apartment modules or panelák geometry.

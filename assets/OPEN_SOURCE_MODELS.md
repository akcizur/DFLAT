# DEPOO | Open-source 3D models

DEPOO uses modular models by **Kenney** from the GLB asset library maintained at [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets).

- Upstream repository: https://github.com/Hidencod/tge-assets
- Pinned source revision: `eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3`
- Catalog: https://raw.githubusercontent.com/Hidencod/tge-assets/eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3/catalog.json
- Artist: [Kenney](https://kenney.nl/)
- License: **CC0 1.0 Universal**
- Attribution is not required, but appreciated.

## Components bundled for DEPOO

The build downloads 44 selected Space Kit components into `public/models/` and writes a verified `manifest.json`.

- **Terrain and roads:** modular road straight/cross/corner/end, terrain tiles and terrain sides.
- **Architecture:** large, small and round hangars; complex/simple gates; loading platforms and stairs.
- **Transit:** straight monorail track, track corner, support pillars, train front, cargo and box cars.
- **Vehicles:** cargo craft A/B and miner craft.
- **Operations:** generators, wireless machine, barrel machine, barrel stacks, pipes and pipe supports.
- **Crew and control:** two astronauts, computer desk, chair, satellite dish and detailed chimney.
- **Outer rim:** large rock, crater and detailed meteor.

The downloader refuses any model unless the pinned catalog identifies it as authored by Kenney and licensed CC0-1.0. Each downloaded file is checked against the catalog byte size.

## Full in-game catalog

The searchable browser exposes the 1,883 CC0 models listed in the pinned catalog. Additional models load only when selected and inserted into the scene; the entire library is not downloaded at startup.

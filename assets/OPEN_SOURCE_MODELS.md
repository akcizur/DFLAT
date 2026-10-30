# DEPOO | Open-source 3D models

DEPOO uses modular models by **Kenney** from the GLB asset library maintained at [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets).

- Upstream repository: https://github.com/Hidencod/tge-assets
- Pinned source revision: `eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3`
- Catalog: https://raw.githubusercontent.com/Hidencod/tge-assets/eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3/catalog.json
- Artist: [Kenney](https://kenney.nl/)
- License: **CC0 1.0 Universal**
- Attribution is not required, but appreciated.

## Components bundled for DEPOO

The build downloads the curated city component set into `public/models/` and writes a verified `manifest.json`.

- **Road network:** straight roads, crossroads, road ends, roundabout, street lights, traffic lights, signs and utility poles.
- **Commercial district:** low-rise shops, office blocks, five skyscraper variations, awnings and parasols.
- **Residential district:** twelve house variations, driveways, planters and street trees.
- **Traffic:** sedans, taxi, SUV, police, ambulance, fire engine, delivery vehicle and refuse truck.
- **Public realm:** oak and detailed trees, shrubs, benches, bins and park furniture.

The downloader refuses any model unless the pinned catalog identifies it as authored by Kenney and licensed CC0-1.0. Each downloaded file is checked against the catalog byte size.

## Full in-game catalog

The searchable browser exposes the 1,883 CC0 models listed in the pinned catalog. Additional models load only when selected and inserted into the scene; the entire library is not downloaded at startup.

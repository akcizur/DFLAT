# DEPOO | Open-source city models

DEPOO uses modular models by **Kenney** from the GLB asset library maintained at [Hidencod/tge-assets](https://github.com/Hidencod/tge-assets).

- Upstream repository: https://github.com/Hidencod/tge-assets
- Pinned source revision: `eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3`
- Catalog: https://raw.githubusercontent.com/Hidencod/tge-assets/eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3/catalog.json
- Artist: [Kenney](https://kenney.nl/)
- License: **CC0 1.0 Universal**
- Attribution is not required, but appreciated.

## Curated city bundle

The production build downloads **106 model types** into `public/models/` and writes a verified `manifest.json`. The world generator places 621 instances of those assets.

- **City Kit (Roads):** road straights and ends, crossroads, roundabout, road squares, streetlights, traffic lights, signs, dumpsters, utility poles and construction details.
- **City Kit (Commercial):** fourteen commercial building variations, five skyscrapers, twelve low-detail skyline variations, awnings, overhangs and parasols.
- **City Kit (Suburban):** all twenty-one house variations, two tree sizes, driveways and planters.
- **Car Kit:** sedan, taxi, SUV, police, delivery, van, ambulance, fire engine, refuse truck and truck.
- **Nature Kit:** oak, detailed and default trees, plus large shrubs.
- **Furniture Kit:** benches and bins.
- **Mini Characters:** twelve pedestrian variations and an accessible wheelchair character.
- **Prototype Kit:** dog prop for the central park.

The downloader refuses any model unless the pinned catalog identifies it as authored by Kenney and licensed CC0-1.0. Every downloaded file is checked against the catalog's exact byte size before it is written to the local model bundle.

## Full in-game catalog

The searchable model browser exposes the full 1,883 CC0 models listed in the pinned catalog. Models outside the curated 106-type city bundle are downloaded only when selected and inserted into the world; the entire library is not downloaded at startup.

The repository keeps its existing Three.js and Vite versions. All city geometry is client-side and the finished site remains deployable to GitHub Pages without a server-side API.

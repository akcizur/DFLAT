# DEPOO | Open city layout

DEPOO is a low-poly first-person city built from modular Kenney City Kit GLB components. The former space-depot scene is removed from the world generator and replaced with an urban environment that can be explored on foot.

## City plan

| District | Approximate position | Purpose |
|---|---:|---|
| Main arrival avenue | x = 0, z = 40 to -40 | Spawn approach and primary north-south street |
| Downtown | x = -16 to 16, z = -16 to 16 | Commercial buildings, towers and the central roundabout |
| Market street | x = -16 to 16, z = 16 to 32 | Low-rise stores, awnings and shop details |
| Civic park | around (-8, 0, 8) | Trees, planters, benches and interactive lighting |
| Residential quarters | x/z = ±24 | Detached houses, driveways and street trees |
| Skyline | beyond the 80 m street grid | Distant low-detail buildings and a taller landmark |

The player starts at (0, 0, 46), just outside the north end of the main avenue. Road modules are placed on an 8 m grid. Main streets cross at x/z coordinates -32, -16, 0, 16 and 32. A roundabout anchors the central crossing.

## Component pipeline

The world layout lives in `src/game/open-world.js`. Repeated modules share one GLB load per asset id, then individual instances receive their own position, rotation, scale and collision bounds.

The build resolves the selected modules against the pinned CC0 catalog and downloads them to `public/models/` through `scripts/prepare-open-models.mjs`. The 1,883-model search catalog remains available in-game, while only the curated city asset set is loaded at startup.

## Asset families

- **City Kit (Roads):** road tiles, crossroads, roundabout, signs, street lights and traffic lights.
- **City Kit (Commercial):** commercial buildings, skyscrapers, awnings and low-detail buildings.
- **City Kit (Suburban):** house variations, driveways, trees and planters.
- **Car Kit:** civilian and service vehicles.
- **Nature Kit / Furniture Kit:** trees, bushes, benches and bins.

All world buildings, vehicles, streets and props are modular GLB assets. The ground plane is retained only as the base navigation surface.

## Interactions

The E key toggles the civic park lighting and the downtown public lighting. These interactions preserve the existing first-person, keyboard, touch and gamepad systems.

## Visual direction

- Low-poly city silhouettes and restrained dusk lighting.
- Warm park and street lights against a cool blue-grey sky.
- Existing pixelated PS1 rendering and RetroCRT support.
- No space depot, freight hangars, monorail or procedural apartment geometry.

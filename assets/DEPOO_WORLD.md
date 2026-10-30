# DEPOO | Complete city blueprint

DEPOO is a first-person, low-poly open city assembled from modular Kenney CC0 GLB assets. The map is designed as a connected urban environment with a clear street hierarchy, consistent building setbacks, distinct districts, walkable public spaces and a populated city edge.

## Map scale and structure

- **Playable bounds:** approximately x/z = -112 to +112 metres.
- **Street module:** 8 metres after automatic footprint fitting.
- **Street lines:** -72, -48, -24, 0, 24, 48 and 72 metres on both axes.
- **Street tiles:** 273 unique modules, including the central roundabout, crossroads, crossings, straight segments and terminal ends.
- **City blocks:** 36 blocks between the main streets.
- **Player spawn:** (0, 0, 100), facing toward the downtown entrance.
- **World composition:** 610 object instances built from 106 curated model types.

## District plan

| District | Approximate position | Composition |
|---|---:|---|
| Downtown | x/z = -12 to 12 | Four tower blocks, five skyline buildings and the central roundabout |
| Market district | z = 36, x = -36 to 36 | Four blocks of shops/offices, awnings, parasols and parked cars |
| Civic quarter | around (36, 12) | Three civic buildings, public space and city services |
| Residential | distributed across 23 blocks | 66 varied homes, driveways, trees and gardens |
| Central park | around (-36, 12) | Eight trees, benches, planters, paths and interactive lighting |
| Neighbourhood garden | around (-36, -12) | Smaller green space with seating and vegetation |
| Parking and traffic | around (-60, 12) | Sedans, taxi, SUV, police and delivery vehicles |
| Utility quarter | around (60, -36) | Emergency vehicles, service trucks, utility details and construction props |
| City edge | beyond the main grid | Low-detail building silhouettes and utility poles |

## Modular asset assembly

The five towers sit inside reserved 24 m blocks rather than on road centerlines. Residential and commercial lots are inset from the 8 m carriageways, and the park layout uses a single connected plaza with seating and vegetation arranged around it.

The layout is defined in `src/game/open-world.js`. Repeated road, building, tree, streetlight, vehicle and character models are loaded once per asset ID and emitted as `THREE.InstancedMesh` batches. Each instance retains its own world matrix, so the city can repeat a modular part without producing a separate draw call for every object.

Every road module is fitted to an 8 m footprint. All GLB models are uniformly scaled, then recentered on their authored map coordinate and grounded at y=0. Runtime bounds are measured from the transformed GLB geometry, so building, vehicle and skyline collision boxes match the visible model rather than guessed dimensions. The browser audit checks every road tile, every building-to-road clearance, building overlaps, model centering and the entrance-to-city route.

## Asset families

- **City Kit (Roads):** road straights, crossroads, roundabout, road ends, crossings, traffic lights, streetlights, signs, utility poles and construction props.
- **City Kit (Commercial):** fourteen building models, five skyscraper variations, twelve low-detail skyline variations, awnings, overhangs and parasols.
- **City Kit (Suburban):** twenty-one house variations, driveways, two tree sizes and planters.
- **Car Kit:** sedans, taxis, SUVs, public-safety vehicles, delivery and utility vehicles.
- **Nature Kit / Furniture Kit:** oak and detailed trees, bushes, benches and bins.
- **Mini Characters / Prototype Kit:** twelve pedestrians, an accessible wheelchair character and a dog.

## Interactions

The existing E interaction toggles the central park lighting and the downtown public lighting. First-person keyboard, mouse, touch and gamepad controls remain active. The M key opens the complete 1,883-model CC0 browser.

## Visual direction

- Low-poly urban silhouettes, street-grid readability and restrained dusk lighting.
- Warm street and park lights against a cool blue-grey sky.
- Pixelated PS1 rendering and the existing RetroCRT package.
- The only procedural primitive is the underlying ground/navigation plane; buildings, roads, vehicles, people and public-space props are modular assets.

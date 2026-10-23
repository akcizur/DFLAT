# DFLAT — Empty Site / Dynamic Environment

A first-person Three.js exploration scene with an intentionally empty site. The live game contains no buildings: only ground, road markings, pavement and an approach path remain. A smooth accelerated day/night cycle and changing weather animate the outdoor environment. Historical Blender model generators are retained as independent authoring references and are not loaded by the runtime.

## Run locally

Install [Bun](https://bun.sh/) and run:

```sh
bun install
bun run check:syntax
bun run test
bun run check
bun run build
bun run preview
```

The live browser scene does not load the Blender GLB or generate a procedural building. The Blender generators are retained as separate source assets for future use, not as active scene geometry.

## Scene and controls

- **Empty site:** only terrain, road markings, sidewalks and the approach path remain. The browser does not instantiate or load any building meshes.
- **Rendering:** direct WebGL rendering with a compact pixel-grid canvas. Antialiasing and screen-wide post-processing are disabled.
- **Time and weather:** one full in-game day lasts four real-time minutes. Clear, overcast, rain and mist states blend their sky, sunlight and fog over several seconds. Rain particles are enabled anywhere on the empty site when it rains.
- **Input:** WASD / arrow keys to move; mouse to look; Space to jump; Esc to pause. Touch controls and Gamepad API remain available.

## Geometry and coordinate export

The retained Blender generator can measure evaluated building vertices and write (this data is not loaded by the live game):

- `public/models/t06b-panelak-v2.glb`: the building asset loaded by the browser.
- `public/data/t06b-panelak-v2.json`: measured object bounds, corners, semantic anchors, counts and nominal room-footprint schedule.
- `public/data/main-building-vertices.json` and `.csv`: normalized coordinate exports validated during the production build.

Coordinates in the Blender manifest use metres, with X across the facade, Y vertical in the authored/game coordinate system, and Z through the building depth. The nominal section is 18.0 × 12.0 m, with 2.8 m floor-to-floor spacing, four above-ground storeys and an 11.2 m roof datum. Entrance projections and roof details intentionally extend beyond the nominal structural footprint; validation measures the structural envelope separately from the projections.

GitHub Actions validates the retained generators, runs JavaScript and design regression tests, builds the site, and checks the rendered WebGL scene in Chromium before deployment.

## Design status

The nominal room-footprint schedule totals approximately 65.4 m² per flat (excluding the separate 4.0 m² loggia). This is a **visualisation concept, not construction documentation or a certification of compliance with ČSN 73 4301**. A dimensioned architectural design and qualified review would still be required to verify clear room dimensions, structural panels, fire and acoustic separation, daylight, accessibility, roof drainage and the exact historical T06B variant.

## Retained reference generators

- `tools/generate_t06b_panelak_v2.py`: active five-module T06B-inspired model.
- `tools/generate_socialist_block_17.py`: independent eight-storey socialist-era concept model.
- `tools/VP_OS_Building_Architecture_v4.py`: separate VP-OS architectural study.

No generated building model is active in the browser scene.

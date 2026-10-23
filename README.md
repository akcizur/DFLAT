# DFLAT — T06B Panelák V2

A compact first-person exploration game built with Three.js, Vite and Bun. The active branch introduces a Blender-authored, four-storey T06B-inspired Czechoslovak panelák: a five-module section, 18 m wide and 12 m deep, with one cellar, eight flats, two recessed loggias per floor, a central switch-back stair and luxfer glazing. There is no lift.

## Run locally

Install [Bun](https://bun.sh/) and [Blender](https://www.blender.org/), then run:

```sh
bun install
blender --background --python tools/generate_t06b_panelak_v2.py
bun run check:syntax
bun run test
bun run check
bun run build
bun run preview
```

The Blender step produces the editable scene, the browser GLB and the measured architectural manifest. The browser uses that GLB when available; the older procedural building remains only as a fallback.

## Scene and controls

- **Main building:** five 3.6 m structural modules (18.0 m total width), 12.0 m nominal shell depth, four above-ground storeys plus a 2.6 m cellar, eight flats and no lift.
- **Recessed loggias:** two 3.2 × 1.25 m bays per storey, with real full-height facade openings, set-back glazed doors, concrete returns and old metal railings.
- **Stairwell:** two switch-back flights of eight risers between storeys, a narrow intermediate landing and an open central slab void. Luxfer blocks light the stair facade.
- **Period finish:** weathered břízolit-inspired render, faded precast concrete, old enamelled metal, dark glazing and restrained housing-estate site details.
- **Environment:** the browser retains its road, terrain and approach path. Those preview-site meshes are excluded from the Blender building GLB to avoid duplicate floors or an oversized ground plane.
- **Rendering:** direct WebGL rendering with a compact pixel-grid canvas. Antialiasing and screen-wide post-processing are disabled.
- **Input:** WASD / arrow keys to move; mouse to look; Space to jump; E to interact with the stair label; Esc to pause. Touch controls and Gamepad API remain available.

## Geometry and coordinate export

The generator measures evaluated Blender mesh vertices and writes:

- `public/models/t06b-panelak-v2.glb`: the building asset loaded by the browser.
- `public/data/t06b-panelak-v2.json`: measured object bounds, corners, semantic anchors, counts and nominal room-footprint schedule.
- `public/data/main-building-vertices.json` and `.csv`: normalized coordinate exports validated during the production build.

Coordinates in the Blender manifest use metres, with X across the facade, Y vertical in the authored/game coordinate system, and Z through the building depth. The nominal section is 18.0 × 12.0 m, with 2.8 m floor-to-floor spacing, four above-ground storeys and an 11.2 m roof datum. Entrance projections and roof details intentionally extend beyond the nominal structural footprint; validation measures the structural envelope separately from the projections.

GitHub Actions installs Blender, regenerates the model and its coordinate manifest, runs syntax, design, collision and stair-navigation tests, builds the site, and checks the rendered WebGL scene in Chromium before deployment.

## Design status

The nominal room-footprint schedule totals approximately 65.4 m² per flat (excluding the separate 4.0 m² loggia). This is a **visualisation concept, not construction documentation or a certification of compliance with ČSN 73 4301**. A dimensioned architectural design and qualified review would still be required to verify clear room dimensions, structural panels, fire and acoustic separation, daylight, accessibility, roof drainage and the exact historical T06B variant.

## Retained reference generators

- `tools/generate_t06b_panelak_v2.py`: active five-module T06B-inspired model.
- `tools/generate_socialist_block_17.py`: independent eight-storey socialist-era concept model.
- `tools/VP_OS_Building_Architecture_v4.py`: separate VP-OS architectural study.

Only the T06B V2 GLB is intended as the active browser building on this branch.

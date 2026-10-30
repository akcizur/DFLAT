# DEPOO world layout

A remote outer-rim freight depot assembled from modular Space Kit GLBs. The visual language is low-poly sci-fi: slate lunar ground, cool atmospheric fill, warm directional light, amber service beacons and cyan dispatch lighting.

| Area | Position (metres) | Purpose |
|---|---:|---|
| Arrival spawn | (0, 0, 9.2) | Clear approach facing the depot |
| Terminal gate | (0, 0, -17) | First landmark |
| Dispatch console | (4.2, 0, -35.5) | Interactive control point |
| Loading apron | (0, 0, -48) | Cargo handling and craft parking |
| Main hangar | (0, 0, -101) | Primary destination |
| Monorail | x = -13, y = 5.2 | Elevated freight route |

All structures and props are loaded from the pinned Space Kit manifest. Repeated track and road parts are cloned from one GLB load per asset id. The ground plane is the only primitive scene surface. No panelák layout, apartment modules, procedural facades or residential interior remain connected to the world generator.

The dispatch console toggles a cyan core light. The relay beacon can be switched on and off through the existing E interaction system.

// Builds the complete apartment environment and its interactable objects.
export function createApartment({ THREE, scene, M, mat, LOW_POWER, state, ui }) {
      const colliders = [];
      const interactables = [];
      const meshesToAnimate = [];
      const doorAnimations = [];
      function animateDoor(pivot, collider, closedRotation, openRotation, closedBounds = null) {
        const door = { pivot, collider, closedRotation, openRotation, targetOpen: false, angle: closedRotation, progress: 0, closedBounds };
        doorAnimations.push(door);
        return door;
      }
  
      function box(name, x, y, z, sx, sy, sz, material, options = {}) {
        const geo = new THREE.BoxGeometry(sx, sy, sz);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z); mesh.name = name;
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        if (options.collider) colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, mesh, dynamic: options.dynamic || false });
        return mesh;
      }
      function addGroup(x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); return g; }
      function localBox(g, x, y, z, sx, sy, sz, material) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
      function cylinder(g, x, y, z, rt, rb, h, material, segments = 6) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
      function sphere(g, x, y, z, r, material, segments = 6) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
      function addCollider(x, z, sx, sz) { colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2 }); }
      function interact(id, name, description, x, z, action, range = 2.1) { interactables.push({ id, name, description, x, z, action, range, used: false }); }
  
      // FLOOR PLAN (16 × 12 m, x: west/east, z: north/south):
      // NW = living room, NE = kitchen + dining, SW = bedroom, SE = bathroom.
      // The main entrance is centered on the south wall. Keep the middle passage open;
      // the bedroom and bathroom each use a clearly framed 1.0–1.2 m doorway.
      // Apartment envelope. The ceiling is omitted so the compact floor plan stays readable.
      box('Podlaha', 0, -.12, 0, 16, .22, 12, M.floor);
      // Keep the floor as one uninterrupted surface: no raised plank strips or dark seam boxes.
      // Ceiling plane stays non-shadowing so it does not black out point-lit interior rooms.
      const ceiling = box('Strop', 0, 3.22, 0, 15.9, .1, 11.9, M.white);
      ceiling.castShadow = false;
      ceiling.receiveShadow = false;

      const wallH = 3.15, wallT = .24;
      function wall(x, z, sx, sz, material = M.wall) { box('Stěna', x, wallH / 2, z, sx, wallH, sz, material, { collider: true }); }
      // North end of the hallway opens through glass doors to a new loggia.
      wall(-4.5, -6, 7, wallT, M.wall); wall(4.5, -6, 7, wallT, M.wall);
      // Build exterior walls around real window openings. All wall sections share one material.
      const exteriorGlass = new THREE.MeshStandardMaterial({
        color: 0xa9c2d4, roughness: 0.28, metalness: 0.03,
        transparent: true, opacity: 0.32, side: THREE.DoubleSide
      });
      function exteriorSide(x, openings) {
        const minZ = -6, maxZ = 6;
        const inward = x < 0 ? 1 : -1;
        const ordered = [...openings].sort((a, b) => a.z - b.z);
        let cursor = minZ;
        for (const opening of ordered) {
          const start = opening.z - opening.width / 2;
          const end = opening.z + opening.width / 2;
          if (start > cursor) wall(x, (cursor + start) / 2, wallT, start - cursor, M.wall);

          const sill = opening.sill ?? 0.82;
          const top = opening.top ?? 2.72;
          const isBalcony = opening.kind === "balcony";
          if (sill > 0.02) {
            box("Obvodová stěna / parapet", x, sill / 2, opening.z, wallT, sill, opening.width, M.wall,
              isBalcony ? {} : { collider: true });
          }
          if (top < wallH) {
            box("Obvodová stěna / nad oknem", x, (wallH + top) / 2, opening.z, wallT, wallH - top, opening.width, M.wall,
              isBalcony ? {} : { collider: true });
          }

          const frameX = x + inward * 0.14;
          if (!isBalcony) {
            box("Okno / sklo", x + inward * 0.125, (sill + top) / 2, opening.z,
              0.035, top - sill, Math.max(0.12, opening.width - 0.12), exteriorGlass);
            box("Okno / středová příčka", frameX, (sill + top) / 2, opening.z,
              0.07, top - sill, 0.055, M.white);
          }
          box("Okno / rám horní", frameX, top, opening.z, 0.08, 0.08, opening.width + 0.10, M.white);
          box("Okno / rám spodní", frameX, sill, opening.z, 0.08, 0.08, opening.width + 0.10, M.white);
          for (const z of [start, end]) {
            box("Okno / rám boční", frameX, (sill + top) / 2, z, 0.08, top - sill + 0.10, 0.08, M.white);
          }
          cursor = end;
        }
        if (cursor < maxZ) wall(x, (cursor + maxZ) / 2, wallT, maxZ - cursor, M.wall);
      }
      exteriorSide(-8, [
        { z: -3.1, width: 2.25, sill: 0.85, top: 2.72, label: "obývák" },
        { z: 3.45, width: 1.8, sill: 0.05, top: 2.72, kind: "balcony", label: "ložnice" }
      ]);
      exteriorSide(8, [
        { z: -3.15, width: 2.25, sill: 0.85, top: 2.72, label: "kuchyně" },
        { z: 3.1, width: 2.25, sill: 0.85, top: 2.72, label: "koupelna" }
      ]);
      // 1.50 m entrance opening, centred and aligned to the door slab and frame.
      wall(-4.375, 6, 7.25, wallT); wall(4.375, 6, 7.25, wallT); // open entry gap in the middle
      // Four separate zones lead off one central hall: living, kitchen, bedroom and bathroom.
      // Cross-walls divide north/south rooms; the side walls of the hall have one doorway per room.
      wall(-4.5, .15, 7.0, .18, M.wall); wall(4.5, .15, 7.0, .18, M.wall);
      // West side of the hall: living doorway z=-4..-2.8; bedroom doorway z=1.8..3.0.
      wall(-1, -5.0, .18, 2.0, M.wall); wall(-1, -1.325, .18, 2.95, M.wall);
      wall(-1, 1.02, .18, 1.56, M.wall); wall(-1, 4.5, .18, 3.0, M.wall);
      // East side of the hall: matching openings into kitchen and bathroom.
      wall(1, -5.0, .18, 2.0, M.wall); wall(1, -1.325, .18, 2.95, M.wall);
      wall(1, 1.02, .18, 1.56, M.wall); wall(1, 4.5, .18, 3.0, M.wall);
      // Hallway-end loggia doors, with a walkable exterior platform and guard rail.
      for (const x of [-1.05, 1.05]) box('Zárubeň lodžie', x, 1.45, -6, .12, 2.9, .16, M.white);
      // The glazing ends at 2.73 m, the lintel starts there, and the wall block starts at 2.85 m.
      box('Nadpraží lodžie', 0, 2.79, -6, 2.22, .12, .16, M.white);
      box('Stěna nad lodžií', 0, (2.85 + wallH) / 2, -6, 2.1, wallH - 2.85, wallT, M.wall);
      const loggiaGlass = new THREE.MeshStandardMaterial({ color: 0xa9c2d4, roughness: .24, metalness: .08, transparent: true, opacity: .28, side: THREE.DoubleSide });
      const loggiaDoorPivot = addGroup(-.98, 0, -5.94);
      localBox(loggiaDoorPivot, .98, 1.38, -.04, 1.92, 2.70, .07, loggiaGlass);
      localBox(loggiaDoorPivot, 1.72, 1.38, -.085, .035, .16, .035, M.metal);
      const loggiaDoorCollider = { minX: -1.12, maxX: 1.12, minZ: -6.18, maxZ: -5.78, door: true };
      colliders.push(loggiaDoorCollider);
      const loggiaDoorAnim = animateDoor(loggiaDoorPivot, loggiaDoorCollider, 0, -1.15, { minX: -1.12, maxX: 1.12, minZ: -6.18, maxZ: -5.78 });
      box('Lodžie / podlaha', 0, -.045, -7.18, 3.25, .12, 2.2, M.tile);
      box('Lodžie / čelní zábradlí', 0, .56, -8.22, 3.25, 1.12, .08, M.metal, { collider: true });
      box('Lodžie / horní madlo', 0, 1.14, -8.22, 3.3, .07, .12, M.metal);
      for (let x = -1.52; x <= 1.53; x += .31) box('Lodžie / svislá příčka', x, .56, -8.22, .055, 1.04, .055, M.metal);
      box('Lodžie / levé zábradlí', -1.58, .56, -7.18, .08, 1.12, 2.12, M.metal, { collider: true });
      box('Lodžie / pravé zábradlí', 1.58, .56, -7.18, .08, 1.12, 2.12, M.metal, { collider: true });
      interact('loggiaDoor', 'Dveře na lodžii', 'Na konci chodby vedou skleněné dveře na lodžii.', -0.15, -5.0, () => {
        state.loggiaDoorOpen = !state.loggiaDoorOpen;
        loggiaDoorAnim.targetOpen = state.loggiaDoorOpen;
        if (state.loggiaDoorOpen) { loggiaDoorCollider.minX = 30; loggiaDoorCollider.maxX = 31; ui.showToast('Dveře na lodžii se otevírají.'); }
        else { ui.showToast('Dveře na lodžii se zavírají.'); }
      }, 2.3);

      // All interior doorways share a 1.20 m clear opening and identical timber frames.
      // The 2.16 m jambs meet the 2.22 m lintel top; wall infill begins exactly at that height.
      const interiorDoorways = [
        { room: 'obýváku', x: -1, z: -3.4, jambs: [-4.0, -2.8] },
        { room: 'kuchyně', x: 1, z: -3.4, jambs: [-4.0, -2.8] },
        { room: 'ložnice', x: -1, z: 2.4, jambs: [1.8, 3.0] },
        { room: 'koupelny', x: 1, z: 2.4, jambs: [1.8, 3.0] }
      ];
      for (const doorway of interiorDoorways) {
        for (const z of doorway.jambs) {
          box(`Zárubeň ${doorway.room}`, doorway.x, 1.08, z, .26, 2.16, .12, M.wood2);
        }
        box(`Nadpraží ${doorway.room}`, doorway.x, 2.16, doorway.z, .26, .12, 1.08, M.wood2);
        box(`Stěna nad dveřmi ${doorway.room}`, doorway.x, (2.22 + wallH) / 2, doorway.z, .18, wallH - 2.22, 1.2, M.wall);
      }

      // Entrance slab and its frame share a 1.50 m structural opening; the leaf fits the 1.38 m clear width.
      for (const x of [-.75, .75]) {
        box('Zárubeň vstupu', x, 1.40, 5.91, .12, 2.80, .26, M.wood2);
      }
      box('Nadpraží vstupu', 0, 2.86, 5.91, 1.65, .12, .26, M.wood2);
      box('Vstup / stěna nadpraží', 0, (2.92 + wallH) / 2, 5.91, 1.65, wallH - 2.92, .24, M.wall);
      // Trim and small visual wall marks.
      // North skirting is segmented with the wall geometry so it does not float across openings.
      // Keep the entrance clear: the south baseboard follows only the two solid wall sections.
      box('Lišta', -4.375, .10, 5.84, 7.25, .14, .07, M.wood);
      box('Lišta', 4.375, .10, 5.84, 7.25, .14, .07, M.wood);
      box('Lišta', -7.84, .10, 0, .07, .14, 11.5, M.wood);
      box('Lišta', 7.84, .10, 0, .07, .14, 11.5, M.wood);
      // Avoid continuous decorative strips across room openings; wall edges stay clean.
      // Rugs and a runner that makes the entry-to-center circulation legible.
      box('Chodba / běhoun', 0, .008, 0, 1.35, .02, 9.8, M.cloth);
      box('Obývák / koberec', -4.1, .006, -1.6, 5.1, .025, 3.1, M.rug);
      box('Ložnice / koberec', -4.8, .009, 3.15, 4.5, .025, 3.3, M.cloth);
      box('Kuchyň / podložka', 4.5, .009, -3.15, 5.3, .025, 2.6, M.dark);
  
      // Living area: sofa, coffee table, TV, low cabinet and plants.
      box('Sofa základ', -4.05, .48, -.6, 3.25, .72, 1.15, M.sofa, { collider: true });
      // Backrest is on the south side; the seats, coffee table and TV all face north.
      box('Sofa opěradlo', -4.05, 1.02, -.12, 3.25, .72, .34, M.sofaDark);
      for (const x of [-5.12, -4.05, -2.98]) box('Polštář', x, .91, -.20, .82, .20, .60, M.sofa);
      box('Područka', -5.62, .67, -.6, .24, .52, 1.0, M.sofaDark); box('Područka', -2.48, .67, -.6, .24, .52, 1.0, M.sofaDark);
      for (const x of [-5.1, -3.0]) for (const z of [-1.0, -.2]) box('Noha gauče', x, .14, z, .11, .28, .11, M.darkWood);
      box('Konferenční stolek', -4.0, .48, -2.0, 2.0, .13, .9, M.wood2, { collider: true });
      for (const x of [-4.7, -3.3]) for (const z of [-2.25, -1.75]) box('Noha stolku', x, .24, z, .10, .45, .10, M.darkWood);
      box('Časopis', -3.65, .57, -2.08, .46, .035, .30, M.white); box('Hrnek', -4.5, .68, -1.92, .16, .22, .16, M.ceramic);
      box('TV stolek', -4.05, .38, -5.48, 2.3, .60, .48, M.wood, { collider: true });
      box('Televize', -4.05, 1.48, -5.70, 1.85, 1.05, .20, M.black);
      box('Obrazovka TV', -4.05, 1.49, -5.58, 1.60, .86, .018, M.screen);
      box('LED tečka', -3.25, 1.0, -5.56, .035, .035, .025, M.yellow);
      interact('tv', 'Televize', 'Na obrazovce se jen odráží pokoj.', -4.05, -4.55, () => { ui.showToast('Televize je vypnutá. V odrazu vypadá byt větší.'); }, 2.3);
      // Bedroom balcony: a hinged glass door, walkable floor and collidable guard rails.
      const balconyDoorPivot = addGroup(-7.86, 0, 2.55);
      localBox(balconyDoorPivot, 0, 1.35, 0.90, 0.065, 2.62, 1.68, exteriorGlass);
      localBox(balconyDoorPivot, 0.045, 1.20, 1.57, 0.04, 0.18, 0.04, M.metal);
      const balconyDoorCollider = { minX: -8.15, maxX: -7.74, minZ: 2.55, maxZ: 4.35, door: true };
      colliders.push(balconyDoorCollider);
      const balconyDoorAnim = animateDoor(balconyDoorPivot, balconyDoorCollider, 0, 1.2, { minX: -8.15, maxX: -7.74, minZ: 2.55, maxZ: 4.35 });
      box('Balkon / podlaha', -9.0, -0.045, 3.45, 2.0, 0.12, 2.18, M.dark);
      box('Balkon / vnější zábradlí', -9.96, 0.58, 3.45, 0.08, 1.16, 2.18, M.metal, { collider: true });
      box('Balkon / horní madlo', -9.0, 1.12, 2.40, 1.92, 0.08, 0.08, M.metal, { collider: true });
      box('Balkon / horní madlo', -9.0, 1.12, 4.50, 1.92, 0.08, 0.08, M.metal, { collider: true });
      box('Balkon / boční zábradlí', -9.0, 0.58, 2.40, 1.92, 1.16, 0.08, M.metal, { collider: true });
      box('Balkon / boční zábradlí', -9.0, 0.58, 4.50, 1.92, 1.16, 0.08, M.metal, { collider: true });
      for (let z = 2.52; z <= 4.38; z += 0.31) {
        box('Balkon / svislá příčka', -9.96, 0.58, z, 0.06, 1.08, 0.055, M.metal);
      }
      interact('balconyDoor', 'Balkonové dveře', 'Skleněné dveře vedou na balkon.', -7.05, 3.45, () => {
        state.balconyDoorOpen = !state.balconyDoorOpen;
        balconyDoorAnim.targetOpen = state.balconyDoorOpen;
        if (state.balconyDoorOpen) { balconyDoorCollider.minX = 30; balconyDoorCollider.maxX = 31; ui.showToast('Balkonové dveře se otevírají.'); }
        else { ui.showToast('Balkonové dveře se zavírají.'); }
      }, 2.35);

      // Plants.
      function addPlant(x, z, scale = 1) { const g = addGroup(x, 0, z); cylinder(g, 0, .28, 0, .22 * scale, .28 * scale, .55 * scale, M.wood2, 5); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; sphere(g, Math.cos(a) * .17 * scale, .64 * scale, Math.sin(a) * .17 * scale, .22 * scale, M.plant, 1); } sphere(g, 0, .82 * scale, 0, .23 * scale, M.leaf, 1); addCollider(x, z, .55 * scale, .55 * scale); return g; }
      addPlant(-6.75, -4.65, 1.15); addPlant(-6.7, -.55, .8); addPlant(7, -1.2, .8);
  
      // Kitchen units, oven, sink and fridge.
      for (let i = 0; i < 5; i++) {
        const x = 2.1 + i * 1.13;
        box('Kuchyňská skříňka', x, .50, -5.22, 1.05, .98, .86, i % 2 ? M.wood : M.wood2, { collider: true });
        box('Dvířka skříňky', x, .49, -4.775, .82, .72, .025, i % 2 ? M.wood2 : M.wood);
        box('Madlo', x + .28, .52, -4.74, .06, .035, .035, M.metal);
      }
      box('Kuchyňská deska', 4.36, 1.04, -5.18, 5.85, .13, 1.0, M.ceramic);
      for (let i = 0; i < 4; i++) { const x = 2.65 + i * 1.18; box('Horní skříňka', x, 2.2, -5.70, .98, .95, .38, M.wood, { collider: true }); box('Horní dvířka', x, 2.2, -5.49, .78, .72, .025, M.wood2); }
      box('Dřez', 3.1, 1.12, -5.10, .88, .035, .62, M.metal); box('Dřez vnitřek', 3.1, 1.145, -5.1, .68, .018, .42, M.dark);
      cylinder(scene, 0, 0, 0, .01, .01, .01, M.dark); // harmless tiny origin detail
      const faucet = cylinder(addGroup(3.1, 0, -5.31), 0, 1.30, 0, .045, .045, .34, M.metal, 6); faucet.rotation.z = .2;
      box('Sporák', 5.35, 1.14, -5.16, 1.45, .10, .82, M.dark);
      for (const x of [4.95, 5.65]) for (const z of [-5.4, -4.95]) cylinder(addGroup(x, 0, z), 0, 1.22, 0, .17, .17, .035, M.metal, 8);
      // Refrigerator: a tall landmark in the kitchen.
      box('Lednice', 7.0, 1.12, -3.95, 1.15, 2.18, 1.25, M.fridge, { collider: true });
      box('Dvířka lednice', 6.98, 1.15, -3.30, 1.05, 2.03, .035, M.white);
      box('Madlo lednice', 7.36, 1.23, -3.265, .045, .68, .05, M.metal);
      interact('fridge', 'Lednice', 'Lednice ti připomene, že bys měl nakoupit.', 6.0, -3.95, () => { ui.showToast('Lednice: půlka citronu, hořčice a světlo.'); }, 2.4);
      // Dining table with the key clearly visible as a tiny bright object.
      box('Jídelní stůl', 3.55, .80, -2.45, 2.0, .14, 1.05, M.wood2, { collider: true });
      for (const x of [2.75, 4.35]) for (const z of [-2.83, -2.07]) box('Noha jídelního stolu', x, .4, z, .12, .78, .12, M.darkWood);
      for (const [x, z] of [[2.35, -2.45], [4.75, -2.45], [3.55, -1.68]]) {
        box('Židle sedák', x, .48, z, .58, .12, .57, M.wood, { collider: true }); box('Židle opěradlo', x, .88, z + .23, .56, .72, .12, M.wood2);
        for (const dx of [-.21, .21]) for (const dz of [-.2, .2]) box('Židle noha', x + dx, .23, z + dz, .08, .45, .08, M.darkWood);
      }
      // Brass key: visible silhouette, with colliders omitted so it can be collected.
      const keyGroup = addGroup(3.25, .98, -2.42);
      cylinder(keyGroup, 0, .02, 0, .095, .095, .025, M.yellow, 10); cylinder(keyGroup, 0, .02, 0, .045, .045, .03, M.wood, 10);
      const shaft = localBox(keyGroup, .20, .02, 0, .32, .045, .045, M.yellow); const tooth = localBox(keyGroup, .31, -.015, 0, .06, .09, .045, M.yellow); keyGroup.rotation.y = .45;
      meshesToAnimate.push({ object: keyGroup, baseY: .98, phase: 0 });
      interact('keys', 'Klíče od bytu', 'Na stole leží tvoje klíče.', 3.25, -2.42, () => {
        if (!state.hasKeys) { state.hasKeys = true; keyGroup.visible = false; ui.updateObjective(state); ui.showToast('Klíče sebrány. Teď můžeš odemknout vstupní dveře.'); }
        else ui.showToast('Klíče už máš.');
      }, 2.0);
      // Tiny mug and a dish.
      cylinder(addGroup(2.8, 0, -2.4), 0, 1.0, 0, .11, .13, .18, M.ceramic, 8);
  
      // Bedroom: bed, side tables, lamp and wardrobe.
      box('Rám postele', -4.8, .36, 3.42, 3.35, .42, 2.6, M.darkWood, { collider: true });
      box('Matrace', -4.8, .64, 3.36, 3.18, .32, 2.42, M.bedding);
      box('Peřina', -4.8, .83, 3.92, 3.12, .12, 1.26, M.blanket);
      box('Polštář', -5.6, .87, 2.55, 1.0, .18, .55, M.white); box('Polštář', -4.0, .87, 2.55, 1.0, .18, .55, M.white);
      box('Čelo postele', -4.8, .85, 2.10, 3.35, .95, .16, M.wood2);
      box('Noční stolek', -2.5, .50, 2.65, .88, 1.0, .78, M.wood, { collider: true });
      box('Noční stolek deska', -2.5, 1.04, 2.65, 1.0, .10, .88, M.wood2);
      cylinder(addGroup(-2.5, 0, 2.65), 0, 1.28, 0, .16, .20, .36, M.yellow, 5);
      sphere(addGroup(-2.5, 0, 2.65), 0, 1.50, 0, .19, M.light, 1);
      // Wardrobe is aligned to the west wall; its doors face into the bedroom (east).
      box('Šatní skříň', -7.3, 1.30, 1.8, 1.15, 2.55, 1.45, M.wood, { collider: true });
      for (const z of [1.45, 2.1]) { box('Skříň / dveře', -6.70, 1.3, z, .035, 2.30, .60, M.wood2); box('Skříň / madlo', -6.665, 1.3, z + .18, .035, .34, .035, M.metal); }
      interact('bed', 'Postel', 'Na chvíli by sis mohl lehnout. Ale ještě ne.', -4.8, 3.42, () => { ui.showToast('Zavřeš oči. Z vedlejšího bytu je slyšet televize.'); }, 2.5);
      // Bathroom intentionally left empty for the next furnishing pass.
      box('Koupelnová dlažba', 5.0, .018, 3.1, 5.5, .02, 4.2, M.tile);

      // Shallow shoe storage is mounted to the west side of the entrance hall, away from the walking line.
      box('Předsíň / botník', -.83, .28, 5.15, .34, .48, .85, M.wood, { collider: true });
      box('Botník / sedák', -.83, .56, 5.15, .36, .08, .88, M.cloth);
      // Front door with a simple animated hinge.
      const doorPivot = addGroup(-.69, 0, 5.86);
      const doorMesh = localBox(doorPivot, .69, 1.40, 0, 1.38, 2.80, .13, M.wood2);
      localBox(doorPivot, 1.18, 1.42, -.08, .04, .10, .04, M.yellow);
      localBox(doorPivot, .20, 1.42, -.08, .04, .10, .04, M.darkWood);
      const doorCollider = { minX: -.75, maxX: .75, minZ: 5.63, maxZ: 6.1, door: true }; colliders.push(doorCollider);
      const frontDoorAnim = animateDoor(doorPivot, doorCollider, 0, -1.35, { minX: -.75, maxX: .75, minZ: 5.63, maxZ: 6.1 });
      interact('frontdoor', 'Vstupní dveře', 'Dveře jsou zamčené. Potřebuješ klíče.', 0, 5.1, () => {
        if (!state.hasKeys) { ui.showToast('Zamčeno. Klíče budou někde v bytě.'); return; }
        state.doorOpen = !state.doorOpen;
        frontDoorAnim.targetOpen = state.doorOpen;
        if (state.doorOpen) {
          doorCollider.minX = 20; doorCollider.maxX = 21;
          ui.showToast('Zámek cvakne. Dveře se pomalu otevírají.');
          ui.updateObjective(state);
        } else {
          doorCollider.minX = 20; doorCollider.maxX = 21;
          ui.showToast('Vstupní dveře se zavírají.');
        }
      }, 2.2);
  
  
      // Distant low-poly city LOD: simple silhouettes sit beyond the balcony/window openings,
      // in front of the panoramic sky sphere. No collision, animation, or shadow cost.
      const skyline = new THREE.Group();
      skyline.name = 'Distant city / low-poly LOD';
      const skylineMats = [
        new THREE.MeshStandardMaterial({ color: 0x454653, roughness: 1, metalness: 0 }),
        new THREE.MeshStandardMaterial({ color: 0x55515b, roughness: 1, metalness: 0 }),
        new THREE.MeshStandardMaterial({ color: 0x66545a, roughness: 1, metalness: 0 }),
        new THREE.MeshStandardMaterial({ color: 0x343946, roughness: 1, metalness: 0 })
      ];
      const skylineSeed = (n) => {
        const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return v - Math.floor(v);
      };
      function skylineBlock(x, z, width, depth, height, material, index) {
        const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        building.position.set(x, height / 2 - .15, z);
        building.name = 'Distant skyline block';
        building.castShadow = false;
        building.receiveShadow = false;
        skyline.add(building);
        // A few larger roof blocks break up the silhouette without expensive window meshes.
        if (index % 4 === 0 && height > 5) {
          const rooftop = new THREE.Mesh(new THREE.BoxGeometry(width * .28, height * .08, depth * .32), material);
          rooftop.position.set(x + width * .12, height + height * .04 - .15, z);
          rooftop.castShadow = false;
          rooftop.receiveShadow = false;
          skyline.add(rooftop);
        }
      }
      let skylineIndex = 0;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 13; i++) {
          const z = -24 + i * 3.9;
          const width = 2.2 + skylineSeed(i + side * 19) * 3.6;
          const depth = 2.2 + skylineSeed(i + side * 43) * 2.8;
          const height = 4 + skylineSeed(i + side * 71) * 13;
          skylineBlock(side * (14 + skylineSeed(i + side * 97) * 5), z, width, depth, height, skylineMats[(i + (side > 0 ? 1 : 0)) % skylineMats.length], skylineIndex++);
        }
      }
      for (let i = 0; i < 15; i++) {
        const x = -23 + i * 3.25;
        const width = 2.0 + skylineSeed(i + 111) * 3.4;
        const depth = 2.2 + skylineSeed(i + 222) * 2.6;
        const height = 5 + skylineSeed(i + 333) * 15;
        skylineBlock(x, -17 - skylineSeed(i + 444) * 5, width, depth, height, skylineMats[(i + 2) % skylineMats.length], skylineIndex++);
      }
      scene.add(skyline);

      // One simple ceiling cube and one matching point light for every enclosed zone.
      scene.add(new THREE.HemisphereLight(0xc7d1d8, 0x332b24, 0.72));
      const roomFixtureMaterial = new THREE.MeshBasicMaterial({ color: 0xffdfbd, toneMapped: false });
      const roomLights = [
        { name: 'Světlo / obývák', x: -4.5, z: -3.0 },
        { name: 'Světlo / kuchyně', x: 4.5, z: -3.0 },
        { name: 'Světlo / ložnice', x: -4.5, z: 3.0 },
        { name: 'Světlo / koupelna', x: 4.5, z: 3.0 },
        { name: 'Světlo / chodba', x: 0, z: 0 }
      ];
      for (const room of roomLights) {
        const light = new THREE.PointLight(0xffdfbd, 7, 7.5, 2);
        light.name = room.name;
        light.position.set(room.x, 2.78, room.z);
        light.castShadow = false;
        scene.add(light);

        const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.32), roomFixtureMaterial);
        fixture.name = room.name + ' / svítidlo';
        fixture.position.set(room.x, 3.06, room.z);
        fixture.castShadow = false;
        fixture.receiveShadow = false;
        scene.add(fixture);
      }

  return { colliders, interactables, meshesToAnimate, doorAnimations };
}

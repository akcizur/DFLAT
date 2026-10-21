// Builds the complete apartment environment and its interactable objects.
export function createApartment({ THREE, scene, M, mat, LOW_POWER, state, ui }) {
      const colliders = [];
      const interactables = [];
      const meshesToAnimate = [];
  
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
      // Broad low-resolution floorboard bands, with staggered joints for an 8-bit / PS1 hybrid look.
      for (let z = -5.5, row = 0; z <= 5.5; z += .62, row++) {
        const tone = row % 2 ? M.wood : M.floor;
        box('Podlahové prkno', 0, .005, z, 15.72, .018, .58, tone);
        const offset = row % 2 ? -1.15 : 0;
        for (let x = -6.75 + offset; x <= 6.75; x += 2.5) {
          box('Spára podlahy', x, .015, z, .018, .004, .55, M.darkWood);
        }
      }
      // Ceiling plane stays non-shadowing so it does not black out point-lit interior rooms.
      const ceiling = box('Strop', 0, 3.22, 0, 15.9, .1, 11.9, M.white);
      ceiling.castShadow = false;
      ceiling.receiveShadow = false;
      for (const x of [-6.5, 0, 6.5]) box('Stropní stínová lišta', x, 3.16, 0, .055, .055, 11.5, M.wall2);
      const wallH = 3.15, wallT = .24;
      function wall(x, z, sx, sz, material = M.wall) { box('Stěna', x, wallH / 2, z, sx, wallH, sz, material, { collider: true }); }
      wall(-8, 0, wallT, 12); wall(8, 0, wallT, 12); wall(0, -6, 16, wallT);
      wall(-4.5, 6, 7, wallT); wall(4.5, 6, 7, wallT); // open entry gap in the middle
      // Four separate zones lead off one central hall: living, kitchen, bedroom and bathroom.
      // Cross-walls divide north/south rooms; the side walls of the hall have one doorway per room.
      wall(-4.5, .15, 7.0, .18, M.wall2); wall(4.5, .15, 7.0, .18, M.wall2);
      // West side of the hall: living doorway z=-4..-2.8; bedroom doorway z=1.8..3.0.
      wall(-1, -5.0, .18, 2.0, M.wall2); wall(-1, -1.325, .18, 2.95, M.wall2);
      wall(-1, 1.02, .18, 1.56, M.wall2); wall(-1, 4.5, .18, 3.0, M.wall2);
      // East side of the hall: matching openings into kitchen and bathroom.
      wall(1, -5.0, .18, 2.0, M.wall2); wall(1, -1.325, .18, 2.95, M.wall2);
      wall(1, 1.02, .18, 1.56, M.wall2); wall(1, 4.5, .18, 3.0, M.wall2);
      // Decorative jambs and lintels. These frame openings without adding collision blockers.
      for (const z of [-4.0, -2.8]) box('Zárubeň obýváku', -1, 1.08, z, .26, 2.16, .12, M.wood2);
      box('Nadpraží obýváku', -1, 2.16, -3.4, .26, .12, 1.08, M.wood2);
      for (const z of [-4.0, -2.8]) box('Zárubeň kuchyně', 1, 1.08, z, .26, 2.16, .12, M.wood2);
      box('Nadpraží kuchyně', 1, 2.16, -3.4, .26, .12, 1.08, M.wood2);
      for (const z of [1.8, 3.0]) box('Zárubeň ložnice', -1, 1.08, z, .26, 2.16, .12, M.wood2);
      box('Nadpraží ložnice', -1, 2.16, 2.4, .26, .12, 1.08, M.wood2);
      for (const z of [1.8, 3.0]) box('Zárubeň koupelny', 1, 1.08, z, .26, 2.16, .12, M.white);
      box('Nadpraží koupelny', 1, 2.16, 2.4, .26, .12, 1.08, M.white);
      // Trim and small visual wall marks.
      box('Lišta', 0, .10, -5.84, 15.45, .14, .07, M.wood);
      // Keep the entrance clear: the south baseboard follows only the two solid wall sections.
      box('Lišta', -4.5, .10, 5.84, 7.0, .14, .07, M.wood);
      box('Lišta', 4.5, .10, 5.84, 7.0, .14, .07, M.wood);
      box('Lišta', -7.84, .10, 0, .07, .14, 11.5, M.wood);
      box('Lišta', 7.84, .10, 0, .07, .14, 11.5, M.wood);
      // Low skirting on both north/south room dividers, split only by the central hall.
      // Visible skirting on both faces of each cross-wall; each strip is aligned to the wall face.
      for (const x of [-4.5, 4.5]) {
        box('Lišta příčky / sever', x, .10, .06, 7.0, .12, .05, M.wood);
        box('Lišta příčky / jih', x, .10, .24, 7.0, .12, .05, M.wood);
      }
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
      // Window in the left wall, represented as a luminous plane and chunky frame.
      box('Okno', -7.82, 2.0, -3.1, .025, 1.45, 2.25, M.glass);
      for (const y of [1.25, 2.75]) box('Rám okna', -7.78, y, -3.1, .12, .10, 2.45, M.white);
      for (const z of [-4.25, -1.95]) box('Rám okna', -7.78, 2.0, z, .12, 1.55, .10, M.white);
      box('Příčka okna', -7.75, 2.0, -3.1, .12, 1.45, .10, M.white);
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
      // Bathroom objects.
      box('Koupelnová dlažba', 5.0, .018, 3.1, 5.5, .02, 4.2, M.tile);
      box('Pračka', 6.8, .55, 4.65, 1.05, 1.1, .95, M.white, { collider: true });
      cylinder(addGroup(6.8, 0, 4.155), 0, .56, 0, .31, .31, .04, M.dark, 12);
      cylinder(addGroup(6.8, 0, 4.12), 0, .56, 0, .22, .22, .045, M.glass, 12);
      box('Umyvadlo', 4.8, 1.0, 4.72, 1.4, .15, .65, M.ceramic, { collider: true });
      box('Skříňka pod umyvadlem', 4.8, .5, 4.72, 1.22, .85, .52, M.white, { collider: true });
      box('Zrcadlo', 4.8, 1.95, 5.77, 1.30, 1.0, .04, M.glass);
      box('Rám zrcadla', 4.8, 1.95, 5.73, 1.44, 1.12, .06, M.white);
      box('Toaleta', 3.4, .36, 4.4, .72, .68, .95, M.ceramic, { collider: true });
      box('Toaleta / nádrž', 3.4, .82, 4.80, .68, .75, .30, M.white);
      interact('bath', 'Zrcadlo', 'Vypadáš přesně tak, jak ses cítil.', 4.8, 4.72, () => { ui.showToast('Zrcadlo: „Zítra začnu dřív.“'); }, 2.2);
      // Shallow shoe storage is mounted to the west side of the entrance hall, away from the walking line.
      box('Předsíň / botník', -.83, .28, 5.15, .34, .48, .85, M.wood, { collider: true });
      box('Botník / sedák', -.83, .56, 5.15, .36, .08, .88, M.cloth);
      // Front door with a simple animated hinge.
      const doorPivot = addGroup(-.82, 0, 5.86);
      const doorMesh = localBox(doorPivot, .68, 1.40, 0, 1.36, 2.80, .13, M.wood2);
      localBox(doorPivot, 1.18, 1.42, -.08, .04, .10, .04, M.yellow);
      localBox(doorPivot, .20, 1.42, -.08, .04, .10, .04, M.darkWood);
      const doorCollider = { minX: -.9, maxX: .9, minZ: 5.63, maxZ: 6.1, door: true }; colliders.push(doorCollider);
      interact('frontdoor', 'Vstupní dveře', 'Dveře jsou zamčené. Potřebuješ klíče.', 0, 5.1, () => {
        if (!state.hasKeys) { ui.showToast('Zamčeno. Klíče budou někde v bytě.'); return; }
        if (!state.doorOpen) { state.doorOpen = true; doorPivot.rotation.y = -1.35; doorCollider.minX = 20; doorCollider.maxX = 21; ui.showToast('Odemčeno. Čerstvý vzduch z chodby.'); ui.updateObjective(state); }
        else { ui.showToast('Dveře už jsou otevřené. Venku na tebe čeká chodba.'); ui.completeGame(state); }
      }, 2.2);
  
      // Reference rendering setup: hemisphere fill, PCF sun shadows on desktop, warm room pools.
      scene.add(new THREE.HemisphereLight(0xc7d1d8, 0x332b24, 1.05));
      const sun = new THREE.DirectionalLight(0xbfd7ff, 1.65);
      sun.position.set(-4, 7, 5);
      sun.castShadow = !LOW_POWER;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -10;
      sun.shadow.camera.right = 10;
      sun.shadow.camera.top = 8;
      sun.shadow.camera.bottom = -8;
      sun.shadow.camera.near = .5;
      sun.shadow.camera.far = 25;
      sun.shadow.bias = -0.0005;
      scene.add(sun);
      const warm = new THREE.PointLight(0xffd29a, 42, 18, 2);
      warm.position.set(0, 2.82, -.4);
      scene.add(warm);
      const livingLight = new THREE.PointLight(0xffd29a, 16, 10, 2);
      livingLight.position.set(-4.2, 2.55, -2.8);
      scene.add(livingLight);
      const kitchenLight = new THREE.PointLight(0xffe8bd, 22, 11, 2);
      kitchenLight.position.set(4, 2.7, -3.7);
      scene.add(kitchenLight);
      const bedLight = new THREE.PointLight(0xffc781, 11, 7, 2);
      bedLight.position.set(-2.5, 1.55, 2.65);
      scene.add(bedLight);
      const bathLight = new THREE.PointLight(0xd6eaff, 8, 7, 2);
      bathLight.position.set(5, 2.7, 3.8);
      scene.add(bathLight);
      const lampShade = mat(0xd7a35f, .85);
      const lampGlow = mat(0xffdca8, .45);
      lampGlow.emissive.set(0x5a3518);
      lampGlow.emissiveIntensity = .7;
      const ceilingLamp = addGroup(0, 0, -.4);
      cylinder(ceilingLamp, 0, 2.94, 0, .27, .27, .1, M.black, 6);
      cylinder(ceilingLamp, 0, 2.84, 0, .42, .3, .25, lampShade, 6);
      sphere(ceilingLamp, 0, 2.72, 0, .16, lampGlow, 1);

  return { colliders, interactables, meshesToAnimate };
}

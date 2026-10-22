// Low-poly Czech panel apartment block: P + 2, flat roof, empty apartment shells.
export function createPanelak({ THREE, scene }) {
  const root = new THREE.Group();
  root.name = "Panelák / P + 2 + střecha / holobyty";
  root.position.set(0, 0, -15.9);
  const mat = (color, roughness = 0.96) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const concrete = mat(0xb9b7af);
  const concreteDark = mat(0x858984);
  const slabMat = mat(0x9c9d98);
  const inside = mat(0xd5d2c9);
  const glass = mat(0x43545c, 0.3);
  const frame = mat(0xe3e0d7);
  const metal = mat(0x525b5e, 0.72);
  const doorMat = mat(0x777a76);
  const W = 15.5, D = 8.2, H = 2.72, floors = 3, wall = 0.16;
  const front = D / 2;
  const back = -D / 2;

  function part(name, x, y, z, sx, sy, sz, material, { shadow = false } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    root.add(mesh);
    return mesh;
  }

  // Raised plinth and three distinct floor plates: no fourth residential level.
  // Split the raised plinth around the entrance; a single solid box would block the door.
  part("Panelák / sokl levý", -(W / 2 + 0.175), 0.28, 0, 0.35, 0.56, D + 0.35, concreteDark);
  part("Panelák / sokl pravý", W / 2 + 0.175, 0.28, 0, 0.35, 0.56, D + 0.35, concreteDark);
  part("Panelák / sokl zadní", 0, 0.28, back - 0.175, W + 0.35, 0.56, 0.35, concreteDark);
  part("Panelák / sokl přední levý", -(W / 2 + 0.925) / 2, 0.28, front + 0.175, W / 2 + 0.925, 0.56, 0.35, concreteDark);
  part("Panelák / sokl přední pravý", (W / 2 + 0.925) / 2, 0.28, front + 0.175, W / 2 + 0.925, 0.56, 0.35, concreteDark);
  for (let floor = 0; floor < floors; floor++) {
    const y0 = floor * H;
    part(`Panelák / podlahová deska P${floor}`, 0, y0 + 0.12, 0, W, 0.24, D, slabMat);
    if (floor > 0) {
      part(`Panelák / čelní spára P${floor}`, 0, y0 + 0.015, front + 0.035, W, 0.055, 0.07, concreteDark);
    }

    // Four empty flats per level, separated by full-height structural partitions.
    const bayW = W / 4;
    for (let bay = 0; bay < 4; bay++) {
      const x = -W / 2 + bayW * (bay + 0.5);
      const roomY = y0 + H / 2 + 0.12;
      const roomH = H - 0.24;
      // Rear and side boundaries form a readable open shell; the front stays glazed/open.
      part(`Byt P${floor} B${bay + 1} / zadní stěna`, x, roomY, back + wall / 2, bayW, roomH, wall, inside);
      if (bay === 0) part(`Panelák / boční štít`, -W / 2 + wall / 2, roomY, 0, wall, roomH, D, concrete);
      if (bay === 3) part(`Panelák / boční štít`, W / 2 - wall / 2, roomY, 0, wall, roomH, D, concrete);

      // Partition between adjacent flats; central door-sized opening is indicated by a short wall pair.
      if (bay < 3) {
        const px = -W / 2 + bayW * (bay + 1);
        part(`Byt / příčka P${floor}`, px, roomY, 0, wall, roomH, D - 0.2, inside);
      }
      // Internal partition walls define empty rooms without furniture.
      part(`Byt P${floor} B${bay + 1} / příčka`, x, roomY, back + D * 0.39, bayW - 0.25, roomH, wall, inside);
      part(`Byt P${floor} B${bay + 1} / vstupní otvor nadpraží`, x, y0 + 2.28, front - 0.55, 0.95, 0.12, wall, inside);
      part(`Byt P${floor} B${bay + 1} / dveřní křídlo`, x, y0 + 1.12, front - 0.55, 0.82, 2.12, 0.06, doorMat);

      // Facade window with concrete reveal and two vertical panes.
      const wx = x;
      const wy = y0 + 1.58;
      const ww = 1.55, wh = 1.28;
      part(`Panelák / okenní špaleta P${floor} B${bay + 1}`, wx, wy, front + 0.035, ww + 0.16, wh + 0.16, 0.09, concreteDark);
      part(`Panelák / sklo P${floor} B${bay + 1}`, wx, wy, front + 0.095, ww, wh, 0.045, glass);
      part(`Panelák / okenní rám svislý`, wx, wy, front + 0.13, 0.055, wh, 0.045, frame);
      for (const dx of [-ww / 2, ww / 2]) {
        part("Panelák / okenní rám boční", wx + dx, wy, front + 0.13, 0.06, wh + 0.08, 0.05, frame);
      }
      part("Panelák / parapet", wx, wy - wh / 2 - 0.05, front + 0.14, ww + 0.14, 0.09, 0.12, frame);

      // Compact loggia slab and rail: one per apartment, repeated on each residential level.
      part(`Lodžie P${floor} B${bay + 1} / deska`, x, y0 + 0.17, front + 0.68, bayW - 0.16, 0.16, 1.3, slabMat);
      part("Lodžie / zábradlí", x, y0 + 0.72, front + 1.28, bayW - 0.2, 0.9, 0.055, metal);
      for (let n = 1; n <= 5; n++) {
        const rx = x - bayW / 2 + n * (bayW / 6);
        part("Lodžie / svislá tyč", rx, y0 + 0.72, front + 1.28, 0.035, 0.84, 0.065, metal);
      }
    }
    // Horizontal facade band separates the levels.
    part(`Panelák / vodorovná spára P${floor}`, 0, y0 + H - 0.025, front + 0.055, W, 0.07, 0.08, concreteDark);
  }

  const totalH = floors * H;
  // Flat roof + low parapet; the raised technical core is not a residential floor.
  part("Panelák / plochá střecha", 0, totalH + 0.10, 0, W + 0.4, 0.2, D + 0.4, concreteDark);
  part("Panelák / atika vpředu", 0, totalH + 0.36, front + 0.12, W + 0.4, 0.32, 0.18, concrete);
  part("Panelák / atika vzadu", 0, totalH + 0.36, back - 0.12, W + 0.4, 0.32, 0.18, concrete);
  part("Panelák / atika levá", -W / 2 - 0.12, totalH + 0.36, 0, 0.18, 0.32, D, concrete);
  part("Panelák / atika pravá", W / 2 + 0.12, totalH + 0.36, 0, 0.18, 0.32, D, concrete);
  part("Panelák / technický výstup na střechu", 0, totalH + 0.72, back + 1.05, 2.2, 0.9, 2.1, concrete);
  part("Panelák / dveře technického výstupu", 0, totalH + 0.58, back + 2.12, 0.8, 0.6, 0.05, doorMat);

  // Entrance portico at ground level, on the front facade.
  part("Panelák / vstupní portál", 0, 1.12, front + 0.06, 1.85, 2.24, 0.14, concreteDark);
  part("Panelák / vstupní dveře", 0, 1.05, front + 0.16, 1.05, 2.0, 0.06, glass);
  part("Panelák / vstupní stříška", 0, 2.32, front + 0.48, 2.5, 0.16, 0.95, slabMat);
  part("Panelák / chodník", 0, 0.055, front + 2.1, 5.2, 0.11, 2.7, concreteDark);

  scene.add(root);
  return root;
}

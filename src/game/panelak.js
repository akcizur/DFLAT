// Low-poly Czech panel apartment block: four storeys (P + 3), empty shells and a flat roof.
export function createPanelak({ THREE, scene }) {
  const root = new THREE.Group();
  root.name = "Panelák / P + 3 / čtyři podlaží";
  root.position.set(0, 0, -15.9);

  const mat = (color, roughness = 0.96) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const concrete = mat(0xb9b7af);
  const concreteDark = mat(0x858984);
  const slabMat = mat(0x9c9d98);
  const inside = mat(0xd5d2c9);
  const frame = mat(0xe3e0d7);
  const metal = mat(0x525b5e, 0.72);
  const doorMat = mat(0x777a76);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x718a92,
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.31,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const W = 15.5, D = 8.2, H = 2.72, floors = 4, wall = 0.16;
  const bayW = W / 4;
  const front = D / 2;
  const back = -D / 2;
  const windowW = 1.55;
  const windowH = 1.28;
  const windowY = 1.58;
  const entryW = 1.05;
  const entryH = 2.0;

  function part(name, x, y, z, sx, sy, sz, material, { shadow = false } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    root.add(mesh);
    return mesh;
  }

  function addWindow(bay, floor, y0) {
    const x = -W / 2 + bayW * (bay + 0.5);
    const wy = y0 + windowY;

    // The aperture is cut out of the concrete facade. Only a real pane and narrow
    // reveal/frame pieces occupy the opening, so the window does not read as a slab.
    part(`Okno P${floor} / sklo B${bay + 1}`,
      x, wy, front - 0.018, windowW, windowH, 0.028, glass);

    const revealZ = front + 0.012;
    const revealDepth = 0.09;
    const sideX = windowW / 2 + 0.035;
    const sideY = windowH / 2 + 0.035;
    part(`Okno P${floor} / špaleta levá`, x - sideX, wy, revealZ,
      0.07, windowH + 0.14, revealDepth, concreteDark);
    part(`Okno P${floor} / špaleta pravá`, x + sideX, wy, revealZ,
      0.07, windowH + 0.14, revealDepth, concreteDark);
    part(`Okno P${floor} / špaleta horní`, x, wy + sideY, revealZ,
      windowW + 0.14, 0.07, revealDepth, concreteDark);
    part(`Okno P${floor} / rám spodní`, x, wy - sideY, front + 0.035,
      windowW + 0.14, 0.075, 0.12, frame);
    part(`Okno P${floor} / rám horní`, x, wy + windowH / 2, front + 0.035,
      windowW + 0.07, 0.055, 0.045, frame);
    part(`Okno P${floor} / rám levý`, x - windowW / 2, wy, front + 0.035,
      0.055, windowH, 0.045, frame);
    part(`Okno P${floor} / rám pravý`, x + windowW / 2, wy, front + 0.035,
      0.055, windowH, 0.045, frame);
    part(`Okno P${floor} / středová příčka`, x, wy, front + 0.037,
      0.045, windowH, 0.045, frame);
  }

  function buildFacade(floor, y0) {
    const wallBottom = y0 + 0.24;
    const wallTop = y0 + H;
    const apertures = Array.from({ length: 4 }, (_, bay) => {
      const center = -W / 2 + bayW * (bay + 0.5);
      return {
        left: center - windowW / 2,
        right: center + windowW / 2,
        bottom: y0 + windowY - windowH / 2,
        top: y0 + windowY + windowH / 2,
        type: "window"
      };
    });
    if (floor === 0) {
      apertures.push({
        left: -entryW / 2,
        right: entryW / 2,
        bottom: wallBottom,
        top: y0 + entryH,
        type: "entry"
      });
    }

    const cuts = [-W / 2, W / 2, ...apertures.flatMap(a => [a.left, a.right])]
      .map(value => Number(value.toFixed(4)));
    const breakpoints = [...new Set(cuts)].sort((a, b) => a - b);

    // Split each bay into wall segments above/below the window or entry opening.
    // This produces a continuous facade without covering the entrance or glass.
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const left = breakpoints[i];
      const right = breakpoints[i + 1];
      const centerX = (left + right) / 2;
      const opening = apertures.find(a => centerX > a.left && centerX < a.right);
      const width = right - left;
      const x = centerX;
      const z = front - wall / 2;
      const addWall = (bottom, top, suffix) => {
        if (top - bottom < 0.015) return;
        part(`Fasáda P${floor} / ${suffix}`, x, (bottom + top) / 2, z,
          width, top - bottom, wall, concrete);
      };
      if (!opening) {
        addWall(wallBottom, wallTop, "panel");
      } else {
        addWall(wallBottom, opening.bottom, "parapet");
        addWall(opening.top, wallTop, opening.type === "entry" ? "nadpraží vstupu" : "nadokenní panel");
      }
    }

    // Recessed panel seams follow the concrete-panel rhythm, not the glass openings.
    for (const seamX of [-bayW * 1.5, -bayW * 0.5, bayW * 0.5, bayW * 1.5]) {
      if (floor === 0 && Math.abs(seamX) < 0.01) continue;
      part(`Fasáda P${floor} / svislá spára`,
        seamX, y0 + H / 2 + 0.12, front + 0.031,
        0.035, H - 0.24, 0.045, concreteDark);
    }
  }

  // Raised concrete plinth, split at the entrance so the doorway remains clear.
  part("Panelák / sokl levý", -(W / 2 + 0.175), 0.28, 0,
    0.35, 0.56, D + 0.35, concreteDark);
  part("Panelák / sokl pravý", W / 2 + 0.175, 0.28, 0,
    0.35, 0.56, D + 0.35, concreteDark);
  part("Panelák / sokl zadní", 0, 0.28, back - 0.175,
    W + 0.35, 0.56, 0.35, concreteDark);
  part("Panelák / sokl přední levý", -(W / 4 + 0.4625), 0.28, front + 0.175,
    W / 2 - 0.925, 0.56, 0.35, concreteDark);
  part("Panelák / sokl přední pravý", W / 4 + 0.4625, 0.28, front + 0.175,
    W / 2 - 0.925, 0.56, 0.35, concreteDark);

  for (let floor = 0; floor < floors; floor++) {
    const y0 = floor * H;
    part(`Panelák / podlahová deska P${floor}`,
      0, y0 + 0.12, 0, W, 0.24, D, slabMat);

    // Four empty bays per storey. Ground-floor middle bays remain open behind the
    // entrance, forming a clear route into the building instead of a wall dead-end.
    for (let bay = 0; bay < 4; bay++) {
      const x = -W / 2 + bayW * (bay + 0.5);
      const roomY = y0 + H / 2 + 0.12;
      const roomH = H - 0.24;

      part(`Byt P${floor} B${bay + 1} / zadní stěna`,
        x, roomY, back + wall / 2, bayW, roomH, wall, inside);

      if (bay === 0) {
        part(`Panelák / levý štít P${floor}`,
          -W / 2 + wall / 2, roomY, 0, wall, roomH, D, concrete);
      }
      if (bay === 3) {
        part(`Panelák / pravý štít P${floor}`,
          W / 2 - wall / 2, roomY, 0, wall, roomH, D, concrete);
      }

      // Keep the central ground-floor entry aligned with a walkable lobby opening.
      if (bay < 3 && !(floor === 0 && bay === 1)) {
        const px = -W / 2 + bayW * (bay + 1);
        part(`Byt / příčka P${floor}`, px, roomY, 0,
          wall, roomH, D - 0.2, inside);
      }

      // The lobby continues into the paired middle units on the ground floor.
      if (!(floor === 0 && (bay === 1 || bay === 2))) {
        part(`Byt P${floor} B${bay + 1} / vnitřní příčka`,
          x, roomY, back + D * 0.39, bayW - 0.25, roomH, wall, inside);
      }

      addWindow(bay, floor, y0);

      // Four shallow loggias give the facade depth while leaving each flat empty.
      part(`Lodžie P${floor} B${bay + 1} / deska`,
        x, y0 + 0.17, front + 0.68, bayW - 0.16, 0.16, 1.3, slabMat);
      part(`Lodžie P${floor} B${bay + 1} / zábradlí`,
        x, y0 + 0.72, front + 1.28, bayW - 0.2, 0.82, 0.055, metal);
      part(`Lodžie P${floor} B${bay + 1} / horní madlo`,
        x, y0 + 1.15, front + 1.28, bayW - 0.16, 0.065, 0.095, metal);
      for (let n = 1; n <= 5; n++) {
        const rx = x - bayW / 2 + n * (bayW / 6);
        part(`Lodžie P${floor} / svislá příčka`,
          rx, y0 + 0.72, front + 1.28, 0.035, 0.76, 0.06, metal);
      }
      for (const side of [-1, 1]) {
        part(`Lodžie P${floor} / boční zábradlí`,
          x + side * (bayW / 2 - 0.09), y0 + 0.72, front + 0.68,
          0.055, 0.82, 1.14, metal);
      }
    }

    buildFacade(floor, y0);
    part(`Panelák / vodorovná spára P${floor}`,
      0, y0 + H - 0.025, front + 0.055, W, 0.07, 0.08, concreteDark);
  }

  const totalH = floors * H;
  part("Panelák / plochá střecha", 0, totalH + 0.10, 0,
    W + 0.4, 0.2, D + 0.4, concreteDark);
  part("Panelák / atika vpředu", 0, totalH + 0.36, front + 0.12,
    W + 0.4, 0.32, 0.18, concrete);
  part("Panelák / atika vzadu", 0, totalH + 0.36, back - 0.12,
    W + 0.4, 0.32, 0.18, concrete);
  part("Panelák / atika levá", -W / 2 - 0.12, totalH + 0.36, 0,
    0.18, 0.32, D, concrete);
  part("Panelák / atika pravá", W / 2 + 0.12, totalH + 0.36, 0,
    0.18, 0.32, D, concrete);

  // A restrained rooftop service core, vents and rain pipes finish the silhouette.
  part("Panelák / technický výstup na střechu", 0, totalH + 0.72,
    back + 1.05, 2.2, 0.9, 2.1, concrete);
  part("Panelák / dveře technického výstupu", 0, totalH + 0.58,
    back + 2.12, 0.8, 0.6, 0.05, doorMat);
  for (const [x, z, sx, sz] of [
    [-4.8, -2.4, 1.3, 1.05],
    [-1.3, 2.8, 1.1, 0.95],
    [2.6, -2.8, 1.25, 1.0]
  ]) {
    part("Panelák / střešní ventilace", x, totalH + 0.34, z,
      sx, 0.28, sz, concrete);
    part("Panelák / odtah", x, totalH + 0.56, z,
      0.32, 0.18, 0.32, metal);
  }
  for (const x of [-W / 2 - 0.10, W / 2 + 0.10]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, totalH, 5),
      metal
    );
    pipe.name = "Panelák / dešťový svod";
    pipe.position.set(x, totalH / 2, front + 0.16);
    root.add(pipe);
  }

  // Ground-floor entrance portal. Its opening is aligned with the world collision gap.
  part("Panelák / vstupní portál levý", -0.84, 1.12, front + 0.06,
    0.16, 2.24, 0.14, concreteDark);
  part("Panelák / vstupní portál pravý", 0.84, 1.12, front + 0.06,
    0.16, 2.24, 0.14, concreteDark);
  part("Panelák / vstupní portál nadpraží", 0, 2.16, front + 0.06,
    1.84, 0.16, 0.14, concreteDark);
  part("Panelák / vstupní dveře", 0, 1.05, front + 0.16,
    entryW, entryH, 0.06, glass);
  part("Panelák / vstupní stříška", 0, 2.32, front + 0.48,
    2.5, 0.16, 0.95, slabMat);
  part("Panelák / chodník u vchodu", 0, 0.055, front + 2.1,
    5.2, 0.11, 2.7, concreteDark);

  scene.add(root);
  return root;
}

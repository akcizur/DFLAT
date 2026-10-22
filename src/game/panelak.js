// Soviet-era prefabricated panel apartment block: four storeys (P + 3), P1–P4.
export function createPanelak({ THREE, scene }) {
  const root = new THREE.Group();
  root.name = "Sovětský panelový dům / P + 3";
  root.position.set(0, 0, -15.9);

  const material = (color, roughness = 0.94, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });

  const concrete = material(0xb8b5aa);
  const concreteLight = material(0xc9c5b8);
  const concreteShade = material(0x85877f);
  const concreteSeam = material(0x777a73);
  const innerConcrete = material(0xd1cec3);
  const foundationMat = material(0x777a76);
  const metal = material(0x4e5656, 0.68, { metalness: 0.25 });
  const frame = material(0xd7d5ca, 0.72);
  const darkGlass = material(0x33434a, 0.29, {
    metalness: 0.12, transparent: true, opacity: 0.66,
    side: THREE.DoubleSide
  });
  const shadowGlass = material(0x202a2e, 0.88);
  const doorMaterial = material(0x4d5a5b, 0.6, { metalness: 0.16 });
  const roofMaterial = material(0x8a8b83);

  const width = 16.4, depth = 8.8, floorHeight = 2.72, floorCount = 4;
  const wallThickness = 0.18, bayWidth = width / 4, front = depth / 2, back = -depth / 2;
  const floorSlab = 0.22, windowWidth = 1.48, windowHeight = 1.30, windowCenterY = 1.58;

  function box(name, x, y, z, sx, sy, sz, mat, { shadow = false } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  function addWindowParts(label, x, y, w, h, z = front) {
    // Dark recess behind the pane gives every window a visible depth.
    box(`Okno ${label} / hluboké ostění`, x, y, z - 0.105,
      w - 0.08, h - 0.08, 0.025, shadowGlass);
    box(`Okno ${label} / sklo`, x, y, z + 0.028,
      w - 0.11, h - 0.11, 0.035, darkGlass);

    const trimZ = z + 0.075, jamb = 0.075;
    box(`Okno ${label} / levé ostění`, x - w / 2 - jamb / 2, y, z + 0.025,
      jamb, h + 0.12, 0.12, concreteShade);
    box(`Okno ${label} / pravé ostění`, x + w / 2 + jamb / 2, y, z + 0.025,
      jamb, h + 0.12, 0.12, concreteShade);
    box(`Okno ${label} / horní překlad`, x, y + h / 2 + 0.035, trimZ,
      w + 0.13, 0.07, 0.12, concreteLight);
    box(`Okno ${label} / parapet`, x, y - h / 2 - 0.035, trimZ,
      w + 0.15, 0.10, 0.18, concreteLight);

    box(`Okno ${label} / rám levý`, x - w / 2 + 0.035, y, z + 0.09,
      0.045, h - 0.02, 0.035, frame);
    box(`Okno ${label} / rám pravý`, x + w / 2 - 0.035, y, z + 0.09,
      0.045, h - 0.02, 0.035, frame);
    box(`Okno ${label} / příčka`, x, y, z + 0.092, 0.05, h - 0.015, 0.035, frame);
    box(`Okno ${label} / horní rám`, x, y + h / 2 - 0.025, z + 0.09,
      w - 0.03, 0.045, 0.035, frame);
    box(`Okno ${label} / spodní rám`, x, y - h / 2 + 0.025, z + 0.09,
      w - 0.03, 0.045, 0.035, frame);
  }

  function buildFrontFacade(floor, y0) {
    const wallBottom = y0 + floorSlab, wallTop = y0 + floorHeight;
    const openings = [];
    for (let bay = 0; bay < 4; bay++) {
      const x = -width / 2 + bayWidth * (bay + 0.5);
      openings.push({
        left: x - windowWidth / 2, right: x + windowWidth / 2,
        bottom: y0 + windowCenterY - windowHeight / 2,
        top: y0 + windowCenterY + windowHeight / 2,
        kind: "flat", x
      });
    }
    // Open ground-floor entrance; narrow, repeated stairwell windows above it.
    if (floor === 0) {
      openings.push({ left: -0.67, right: 0.67, bottom: wallBottom, top: y0 + 2.15, kind: "entry", x: 0 });
    } else {
      openings.push({ left: -0.39, right: 0.39, bottom: y0 + 0.92, top: y0 + 2.34, kind: "stairs", x: 0 });
    }

    const breaks = [...new Set([
      -width / 2, width / 2,
      ...openings.flatMap(opening => [opening.left, opening.right])
    ])].sort((a, b) => a - b);

    // Assemble concrete panels above and below each real aperture.
    for (let i = 0; i < breaks.length - 1; i++) {
      const left = breaks[i], right = breaks[i + 1];
      if (right - left < 0.012) continue;
      const x = (left + right) / 2;
      const opening = openings.find(item => x > item.left + 0.0001 && x < item.right - 0.0001);
      const addPanel = (bottom, top, label) => {
        if (top - bottom < 0.018) return;
        box(`Fasádní panel P${floor + 1} / ${label}`, x, (bottom + top) / 2, front - wallThickness / 2,
          right - left, top - bottom, wallThickness,
          (i + floor) % 3 === 0 ? concreteLight : concrete);
      };
      if (!opening) addPanel(wallBottom, wallTop, "beton");
      else {
        addPanel(wallBottom, opening.bottom, "parapet");
        addPanel(opening.top, wallTop, opening.kind === "entry" ? "nadpraží vchodu" : "nadokenní dílec");
      }
    }

    for (const opening of openings) {
      if (opening.kind === "flat") {
        addWindowParts(`P${floor + 1} / byt`, opening.x,
          opening.bottom + windowHeight / 2, windowWidth, windowHeight);
      } else if (opening.kind === "stairs") {
        addWindowParts(`P${floor + 1} / schodiště`, opening.x,
          (opening.bottom + opening.top) / 2,
          opening.right - opening.left, opening.top - opening.bottom);
      }
    }

    // Panel seams and concrete floor band create the repeated prefab rhythm.
    for (let bay = 1; bay < 4; bay++) {
      const x = -width / 2 + bayWidth * bay;
      box(`Fasáda P${floor + 1} / panelová spára`, x,
        y0 + floorHeight / 2 + 0.02, front + 0.018,
        0.035, floorHeight - 0.30, 0.045, concreteSeam);
    }
    box(`Fasáda P${floor + 1} / vodorovný pás`, 0,
      y0 + floorHeight - 0.045, front + 0.045,
      width + 0.04, 0.075, 0.09, concreteShade);
  }

  // Heavy concrete plinth, split so it does not block the entrance.
  box("Panelák / sokl levý", -(width / 2 + 0.18), 0.28, 0, 0.36, 0.56, depth + 0.36, foundationMat);
  box("Panelák / sokl pravý", width / 2 + 0.18, 0.28, 0, 0.36, 0.56, depth + 0.36, foundationMat);
  box("Panelák / sokl zadní", 0, 0.28, back - 0.18, width + 0.36, 0.56, 0.36, foundationMat);
  box("Panelák / sokl přední levý", -(width / 4 + 0.50), 0.28, front + 0.17,
    width / 2 - 1.0, 0.56, 0.34, foundationMat);
  box("Panelák / sokl přední pravý", width / 4 + 0.50, 0.28, front + 0.17,
    width / 2 - 1.0, 0.56, 0.34, foundationMat);

  for (let floor = 0; floor < floorCount; floor++) {
    const y0 = floor * floorHeight;
    const roomY = y0 + floorHeight / 2 + 0.10;
    const roomH = floorHeight - 0.25;
    box(`Panelák / železobetonová deska P${floor + 1}`, 0, y0 + floorSlab / 2,
      0, width, floorSlab, depth, roofMaterial, { shadow: true });
    box(`Panelák / zadní obvodová stěna P${floor + 1}`, 0, roomY,
      back + wallThickness / 2, width, roomH, wallThickness, innerConcrete);
    box(`Panelák / levý štít P${floor + 1}`, -width / 2 + wallThickness / 2,
      roomY, 0, wallThickness, roomH, depth, concrete);
    box(`Panelák / pravý štít P${floor + 1}`, width / 2 - wallThickness / 2,
      roomY, 0, wallThickness, roomH, depth, concrete);

    // Empty apartment shells only. The central ground-level lobby remains open.
    for (let bay = 0; bay < 4; bay++) {
      const x = -width / 2 + bayWidth * (bay + 0.5);
      if (bay < 3 && !(floor === 0 && bay === 1)) {
        const partitionX = -width / 2 + bayWidth * (bay + 1);
        box(`Panelák / příčná stěna P${floor + 1}`, partitionX, roomY,
          0, wallThickness, roomH, depth - 0.24, innerConcrete);
      }
      if (!(floor === 0 && (bay === 1 || bay === 2))) {
        box(`Panelák / bytová příčka P${floor + 1} B${bay + 1}`, x, roomY,
          back + depth * 0.39, bayWidth - 0.24, roomH, wallThickness, innerConcrete);
      }

      // Concrete balcony slab, chunky loggia cheeks and a plain steel rail.
      const balconyZ = front + 0.72;
      box(`Lodžie P${floor + 1} B${bay + 1} / betonová deska`,
        x, y0 + 0.20, front + 0.66, bayWidth - 0.16, 0.16, 1.42, roofMaterial);
      for (const side of [-1, 1]) {
        box(`Lodžie P${floor + 1} / betonová bočnice`,
          x + side * (bayWidth / 2 - 0.075), y0 + 0.60, balconyZ,
          0.10, 0.76, 1.20, concreteShade);
      }
      box(`Lodžie P${floor + 1} / ocelové zábradlí`, x,
        y0 + 0.71, front + 1.365, bayWidth - 0.30, 0.84, 0.055, metal);
      box(`Lodžie P${floor + 1} / horní madlo`, x, y0 + 1.15,
        front + 1.365, bayWidth - 0.25, 0.065, 0.09, metal);
      for (let bar = 1; bar <= 7; bar++) {
        const railX = x - (bayWidth - 0.30) / 2 + bar * ((bayWidth - 0.30) / 8);
        box(`Lodžie P${floor + 1} / svislá tyč`, railX, y0 + 0.71,
          front + 1.365, 0.035, 0.80, 0.055, metal);
      }
    }

    buildFrontFacade(floor, y0);

    // Simple end-wall windows keep the narrow side elevations from reading as blanks.
    for (const side of [-1, 1]) {
      const sideX = side * (width / 2 + 0.018);
      const windowY = y0 + 1.54, sideZ = 0.8;
      box(`Štít P${floor + 1} / zapuštěné okno`, sideX - side * 0.015,
        windowY, sideZ, 0.035, 1.12, 1.20, darkGlass);
      box(`Štít P${floor + 1} / horní překlad`, sideX + side * 0.01,
        windowY + 0.60, sideZ, 0.10, 0.08, 1.33, concreteLight);
      box(`Štít P${floor + 1} / parapet`, sideX + side * 0.01,
        windowY - 0.60, sideZ, 0.13, 0.10, 1.33, concreteLight);
      box(`Štít P${floor + 1} / svislý rám`, sideX + side * 0.045,
        windowY, sideZ, 0.08, 1.12, 0.045, frame);
    }
  }

  const totalHeight = floorCount * floorHeight;
  box("Panelák / střešní deska", 0, totalHeight + 0.10, 0,
    width + 0.44, 0.20, depth + 0.44, foundationMat);
  box("Panelák / atika vpředu", 0, totalHeight + 0.35, front + 0.14,
    width + 0.44, 0.32, 0.20, concrete);
  box("Panelák / atika vzadu", 0, totalHeight + 0.35, back - 0.14,
    width + 0.44, 0.32, 0.20, concrete);

  for (const side of [-1, 1]) {
    box("Panelák / boční atika", side * (width / 2 + 0.14), totalHeight + 0.35,
      0, 0.20, 0.32, depth + 0.30, concrete);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, totalHeight, 5), metal);
    pipe.name = "Panelák / dešťový svod";
    pipe.position.set(side * (width / 2 + 0.11), totalHeight / 2, front + 0.17);
    root.add(pipe);
  }

  box("Panelák / výlez na střechu", 0, totalHeight + 0.64, back + 1.05,
    2.25, 0.90, 2.10, concreteShade);
  box("Panelák / dveře střešního výlezu", 0, totalHeight + 0.55, back + 2.12,
    0.82, 0.60, 0.06, doorMaterial);
  for (const [x, z, sx, sz] of [
    [-5.4, -2.5, 1.5, 1.15], [-1.5, 2.5, 1.25, 1.0],
    [2.9, -2.7, 1.4, 1.15], [5.2, 2.1, 1.0, 0.9]
  ]) {
    box("Panelák / střešní ventilační komora", x, totalHeight + 0.29, z, sx, 0.34, sz, concreteShade);
    box("Panelák / ventilační výdech", x, totalHeight + 0.52, z, 0.36, 0.15, 0.36, metal);
  }

  // Ground entrance with recessed door, cast-concrete portal, flat canopy and two steps.
  box("Panelák / vstupní portál levý", -0.79, 1.12, front + 0.075, 0.16, 2.24, 0.17, concreteShade);
  box("Panelák / vstupní portál pravý", 0.79, 1.12, front + 0.075, 0.16, 2.24, 0.17, concreteShade);
  box("Panelák / vstupní nadpraží", 0, 2.18, front + 0.075, 1.74, 0.16, 0.17, concreteShade);
  box("Panelák / hlavní vstupní dveře", 0, 1.10, front + 0.12, 1.30, 2.04, 0.055, doorMaterial);
  box("Panelák / sklo vstupu", 0, 1.12, front + 0.16, 0.72, 1.84, 0.025, darkGlass);
  box("Panelák / vstupní stříška", 0, 2.34, front + 0.55, 2.75, 0.16, 1.02, roofMaterial);
  box("Panelák / schod 1", 0, 0.09, front + 1.47, 2.65, 0.18, 0.42, foundationMat);
  box("Panelák / schod 2", 0, 0.045, front + 1.80, 2.85, 0.09, 0.30, concreteLight);
  box("Panelák / vstupní chodník", 0, 0.015, front + 2.45, 4.4, 0.07, 3.5, concreteShade);
  box("Panelák / domovní tabulka", 1.10, 1.75, front + 0.11, 0.28, 0.34, 0.045, metal);
  box("Panelák / zvonkový panel", 0.98, 1.25, front + 0.12, 0.10, 0.24, 0.035, frame);

  scene.add(root);
  return root;
}

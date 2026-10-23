import { PANELAK_LAYOUT } from "./panelak-config.js";

// Runtime model of a four-storey T06B-inspired section: five 3.6 m modules,
// two mirrored flats per level, recessed loggias and a central switchback stair.
export function createMainBuildingWorld({ THREE, scene, state, ui, showBuilding = true }) {
  const colliders = [];
  const interactables = [];
  const meshesToAnimate = [];
  const doorAnimations = [];
  const meshes = [];

  const floorHeight = PANELAK_LAYOUT.floorHeight;
  const floors = PANELAK_LAYOUT.totalFloors;
  const moduleWidth = PANELAK_LAYOUT.moduleWidth;
  const width = PANELAK_LAYOUT.totalWidth;
  const depth = PANELAK_LAYOUT.depth;
  const wallT = PANELAK_LAYOUT.exteriorWall;
  const buildingZ = -22;
  const frontZ = buildingZ + depth / 2;
  const rearZ = buildingZ - depth / 2;
  const leftX = -width / 2;
  const rightX = width / 2;
  const buildingHeight = floors * floorHeight;
  const frontWallZ = frontZ - wallT / 2;
  const rearWallZ = rearZ + wallT / 2;

  const materials = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xb7b3a7, roughness: 0.98, flatShading: true }),
    facade: new THREE.MeshStandardMaterial({ color: 0xc3c0b3, roughness: 1, flatShading: true }),
    panelEdge: new THREE.MeshStandardMaterial({ color: 0x89897f, roughness: 1, flatShading: true }),
    darkConcrete: new THREE.MeshStandardMaterial({ color: 0x77786e, roughness: 1, flatShading: true }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xd0cbb8, roughness: 1, flatShading: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0x45535a, roughness: 0.35, metalness: 0.08, flatShading: true }),
    warmGlass: new THREE.MeshStandardMaterial({ color: 0x94816a, roughness: 0.48, flatShading: true }),
    luxfer: new THREE.MeshStandardMaterial({ color: 0xabb8b3, roughness: 0.45, metalness: 0.03, flatShading: true }),
    windowFrame: new THREE.MeshStandardMaterial({ color: 0xd4cebb, roughness: 0.78, flatShading: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0x545b55, roughness: 0.86, metalness: 0.18, flatShading: true }),
    oxidizedMetal: new THREE.MeshStandardMaterial({ color: 0x635747, roughness: 0.92, metalness: 0.08, flatShading: true }),
    door: new THREE.MeshStandardMaterial({ color: 0x4a5148, roughness: 0.82, flatShading: true }),
    floor: new THREE.MeshStandardMaterial({ color: 0x88877b, roughness: 0.98, flatShading: true }),
    lino: new THREE.MeshStandardMaterial({ color: 0x777e70, roughness: 0.96, flatShading: true }),
    wood: new THREE.MeshStandardMaterial({ color: 0x725b43, roughness: 0.95, flatShading: true }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0xa18a65, roughness: 0.95, flatShading: true }),
    white: new THREE.MeshStandardMaterial({ color: 0xcac9bf, roughness: 0.9, flatShading: true }),
    bath: new THREE.MeshStandardMaterial({ color: 0xb9beb5, roughness: 0.35, flatShading: true }),
    tile: new THREE.MeshStandardMaterial({ color: 0x8d9a91, roughness: 0.9, flatShading: true }),
    grass: new THREE.MeshStandardMaterial({ color: 0x646b55, roughness: 1, flatShading: true }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x484d4d, roughness: 1, flatShading: true }),
    pavement: new THREE.MeshStandardMaterial({ color: 0x918f84, roughness: 1, flatShading: true }),
    marking: new THREE.MeshStandardMaterial({ color: 0xb7b4a6, roughness: 1, flatShading: true })
  };

  function addCollider(x, sx, z, sz, floor = null, active = true) {
    colliders.push({
      minX: x - sx / 2, maxX: x + sx / 2,
      minZ: z - sz / 2, maxZ: z + sz / 2,
      ...(Number.isInteger(floor) ? { floor } : {}),
      active
    });
  }

  function box(name, x, y, z, sx, sy, sz, material, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow ?? false;
    mesh.receiveShadow = options.receiveShadow ?? true;
    scene.add(mesh);
    meshes.push(mesh);
    if (options.collider) addCollider(x, sx, z, sz, options.floor ?? null, options.active ?? true);
    return mesh;
  }

  function wallX(name, z, x0, x1, bottom, height, floor, material = materials.plaster, door = null) {
    // A real opening is omitted from both the wall mesh and its collision strip.
    const doorLeft = door ? door.center - door.width / 2 : Infinity;
    const doorRight = door ? door.center + door.width / 2 : -Infinity;
    const pieces = [];
    if (!door || doorLeft > x0 + 0.01) pieces.push([x0, door ? Math.min(x1, doorLeft) : x1]);
    if (door && doorRight < x1 - 0.01) pieces.push([Math.max(x0, doorRight), x1]);
    for (const piece of pieces) {
      if (piece[1] - piece[0] < 0.04) continue;
      box(name, (piece[0] + piece[1]) / 2, bottom + height / 2, z,
        piece[1] - piece[0], height, wallT, material, { collider: true, floor });
    }
    if (door && door.height < height) {
      // A lintel is above head height and must not become a floor-plane blocker.
      box(name + " / nadpraží", door.center, bottom + door.height + (height - door.height) / 2,
        z, door.width, height - door.height, wallT, material);
    }
  }

  function wallZ(name, x, z0, z1, bottom, height, floor, material = materials.plaster, door = null) {
    const doors = (Array.isArray(door) ? door : (door ? [door] : [])).slice().sort((a, b) => a.center - b.center);
    const pieces = [];
    let cursor = z0;
    for (const opening of doors) {
      const start = opening.center - opening.width / 2;
      const end = opening.center + opening.width / 2;
      if (start > cursor + 0.01) pieces.push([cursor, Math.min(z1, start)]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < z1 - 0.01) pieces.push([Math.max(z0, cursor), z1]);
    for (const piece of pieces) {
      if (piece[1] - piece[0] < 0.04) continue;
      box(name, x, bottom + height / 2, (piece[0] + piece[1]) / 2,
        wallT, height, piece[1] - piece[0], material, { collider: true, floor });
    }
    for (const opening of doors) {
      if (opening.height >= height) continue;
      box(name + " / nadpraží", x, bottom + opening.height + (height - opening.height) / 2,
        opening.center, wallT, height - opening.height, opening.width, material);
    }
  }

  function facadeWithOpenings(floor, z, front) {
    const y0 = floor * floorHeight;
    const y1 = y0 + floorHeight;
    const facadeZ = front ? frontWallZ : rearWallZ;
    const windows = [];
    let mainDoor = null;

    if (front) {
      for (const x of [-7.2, -3.6, 3.6, 7.2]) {
        windows.push({ x, width: 1.42, bottom: y0 + 0.86, top: y0 + 2.18, kind: "window" });
      }
      if (floor === 0) mainDoor = { x0: -0.88, x1: 0.88, y0: y0 + 0.02, y1: y0 + 2.36, x: 0, kind: "entry" };
      else windows.push({ x: 0, width: 2.18, bottom: y0 + 0.20, top: y0 + 2.55, kind: "luxfer" });
    } else {
      windows.push({ x: -7.2, width: 1.42, bottom: y0 + 0.86, top: y0 + 2.18, kind: "window" });
      windows.push({ x: 7.2, width: 1.42, bottom: y0 + 0.86, top: y0 + 2.18, kind: "window" });
      windows.push({ x: -3.6, width: 1.48, bottom: y0 + 0.04, top: y0 + 2.42, kind: "loggia-door" });
      windows.push({ x: 3.6, width: 1.48, bottom: y0 + 0.04, top: y0 + 2.42, kind: "loggia-door" });
    }

    const openings = windows.map(w => ({ x0: w.x - w.width / 2, x1: w.x + w.width / 2, y0: w.bottom, y1: w.top, kind: w.kind }));
    if (mainDoor) openings.push({ x0: mainDoor.x0, x1: mainDoor.x1, y0: mainDoor.y0, y1: mainDoor.y1, kind: "entry" });
    const xCuts = [leftX + wallT / 2, rightX - wallT / 2];
    const yCuts = [y0, y1];
    for (const opening of openings) {
      xCuts.push(opening.x0, opening.x1);
      yCuts.push(opening.y0, opening.y1);
    }
    const xs = [...new Set(xCuts)].sort((a, b) => a - b);
    const ys = [...new Set(yCuts)].sort((a, b) => a - b);
    for (let xi = 0; xi < xs.length - 1; xi++) {
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const x0 = xs[xi], x1 = xs[xi + 1], yA = ys[yi], yB = ys[yi + 1];
        if (x1 - x0 < 0.025 || yB - yA < 0.025) continue;
        const cx = (x0 + x1) / 2, cy = (yA + yB) / 2;
        const insideOpening = openings.some(op => cx > op.x0 + 0.001 && cx < op.x1 - 0.001 && cy > op.y0 + 0.001 && cy < op.y1 - 0.001);
        if (insideOpening) continue;
        box(front ? "Fasáda / břízolitový panel" : "Fasáda zadní / panel", cx, cy, facadeZ,
          x1 - x0, yB - yA, wallT, (yi === 0 && xi % 3 === 1) ? materials.facade : materials.concrete);
      }
    }

    // Wall collision only opens at doors, never at ordinary window apertures.
    const walkGaps = front
      ? (floor === 0 ? [{ center: 0, width: 1.76, height: 2.36 }] : [])
      : windows.filter(w => w.kind === "loggia-door").map(w => ({ center: w.x, width: w.width, height: w.top - w.bottom }));
    let cursor = leftX;
    for (const gap of walkGaps.sort((a, b) => a.center - b.center)) {
      const start = gap.center - gap.width / 2;
      const end = gap.center + gap.width / 2;
      if (start > cursor) addCollider((cursor + start) / 2, start - cursor, z, wallT, floor);
      cursor = Math.max(cursor, end);
    }
    if (cursor < rightX) addCollider((cursor + rightX) / 2, rightX - cursor, z, wallT, floor);

    for (const w of windows) {
      const h = w.top - w.bottom;
      const cy = (w.top + w.bottom) / 2;
      if (w.kind === "luxfer") {
        const rows = 6, cols = 10;
        const cellW = w.width / cols, cellH = h / rows;
        for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
          box("Schodiště / luxferová tvárnice", w.x - w.width / 2 + (c + 0.5) * cellW, w.bottom + (r + 0.5) * cellH,
            facadeZ + (front ? 0.09 : -0.09), cellW - 0.018, cellH - 0.018, 0.07, materials.luxfer);
        }
        continue;
      }
      const paneMat = ((floor * 5 + Math.round((w.x + 9) * 2)) % 7 < 2) ? materials.warmGlass : materials.glass;
      const openingZ = w.kind === "loggia-door" ? rearZ + 1.72 : facadeZ;
      const paneZ = openingZ + (front ? 0.055 : -0.055);
      box(w.kind === "loggia-door" ? "Lodžie / prosklené dveře" : "Okno / tmavé zapuštěné sklo",
        w.x, cy, paneZ, w.width - 0.12, h - 0.12, 0.045, paneMat);
      const frameZ = openingZ + (front ? 0.092 : -0.092);
      const frame = 0.065;
      box("Okno / levý rám", w.x - w.width / 2 + frame / 2, cy, frameZ, frame, h, 0.065, materials.windowFrame);
      box("Okno / pravý rám", w.x + w.width / 2 - frame / 2, cy, frameZ, frame, h, 0.065, materials.windowFrame);
      box("Okno / horní rám", w.x, w.top - frame / 2, frameZ, w.width, frame, 0.065, materials.windowFrame);
      box("Okno / spodní rám", w.x, w.bottom + frame / 2, frameZ, w.width, frame, 0.065, materials.windowFrame);
      box("Okno / středová příčka", w.x, cy, frameZ + (front ? 0.012 : -0.012), 0.045, h - frame * 2, 0.045, materials.panelEdge);
    }
    if (mainDoor) {
      box("Vchod / levé ostění", -0.94, y0 + 1.18, facadeZ + 0.11, 0.12, 2.36, 0.18, materials.darkConcrete);
      box("Vchod / pravé ostění", 0.94, y0 + 1.18, facadeZ + 0.11, 0.12, 2.36, 0.18, materials.darkConcrete);
      box("Vchod / otevřené levé křídlo", -0.82, y0 + 1.17, facadeZ + 0.42, 0.055, 2.30, 0.74, materials.door);
      box("Vchod / otevřené pravé křídlo", 0.82, y0 + 1.17, facadeZ + 0.42, 0.055, 2.30, 0.74, materials.door);
      box("Vchod / nadpraží", 0, y0 + 2.42, facadeZ + 0.10, 1.92, 0.12, 0.18, materials.darkConcrete);
    }
  }

  function makeFloorSlab(floor) {
    const y = floor * floorHeight - 0.08;
    // Separate the ground and outdoor terrain by 15 mm: avoid coplanar depth
    // fighting while keeping the threshold visually almost flush with grade.
    const slabY = floor === 0 ? y + 0.005 : y;
    const core = navigationCore();
    const leftWidth = core.minX - leftX;
    const rightWidth = rightX - core.maxX;
    const frontDepth = frontZ - core.maxZ;
    const interiorRearZ = rearZ + 1.72;
    const interiorDepth = frontZ - interiorRearZ;

    // There are genuine notches beneath both rear loggias on every floor,
    // including the ground level. This prevents the main slab hiding or
    // coplanarly overlapping the independently modelled balcony surfaces.
    if (floor === 0) {
      box("Podlaha / přízemí", 0, slabY, (frontZ + interiorRearZ) / 2,
        width, 0.16, interiorDepth, materials.floor);
      const rearBands = [[leftX, -4.875], [-2.325, 2.325], [4.875, rightX]];
      for (const [x0, x1] of rearBands) {
        box("Podlaha / přízemí / pás mimo lodžie", (x0 + x1) / 2, slabY,
          (rearZ + interiorRearZ) / 2, x1 - x0, 0.16, interiorRearZ - rearZ, materials.floor);
      }
      return;
    }

    box("Stropní panel / levý trakt", (leftX + core.minX) / 2, y,
      (frontZ + interiorRearZ) / 2, leftWidth, 0.16, interiorDepth, materials.floor);
    box("Stropní panel / pravý trakt", (core.maxX + rightX) / 2, y,
      (frontZ + interiorRearZ) / 2, rightWidth, 0.16, interiorDepth, materials.floor);
    box("Stropní panel / přední podesta", 0, y, (frontZ + core.maxZ) / 2,
      core.maxX - core.minX, 0.16, frontDepth, materials.floor);
    box("Stropní panel / zadní trakt", 0, y, (core.minZ + interiorRearZ) / 2,
      core.maxX - core.minX, 0.16, Math.max(0.1, core.minZ - interiorRearZ), materials.floor);

    const rearBands = [[leftX, -4.875], [-2.325, 2.325], [4.875, rightX]];
    for (const [x0, x1] of rearBands) {
      box("Stropní panel / zadní pás mimo lodžie", (x0 + x1) / 2, y,
        (rearZ + interiorRearZ) / 2, x1 - x0, 0.16, interiorRearZ - rearZ, materials.floor);
    }
  }

  // U-shaped two-flight stair: both flights run along Z, side by side.
  // Each flight rises half a storey; a full-width mid-landing joins them at the far end.
  const stair = {
    lowX: -0.72, highX: 0.72, firstZ: -21.4, secondZ: -17.9, steps: 8,
    treadDepth: 0.46, treadOverlap: 0.025, landingWidth: 2.9
  };
  const stepRun = Math.abs(stair.secondZ - stair.firstZ) / stair.steps;
  const treadWidth = 1.12;
  const landingDepth = 1.18;
  const landingCenterZ = stair.secondZ + landingDepth / 2;
  const core = {
    minX: -1.8, maxX: 1.8,
    minZ: stair.firstZ - landingDepth / 2,
    maxZ: stair.secondZ + landingDepth / 2
  };
  const landingWidth = core.maxX - wallT;
  const landingCenterX = (core.minX + core.maxX) / 2;
  function navigationCore() { return core; }

  // Surroundings evoke a Czech normalisation-era estate, without competing with the hero building.
  box("Sídliště / travnatý pozemek", 0, -0.12, -22, 2000, 0.22, 2000, materials.grass);
  box("Sídliště / asfaltová komunikace", 0, 0.012, 2.7, 220, 0.035, 8.2, materials.asphalt);
  box("Sídliště / chodník", 0, 0.025, -2.05, 220, 0.05, 1.55, materials.pavement);
  box("Sídliště / přístupový chodník", 0, 0.018, -8, 3.8, 0.036, 10, materials.pavement);
  box("Sídliště / vstupní plošina", 0, 0.035, -14.95, 5.4, 0.07, 2.6, materials.pavement);
  for (let x = -102; x <= 102; x += 12) box("Silnice / přerušovaná čára", x, 0.034, 2.7, 4.4, 0.012, 0.12, materials.marking);

  // The live game can deliberately run as an open, building-free environment.
  // The architectural model remains available to the coordinate exporter and tests.
  if (!showBuilding) {
    return {
      colliders, interactables, meshesToAnimate, doorAnimations, meshes,
      navigation: {
        floorHeight, floors: 1,
        footprint: { minX: -1000, maxX: 1000, minZ: -1022, maxZ: 978, rearZ: -1022, frontZ: 978 },
        coreOpening: { minX: 10000, maxX: 10001, minZ: 10000, maxZ: 10001 },
        stairs: {
          lowX: 10000, highX: 10001, firstZ: 10000, secondZ: 10002, steps: 8,
          stepRise: 0.175, stepRun: 0.3, treadDepth: 1.16, treadOverlap: 0.025,
          landingWidth: 1.28, landingDepth: 3.16,
          landingCenterX: 10001.64, landingCenterZ: 10001
        }
      },
      getCoordinateData: () => ({
        schemaVersion: "2.0", units: "metres",
        coordinateSystem: { x: "east-west", y: "up", z: "north-south" },
        building: { system: "empty outdoor map", width: 0, depth: 0, floors: 0, height: 0 },
        counts: { objects: meshes.length, logicalCorners: 0, semanticAnchors: 0 },
        objects: [], anchors: []
      }),
      exportCoordinateCSV: () => "record_type,id,name,x,y,z"
    };
  }

  // Foundation plinth and shallow basement level (1 PP). The cellar remains below grade.
  const plinthY = -0.66;
  const plinthHeight = 1.40;
  const plinthBorder = 0.34;
  // Four perimeter strips leave the interior floor visible. A solid foundation
  // block here would cover the playable floor and share coplanar faces with terrain.
  box("Suterén / základový sokl / přední", 0, plinthY, frontZ + plinthBorder / 2,
    width + plinthBorder, plinthHeight, plinthBorder, materials.darkConcrete);
  box("Suterén / základový sokl / zadní", 0, plinthY, rearZ - plinthBorder / 2,
    width + plinthBorder, plinthHeight, plinthBorder, materials.darkConcrete);
  for (const x of [leftX - plinthBorder / 2, rightX + plinthBorder / 2]) {
    box("Suterén / základový sokl / boční", x, plinthY, buildingZ,
      plinthBorder, plinthHeight, depth, materials.darkConcrete);
  }
  box("Hlavní budova / levý štít", leftX + wallT / 2, buildingHeight / 2, buildingZ,
    wallT, buildingHeight, depth, materials.concrete);
  box("Hlavní budova / pravý štít", rightX - wallT / 2, buildingHeight / 2, buildingZ,
    wallT, buildingHeight, depth, materials.concrete);

  for (let floor = 0; floor < floors; floor++) {
    makeFloorSlab(floor);
    facadeWithOpenings(floor, frontZ, true);
    facadeWithOpenings(floor, rearZ, false);
    const y0 = floor * floorHeight;
    // Repeated panel joints and floor bands are characteristic of prefabricated facade bays.
    box("Fasáda / vodorovná spára", 0, y0 + floorHeight - 0.055, frontZ + 0.045, width, 0.055, 0.08, materials.panelEdge);
    box("Fasáda / vodorovná spára zadní", 0, y0 + floorHeight - 0.055, rearZ - 0.045, width, 0.055, 0.08, materials.panelEdge);
    for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) {
      box("Fasáda / svislá spára panelu", x, y0 + floorHeight / 2, frontZ + 0.045, 0.035, floorHeight - 0.1, 0.05, materials.panelEdge);
    }
  }

  // Recessed loggias: their door wall sits inward of the main rear facade line.
  // The outer rear wall is interrupted only at the two module bays serving the living rooms.
  // Side returns and low, aged metal rails keep the openings legible from the courtyard.
  for (let floor = 0; floor < floors; floor++) {
    const fy = floor * floorHeight;
    for (const x of [-3.6, 3.6]) {
      const outerZ = rearZ;
      const innerZ = rearZ + 1.72;
      box("Lodžie / betonová podlaha", x, fy - 0.075, (outerZ + innerZ) / 2, 2.55, 0.15, 1.72, materials.facade);
      for (const side of [-1, 1]) {
        box("Lodžie / boční návratový panel", x + side * 1.55, fy + 1.30, rearZ + 0.91,
          0.10, 2.60, 1.72, materials.darkConcrete);
      }
      box("Lodžie / zábradlí horní madlo", x, fy + 1.02, rearZ + 0.15, 2.42, 0.055, 0.055, materials.oxidizedMetal);
      box("Lodžie / spodní příčka", x, fy + 0.22, rearZ + 0.15, 2.42, 0.045, 0.045, materials.oxidizedMetal);
      for (let p = -3; p <= 3; p++) {
        box("Lodžie / svislé kovové pruty", x + p * 0.35, fy + 0.61, rearZ + 0.15, 0.035, 0.78, 0.035, materials.oxidizedMetal);
      }
      // Worn concrete cheeks and old clothesline brackets, not modern glass balustrades.
      box("Lodžie / konzola", x - 0.92, fy - 0.12, rearZ + 0.35, 0.14, 0.20, 0.35, materials.darkConcrete);
      box("Lodžie / konzola", x + 0.92, fy - 0.12, rearZ + 0.35, 0.14, 0.20, 0.35, materials.darkConcrete);
    }
  }

  // Internal partitions use nominal apartment zones based on the corrected room-area budget.
  const moduleBounds = [
    [-9.0, -5.4, -7.2], [-5.4, -1.8, -3.6],
    [1.8, 5.4, 3.6], [5.4, 9.0, 7.2]
  ];
  const roomBands = {
    outerFrontEnd: frontZ - 3.0,
    middleFrontEnd: frontZ - 3.5,
    hallDepth: PANELAK_LAYOUT.hallDepth,
    bathDepth: PANELAK_LAYOUT.bathDepth,
    bedDepth: 4.35,
    livingDepth: 4.65
  };

  function buildApartmentPartitions(floor) {
    const fy = floor * floorHeight;
    // Room doors open to the short hall/core zone. Structural separations repeat at each floor.
    for (const [x0, x1, center] of moduleBounds) {
      if (center === -7.2 || center === 7.2) {
        wallX("Byt / příčka dětský pokoj a chodba", roomBands.outerFrontEnd, x0 + 0.15, x1 - 0.15,
          fy, 2.58, floor, materials.plaster, { center, width: 0.92, height: 2.05 });
      } else {
        wallX("Byt / příčka kuchyně a bytové jádro", roomBands.middleFrontEnd, x0 + 0.15, x1 - 0.15,
          fy, 2.58, floor, materials.plaster, { center, width: 0.92, height: 2.05 });
      }
    }
    const rearPartitions = [
      { z: roomBands.outerFrontEnd - roomBands.hallDepth, spans: [[-8.85, -5.55, -7.2], [5.55, 8.85, 7.2]] },
      { z: rearZ + roomBands.bedDepth, spans: [[-8.85, -5.55, -7.2], [5.55, 8.85, 7.2]] },
      { z: roomBands.middleFrontEnd - roomBands.bathDepth, spans: [[-5.25, -1.95, -3.6], [1.95, 5.25, 3.6]] }
    ];
    for (const row of rearPartitions) {
      for (const [x0, x1, center] of row.spans) {
        wallX("Byt / příčka středního traktu", row.z, x0, x1, fy, 2.58, floor,
          materials.plaster, { center, width: 0.88, height: 2.05 });
      }
    }
    // Module-separation doorways link the two room bays in each flat.
    for (const x of [-5.4, 5.4]) {
      wallZ("Byt / příčná dělící stěna", x, rearZ + 0.18, frontZ - 0.18, fy, 2.58, floor,
        materials.plaster, [
          { center: buildingZ + 1.15, width: 0.92, height: 2.05 },
          { center: buildingZ - 1.55, width: 0.92, height: 2.05 }
        ]);
    }
    // Both flight ends meet a storey-level corridor. One opening belongs
    // at the lower flight toe and one at the upper flight arrival; a doorway
    // at the half-storey landing would lead into a wall with no floor behind it.
    const stairDoors = [
      { center: stair.firstZ, width: 1.28, height: 2.12 },
      { center: stair.secondZ, width: 1.28, height: 2.12 }
    ];
    for (const x of [-1.8, 1.8]) {
      wallZ("Schodiště / stěna jádra", x, rearZ + 0.18, frontZ - 0.18,
        fy, floorHeight - 0.16, floor, materials.concrete, stairDoors);
    }
  }

  // Furniture and fittings are deliberately period-plain: panel furniture, lino,
  // white enamel sanitaryware, fluorescent corridor lights and simple pine doors.
  function furnishFlat(floor, sign) {
    const fy = floor * floorHeight;
    const outerX = sign * 7.2;
    const innerX = sign * 3.6;
    const frontRoomZ = frontZ - 1.65;
    const middleZ = buildingZ + 1.0;
    const rearRoomZ = rearZ + 3.35;

    box("Interiér / kuchyňská linka", sign * 3.6, fy + 0.47, frontZ - 0.62,
      2.75, 0.94, 0.48, materials.woodLight);
    box("Interiér / pracovní deska kuchyně", sign * 3.6, fy + 0.97, frontZ - 0.62,
      2.82, 0.06, 0.52, materials.darkConcrete);
    box("Interiér / sporák", sign * 3.6 - sign * 0.74, fy + 1.01, frontZ - 0.62,
      0.54, 0.07, 0.50, materials.white);
    box("Interiér / lednice", sign * 4.72, fy + 0.93, frontZ - 0.70,
      0.55, 1.86, 0.62, materials.white);
    box("Interiér / kuchyňský stůl", sign * 3.3, fy + 0.78, frontZ - 2.20,
      1.10, 0.08, 0.72, materials.wood);
    for (const dx of [-0.42, 0.42]) for (const dz of [-0.24, 0.24]) {
      box("Interiér / noha stolu", sign * 3.3 + dx, fy + 0.38, frontZ - 2.20 + dz,
        0.055, 0.72, 0.055, materials.wood);
    }
    box("Interiér / jídelní židle", sign * 2.85, fy + 0.45, frontZ - 2.20,
      0.38, 0.84, 0.38, materials.wood);
    box("Interiér / dětský pokoj postel", outerX, fy + 0.26, frontRoomZ - 0.72,
      1.0, 0.45, 2.0, materials.wood);
    box("Interiér / dětský pokoj skříň", outerX + sign * 1.10, fy + 0.98, frontZ - 0.65,
      0.42, 1.96, 1.85, materials.woodLight);
    box("Interiér / obývací pokoj sedačka", innerX, fy + 0.42, rearRoomZ + 0.5,
      2.15, 0.80, 0.80, materials.wood);
    box("Interiér / obývací pokoj konferenční stolek", innerX, fy + 0.38, rearRoomZ - 0.48,
      0.95, 0.30, 0.55, materials.woodLight);
    box("Interiér / obývací pokoj obývací stěna", innerX + sign * 1.30, fy + 0.98, rearRoomZ - 0.60,
      0.34, 1.90, 1.75, materials.wood);
    box("Interiér / ložnice manželská postel", outerX, fy + 0.28, rearRoomZ,
      1.75, 0.42, 2.05, materials.wood);
    box("Interiér / ložnice šatní skříň", outerX + sign * 1.08, fy + 1.0, rearZ + 0.70,
      0.46, 2.0, 1.85, materials.woodLight);

    // Bathroom B7-inspired assembly, with separate fittings around an upright services shaft.
    box("Jádro B7 / vana", innerX, fy + 0.28, middleZ,
      1.68, 0.56, 0.72, materials.bath);
    box("Jádro B7 / umyvadlo", innerX + sign * 1.05, fy + 0.72, middleZ + 0.28,
      0.62, 0.18, 0.44, materials.white);
    box("Jádro B7 / WC", innerX - sign * 0.82, fy + 0.32, middleZ - 0.25,
      0.40, 0.44, 0.58, materials.white);
    box("Jádro B7 / instalační šachta", innerX - sign * 1.35, fy + 1.22, middleZ,
      0.28, 2.44, 0.42, materials.tile);
    box("Interiér / vestavěná předsíňová skříň", outerX, fy + 0.98, middleZ,
      0.42, 1.92, 1.50, materials.woodLight);
    box("Interiér / zářivkové svítidlo", sign * 1.0, fy + 2.58, buildingZ + 0.95,
      0.95, 0.055, 0.16, materials.white);
  }

  // Main facade, rear facade and low-rise side silhouette.
  for (let floor = 0; floor < floors; floor++) {
    buildApartmentPartitions(floor);
    furnishFlat(floor, -1);
    furnishFlat(floor, 1);
    // Window reveal ledges and floor datums repeat at a restrained 2.8 m pitch.
    for (const x of [-7.2, -3.6, 3.6, 7.2]) {
      box("Fasáda / parapetní hrana", x, floor * floorHeight + 0.82, frontZ + 0.10,
        1.48, 0.075, 0.14, materials.panelEdge);
      box("Fasáda zadní / parapetní hrana", x, floor * floorHeight + 0.82, rearZ - 0.10,
        1.48, 0.075, 0.14, materials.panelEdge);
    }
  }

  // Central staircase: three inter-storey runs, eight treads per flight and a real landing.
  const stepRise = (floorHeight / 2) / stair.steps;
  function railBeam(name, x1, y1, z1, x2, y2, z2, zOffset) {
    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const rail = box(name, (x1 + x2) / 2, (y1 + y2) / 2, z1 + zOffset,
      length, 0.055, 0.055, materials.oxidizedMetal);
    rail.rotation.z = Math.atan2(dy, dx);
    return rail;
  }
  for (let floor = 0; floor < floors - 1; floor++) {
    const baseY = floor * floorHeight;
    for (let i = 0; i < stair.steps; i++) {
      const t = (i + 0.5) / stair.steps;
      const zA = stair.firstZ + (stair.secondZ - stair.firstZ) * t;
      const yA = baseY + (i + 1) * stepRise - 0.09;
      box("Schodiště / dolní rameno / stupeň", stair.lowX, yA, zA,
        treadWidth, 0.18, stepRun + stair.treadOverlap,
        i % 2 ? materials.concrete : materials.facade);
      const zB = stair.secondZ - (stair.secondZ - stair.firstZ) * t;
      const yB = baseY + floorHeight / 2 + (i + 1) * stepRise - 0.09;
      box("Schodiště / horní rameno / stupeň", stair.highX, yB, zB,
        treadWidth, 0.18, stepRun + stair.treadOverlap,
        i % 2 ? materials.concrete : materials.facade);
    }
    // The half-storey landing spans both flights at the turn, not the entire stairwell length.
    box("Schodiště / mezipodesta", landingCenterX,
      baseY + floorHeight / 2 - 0.07, landingCenterZ,
      landingWidth, 0.14, landingDepth, materials.concrete);
    for (const lane of [
      { x: stair.lowX, z1: stair.firstZ, z2: stair.secondZ, y1: baseY + 0.88, y2: baseY + floorHeight / 2 + 0.88 },
      { x: stair.highX, z1: stair.secondZ, z2: stair.firstZ, y1: baseY + floorHeight / 2 + 0.88, y2: baseY + floorHeight + 0.88 }
    ]) {
      for (const offset of [-0.54, 0.54]) {
        const midZ = (lane.z1 + lane.z2) / 2;
        const midY = (lane.y1 + lane.y2) / 2;
        const length = Math.hypot(lane.z2 - lane.z1, lane.y2 - lane.y1);
        const rail = box("Schodiště / šikmé kovové madlo", lane.x + offset, midY, midZ,
          0.045, length, 0.045, materials.oxidizedMetal);
        rail.rotation.x = Math.atan2(lane.y2 - lane.y1, lane.z2 - lane.z1);
      }
      for (let i = 0; i <= stair.steps; i++) {
        const t = i / stair.steps;
        const z = lane.z1 + (lane.z2 - lane.z1) * t;
        const y = lane.y1 + (lane.y2 - lane.y1) * t - 0.40;
        for (const offset of [-0.54, 0.54]) {
          box("Schodiště / svislá výplň zábradlí", lane.x + offset, y, z, 0.035, 0.80, 0.035, materials.oxidizedMetal);
        }
      }
    }
  }

  // Roof slab, parapet, vents and a modest service hatch; no elevator machinery.
  box("Střecha / stropní deska", 0, buildingHeight - 0.08, buildingZ, width + 0.20, 0.16, depth + 0.20, materials.concrete);
  box("Střecha / atika přední", 0, buildingHeight + 0.38, frontZ + 0.04, width + 0.30, 0.58, 0.22, materials.facade);
  box("Střecha / atika zadní", 0, buildingHeight + 0.38, rearZ - 0.04, width + 0.30, 0.58, 0.22, materials.facade);
  for (const x of [leftX + 0.05, rightX - 0.05]) {
    box("Střecha / boční atika", x, buildingHeight + 0.38, buildingZ, 0.22, 0.58, depth, materials.facade);
  }
  box("Střecha / větrací komín", -5.9, buildingHeight + 0.45, buildingZ - 2.1, 0.85, 0.9, 0.85, materials.darkConcrete);
  box("Střecha / větrací komín", 5.9, buildingHeight + 0.45, buildingZ - 2.1, 0.85, 0.9, 0.85, materials.darkConcrete);
  box("Střecha / servisní poklop", 0, buildingHeight + 0.015, buildingZ + 0.4, 0.95, 0.06, 0.95, materials.darkConcrete);

  // Entrance identity, old intercom and basement light-wells finish the street edge.
  box("Vchod / přístřešek z betonu", 0, 2.75, frontZ + 0.58, 3.5, 0.18, 1.12, materials.darkConcrete);
  box("Vchod / označení VCHOD 02", 0, 3.18, frontZ + 0.095, 1.55, 0.26, 0.06, materials.oxidizedMetal);
  box("Vchod / zvonkový panel", 1.18, 1.55, frontZ + 0.12, 0.16, 0.52, 0.08, materials.darkConcrete);
  box("Vchod / schránky", -0.75, 1.35, frontZ - 1.1, 0.78, 1.0, 0.18, materials.metal);
  box("Vchod / nástěnka domu", 0.78, 1.45, frontZ - 1.1, 0.62, 1.1, 0.07, materials.woodLight);
  for (let i = 0; i < 8; i++) {
    box("Vchod / štítek zvonku " + String(i + 1).padStart(2, "0"), 1.18, 1.68 - i * 0.055, frontZ + 0.17,
      0.075, 0.025, 0.015, materials.white);
  }

  // Floor-scoped structural wall colliders. These preserve separate apartment floors
  // while leaving the entry, stair doors, room doors and loggia thresholds passable.
  for (let floor = 0; floor < floors; floor++) {
    const fy = floor * floorHeight;
    addCollider(leftX + wallT / 2, wallT, buildingZ, depth, floor);
    addCollider(rightX - wallT / 2, wallT, buildingZ, depth, floor);
    if (floor > 0) {
      // Rear wall gets two passages into the recessed loggias on every occupied floor.
    const gaps = [-3.6, 3.6].map(x => ({ start: x - 0.74, end: x + 0.74 })).sort((a, b) => a.start - b.start);
    let cursor = leftX;
    for (const gap of gaps) {
      if (gap.start > cursor) addCollider((cursor + gap.start) / 2, gap.start - cursor, rearZ, wallT, floor);
      cursor = gap.end;
    }
    if (cursor < rightX) addCollider((cursor + rightX) / 2, rightX - cursor, rearZ, wallT, floor);
    // The old-fashioned metal guardrail is a real boundary for the player capsule.
    for (const x of [-3.6, 3.6]) addCollider(x, 2.42, rearZ + 0.15, 0.08, floor);
    // The front facade opening is traversable only at the main entrance on the ground floor.
    if (floor === 0) {
      addCollider((leftX - 0.88) / 2, -0.88 - leftX, frontZ, wallT, floor);
      addCollider((0.88 + rightX) / 2, rightX - 0.88, frontZ, wallT, floor);
    } else {
      addCollider(0, width, frontZ, wallT, floor);
    }
  }

  for (let i = 0; i < floors; i++) {
    for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) {
      box("Interiér / stropní zářivka", x, i * floorHeight + 2.67, buildingZ,
        0.78, 0.055, 0.12, materials.white);
    }
  }

  interactables.push({
    id: "stairs", name: "Schodiště", description: "Čtyři nadzemní podlaží, bez výtahu.",
    x: 0, z: buildingZ + 1.2, range: 2.4, used: false,
    action: () => ui?.showToast?.("Schodiště T06B: projdi fyzické stupně pomocí WASD. Dům nemá výtah.")
  });

  function getCoordinateData() {
    scene.updateMatrixWorld(true);
    const round = n => Math.round(n * 1e6) / 1e6;
    const v = new THREE.Vector3();
    const objects = meshes.map((mesh, index) => {
      mesh.updateWorldMatrix(true, false);
      const pos = mesh.geometry.getAttribute("position");
      const pts = new Map();
      const min = { x: Infinity, y: Infinity, z: Infinity };
      const max = { x: -Infinity, y: -Infinity, z: -Infinity };
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        const p = { x: round(v.x), y: round(v.y), z: round(v.z) };
        pts.set(p.x + "," + p.y + "," + p.z, p);
        min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
        max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
      }
      const p = mesh.getWorldPosition(new THREE.Vector3());
      const params = mesh.geometry.parameters || {};
      return {
        id: "object-" + String(index + 1).padStart(4, "0"),
        name: mesh.name,
        center: { x: round(p.x), y: round(p.y), z: round(p.z) },
        dimensions: { x: round(params.width || 0), y: round(params.height || 0), z: round(params.depth || 0) },
        bounds: { min, max },
        corners: [...pts.values()],
        floorIndex: Math.max(0, Math.min(floors, Math.floor(p.y / floorHeight))),
        provenance: "src/game/main-building.js"
      };
    });

    const anchors = [
      { id: "building-origin", name: "Střed půdorysu", position: { x: 0, y: 0, z: buildingZ }, provenance: "building design" },
      { id: "front-left-ground", name: "Přední levý roh", position: { x: leftX, y: 0, z: frontZ }, provenance: "building bounds" },
      { id: "front-right-ground", name: "Přední pravý roh", position: { x: rightX, y: 0, z: frontZ }, provenance: "building bounds" },
      { id: "rear-left-ground", name: "Zadní levý roh", position: { x: leftX, y: 0, z: rearZ }, provenance: "building bounds" },
      { id: "rear-right-ground", name: "Zadní pravý roh", position: { x: rightX, y: 0, z: rearZ }, provenance: "building bounds" },
      { id: "roof-datum", name: "Výškové datum střechy", position: { x: 0, y: buildingHeight, z: buildingZ }, provenance: "four floors × 2.8 m" },
      { id: "entrance-left-bottom", name: "Vchod vlevo dole", position: { x: -0.88, y: 0.02, z: frontZ }, provenance: "main entrance opening" },
      { id: "entrance-right-top", name: "Vchod vpravo nahoře", position: { x: 0.88, y: 2.36, z: frontZ }, provenance: "main entrance opening" },
      { id: "stair-mid-landing-f0", name: "Mezipodesta schodiště přízemí", position: { x: landingCenterX, y: floorHeight / 2 - 0.07, z: landingCenterZ }, provenance: "stair dimensions" },
      { id: "stair-arrival-f1", name: "Nástup schodiště 1. patro", position: { x: stair.lowX, y: floorHeight, z: stair.secondZ }, provenance: "upper stair flight" }
    ];
    for (let floor = 0; floor < floors; floor++) {
      for (const x of [-3.6, 3.6]) {
        anchors.push({
          id: "loggia-door-f" + floor + "-x" + (x < 0 ? "L" : "R"),
          name: "Dveře lodžie, patro " + floor,
          position: { x, y: floor * floorHeight + 1.23, z: rearZ + 1.72 },
          provenance: "rear recessed loggia door"
        });
      }
    }
    for (let floor = 0; floor <= floors; floor++) {
      anchors.push({
        id: "floor-datum-" + floor,
        name: "Podlažní datum " + floor,
        position: { x: 0, y: floor * floorHeight, z: buildingZ },
        provenance: "floor × floorHeight"
      });
    }
    return {
      schemaVersion: "2.0",
      units: "metres",
      coordinateSystem: {
        x: "across the 18 m facade",
        y: "vertical upward",
        z: "depth; facade front is positive Z",
        buildingWorldOrigin: { x: 0, y: 0, z: buildingZ },
        localToWorld: "x_world=x_local; y_world=y_local; z_world=z_local-22"
      },
      building: {
        system: "T06B-inspired five-module section",
        width, depth, floors, basementFloors: 1, floorHeight, height: buildingHeight,
        modules: 5, moduleWidth, apartmentsPerFloor: 2, elevator: false,
        targetApartmentArea: PANELAK_LAYOUT.apartmentArea,
        correctedNominalRoomArea: PANELAK_LAYOUT.calculatedRoomArea
      },
      counts: { objects: objects.length, logicalCorners: objects.reduce((sum, o) => sum + o.corners.length, 0), semanticAnchors: anchors.length },
      objects, anchors
    };
  }

  function exportCoordinateCSV() {
    const data = getCoordinateData();
    const rows = [["record_type", "id", "name", "x", "y", "z", "width", "height", "depth", "min_x", "min_y", "min_z", "max_x", "max_y", "max_z", "floor_index", "provenance"]];
    const field = value => {
      if (value === null || value === undefined) return "";
      const s = String(value);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    for (const o of data.objects) rows.push([
      "object", o.id, o.name, o.center.x, o.center.y, o.center.z,
      o.dimensions.x, o.dimensions.y, o.dimensions.z,
      o.bounds.min.x, o.bounds.min.y, o.bounds.min.z, o.bounds.max.x, o.bounds.max.y, o.bounds.max.z,
      o.floorIndex, o.provenance
    ]);
    for (const a of data.anchors) rows.push(["anchor", a.id, a.name, a.position.x, a.position.y, a.position.z, "", "", "", "", "", "", "", "", "", "", a.provenance]);
    return rows.map(row => row.map(field).join(",")).join("\r\n");
  }

  const navigation = {
    floorHeight, floors, coreOpening: { ...core },
    footprint: { minX: leftX, maxX: rightX, minZ: rearZ, maxZ: frontZ, frontZ, rearZ },
    stairs: {
      ...stair, stepRise, stepRun, treadWidth, landingWidth, landingDepth, landingCenterX, landingCenterZ
    }
  };
  return { colliders, interactables, meshesToAnimate, doorAnimations, meshes, navigation, getCoordinateData, exportCoordinateCSV };
}

// Main-building remaster: a sparse exterior map and a structurally open, eight-storey panelák.
export function createMainBuildingWorld({ THREE, scene, state, ui }) {
  const colliders = [];
  const interactables = [];
  const meshesToAnimate = [];
  const doorAnimations = [];
  const meshes = [];
  const liftCarMeshes = [];
  const liftDoorPanels = [];
  const liftDoorColliders = [];
  const liftCabinColliders = [];
  let liftCarFloor = 0;

  const concrete = new THREE.MeshStandardMaterial({
    color: 0xbdbbb2, roughness: 0.96, flatShading: true
  });
  const facadePanel = new THREE.MeshStandardMaterial({
    color: 0xc9c7bd, roughness: 0.98, flatShading: true
  });
  const concreteDark = new THREE.MeshStandardMaterial({
    color: 0x858883, roughness: 1, flatShading: true
  });
  const reveal = new THREE.MeshStandardMaterial({
    color: 0x686f70, roughness: 1, flatShading: true
  });
  const glassDark = new THREE.MeshStandardMaterial({
    color: 0x40545d, roughness: 0.35, metalness: 0.10, flatShading: true
  });
  const glassWarm = new THREE.MeshStandardMaterial({
    color: 0x93836a, roughness: 0.48, metalness: 0.04, flatShading: true
  });
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x626a69, roughness: 0.88, metalness: 0.12, flatShading: true
  });
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x384548, roughness: 0.76, metalness: 0.12, flatShading: true
  });
  const grass = new THREE.MeshStandardMaterial({
    color: 0x747b6d, roughness: 1, flatShading: true
  });
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x50565a, roughness: 1, flatShading: true
  });
  const pavement = new THREE.MeshStandardMaterial({
    color: 0x98978e, roughness: 1, flatShading: true
  });
  const roadMark = new THREE.MeshStandardMaterial({
    color: 0xc3c0b1, roughness: 1, flatShading: true
  });

  function box(name, x, y, z, sx, sy, sz, material, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow ?? false;
    mesh.receiveShadow = options.receiveShadow ?? true;
    scene.add(mesh);
    meshes.push(mesh);
    if (options.collider) {
      colliders.push({
        minX: x - sx / 2, maxX: x + sx / 2,
        minZ: z - sz / 2, maxZ: z + sz / 2
      });
    }
    return mesh;
  }

  // Keep the surroundings deliberately spare: open ground, one road, one footpath.
  box("Mapa / terén", 0, -0.11, -22, 240, 0.22, 240, grass);
  box("Mapa / hlavní silnice", 0, 0.012, 2.7, 220, 0.035, 8.2, asphalt);
  box("Mapa / chodník u silnice", 0, 0.025, -2.05, 220, 0.05, 1.55, pavement);
  box("Mapa / přístupová cesta", 0, 0.018, -8, 6.0, 0.036, 10.0, pavement);
  box("Mapa / vstupní plošina", 0, 0.035, -14.8, 7.0, 0.07, 3.4, facadePanel);

  for (let x = -102; x <= 102; x += 12) {
    box("Silnice / přerušovaná čára", x, 0.034, 2.7, 4.4, 0.012, 0.12, roadMark, {
      castShadow: false, receiveShadow: false
    });
  }

  // Consistent dimensions: 28 m wide, 12 m deep, 8 storeys, 2.8 m floor-to-floor.
  const building = { x: 0, z: -22, width: 28, depth: 12, floors: 8, floorHeight: 2.8, wall: 0.28 };
  const { x: bx, z: bz, width, depth, floors, floorHeight, wall: wallT } = building;
  const height = floors * floorHeight;
  const frontZ = bz + depth / 2;
  const rearZ = bz - depth / 2;
  const leftX = bx - width / 2;
  const rightX = bx + width / 2;
  const frontWallZ = frontZ - wallT / 2;

  // Floors are real slabs. Upper storeys keep a central void for the stairs and lift.
  const coreOpening = { minX: -3.8, maxX: 3.8, minZ: -26.0, maxZ: -22.35 };
  function makeFloorSlab(floor) {
    const y = floor * floorHeight - 0.08;
    const material = concrete;
    if (floor === 0) {
      box("Hlavní budova / přízemní podlaha", bx, y, bz, width + 0.28, 0.16, depth + 0.28, material);
      return;
    }
    const fullLeft = leftX - 0.14;
    const fullRight = rightX + 0.14;
    const leftWidth = coreOpening.minX - fullLeft;
    const rightWidth = fullRight - coreOpening.maxX;
    const frontDepth = (frontZ + 0.14) - coreOpening.maxZ;
    const rearDepth = coreOpening.minZ - (rearZ - 0.14);
    box("Podlaží / levé křídlo", (fullLeft + coreOpening.minX) / 2, y,
      bz, leftWidth, 0.16, depth + 0.28, material);
    box("Podlaží / pravé křídlo", (coreOpening.maxX + fullRight) / 2, y,
      bz, rightWidth, 0.16, depth + 0.28, material);
    box("Podlaží / vstupní chodba", bx, y, (coreOpening.maxZ + frontZ + 0.14) / 2,
      coreOpening.maxX - coreOpening.minX, 0.16, frontDepth, material);
    box("Podlaží / zadní trakt", bx, y, (rearZ - 0.14 + coreOpening.minZ) / 2,
      coreOpening.maxX - coreOpening.minX, 0.16, rearDepth, material);
  }
  function makeRoofSlab() {
    const y = floors * floorHeight - 0.08;
    const material = facadePanel;
    const fullLeft = leftX - 0.14;
    const fullRight = rightX + 0.14;
    const slabRearZ = rearZ - 0.14;
    const slabFrontZ = frontZ + 0.14;

    // A dedicated maintenance hatch sits above the top stair landing.
    // Unlike residential floors, the roof does not repeat the large stair/lift core void.
    const roofHatch = {
      minX: -1.325, maxX: -0.275,
      minZ: -24.625, maxZ: -23.575
    };
    const hatchWidth = roofHatch.maxX - roofHatch.minX;
    const hatchDepth = roofHatch.maxZ - roofHatch.minZ;
    const fullDepth = depth + 0.28;

    box("Střecha / deska vlevo od servisního poklopu",
      (fullLeft + roofHatch.minX) / 2, y, bz,
      roofHatch.minX - fullLeft, 0.16, fullDepth, material);
    box("Střecha / deska vpravo od servisního poklopu",
      (roofHatch.maxX + fullRight) / 2, y, bz,
      fullRight - roofHatch.maxX, 0.16, fullDepth, material);
    box("Střecha / deska za servisním poklopem",
      (roofHatch.minX + roofHatch.maxX) / 2, y,
      (slabRearZ + roofHatch.minZ) / 2,
      hatchWidth, 0.16, roofHatch.minZ - slabRearZ, material);
    box("Střecha / deska před servisním poklopem",
      (roofHatch.minX + roofHatch.maxX) / 2, y,
      (roofHatch.maxZ + slabFrontZ) / 2,
      hatchWidth, 0.16, slabFrontZ - roofHatch.maxZ, material);

    const roofY = height;
    const frameT = 0.10;
    const frameH = 0.12;
    const frameY = roofY + frameH / 2;
    const hatchX = (roofHatch.minX + roofHatch.maxX) / 2;
    const hatchZ = (roofHatch.minZ + roofHatch.maxZ) / 2;
    box("Střecha / rám poklopu vlevo", roofHatch.minX - frameT / 2,
      frameY, hatchZ, frameT, frameH, hatchDepth + frameT, concreteDark);
    box("Střecha / rám poklopu vpravo", roofHatch.maxX + frameT / 2,
      frameY, hatchZ, frameT, frameH, hatchDepth + frameT, concreteDark);
    box("Střecha / rám poklopu vzadu", hatchX, frameY,
      roofHatch.minZ - frameT / 2, hatchWidth, frameH, frameT, concreteDark);
    box("Střecha / rám poklopu vpředu", hatchX, frameY,
      roofHatch.maxZ + frameT / 2, hatchWidth, frameH, frameT, concreteDark);

    // The hatch lid is shown resting open on the roof, clear of the ladder opening.
    box("Střecha / otevřený poklop", hatchX, roofY + 0.04,
      roofHatch.maxZ + frameT + hatchDepth / 2,
      hatchWidth, 0.08, hatchDepth, facadePanel);

    // Fixed access ladder from the top landing to the roof hatch.
    const ladderZ = roofHatch.maxZ - 0.14;
    const ladderBottomY = (floors - 1) * floorHeight + 0.22;
    const ladderTopY = roofY - 0.12;
    const ladderHeight = ladderTopY - ladderBottomY;
    const ladderCenterY = (ladderTopY + ladderBottomY) / 2;
    const ladderLeftX = roofHatch.minX + 0.16;
    const ladderRightX = roofHatch.maxX - 0.16;
    box("Střecha / žebřík levá stojina", ladderLeftX, ladderCenterY, ladderZ,
      0.045, ladderHeight, 0.045, railMaterial);
    box("Střecha / žebřík pravá stojina", ladderRightX, ladderCenterY, ladderZ,
      0.045, ladderHeight, 0.045, railMaterial);
    const rungStartY = ladderBottomY + 0.10;
    const rungEndY = ladderTopY - 0.08;
    for (let rungY = rungStartY; rungY <= rungEndY; rungY += 0.24) {
      box("Střecha / žebřík příčka", hatchX, rungY, ladderZ,
        hatchWidth - 0.30, 0.035, 0.035, railMaterial);
    }
  }

  for (let floor = 0; floor < floors; floor++) makeFloorSlab(floor);
  makeRoofSlab();
  box("Hlavní budova / zadní stěna", bx, height / 2, rearZ + wallT / 2, width, height, wallT, concrete);
  box("Hlavní budova / levá štítová stěna", leftX + wallT / 2, height / 2, bz, wallT, height, depth, concrete);
  box("Hlavní budova / pravá štítová stěna", rightX - wallT / 2, height / 2, bz, wallT, height, depth, concrete);

  const doorWidth = 1.82;
  const doorHeight = 2.50;
  // Split the plinth around the actual entrance opening, including a small tolerance.
  const plinthEndX = doorWidth / 2 + 0.11;
  const plinthWidth = width / 2 - plinthEndX;
  box("Hlavní budova / sokl vlevo od vchodu", -(width / 2 + plinthEndX) / 2,
    0.36, frontZ - 0.025, plinthWidth, 0.72, 0.14, concreteDark);
  box("Hlavní budova / sokl vpravo od vchodu", (width / 2 + plinthEndX) / 2,
    0.36, frontZ - 0.025, plinthWidth, 0.72, 0.14, concreteDark);

  // Front facade is built as wall sections around real rectangular openings.
  // Windows are holes in the wall geometry, not glass cards floating on a solid slab.
  const windowXs = [-11.4, -8.15, -4.9, -1.65, 1.65, 4.9, 8.15, 11.4];
  const windowWidth = 1.36;
  const windowBottom = 0.78;
  const windowTop = 2.28;

  function buildFacadeFloor(floor) {
    const floorY = floor * floorHeight;
    const openings = [];
    for (let i = 0; i < windowXs.length; i++) {
      const wx = windowXs[i];
      if (floor === 0 && Math.abs(wx) < 2) continue;
      const isBalconyDoor = Math.abs(Math.abs(wx) - 4.9) < 0.001;
      const openingBottom = isBalconyDoor ? 0 : windowBottom;
      openings.push({
        kind: isBalconyDoor ? "balcony-door" : "window",
        x0: wx - windowWidth / 2, x1: wx + windowWidth / 2,
        y0: floorY + openingBottom, y1: floorY + windowTop,
        x: wx, column: i, openingBottom
      });
    }
    if (floor === 0) {
      openings.push({
        kind: "door", x0: -doorWidth / 2, x1: doorWidth / 2,
        y0: 0.02, y1: doorHeight, x: 0
      });
    }

    const xCuts = [leftX, rightX];
    const yCuts = [floorY, floorY + floorHeight];
    for (const opening of openings) {
      xCuts.push(opening.x0, opening.x1);
      yCuts.push(opening.y0, opening.y1);
    }
    const xs = [...new Set(xCuts)].sort((a, b) => a - b);
    const ys = [...new Set(yCuts)].sort((a, b) => a - b);

    for (let xi = 0; xi < xs.length - 1; xi++) {
      const x0 = xs[xi], x1 = xs[xi + 1];
      if (x1 - x0 < 0.015) continue;
      const cx = (x0 + x1) / 2;
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const y0 = ys[yi], y1 = ys[yi + 1];
        if (y1 - y0 < 0.015) continue;
        const cy = (y0 + y1) / 2;
        const isOpening = openings.some(opening =>
          cx > opening.x0 - 0.001 && cx < opening.x1 + 0.001 &&
          cy > opening.y0 - 0.001 && cy < opening.y1 + 0.001
        );
        if (isOpening) continue;
        box("Fasáda / prefabrikovaný betonový panel", cx, cy, frontWallZ,
          x1 - x0, y1 - y0, wallT, (xi + yi + floor) % 4 === 0 ? facadePanel : concrete);
      }
    }

    // Low, high-contrast reveals make the floor rhythm visible at pixel scale.
    box("Fasáda / vodorovná spára", bx, floorY + floorHeight - 0.055,
      frontZ + 0.025, width, 0.07, 0.055, concreteDark);

    for (const opening of openings) {
      const isBalconyDoor = opening.kind === "balcony-door";
      const openingBottom = opening.openingBottom ?? windowBottom;
      const openingHeight = windowTop - openingBottom;
      const wy = floorY + (openingBottom + windowTop) / 2;
      const pane = ((floor * 7 + opening.column * 3) % 13 === 0) ? glassWarm : glassDark;
      const frameZ = frontZ + 0.075;
      const frameW = 0.075;
      const leftFrameName = isBalconyDoor ? "Balkonové dveře / levý rám" : "Okno / levý rám";
      const rightFrameName = isBalconyDoor ? "Balkonové dveře / pravý rám" : "Okno / pravý rám";
      const topFrameName = isBalconyDoor ? "Balkonové dveře / horní rám" : "Okno / horní rám";
      const bottomFrameName = isBalconyDoor ? "Balkonové dveře / spodní rám" : "Okno / spodní rám";

      if (isBalconyDoor) {
        // Open door leaves are turned into the balcony depth, leaving the center passable.
        const leafOffset = windowWidth / 2 - 0.08;
        for (const side of [-1, 1]) {
          box(side < 0 ? "Balkonové dveře / otevřené levé křídlo" : "Balkonové dveře / otevřené pravé křídlo",
            opening.x + side * leafOffset, wy, frontZ + 0.30,
            0.04, openingHeight - 0.14, 0.56, pane);
        }
      } else {
        box("Okno / tmavé zapuštěné sklo", opening.x, wy, frontZ + 0.035,
          windowWidth - 0.14, openingHeight - 0.14, 0.04, pane);
        box("Okno / středová příčka", opening.x, wy, frameZ + 0.012,
          windowWidth - 0.14, 0.045, 0.045, concreteDark);
      }

      box(leftFrameName, opening.x - windowWidth / 2 + frameW / 2, wy,
        frameZ, frameW, openingHeight, 0.07, facadePanel);
      box(rightFrameName, opening.x + windowWidth / 2 - frameW / 2, wy,
        frameZ, frameW, openingHeight, 0.07, facadePanel);
      box(topFrameName, opening.x, floorY + windowTop - 0.035,
        frameZ, windowWidth, 0.07, 0.07, facadePanel);
      box(bottomFrameName, opening.x, floorY + openingBottom + 0.035,
        frameZ, windowWidth, 0.07, 0.07, facadePanel);
    }
  }

  for (let floor = 0; floor < floors; floor++) buildFacadeFloor(floor);

  // Repeating shallow loggias. Balconies have slab, side cheeks and a distinct metal railing.
  for (let floor = 0; floor < floors; floor++) {
    const floorY = floor * floorHeight;
    for (const x of [-4.9, 4.9]) {
      const slabY = floorY - 0.08;
      const balconyZ = frontZ + 0.78;
      box("Balkon / betonová deska", x, slabY, balconyZ, 2.48, 0.16, 1.55, facadePanel);
      box("Balkon / horní madlo", x, floorY + 1.25, frontZ + 1.555, 2.38, 0.065, 0.065, railMaterial);
      box("Balkon / spodní příčka", x, floorY + 0.12, frontZ + 1.555, 2.36, 0.045, 0.045, railMaterial);
      for (let post = -2; post <= 2; post++) {
        box("Balkon / svislé zábradlí", x + post * 0.46, floorY + 0.61,
          frontZ + 1.555, 0.045, 1.18, 0.045, railMaterial);
      }
      for (const side of [-1, 1]) {
        box("Balkon / bočnice", x + side * 1.19, floorY + 0.38,
          frontZ + 0.79, 0.08, 0.76, 1.40, concreteDark);
      }
    }
  }

  // Entrance recess sits inside the door opening; canopy and approach stairs form one clear landmark.
  box("Vchod / levé ostění", -doorWidth / 2 - 0.07, 1.29, frontZ + 0.045,
    0.14, 2.58, 0.18, facadePanel);
  box("Vchod / pravé ostění", doorWidth / 2 + 0.07, 1.29, frontZ + 0.045,
    0.14, 2.58, 0.18, facadePanel);
  box("Vchod / nadpraží", 0, doorHeight + 0.06, frontZ + 0.045,
    doorWidth + 0.28, 0.12, 0.18, facadePanel);
  // Both entrance leaves are shown swung open against the jambs, so the playable entry is visibly clear.
  box("Vchod / otevřené levé dveřní křídlo", -0.90, 1.20, frontZ + 0.34,
    0.055, 2.34, 0.78, doorMaterial);
  box("Vchod / otevřené pravé dveřní křídlo", 0.90, 1.20, frontZ + 0.34,
    0.055, 2.34, 0.78, doorMaterial);
  for (const side of [-1, 1]) {
    box("Vchod / zasklení otevřeného dveřního křídla",
      side * 0.94, 1.52, frontZ + 0.34,
      0.025, 1.08, 0.52, glassDark);
  }
  box("Vchod / madlo pravého křídla", 0.90, 1.12, frontZ + 0.34,
    0.035, 0.43, 0.035, facadePanel);
  box("Vchod / přístřešek", 0, 2.92, frontZ + 0.78,
    3.65, 0.18, 1.46, concreteDark);
  box("Vchod / schod 1", 0, 0.09, frontZ + 0.46,
    2.95, 0.18, 0.50, facadePanel);
  box("Vchod / schod 2", 0, 0.045, frontZ + 0.88,
    3.20, 0.09, 0.42, facadePanel);
  box("Vchod / identifikační tabulka", 0, 3.31, frontZ + 0.085,
    1.86, 0.28, 0.07, railMaterial);
  box("Vchod / zvonkový panel", 1.17, 1.68, frontZ + 0.10,
    0.16, 0.48, 0.08, reveal);

  // Roof edge and a restrained service core finish the silhouette without adding nearby buildings.
  const roofY = height;
  box("Hlavní budova / střešní atika přední", bx, roofY + 0.40, frontZ - 0.05,
    width + 0.42, 0.68, 0.24, facadePanel);
  box("Hlavní budova / střešní atika zadní", bx, roofY + 0.40, rearZ + 0.05,
    width + 0.42, 0.68, 0.24, facadePanel);
  box("Hlavní budova / střešní atika levá", leftX + 0.05, roofY + 0.40, bz,
    0.24, 0.68, depth - 0.1, facadePanel);
  box("Hlavní budova / střešní atika pravá", rightX - 0.05, roofY + 0.40, bz,
    0.24, 0.68, depth - 0.1, facadePanel);
  box("Hlavní budova / strojovna výtahu", 2.2, roofY + 0.59, bz - 1.1,
    4.2, 1.18, 3.8, concreteDark);
  box("Hlavní budova / větrací komín", -4.4, roofY + 0.55, bz - 2.0,
    1.0, 1.1, 1.0, concreteDark);

  // Shared corridor partitions and open apartment doorways repeat on each residential floor.
  const corridorWallX = [-4.75, 4.75];
  const apartmentDoorZ = -19.35;
  const apartmentDoorWidth = 1.28;
  for (let floor = 0; floor < floors; floor++) {
    const floorY = floor * floorHeight;
    for (const wallX of corridorWallX) {
      const doorStart = apartmentDoorZ - apartmentDoorWidth / 2;
      const doorEnd = apartmentDoorZ + apartmentDoorWidth / 2;
      const frontEnd = frontZ - wallT / 2;
      const rearStart = coreOpening.maxZ;
      const frontLength = frontEnd - doorEnd;
      const rearLength = doorStart - rearStart;
      if (frontLength > 0.1) {
        box("Podlaží / stěna chodby", wallX, floorY + floorHeight / 2,
          (doorEnd + frontEnd) / 2, 0.14, floorHeight, frontLength, concrete, { collider: true });
      }
      if (rearLength > 0.1) {
        box("Podlaží / stěna chodby", wallX, floorY + floorHeight / 2,
          (rearStart + doorStart) / 2, 0.14, floorHeight, rearLength, concrete, { collider: true });
      }
      for (const z of [doorStart, doorEnd]) {
        box("Byt / otevřené dveřní ostění", wallX, floorY + 1.08, z,
          0.20, 2.16, 0.10, facadePanel);
      }
      box("Byt / nadpraží", wallX, floorY + 2.25, apartmentDoorZ,
        0.18, 0.10, apartmentDoorWidth, concreteDark);
      box("Byt / orientační štítek", wallX + (wallX < 0 ? 0.1 : -0.1),
        floorY + 1.75, apartmentDoorZ, 0.035, 0.24, 0.42, railMaterial);
    }
  }

  // The collision facade has gaps matching the main entrance and both balcony doors.
  colliders.push(
    { minX: leftX, maxX: leftX + wallT, minZ: rearZ, maxZ: frontZ },
    { minX: rightX - wallT, maxX: rightX, minZ: rearZ, maxZ: frontZ },
    { minX: leftX, maxX: rightX, minZ: rearZ - wallT / 2, maxZ: rearZ + wallT / 2 }
  );
  const frontPassages = [
    { minX: -doorWidth / 2, maxX: doorWidth / 2 },
    ...[-4.9, 4.9].map(x => ({
      minX: x - windowWidth / 2,
      maxX: x + windowWidth / 2
    }))
  ].sort((a, b) => a.minX - b.minX);
  let frontCursor = leftX;
  for (const passage of frontPassages) {
    if (passage.minX > frontCursor) {
      colliders.push({
        minX: frontCursor, maxX: passage.minX,
        minZ: frontZ - wallT / 2, maxZ: frontZ + wallT / 2
      });
    }
    frontCursor = Math.max(frontCursor, passage.maxX);
  }
  if (frontCursor < rightX) {
    colliders.push({
      minX: frontCursor, maxX: rightX,
      minZ: frontZ - wallT / 2, maxZ: frontZ + wallT / 2
    });
  }

  // Switchback stair: two real flights and a shared intermediate landing per storey.
  const stair = { lowX: -3.2, highX: -0.8, firstZ: -25.1, secondZ: -23.1, steps: 8 };
  const stepRise = (floorHeight / 2) / stair.steps;
  const stepRun = (stair.highX - stair.lowX) / stair.steps;
  function beam(name, x1, y1, z1, x2, y2, z2, thickness, material) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const length = Math.hypot(dx, dy, dz);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, thickness), material);
    mesh.name = name;
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    mesh.rotation.z = Math.atan2(dy, dx);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  for (let floor = 0; floor < floors - 1; floor++) {
    const baseY = floor * floorHeight;
    for (let i = 0; i < stair.steps; i++) {
      const riseA = baseY + (i + 1) * stepRise;
      const xA = stair.lowX + (i + 0.5) * stepRun;
      box("Schodiště / dolní rameno / stupeň", xA, riseA - 0.09, stair.firstZ,
        stepRun + 0.025, 0.18, 1.16, (i % 2) ? concrete : facadePanel);
      const riseB = baseY + floorHeight / 2 + (i + 1) * stepRise;
      const xB = stair.highX - (i + 0.5) * stepRun;
      box("Schodiště / horní rameno / stupeň", xB, riseB - 0.09, stair.secondZ,
        stepRun + 0.025, 0.18, 1.16, (i % 2) ? concrete : facadePanel);
    }
    const landingWidth = 1.28;
    const landingDepth = Math.abs(stair.firstZ - stair.secondZ) + 1.1;
    // The landing begins at the flight endpoint and extends to its right.
    // This avoids intersecting the last several treads of either stair flight.
    box("Schodiště / mezipodesta", stair.highX + landingWidth / 2,
      baseY + floorHeight / 2 - 0.07,
      (stair.firstZ + stair.secondZ) / 2, landingWidth, 0.14,
      landingDepth, facadePanel);
    for (const lane of [
      { z: stair.firstZ, x1: stair.lowX, x2: stair.highX, y1: baseY + 0.88, y2: baseY + floorHeight / 2 + 0.88 },
      { z: stair.secondZ, x1: stair.highX, x2: stair.lowX, y1: baseY + floorHeight / 2 + 0.88, y2: baseY + floorHeight + 0.88 }
    ]) {
      for (const side of [-1, 1]) {
        beam("Schodiště / šikmé madlo", lane.x1, lane.y1, lane.z + side * 0.61,
          lane.x2, lane.y2, lane.z + side * 0.61, 0.065, railMaterial);
      }
    }
  }

  // Continuous lift shaft with a visible car at ground level and landing doors on all floors.
  const lift = { centerX: 2.2, rearZ: -25.0, frontZ: -22.52, width: 2.3, wall: 0.12 };
  const liftLeft = lift.centerX - lift.width / 2;
  const liftRight = lift.centerX + lift.width / 2;
  const liftDepth = lift.frontZ - lift.rearZ;
  const shaftDark = new THREE.MeshStandardMaterial({
    color: 0x292f31, roughness: 0.95, flatShading: true
  });
  box("Výtah / levá šachta", liftLeft + lift.wall / 2, height / 2,
    (lift.rearZ + lift.frontZ) / 2, lift.wall, height, liftDepth, concreteDark);
  box("Výtah / pravá šachta", liftRight - lift.wall / 2, height / 2,
    (lift.rearZ + lift.frontZ) / 2, lift.wall, height, liftDepth, concreteDark);
  box("Výtah / zadní šachta", lift.centerX, height / 2, lift.rearZ + lift.wall / 2,
    lift.width, height, lift.wall, shaftDark);

  const liftDoorWidth = 1.42;
  const liftOpeningLeft = lift.centerX - liftDoorWidth / 2;
  const liftOpeningRight = lift.centerX + liftDoorWidth / 2;
  for (let floor = 0; floor < floors; floor++) {
    const levelCollision = (minX, maxX, minZ, maxZ, active = true) => {
      const collider = { minX, maxX, minZ, maxZ, floor, active };
      colliders.push(collider);
      return collider;
    };
    levelCollision(liftLeft, liftLeft + lift.wall, lift.rearZ, lift.frontZ);
    levelCollision(liftRight - lift.wall, liftRight, lift.rearZ, lift.frontZ);
    levelCollision(liftLeft, liftRight, lift.rearZ - lift.wall / 2, lift.rearZ + lift.wall / 2);
    levelCollision(liftLeft, liftOpeningLeft, lift.frontZ - lift.wall / 2, lift.frontZ + lift.wall / 2);
    levelCollision(liftOpeningRight, liftRight, lift.frontZ - lift.wall / 2, lift.frontZ + lift.wall / 2);
  }
  for (let floor = 0; floor < floors; floor++) {
    const floorY = floor * floorHeight;
    const doorWidth = 1.42;
    const openingLeft = lift.centerX - doorWidth / 2;
    const openingRight = lift.centerX + doorWidth / 2;
    box("Výtah / nadpraží otvoru", lift.centerX, floorY + 2.43, lift.frontZ,
      doorWidth, 0.74, 0.10, concreteDark);
    for (const x of [openingLeft, openingRight]) {
      box("Výtah / ostění", x, floorY + 1.08, lift.frontZ + 0.04,
        0.10, 2.16, 0.12, facadePanel);
    }
    for (const x of [
      (liftLeft + openingLeft) / 2,
      (openingRight + liftRight) / 2
    ]) {
      const span = x < lift.centerX ? openingLeft - liftLeft : liftRight - openingRight;
      box("Výtah / stěna čela šachty", x, floorY + 1.4, lift.frontZ,
        span, 2.8, lift.wall, concrete);
    }

    const panelW = doorWidth / 2;
    const openPanelWidth = Math.max(0.2, Math.min(
      0.34,
      liftOpeningLeft - (liftLeft + lift.wall),
      (liftRight - lift.wall) - liftOpeningRight
    ));
    const openScaleX = openPanelWidth / panelW;
    const closedOffset = panelW / 2;
    const openOffset = doorWidth / 2 + openPanelWidth / 2;
    for (const side of [-1, 1]) {
      const closedX = lift.centerX + side * closedOffset;
      const openX = lift.centerX + side * openOffset;
      const panel = box(floor === 0 ? "Výtah / otevřené dveře" : "Výtah / dveře patra",
        floor === 0 ? openX : closedX, floorY + 1.08, lift.frontZ + 0.11,
        panelW, 2.10, 0.065, doorMaterial);
      if (floor === 0) panel.scale.x = openScaleX;
      liftDoorPanels.push({ mesh: panel, floor, closedX, openX, openScaleX });
    }
    box("Výtah / číselný panel", liftRight + 0.16, floorY + 1.42, lift.frontZ + 0.08,
      0.10, 0.35, 0.08, railMaterial);
  }
  // The cabin, its walls and its collision footprint move together between landings.
  liftCarMeshes.push(box("Výtah / podlaha kabiny", lift.centerX, 0.04, -23.82, 1.45, 0.08, 1.78, concreteDark));
  liftCarMeshes.push(box("Výtah / zadní stěna kabiny", lift.centerX, 1.15, -24.64, 1.42, 2.10, 0.08, concreteDark));
  liftCarMeshes.push(box("Výtah / levá stěna kabiny", lift.centerX - 0.69, 1.15, -23.82, 0.08, 2.10, 1.65, concreteDark));
  liftCarMeshes.push(box("Výtah / pravá stěna kabiny", lift.centerX + 0.69, 1.15, -23.82, 0.08, 2.10, 1.65, concreteDark));

  const cabinZBounds = { minZ: -23.82 - 1.65 / 2, maxZ: -23.82 + 1.65 / 2 };
  for (let floor = 0; floor < floors; floor++) {
    const cabinActive = floor === 0;
    for (const centerX of [lift.centerX - 0.69, lift.centerX + 0.69]) {
      const collider = {
        minX: centerX - 0.04, maxX: centerX + 0.04,
        ...cabinZBounds, floor, active: cabinActive
      };
      colliders.push(collider);
      liftCabinColliders.push({ floor, collider });
    }
    const backCollider = {
      minX: lift.centerX - 1.42 / 2,
      maxX: lift.centerX + 1.42 / 2,
      minZ: -24.64 - 0.04, maxZ: -24.64 + 0.04,
      floor, active: cabinActive
    };
    colliders.push(backCollider);
    liftCabinColliders.push({ floor, collider: backCollider });
  }

  for (let floor = 0; floor < floors; floor++) {
    const collider = {
      minX: liftOpeningLeft, maxX: liftOpeningRight,
      minZ: lift.frontZ - lift.wall / 2, maxZ: lift.frontZ + lift.wall / 2,
      floor, active: floor !== liftCarFloor
    };
    colliders.push(collider);
    liftDoorColliders.push({ floor, collider });
  }

  state.onElevatorMoved = (floor) => {
    const nextFloor = Math.max(0, Math.min(floors - 1, Math.round(floor)));
    const deltaY = (nextFloor - liftCarFloor) * floorHeight;
    for (const mesh of liftCarMeshes) mesh.position.y += deltaY;
    liftCarFloor = nextFloor;

    for (const panel of liftDoorPanels) {
      const isServedFloor = panel.floor === nextFloor;
      panel.mesh.position.x = isServedFloor ? panel.openX : panel.closedX;
      panel.mesh.scale.x = isServedFloor ? panel.openScaleX : 1;
      panel.mesh.name = isServedFloor ? "Výtah / otevřené dveře" : "Výtah / dveře patra";
    }
    for (const entry of liftDoorColliders) entry.collider.active = entry.floor !== nextFloor;
    for (const entry of liftCabinColliders) entry.collider.active = entry.floor === nextFloor;
  };
  for (const x of [liftLeft + 0.26, liftRight - 0.26]) {
    box("Výtah / vodicí lišta", x, height / 2, -24.15, 0.06, height, 0.06, railMaterial);
  }

  // Interactions make vertical circulation explorable despite the 2.5D movement model.
  interactables.push({
    id: "elevator", name: "Výtah", description: "Výtah obsluhuje všech osm podlaží.",
    x: lift.centerX, z: -21.35, range: 2.4, used: false,
    action: () => {
      if (typeof state?.changeFloor === "function") {
        state.changeFloor(((state.currentFloor || 0) + 1) % floors, "Výtah");
      } else {
        ui?.showToast?.("Výtah / hlavní budova");
      }
    }
  });
  interactables.push({
    id: "stairs", name: "Schodiště", description: "Schodiště pokračuje do dalších podlaží.",
    x: -1.8, z: -21.45, range: 2.5, used: false,
    action: () => {
      ui?.showToast?.("Schodiště: projdi skutečné stupně pomocí WASD. Výška se mění při chůzi.");
    }
  });


  function getCoordinateData() {
    const round = value => Math.round(value * 1e6) / 1e6;
    const point = (x, y, z) => ({ x: round(x), y: round(y), z: round(z) });
    const anchors = [];
    const addAnchor = (id, name, x, y, z, provenance) => {
      anchors.push({ id, name, position: point(x, y, z), provenance });
    };

    const objectRecords = meshes.map((mesh, index) => {
      mesh.updateWorldMatrix(true, false);
      const position = mesh.geometry.getAttribute("position");
      const uniqueCorners = new Map();
      const vertex = new THREE.Vector3();
      const min = { x: Infinity, y: Infinity, z: Infinity };
      const max = { x: -Infinity, y: -Infinity, z: -Infinity };

      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        const corner = point(vertex.x, vertex.y, vertex.z);
        const key = `${corner.x},${corner.y},${corner.z}`;
        uniqueCorners.set(key, corner);
        min.x = Math.min(min.x, corner.x);
        min.y = Math.min(min.y, corner.y);
        min.z = Math.min(min.z, corner.z);
        max.x = Math.max(max.x, corner.x);
        max.y = Math.max(max.y, corner.y);
        max.z = Math.max(max.z, corner.z);
      }

      const centerVector = mesh.getWorldPosition(new THREE.Vector3());
      const center = point(centerVector.x, centerVector.y, centerVector.z);
      const parameters = mesh.geometry.parameters || {};
      const floorIndex = Math.max(0, Math.min(floors, Math.floor(center.y / floorHeight)));
      const corners = [...uniqueCorners.values()].sort((a, b) =>
        a.z - b.z || a.y - b.y || a.x - b.x
      );

      return {
        id: `object-${String(index + 1).padStart(4, "0")}`,
        name: mesh.name || `Unnamed object ${index + 1}`,
        geometry: "BoxGeometry",
        center,
        dimensions: {
          x: round(parameters.width ?? 0),
          y: round(parameters.height ?? 0),
          z: round(parameters.depth ?? 0)
        },
        scale: {
          x: round(mesh.scale.x),
          y: round(mesh.scale.y),
          z: round(mesh.scale.z)
        },
        worldAabbSize: {
          x: round(max.x - min.x),
          y: round(max.y - min.y),
          z: round(max.z - min.z)
        },
        rotation: {
          x: round(mesh.rotation.x),
          y: round(mesh.rotation.y),
          z: round(mesh.rotation.z)
        },
        bounds: { min: point(min.x, min.y, min.z), max: point(max.x, max.y, max.z) },
        corners,
        floorIndex,
        floorIndexBasis: "inferred from world-space center Y",
        provenance: "src/game/main-building.js"
      };
    });

    // Stable, named semantic anchors for layout checks and downstream exporters.
    addAnchor("building-origin", "Původ modelu", bx, 0, bz, "building.x/z");
    addAnchor("front-left-ground", "Přední levý roh", leftX, 0, frontZ, "building bounds");
    addAnchor("front-right-ground", "Přední pravý roh", rightX, 0, frontZ, "building bounds");
    addAnchor("rear-left-ground", "Zadní levý roh", leftX, 0, rearZ, "building bounds");
    addAnchor("rear-right-ground", "Zadní pravý roh", rightX, 0, rearZ, "building bounds");
    addAnchor("roof-datum", "Horní datum střechy", bx, height, bz, "floors * floorHeight");
    addAnchor("front-wall-center", "Střed předního líce stěny", bx, height / 2, frontWallZ, "frontZ - wallT / 2");

    for (const [label, x] of [["left", -doorWidth / 2], ["right", doorWidth / 2]]) {
      addAnchor(`entrance-${label}-bottom`, `Vchod ${label} dole`, x, 0.02, frontWallZ, "door opening");
      addAnchor(`entrance-${label}-top`, `Vchod ${label} nahoře`, x, doorHeight, frontWallZ, "door opening");
    }

    for (let floor = 1; floor < floors; floor++) {
      const openingY = floor * floorHeight;
      for (const [xLabel, x] of [["left", coreOpening.minX], ["right", coreOpening.maxX]]) {
        for (const [zLabel, z] of [["rear", coreOpening.minZ], ["front", coreOpening.maxZ]]) {
          addAnchor(`core-f${floor}-${xLabel}-${zLabel}`,
            `Kout jádra patro ${floor}, ${xLabel}/${zLabel}`, x, openingY, z, "coreOpening on residential slab datum");
        }
      }
    }

    const liftLeft = lift.centerX - lift.width / 2;
    const liftRight = lift.centerX + lift.width / 2;
    for (const [xLabel, x] of [["left", liftLeft], ["right", liftRight]]) {
      for (const [zLabel, z] of [["rear", lift.rearZ], ["front", lift.frontZ]]) {
        addAnchor(`lift-${xLabel}-${zLabel}-base`, `Výtah ${xLabel}/${zLabel} dole`, x, 0, z, "lift envelope");
        addAnchor(`lift-${xLabel}-${zLabel}-top`, `Výtah ${xLabel}/${zLabel} nahoře`, x, height, z, "lift envelope");
      }
    }

    for (let floor = 0; floor <= floors; floor++) {
      const floorY = floor * floorHeight;
      addAnchor(`floor-datum-${floor}`, `Podlažní datum ${floor}`, bx, floorY, bz, "floor * floorHeight");
    }

    windowXs.forEach((x, column) => {
      for (let floor = 0; floor < floors; floor++) {
        if (floor === 0 && Math.abs(x) < 2) continue;
        const isBalconyDoor = Math.abs(Math.abs(x) - 4.9) < 0.001;
        const openingBottom = isBalconyDoor ? 0 : windowBottom;
        const y = floor * floorHeight + (openingBottom + windowTop) / 2;
        const anchorType = isBalconyDoor ? "balcony-door" : "window";
        addAnchor(`${anchorType}-f${floor}-c${column}`,
          `${isBalconyDoor ? "Balkonové dveře" : "Okno"} patro ${floor}, sloupec ${column}`,
          x, y, frontZ + 0.035,
          isBalconyDoor ? "windowXs / balconyDoorBottom=0 / windowTop" : "windowXs / windowBottom / windowTop");
      }
    });

    for (let floor = 0; floor < floors; floor++) {
      const floorY = floor * floorHeight;
      for (const x of [-4.9, 4.9]) {
        addAnchor(`balcony-f${floor}-x${x < 0 ? "L" : "R"}`, `Střed balkonu patro ${floor}`,
          x, floorY - 0.08, frontZ + 0.78, "balcony slab center Y = finished floor datum - slab thickness / 2");
      }
    }

    for (let floor = 0; floor < floors - 1; floor++) {
      const baseY = floor * floorHeight;
      addAnchor(`stair-mid-landing-f${floor}`, `Mezipodesta schodiště patro ${floor}`,
        stair.highX + 1.28 / 2, baseY + floorHeight / 2 - 0.07, (stair.firstZ + stair.secondZ) / 2,
        "stair parameters: landing center X = highX + landingWidth / 2");
      addAnchor(`stair-arrival-f${floor + 1}`, `Nástup schodiště patro ${floor + 1}`,
        stair.lowX, baseY + floorHeight, stair.secondZ, "upper stair flight");
    }

    for (let floor = 0; floor < floors; floor++) {
      addAnchor(`elevator-interaction-f${floor}`, `Interakční bod výtahu patro ${floor}`,
        lift.centerX, floor * floorHeight, -21.35, "elevator interactable");
    }

    const roofHatch = { minX: -1.325, maxX: -0.275, minZ: -24.625, maxZ: -23.575 };
    for (const [xLabel, x] of [["left", roofHatch.minX], ["right", roofHatch.maxX]]) {
      for (const [zLabel, z] of [["rear", roofHatch.minZ], ["front", roofHatch.maxZ]]) {
        addAnchor(`roof-hatch-${xLabel}-${zLabel}`, `Servisní poklop ${xLabel}/${zLabel}`,
          x, height, z, "dedicated roof hatch");
      }
    }

    const logicalCornerCount = objectRecords.reduce((sum, object) => sum + object.corners.length, 0);
    return {
      schemaVersion: "1.0",
      units: "metres",
      coordinateSystem: {
        x: "facade width",
        y: "up",
        z: "depth",
        buildingWorldOrigin: point(bx, 0, bz),
        localToWorld: "x_world=x_local; y_world=y_local; z_world=z_local-22"
      },
      building: { width, depth, floors, floorHeight, wallThickness: wallT, height },
      counts: {
        objects: objectRecords.length,
        logicalCorners: logicalCornerCount,
        semanticAnchors: anchors.length
      },
      objects: objectRecords,
      anchors
    };
  }

  function exportCoordinateCSV() {
    const data = getCoordinateData();
    const header = [
      "record_type", "id", "name", "x", "y", "z",
      "geometry_width", "geometry_height", "geometry_depth",
      "scale_x", "scale_y", "scale_z", "world_aabb_width", "world_aabb_height", "world_aabb_depth",
      "rotation_x", "rotation_y", "rotation_z",
      "min_x", "min_y", "min_z", "max_x", "max_y", "max_z",
      "corner_index", "floor_index", "provenance"
    ];
    const csvField = value => {
      if (value === null || value === undefined) return "";
      const text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [header];

    for (const object of data.objects) {
      rows.push([
        "object", object.id, object.name,
        object.center.x, object.center.y, object.center.z,
        object.dimensions.x, object.dimensions.y, object.dimensions.z,
        object.scale.x, object.scale.y, object.scale.z,
        object.worldAabbSize.x, object.worldAabbSize.y, object.worldAabbSize.z,
        object.rotation.x, object.rotation.y, object.rotation.z,
        object.bounds.min.x, object.bounds.min.y, object.bounds.min.z,
        object.bounds.max.x, object.bounds.max.y, object.bounds.max.z,
        "", object.floorIndex, object.provenance
      ]);
      object.corners.forEach((corner, index) => rows.push([
        "corner", object.id, object.name,
        corner.x, corner.y, corner.z,
        ...Array(18).fill(""),
        index + 1, object.floorIndex, object.provenance
      ]));
    }

    for (const anchor of data.anchors) {
      rows.push([
        "anchor", anchor.id, anchor.name,
        anchor.position.x, anchor.position.y, anchor.position.z,
        ...Array(20).fill(""),
        anchor.provenance
      ]);
    }

    const invalidRow = rows.findIndex(row => row.length !== header.length);
    if (invalidRow !== -1) {
      throw new Error(\`Coordinate CSV row \${invalidRow + 1} has \${rows[invalidRow].length} fields; expected \${header.length}.\`);
    }
    return rows.map(row => row.map(csvField).join(",")).join("\r\n");
  }

  const navigation = {
    floorHeight,
    floors,
    coreOpening: { ...coreOpening },
    stairs: {
      ...stair,
      stepRise,
      stepRun,
      treadDepth: 1.16,
      treadOverlap: 0.025,
      landingWidth: 1.28,
      landingDepth: Math.abs(stair.firstZ - stair.secondZ) + 1.1,
      landingCenterX: stair.highX + 1.28 / 2,
      landingCenterZ: (stair.firstZ + stair.secondZ) / 2
    }
  };

  return {
    colliders, interactables, meshesToAnimate, doorAnimations, meshes,
    navigation, getCoordinateData, exportCoordinateCSV
  };
}

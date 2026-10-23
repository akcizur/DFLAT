// Main-building remaster: a sparse exterior map and a structurally open, eight-storey panelák.
export function createMainBuildingWorld({ THREE, scene }) {
  const colliders = [];
  const interactables = [];
  const meshesToAnimate = [];
  const doorAnimations = [];

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

  // Floors, rear wall and end walls create the actual building mass.
  for (let floor = 0; floor <= floors; floor++) {
    box(
      floor === floors ? "Hlavní budova / střešní deska" : "Hlavní budova / stropní deska",
      bx, floor * floorHeight - 0.08, bz,
      width + 0.28, 0.16, depth + 0.28,
      floor === floors ? facadePanel : concrete
    );
  }
  box("Hlavní budova / zadní stěna", bx, height / 2, rearZ + wallT / 2, width, height, wallT, concrete);
  box("Hlavní budova / levá štítová stěna", leftX + wallT / 2, height / 2, bz, wallT, height, depth, concrete);
  box("Hlavní budova / pravá štítová stěna", rightX - wallT / 2, height / 2, bz, wallT, height, depth, concrete);
  box("Hlavní budova / sokl", bx, 0.36, frontZ - 0.025, width + 0.12, 0.72, 0.14, concreteDark);

  // Front facade is built as wall sections around real rectangular openings.
  // Windows are holes in the wall geometry, not glass cards floating on a solid slab.
  const windowXs = [-11.4, -8.15, -4.9, -1.65, 1.65, 4.9, 8.15, 11.4];
  const windowWidth = 1.36;
  const windowBottom = 0.78;
  const windowTop = 2.28;
  const doorWidth = 1.82;
  const doorHeight = 2.50;

  function buildFacadeFloor(floor) {
    const floorY = floor * floorHeight;
    const openings = [];
    for (let i = 0; i < windowXs.length; i++) {
      const wx = windowXs[i];
      if (floor === 0 && Math.abs(wx) < 2) continue;
      openings.push({
        kind: "window", x0: wx - windowWidth / 2, x1: wx + windowWidth / 2,
        y0: floorY + windowBottom, y1: floorY + windowTop, x: wx, column: i
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
      if (opening.kind !== "window") continue;
      const wy = floorY + (windowBottom + windowTop) / 2;
      const pane = ((floor * 7 + opening.column * 3) % 13 === 0) ? glassWarm : glassDark;
      const paneZ = frontZ + 0.035;
      box("Okno / tmavé zapuštěné sklo", opening.x, wy, paneZ,
        windowWidth - 0.14, (windowTop - windowBottom) - 0.14, 0.04, pane);
      const frameZ = frontZ + 0.075;
      const frameW = 0.075;
      box("Okno / levý rám", opening.x - windowWidth / 2 + frameW / 2, wy,
        frameZ, frameW, windowTop - windowBottom, 0.07, facadePanel);
      box("Okno / pravý rám", opening.x + windowWidth / 2 - frameW / 2, wy,
        frameZ, frameW, windowTop - windowBottom, 0.07, facadePanel);
      box("Okno / horní rám", opening.x, floorY + windowTop - 0.035,
        frameZ, windowWidth, 0.07, 0.07, facadePanel);
      box("Okno / spodní rám", opening.x, floorY + windowBottom + 0.035,
        frameZ, windowWidth, 0.07, 0.07, facadePanel);
      box("Okno / středová příčka", opening.x, wy, frameZ + 0.012,
        windowWidth - 0.14, 0.045, 0.045, concreteDark);
    }
  }

  for (let floor = 0; floor < floors; floor++) buildFacadeFloor(floor);

  // Repeating shallow loggias. Balconies have slab, side cheeks and a distinct metal railing.
  for (let floor = 0; floor < floors; floor++) {
    const floorY = floor * floorHeight;
    for (const x of [-4.9, 4.9]) {
      const slabY = floorY + 0.17;
      const balconyZ = frontZ + 0.78;
      box("Balkon / betonová deska", x, slabY, balconyZ, 2.48, 0.16, 1.55, facadePanel);
      box("Balkon / horní madlo", x, floorY + 1.25, frontZ + 1.54, 2.38, 0.065, 0.065, railMaterial);
      box("Balkon / spodní příčka", x, floorY + 0.39, frontZ + 1.54, 2.36, 0.045, 0.045, railMaterial);
      for (let post = -2; post <= 2; post++) {
        box("Balkon / svislé zábradlí", x + post * 0.46, floorY + 0.82,
          frontZ + 1.54, 0.045, 0.88, 0.045, railMaterial);
      }
      for (const side of [-1, 1]) {
        box("Balkon / bočnice", x + side * 1.19, floorY + 0.55,
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
  box("Vchod / levé dveřní křídlo", -0.43, 1.20, frontZ + 0.095,
    0.82, 2.34, 0.055, doorMaterial);
  box("Vchod / pravé dveřní křídlo", 0.43, 1.20, frontZ + 0.095,
    0.82, 2.34, 0.055, doorMaterial);
  box("Vchod / zasklení dveří", 0, 1.52, frontZ + 0.13,
    0.94, 1.08, 0.025, glassDark);
  box("Vchod / madlo", 0.70, 1.12, frontZ + 0.16,
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
  box("Hlavní budova / strojovna výtahu", 2.2, roofY + 0.89, bz - 1.1,
    4.2, 1.18, 3.8, concreteDark);
  box("Hlavní budova / větrací komín", -4.4, roofY + 0.85, bz - 2.0,
    1.0, 1.1, 1.0, concreteDark);

  // A single footprint collider prevents walking through the building but leaves the map open.
  colliders.push({
    minX: leftX, maxX: rightX,
    minZ: rearZ, maxZ: frontZ
  });

  return { colliders, interactables, meshesToAnimate, doorAnimations, meshes: [] };
}

// Outdoor DFLAT map: an otherwise empty site with one dominant socialist-era apartment block.
export function createMainBuildingWorld({ THREE, scene }) {
  const colliders = [];
  const interactables = [];
  const meshesToAnimate = [];
  const doorAnimations = [];

  const concrete = new THREE.MeshStandardMaterial({
    color: 0xb9b7ae, roughness: 0.96, flatShading: true
  });
  const concreteLight = new THREE.MeshStandardMaterial({
    color: 0xd0cec4, roughness: 0.95, flatShading: true
  });
  const concreteDark = new THREE.MeshStandardMaterial({
    color: 0x92938d, roughness: 1, flatShading: true
  });
  const concreteSeam = new THREE.MeshStandardMaterial({
    color: 0x777a76, roughness: 1, flatShading: true
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x465d65, roughness: 0.38, metalness: 0.12,
    flatShading: true
  });
  const warmGlass = new THREE.MeshStandardMaterial({
    color: 0x968668, roughness: 0.5, metalness: 0.04,
    flatShading: true
  });
  const balconyMetal = new THREE.MeshStandardMaterial({
    color: 0x626b6b, roughness: 0.88, metalness: 0.18,
    flatShading: true
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x343b3d, roughness: 0.72, metalness: 0.2,
    flatShading: true
  });
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x414b4d, roughness: 0.75, metalness: 0.08,
    flatShading: true
  });
  const grass = new THREE.MeshStandardMaterial({
    color: 0x707969, roughness: 1, flatShading: true
  });
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x51565a, roughness: 1, flatShading: true
  });
  const pavement = new THREE.MeshStandardMaterial({
    color: 0x95958c, roughness: 1, flatShading: true
  });
  const linePaint = new THREE.MeshStandardMaterial({
    color: 0xb8b7a7, roughness: 1, flatShading: true
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

  // Empty terrain. The road and single approach path provide scale without filling the map with props.
  box("Mapa / terén", 0, -0.11, -22, 240, 0.22, 240, grass);
  box("Mapa / hlavní silnice", 0, 0.012, 2.7, 220, 0.035, 8.2, asphalt);
  box("Mapa / chodník u silnice", 0, 0.025, -2.05, 220, 0.05, 1.55, pavement);
  box("Mapa / chodník podél domu", 0, 0.024, -12.35, 34, 0.048, 2.2, pavement);
  box("Mapa / přístupová cesta", 0, 0.018, -7.55, 6.0, 0.036, 9.2, pavement);
  box("Mapa / vstupní plošina", 0, 0.035, -15.0, 7.0, 0.07, 3.0, concreteLight);

  for (let x = -102; x <= 102; x += 12) {
    box("Silnice / přerušovaná čára", x, 0.034, 2.7, 4.4, 0.012, 0.12, linePaint, {
      castShadow: false, receiveShadow: false
    });
  }

  // Main building dimensions: 28 m wide, 12 m deep, 8 storeys at 2.8 m per floor.
  const building = { x: 0, z: -22, width: 28, depth: 12, floors: 8, floorHeight: 2.8 };
  const buildingHeight = building.floors * building.floorHeight;
  const frontZ = building.z + building.depth / 2;

  box(
    "Hlavní budova / železobetonový skelet",
    building.x, buildingHeight / 2, building.z,
    building.width, buildingHeight, building.depth, concrete
  );
  box("Hlavní budova / sokl", 0, 0.42, frontZ + 0.09, 28.3, 0.84, 0.22, concreteDark);
  box("Hlavní budova / střešní deska", 0, buildingHeight + 0.12, building.z, 28.7, 0.24, 12.7, concreteLight);
  box("Hlavní budova / střešní atika přední", 0, buildingHeight + 0.57, frontZ + 0.13, 28.6, 0.72, 0.22, concreteLight);
  box("Hlavní budova / střešní atika zadní", 0, buildingHeight + 0.57, building.z - building.depth / 2 - 0.13, 28.6, 0.72, 0.22, concreteLight);
  box("Hlavní budova / střešní atika levá", -14.13, buildingHeight + 0.57, building.z, 0.22, 0.72, 12.6, concreteLight);
  box("Hlavní budova / střešní atika pravá", 14.13, buildingHeight + 0.57, building.z, 0.22, 0.72, 12.6, concreteLight);

  // The roof has only a small utility volume, keeping the skyline quiet.
  box("Hlavní budova / střešní výtahová strojovna", 2.2, buildingHeight + 1.0, building.z - 1.1, 4.2, 1.55, 3.8, concreteDark);
  box("Hlavní budova / větrací komín", -4.4, buildingHeight + 0.95, building.z - 2.0, 1.0, 1.2, 1.0, concreteDark);

  // Main shell collision prevents walking through the building while leaving the site open on every side.
  colliders.push({
    minX: -building.width / 2, maxX: building.width / 2,
    minZ: building.z - building.depth / 2, maxZ: building.z + building.depth / 2
  });

  // Repeating precast-concrete floor bands and narrow panel joints.
  for (let floor = 0; floor < building.floors; floor++) {
    const bandY = (floor + 1) * building.floorHeight;
    box("Fasáda / vodorovná spára", 0, bandY - 0.08, frontZ + 0.13, 28.25, 0.13, 0.16, concreteLight);
  }
  for (let x = -12.4; x <= 12.41; x += 3.1) {
    box("Fasáda / svislý panelový spoj", x, buildingHeight / 2, frontZ + 0.055, 0.035, buildingHeight - 0.35, 0.025, concreteSeam);
  }

  const windowXs = [-11.4, -8.15, -4.9, -1.65, 1.65, 4.9, 8.15, 11.4];
  function frontWindow(x, y, floor, column) {
    const paneMaterial = ((floor * 7 + column * 3) % 13 === 0) ? warmGlass : glass;
    const paneZ = frontZ + 0.09;
    box("Okno hlavní budovy / sklo", x, y, paneZ, 1.34, 1.52, 0.045, paneMaterial);
    for (const side of [-1, 1]) {
      box("Okno hlavní budovy / boční rám", x + side * 0.72, y, paneZ + 0.035, 0.075, 1.64, 0.075, concreteLight);
    }
    box("Okno hlavní budovy / horní rám", x, y + 0.80, paneZ + 0.035, 1.50, 0.075, 0.075, concreteLight);
    box("Okno hlavní budovy / spodní rám", x, y - 0.80, paneZ + 0.035, 1.50, 0.075, 0.075, concreteLight);
    box("Okno hlavní budovy / příčka", x, y - 0.03, paneZ + 0.07, 1.35, 0.045, 0.04, concreteLight);
  }

  for (let floor = 0; floor < building.floors; floor++) {
    const windowY = 1.52 + floor * building.floorHeight;
    windowXs.forEach((x, column) => {
      if (floor === 0 && Math.abs(x) < 2) return;
      frontWindow(x, windowY, floor, column);
    });

    // Repeated open loggias on two bays: thin concrete slabs and simple metal railings.
    for (const x of [-4.9, 4.9]) {
      const balconyY = floor * building.floorHeight + 1.02;
      const balconyZ = frontZ + 0.78;
      box("Balkon / betonová deska", x, balconyY, balconyZ, 2.45, 0.16, 1.48, concreteLight);
      box("Balkon / horní madlo", x, balconyY + 0.92, frontZ + 1.49, 2.35, 0.065, 0.065, balconyMetal);
      box("Balkon / spodní příčka", x, balconyY + 0.20, frontZ + 1.49, 2.32, 0.045, 0.045, balconyMetal);
      for (let post = -2; post <= 2; post++) {
        box("Balkon / svislé zábradlí", x + post * 0.46, balconyY + 0.56, frontZ + 1.49, 0.045, 0.78, 0.045, balconyMetal);
      }
      for (const side of [-1, 1]) {
        box("Balkon / bočnice", x + side * 1.18, balconyY + 0.48, frontZ + 0.79, 0.075, 0.78, 1.38, concreteDark);
      }
    }
  }

  // A closed, readable entrance with a canopy. The building is an exterior landmark, not an interior level.
  const entranceZ = frontZ + 0.16;
  box("Vchod / zapuštěná plocha", 0, 1.3, entranceZ, 1.9, 2.6, 0.07, darkMetal);
  box("Vchod / dveřní křídlo", 0, 1.16, entranceZ + 0.055, 1.62, 2.28, 0.045, doorMaterial);
  box("Vchod / svislá dělící lišta", 0, 1.16, entranceZ + 0.09, 0.055, 2.24, 0.035, concreteLight);
  box("Vchod / madlo", 0.55, 1.12, entranceZ + 0.13, 0.045, 0.46, 0.045, concreteLight);
  for (const x of [-1.02, 1.02]) {
    box("Vchod / ostění", x, 1.34, entranceZ + 0.075, 0.13, 2.68, 0.15, concreteLight);
  }
  box("Vchod / nadpraží", 0, 2.72, entranceZ + 0.075, 2.16, 0.14, 0.15, concreteLight);
  box("Vchod / přístřešek", 0, 2.95, frontZ + 0.76, 3.6, 0.18, 1.45, concreteDark);
  box("Vchod / schod 1", 0, 0.09, frontZ + 0.48, 2.9, 0.18, 0.55, concreteLight);
  box("Vchod / schod 2", 0, 0.045, frontZ + 0.91, 3.2, 0.09, 0.42, concreteLight);
  box("Vchod / identifikační tabulka", 0, 3.30, entranceZ + 0.09, 2.05, 0.30, 0.07, balconyMetal);
  box("Vchod / zvonkový panel", 1.20, 1.72, entranceZ + 0.10, 0.18, 0.50, 0.07, darkMetal);

  return { colliders, interactables, meshesToAnimate, doorAnimations, meshes: [] };
}

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const APP_BASE = typeof import.meta.env !== "undefined" && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : "/";
const place = (id, x, z, kind, zone, options = {}) => ({ id, x, z, kind, zone, ...options });

const BLOCK_CENTERS = [-60, -36, -12, 12, 36, 60];
const STREET_LINES = [-72, -48, -24, 0, 24, 48, 72];
const ROAD_CELLS = Array.from({ length: 23 }, (_, index) => -88 + index * 8);
const ROAD_FOOTPRINT = 8;
const world = [];

// 01 / Streets. The 8 m road modules form a continuous 7 × 7 city grid.
// Crossroads are generated once per intersection, preventing duplicate tiles.
for (const x of ROAD_CELLS) {
  for (const z of ROAD_CELLS) {
    const northSouth = STREET_LINES.includes(x);
    const eastWest = STREET_LINES.includes(z);
    if (!northSouth && !eastWest) continue;

    let id;
    let yaw = 0;
    if (northSouth && eastWest) {
      id = x === 0 && z === 0
        ? "city-kit-roads/road-roundabout"
        : (Math.abs(x) <= 24 && Math.abs(z) <= 24 && (x === 0 || z === 0)
          ? "city-kit-roads/road-crossroad-path"
          : "city-kit-roads/road-crossroad");
    } else {
      const atEnd = northSouth ? Math.abs(z) === 88 : Math.abs(x) === 88;
      id = atEnd ? "city-kit-roads/road-end" : "city-kit-roads/road-straight";
      if (eastWest) yaw = Math.PI / 2;
    }
    world.push(place(id, x, z, "road", "street-network", { targetFootprint: ROAD_FOOTPRINT, yaw }));
  }
}

// 02 / Downtown skyline. Towers occupy the four inner blocks around the roundabout.
const towers = [
  ["a", -12, -12, 34], ["c", 12, -12, 38],
  ["d", -12, 12, 30], ["e", 12, 12, 32],
  ["b", 0, -36, 25]
];
for (const [variant, x, z, height] of towers) {
  world.push(place(
    "city-kit-commercial/building-skyscraper-" + variant,
    x, z, "tower", "downtown",
    { targetHeight: height, targetFootprint: 9, collider: [4.2, 4.2] }
  ));
}

// 03 / Market streets. Four mixed-use blocks get varied shops and office buildings.
const marketBlocks = [
  [-36, 36], [-12, 36], [12, 36], [36, 36]
];
const commercialTypes = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"];
let commercialIndex = 0;
for (const [cx, cz] of marketBlocks) {
  const lots = [[-5, -4], [5, -4], [0, 5]];
  for (const [dx, dz] of lots) {
    const variant = commercialTypes[commercialIndex++ % commercialTypes.length];
    const x = cx + dx;
    const z = cz + dz;
    world.push(place(
      "city-kit-commercial/building-" + variant,
      x, z, "commercial", "market-district",
      {
        targetHeight: 8.5 + (commercialIndex % 4) * 1.3,
        targetFootprint: 5.8,
        yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2][commercialIndex % 4],
        collider: [2.5, 2.5]
      }
    ));
    if (commercialIndex % 2 === 0) {
      world.push(place(
        commercialIndex % 4 === 0 ? "city-kit-commercial/detail-awning-wide" : "city-kit-commercial/detail-awning",
        x, z + 2.2, "shop-detail", "market-district",
        { targetHeight: 2.5, targetFootprint: 4.2, yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2][commercialIndex % 4] }
      ));
    }
  }
}
world.push(
  place("city-kit-commercial/detail-parasol-a", -34, 42, "shop-detail", "market-district", { targetHeight: 2.7, targetFootprint: 3.2 }),
  place("city-kit-commercial/detail-parasol-b", -30, 42, "shop-detail", "market-district", { targetHeight: 2.7, targetFootprint: 3.2 }),
  place("city-kit-commercial/detail-overhang-wide", 14, 41, "shop-detail", "market-district", { targetHeight: 2.4, targetFootprint: 4.6 })
);

// 04 / Civic quarter. Public buildings, a forecourt and accessible pedestrian space.
const civicLots = [
  ["g", 31, 8, 12], ["l", 41, 8, 11], ["n", 36, 18, 13]
];
for (const [variant, x, z, height] of civicLots) {
  world.push(place(
    "city-kit-commercial/building-" + variant,
    x, z, "civic-building", "civic-quarter",
    { targetHeight: height, targetFootprint: 6, collider: [2.8, 2.8] }
  ));
}
world.push(
  place("city-kit-commercial/detail-awning-wide", 31, 10.5, "civic-detail", "civic-quarter", { targetHeight: 2.4, targetFootprint: 4.5 }),
  place("furniture-kit/trashcan", 43, 14, "street-detail", "civic-quarter", { targetHeight: 1, targetFootprint: 1.2 })
);

// 05 / Residential districts. Every block has three fitted house lots, gardens and paths.
const residentialBlocks = [];
for (const cx of BLOCK_CENTERS) {
  for (const cz of BLOCK_CENTERS) {
    const key = cx + "," + cz;
    const special = new Set([
      "-12,-12", "12,-12", "-12,12", "12,12",
      "-36,12", "-36,-12",
      "-36,36", "-12,36", "12,36", "36,36",
      "36,12", "60,-36", "-60,12"
    ]);
    if (!special.has(key)) residentialBlocks.push([cx, cz]);
  }
}

const houseTypes = "abcdefghijklmnopqrstu".split("");
let houseIndex = 0;
for (const [cx, cz] of residentialBlocks) {
  const lots = [[-4.7, -4.2], [4.7, -4.2], [0, 5.0]];
  for (const [dx, dz] of lots) {
    const variant = houseTypes[houseIndex % houseTypes.length];
    const height = [6.2, 6.8, 7.1, 6.5, 7.6, 6.4][houseIndex % 6];
    world.push(place(
      "city-kit-suburban/building-type-" + variant,
      cx + dx, cz + dz, "house", "residential",
      {
        targetHeight: height,
        targetFootprint: 6.1,
        yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2][houseIndex % 4],
        collider: [2.55, 2.55]
      }
    ));
    houseIndex += 1;
  }
  const treeVariant = (Math.abs(cx + cz) / 12) % 2 === 0 ? "tree-large" : "tree-small";
  world.push(
    place("city-kit-suburban/" + treeVariant, cx - 7, cz + 7, "tree", "residential", { targetHeight: treeVariant === "tree-large" ? 5.5 : 4.2, targetFootprint: 4.2 }),
    place("nature-kit/plant-bushlarge", cx + 7, cz + 7, "plant", "residential", { targetHeight: 1.5, targetFootprint: 2.4 })
  );
  if ((cx + cz) % 2 === 0) {
    world.push(place(
      "city-kit-suburban/driveway-short", cx, cz - 7.0,
      "driveway", "residential", { targetFootprint: 5.5 }
    ));
  }
}

// 06 / Civic green. A full park and a smaller neighborhood garden.
function addPark(cx, cz, zone, scale = 1) {
  const treeOffsets = [
    [-6, -6], [6, -6], [-6, 6], [6, 6],
    [0, -6], [0, 6], [-6, 0], [6, 0]
  ];
  treeOffsets.forEach(([dx, dz], index) => {
    const id = index % 3 === 0 ? "nature-kit/tree-oak"
      : index % 3 === 1 ? "nature-kit/tree-detailed"
        : "nature-kit/tree-default";
    world.push(place(id, cx + dx * scale, cz + dz * scale, "tree", zone, {
      targetHeight: index % 2 ? 5.2 : 6.3, targetFootprint: 4.5
    }));
  });
  for (const [dx, dz, yaw] of [
    [-4, 0, 0], [4, 0, Math.PI], [0, -4, Math.PI / 2], [0, 4, -Math.PI / 2]
  ]) {
    world.push(place(
      "furniture-kit/bench", cx + dx * scale, cz + dz * scale,
      "bench", zone, { targetHeight: 0.85, targetFootprint: 2.2, yaw }
    ));
  }
  world.push(
    place("city-kit-suburban/planter", cx - 2, cz - 2, "planter", zone, { targetHeight: 1.1, targetFootprint: 2 }),
    place("city-kit-suburban/planter", cx + 2, cz + 2, "planter", zone, { targetHeight: 1.1, targetFootprint: 2 }),
    place("nature-kit/plant-bushlarge", cx, cz, "plant", zone, { targetHeight: 1.7, targetFootprint: 2.4 }),
    place("furniture-kit/trashcan", cx + 5, cz, "street-detail", zone, { targetHeight: 1, targetFootprint: 1.2 })
  );
  for (const [dx, dz] of [[-3, 5], [3, -5]]) {
    world.push(place("city-kit-roads/road-square", cx + dx * scale, cz + dz * scale, "park-path", zone, { targetFootprint: 5 }));
  }
}
addPark(-36, 12, "central-park");
addPark(-36, -12, "neighborhood-garden", 0.68);

// 07 / Mobility and public life. Pedestrians, accessible routes, cars and service vehicles.
const traffic = [
  ["sedan", -65, 8, 0], ["taxi", -59, 8, 0], ["suv", -53, 8, 0],
  ["police", -65, 15, Math.PI], ["delivery", -59, 15, Math.PI], ["van", -53, 15, Math.PI],
  ["ambulance", 55, -40, Math.PI / 2], ["firetruck", 63, -40, Math.PI / 2],
  ["garbage-truck", 55, -32, Math.PI / 2], ["truck", 63, -32, Math.PI / 2],
  ["sedan", 30, 42, Math.PI], ["taxi", 42, 42, Math.PI]
];
for (const [model, x, z, yaw] of traffic) {
  world.push(place("car-kit/" + model, x, z, "vehicle", model === "firetruck" || model === "ambulance" ? "emergency-services" : "parking-and-traffic", {
    targetHeight: model === "truck" || model === "garbage-truck" || model === "firetruck" ? 1.8 : 1.48,
    targetFootprint: model === "truck" || model === "garbage-truck" || model === "firetruck" ? 5.5 : 4.5,
    yaw, collider: [1.25, 2.25]
  }));
}

const pedestrians = [
  ["female-a", -34, 9], ["male-a", -38, 15], ["female-b", -30, -10],
  ["male-b", -34, -17], ["female-c", -18, 44], ["male-c", -6, 44],
  ["female-d", 6, 44], ["male-d", 18, 44], ["female-e", 28, 0],
  ["male-e", 44, 0], ["female-f", 28, 16], ["male-f", 44, 16]
];
for (const [model, x, z] of pedestrians) {
  world.push(place("mini-characters/character-" + model, x, z, "pedestrian", z > 30 ? "market-district" : "public-space", {
    targetHeight: 1.7, targetFootprint: 1.15
  }));
}
world.push(
  place("mini-characters/wheelchair-deluxe", -31, 12, "pedestrian", "central-park", { targetHeight: 1.25, targetFootprint: 1.5 }),
  place("prototype-kit/animal-dog", -39, 10, "animal", "central-park", { targetHeight: 0.75, targetFootprint: 1.2 })
);

// 08 / Street furniture, lighting and road safety.
// Lamps follow both sides of the main streets, never blocking the central walking lanes.
for (const street of STREET_LINES) {
  for (let offset = -80; offset <= 80; offset += 32) {
    world.push(
      place("city-kit-roads/light-square-double", street + 5.1, offset, "streetlight", "street-network", { targetHeight: 5.3, targetFootprint: 2.2 }),
      place("city-kit-roads/light-square-double", offset, street - 5.1, "streetlight", "street-network", { targetHeight: 5.3, targetFootprint: 2.2, yaw: Math.PI / 2 })
    );
  }
}
for (const x of [-48, -24, 0, 24, 48]) {
  for (const z of [-48, -24, 0, 24, 48]) {
    if (Math.abs(x) > 24 || Math.abs(z) > 24 || (x === 0 && z === 0)) continue;
    world.push(place(
      "city-kit-roads/traffic-light-object-vertical",
      x - 5.3, z - 5.3, "traffic-light", "downtown",
      { targetHeight: 3.3, targetFootprint: 1.35, yaw: Math.PI / 2 }
    ));
  }
}
world.push(
  place("city-kit-roads/road-sign-stop", -83, 48, "sign", "west-entry", { targetHeight: 2.5, targetFootprint: 1.5 }),
  place("city-kit-roads/road-sign-street", 83, -48, "sign", "east-entry", { targetHeight: 2.7, targetFootprint: 1.5 }),
  place("city-kit-roads/road-sign-warning", 68, -55, "sign", "utility-quarter", { targetHeight: 2.5, targetFootprint: 1.5 }),
  place("city-kit-roads/dumpster", 18, 43, "street-detail", "market-district", { targetHeight: 1.8, targetFootprint: 2 }),
  place("city-kit-roads/dumpster", -18, 43, "street-detail", "market-district", { targetHeight: 1.8, targetFootprint: 2 }),
  place("city-kit-roads/dumpster", 60, -34, "street-detail", "utility-quarter", { targetHeight: 1.8, targetFootprint: 2 }),
  place("city-kit-roads/electricity-pole", -82, -60, "utility", "city-edge", { targetHeight: 7, targetFootprint: 2 }),
  place("city-kit-roads/electricity-pole", -82, 60, "utility", "city-edge", { targetHeight: 7, targetFootprint: 2 }),
  place("city-kit-roads/electricity-pole", 82, -60, "utility", "city-edge", { targetHeight: 7, targetFootprint: 2 }),
  place("city-kit-roads/electricity-pole", 82, 60, "utility", "city-edge", { targetHeight: 7, targetFootprint: 2 }),
  place("city-kit-roads/construction-barrier", 68, -62, "utility-detail", "utility-quarter", { targetFootprint: 3 }),
  place("city-kit-roads/construction-cone", 64, -62, "utility-detail", "utility-quarter", { targetHeight: 0.9, targetFootprint: 0.8 }),
  place("city-kit-roads/construction-cone", 72, -62, "utility-detail", "utility-quarter", { targetHeight: 0.9, targetFootprint: 0.8 })
);

// 09 / Skyline fringe. Low-detail buildings extend the city beyond the playable blocks.
const skyline = [
  ["a", -96, -88], ["d", -96, 0], ["g", -96, 88],
  ["j", 96, -88], ["m", 96, 0], ["wide-a", 96, 88],
  ["b", -88, -96], ["e", 0, -96], ["h", 88, -96],
  ["k", -88, 96], ["n", 0, 96], ["wide-b", 88, 96]
];
for (const [variant, x, z] of skyline) {
  world.push(place(
    "city-kit-commercial/low-detail-building-" + variant,
    x, z, "skyline-building", "city-edge",
    { targetHeight: 13 + (skyline.findIndex(item => item[0] === variant) % 3) * 2, targetFootprint: 10 }
  ));
}

export const WORLD_LAYOUT = world;

function prepareModel(THREE, root, entry) {
  root.position.set(0, 0, 0);
  root.rotation.y = entry.yaw || 0;
  if (entry.scale) root.scale.multiplyScalar(entry.scale);

  const initialBounds = new THREE.Box3().setFromObject(root);
  const size = initialBounds.getSize(new THREE.Vector3());
  let fitScale = 1;
  if (entry.targetHeight) fitScale = Math.min(fitScale, entry.targetHeight / Math.max(0.001, size.y));
  if (entry.targetFootprint) fitScale = Math.min(fitScale, entry.targetFootprint / Math.max(0.001, size.x, size.z));
  root.scale.multiplyScalar(fitScale);

  const bounds = new THREE.Box3().setFromObject(root);
  root.position.set(entry.x, (entry.y || 0) - bounds.min.y, entry.z);
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = !["road", "driveway", "park-path"].includes(entry.kind);
    node.receiveShadow = true;
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) material.roughness = Math.max(material.roughness ?? 0.8, 0.72);
    }
  });
  return root;
}

function addStaticInstances(THREE, scene, sourceScene, entries, meshes) {
  const batches = [];
  const roots = entries.map(entry => {
    const root = prepareModel(THREE, sourceScene.clone(true), entry);
    root.updateMatrixWorld(true);
    const renderables = [];
    root.traverse(node => {
      if (node.isMesh) renderables.push({ node, matrix: node.matrixWorld.clone() });
    });
    batches.push(renderables);
    return root;
  });

  const meshCount = batches[0]?.length || 0;
  for (let meshIndex = 0; meshIndex < meshCount; meshIndex += 1) {
    const source = batches[0][meshIndex].node;
    const batch = new THREE.InstancedMesh(source.geometry, source.material, entries.length);
    batch.name = entries[0].id + " / " + entries[0].kind + " × " + entries.length;
    batch.castShadow = source.castShadow;
    batch.receiveShadow = source.receiveShadow;
    batch.frustumCulled = true;
    for (let instance = 0; instance < entries.length; instance += 1) {
      const mesh = batches[instance][meshIndex];
      if (mesh) batch.setMatrixAt(instance, mesh.matrix);
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingSphere();
    scene.add(batch);
    meshes.push(batch);
  }
  return roots.length;
}

export function createOpenWorld({ THREE, scene, onProgress = () => {} }) {
  const loader = new GLTFLoader();
  const colliders = [];
  const interactables = [];
  const meshes = [];
  const loadedIds = new Set();
  const failedIds = [];
  let elapsed = 0;
  let parkLightOnline = false;
  let streetLightOnline = false;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ color: 0x4b5154, roughness: 1, metalness: 0 })
  );
  ground.name = "DEPOO city ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.18;
  ground.frustumCulled = false;
  ground.receiveShadow = true;
  scene.add(ground);
  meshes.push(ground);

  for (const entry of WORLD_LAYOUT) {
    if (!entry.collider) continue;
    const [halfWidth, halfDepth] = entry.collider;
    colliders.push({
      minX: entry.x - halfWidth, maxX: entry.x + halfWidth,
      minZ: entry.z - halfDepth, maxZ: entry.z + halfDepth,
      name: entry.id
    });
  }

  const parkLight = new THREE.PointLight(0xffc47c, 0, 24, 1.8);
  parkLight.name = "DEPOO / central park lights";
  parkLight.position.set(-36, 3.1, 12);
  scene.add(parkLight);
  meshes.push(parkLight);

  const streetLight = new THREE.PointLight(0xffb86b, 0, 30, 1.6);
  streetLight.name = "DEPOO / downtown public lighting";
  streetLight.position.set(0, 5.2, 0);
  scene.add(streetLight);
  meshes.push(streetLight);

  interactables.push({
    id: "city-park-light", name: "Zapnout osvětlení centrálního parku",
    x: -36, z: 12, range: 4.2,
    action() {
      parkLightOnline = !parkLightOnline;
      parkLight.intensity = parkLightOnline ? 7.2 : 0;
      this.name = parkLightOnline ? "Vypnout osvětlení centrálního parku" : "Zapnout osvětlení centrálního parku";
    }
  });
  interactables.push({
    id: "city-street-light", name: "Zapnout osvětlení náměstí",
    x: 0, z: 0, range: 4.2,
    action() {
      streetLightOnline = !streetLightOnline;
      streetLight.intensity = streetLightOnline ? 8.5 : 0;
      this.name = streetLightOnline ? "Vypnout osvětlení náměstí" : "Zapnout osvětlení náměstí";
    }
  });

  const ready = (async () => {
    const response = await fetch(APP_BASE + "models/manifest.json");
    if (!response.ok) throw new Error("DEPOO city asset manifest request failed: " + response.status);
    const manifest = await response.json();
    const assetMap = new Map((manifest.assets || []).map(asset => [asset.id, asset]));
    const entriesById = new Map();
    for (const entry of WORLD_LAYOUT) {
      if (!entriesById.has(entry.id)) entriesById.set(entry.id, []);
      entriesById.get(entry.id).push(entry);
    }
    const uniqueIds = [...entriesById.keys()];
    let completed = 0;
    let instancesLoaded = 0;

    for (let offset = 0; offset < uniqueIds.length; offset += 8) {
      const batch = uniqueIds.slice(offset, offset + 8);
      await Promise.all(batch.map(async id => {
        const entries = entriesById.get(id);
        const asset = assetMap.get(id);
        if (!asset) {
          failedIds.push(id);
          completed += 1;
          onProgress(completed, uniqueIds.length, id);
          return;
        }
        try {
          const gltf = await loader.loadAsync(APP_BASE + "models/" + asset.file);
          instancesLoaded += addStaticInstances(THREE, scene, gltf.scene, entries, meshes);
          loadedIds.add(id);
        } catch (error) {
          failedIds.push(id);
          console.warn("DEPOO city asset could not be loaded:", id, error);
        } finally {
          completed += 1;
          onProgress(completed, uniqueIds.length, id);
        }
      }));
    }

    return {
      loaded: loadedIds.size,
      total: uniqueIds.length,
      instances: instancesLoaded,
      failed: failedIds.slice(),
      source: manifest.source
    };
  })();

  function addPlacedModel(root) {
    scene.add(root);
    meshes.push(root);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.x > 0.25 && size.z > 0.25 && size.x < 8 && size.z < 8) {
      const center = bounds.getCenter(new THREE.Vector3());
      colliders.push({
        minX: center.x - size.x * 0.36, maxX: center.x + size.x * 0.36,
        minZ: center.z - size.z * 0.36, maxZ: center.z + size.z * 0.36,
        name: root.name || "Placed CC0 model"
      });
    }
    return root;
  }

  function tick(deltaTime) {
    elapsed += Math.max(0, deltaTime || 0);
    if (parkLightOnline) parkLight.intensity = 7.0 + Math.sin(elapsed * 2.1) * 0.3;
    if (streetLightOnline) streetLight.intensity = 8.2 + Math.sin(elapsed * 1.4) * 0.35;
  }

  function getCoordinateData() {
    const zones = [...new Set(WORLD_LAYOUT.map(entry => entry.zone))];
    return {
      schemaVersion: "4.0",
      theme: "DEPOO",
      setting: "DEPOO / complete modular open city",
      units: "metres",
      objects: WORLD_LAYOUT.map((entry, index) => ({
        index, id: entry.id, x: entry.x, y: entry.y || 0, z: entry.z,
        yaw: entry.yaw || 0, kind: entry.kind, zone: entry.zone
      })),
      zones,
      anchors: [
        { id: "spawn", x: 0, y: 0, z: 100 },
        { id: "downtown-roundabout", x: 0, y: 0, z: 0 },
        { id: "market-district", x: 0, y: 0, z: 36 },
        { id: "central-park", x: -36, y: 0, z: 12 },
        { id: "civic-quarter", x: 36, y: 0, z: 12 },
        { id: "utility-quarter", x: 60, y: 0, z: -36 }
      ],
      loadedAssetIds: [...loadedIds],
      failedAssetIds: failedIds.slice()
    };
  }

  return {
    colliders,
    interactables,
    meshes,
    navigation: {
      theme: "DEPOO",
      floors: 1,
      verticalMovementEnabled: false,
      assetInstances: WORLD_LAYOUT.length,
      bounds: { minX: -112, maxX: 112, minZ: -112, maxZ: 112 }
    },
    ready,
    addPlacedModel,
    tick,
    getCoordinateData,
    exportCoordinateCSV: () => "record_type,id,name,x,y,z,zone\n" + WORLD_LAYOUT.map((entry, index) =>
      ["object", index + 1, entry.id, entry.x, entry.y || 0, entry.z, entry.zone].join(",")
    ).join("\n")
  };
}
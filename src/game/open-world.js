import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const APP_BASE = typeof import.meta.env !== "undefined" && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : "/";

const place = (id, x, z, kind, zone, options = {}) => ({ id, x, z, kind, zone, ...options });
const ROAD_SCALE = 8;
const STREET_LINES = [-32, -16, 0, 16, 32];
const ROAD_COORDS = Array.from({ length: 11 }, (_, index) => -40 + index * 8);

// DEPOO is a walkable town with a connected road grid, downtown core,
// residential blocks, a civic park, shops and static street traffic.
const roads = [];
for (const x of STREET_LINES) {
  for (const z of ROAD_COORDS) {
    const crossing = STREET_LINES.includes(z);
    const id = x === 0 && z === 0
      ? "city-kit-roads/road-roundabout"
      : crossing
        ? "city-kit-roads/road-crossroad"
        : Math.abs(z) === 40
          ? "city-kit-roads/road-end"
          : "city-kit-roads/road-straight";
    roads.push(place(id, x, z, "road", "street-grid", {
      scale: ROAD_SCALE,
      yaw: Math.abs(z) === 40 && z < 0 ? Math.PI : 0
    }));
  }
}
for (const z of STREET_LINES) {
  for (const x of ROAD_COORDS) {
    if (STREET_LINES.includes(x)) continue;
    roads.push(place(
      Math.abs(x) === 40 ? "city-kit-roads/road-end" : "city-kit-roads/road-straight",
      x, z, "road", "street-grid",
      { scale: ROAD_SCALE, yaw: x < 0 && Math.abs(x) === 40 ? -Math.PI / 2 : Math.PI / 2 }
    ));
  }
}

const commercial = [
  place("city-kit-commercial/building-a", 4, 8, "commercial", "downtown", { targetHeight: 9.2, yaw: Math.PI / 2, collider: [3.5, 3.5] }),
  place("city-kit-commercial/building-f", 12, 8, "commercial", "downtown", { targetHeight: 11.5, yaw: -Math.PI / 2, collider: [3.8, 3.8] }),
  place("city-kit-commercial/building-c", -12, 8, "commercial", "downtown", { targetHeight: 8.8, yaw: Math.PI / 2, collider: [3.5, 3.5] }),
  place("city-kit-commercial/building-j", -4, 8, "commercial", "downtown", { targetHeight: 13.5, yaw: -Math.PI / 2, collider: [3.8, 3.8] }),
  place("city-kit-commercial/building-h", 4, 24, "commercial", "market-street", { targetHeight: 10.2, collider: [3.8, 3.8] }),
  place("city-kit-commercial/building-n", 12, 24, "commercial", "market-street", { targetHeight: 14.5, collider: [4, 4] }),
  place("city-kit-commercial/detail-awning-wide", 4, 11.5, "shop-detail", "downtown", { targetHeight: 2.2 }),
  place("city-kit-commercial/detail-awning", 12, 11.5, "shop-detail", "downtown", { targetHeight: 2.1 }),
  place("city-kit-commercial/detail-parasol-a", 0, 12, "shop-detail", "downtown", { targetHeight: 2.8 }),
  place("city-kit-commercial/detail-parasol-b", 16, 12, "shop-detail", "downtown", { targetHeight: 2.8 }),
  place("city-kit-commercial/detail-overhang-wide", 4, 27, "shop-detail", "market-street", { targetHeight: 2.4 })
];

const towers = [
  place("city-kit-commercial/building-skyscraper-a", -8, -8, "tower", "downtown", { targetHeight: 25, collider: [5, 5] }),
  place("city-kit-commercial/building-skyscraper-c", 8, -8, "tower", "downtown", { targetHeight: 28, collider: [5, 5] }),
  place("city-kit-commercial/building-skyscraper-d", -24, 8, "tower", "civic-district", { targetHeight: 22, collider: [5, 5] }),
  place("city-kit-commercial/building-skyscraper-e", 24, 8, "tower", "civic-district", { targetHeight: 24, collider: [5, 5] }),
  place("city-kit-commercial/building-skyscraper-b", 0, -52, "tower", "skyline", { targetHeight: 21 })
];

const houseBlocks = [
  [-24, -24], [-8, -24], [8, -24], [24, -24],
  [-24, -8], [24, -8],
  [-24, 24], [-8, 24], [8, 24], [24, 24]
];
const houseTypes = ["a", "b", "d", "f", "h", "j", "l", "n", "p", "r", "t", "u"];
const houses = houseBlocks.flatMap(([x, z], index) => {
  const type = houseTypes[index % houseTypes.length];
  const height = [6.3, 6.8, 7.2, 6.5, 7.5][index % 5];
  return [
    place("city-kit-suburban/building-type-" + type, x, z, "house", "residential", {
      targetHeight: height, yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2][index % 4],
      collider: [3.5, 3.5]
    }),
    place(index % 2 ? "city-kit-suburban/tree-small" : "city-kit-suburban/tree-large",
      x + 5.2, z + 4.8, "tree", "residential", { targetHeight: index % 2 ? 3.8 : 5.2 }),
    place("city-kit-suburban/driveway-short", x, z + 5.8, "driveway", "residential", {
      scale: 5.2, yaw: index % 2 ? Math.PI : 0
    })
  ];
});

const distantBlocks = [
  ["a", -55, -44], ["d", -55, 0], ["g", -55, 44],
  ["j", 55, -44], ["m", 55, 0], ["wide-a", 55, 44]
].map(([variant, x, z]) => place(
  "city-kit-commercial/low-detail-building-" + variant,
  x, z, "distant-building", "city-edge", { targetHeight: 10.5 }
));

const streetFurniture = [];
for (const x of STREET_LINES) {
  for (const z of [-32, -16, 0, 16, 32]) {
    streetFurniture.push(place(
      "city-kit-roads/light-square-double", x + 4.8, z + 4.8,
      "streetlight", "street-grid", { targetHeight: 5.2 }
    ));
  }
}
for (const x of [-16, 0, 16]) {
  for (const z of [-16, 0, 16]) {
    if (x === 0 && z === 0) continue;
    streetFurniture.push(place(
      "city-kit-roads/traffic-light-object-vertical",
      x + 3.6, z + 3.6, "traffic-light", "downtown",
      { targetHeight: 3.2, yaw: Math.PI / 2 }
    ));
  }
}
streetFurniture.push(
  place("city-kit-roads/road-sign-stop", -35, -16, "sign", "west-quarter", { targetHeight: 2.5 }),
  place("city-kit-roads/road-sign-street", 35, 16, "sign", "east-quarter", { targetHeight: 2.7 }),
  place("city-kit-roads/electricity-pole", -36, -32, "utility", "city-edge", { targetHeight: 7 }),
  place("city-kit-roads/electricity-pole", 36, -32, "utility", "city-edge", { targetHeight: 7 }),
  place("city-kit-roads/electricity-pole", -36, 32, "utility", "city-edge", { targetHeight: 7 }),
  place("city-kit-roads/electricity-pole", 36, 32, "utility", "city-edge", { targetHeight: 7 }),
  place("city-kit-roads/dumpster", 17, 11, "street-detail", "downtown", { targetHeight: 1.8 }),
  place("city-kit-roads/dumpster", -16, 27, "street-detail", "market-street", { targetHeight: 1.8 })
);

const park = [
  place("city-kit-suburban/planter", -12, 8, "planter", "civic-park", { targetHeight: 1.2 }),
  place("city-kit-suburban/planter", -4, 8, "planter", "civic-park", { targetHeight: 1.2 }),
  place("nature-kit/tree-oak", -8, 13, "tree", "civic-park", { targetHeight: 6.2 }),
  place("nature-kit/tree-detailed", -13, 15, "tree", "civic-park", { targetHeight: 5.5 }),
  place("nature-kit/plant-bushlarge", -3, 15, "plant", "civic-park", { targetHeight: 1.8 }),
  place("furniture-kit/bench", -11, 5, "bench", "civic-park", { targetHeight: 0.85, yaw: Math.PI / 2 }),
  place("furniture-kit/bench", -5, 5, "bench", "civic-park", { targetHeight: 0.85, yaw: -Math.PI / 2 }),
  place("furniture-kit/trashcan", -2.5, 10, "street-detail", "civic-park", { targetHeight: 1 })
];

const traffic = [
  place("car-kit/sedan", -2.0, -27, "vehicle", "traffic", { targetHeight: 1.45, collider: [1.2, 2.1] }),
  place("car-kit/taxi", 2.0, -7, "vehicle", "traffic", { targetHeight: 1.45, yaw: Math.PI, collider: [1.2, 2.1] }),
  place("car-kit/suv", -2.0, 17, "vehicle", "traffic", { targetHeight: 1.5, collider: [1.3, 2.2] }),
  place("car-kit/police", 2.0, 31, "vehicle", "traffic", { targetHeight: 1.45, yaw: Math.PI, collider: [1.2, 2.1] }),
  place("car-kit/delivery", -27, -2, "vehicle", "traffic", { targetHeight: 1.5, yaw: Math.PI / 2, collider: [1.3, 2.2] }),
  place("car-kit/ambulance", 27, 2, "vehicle", "traffic", { targetHeight: 1.5, yaw: -Math.PI / 2, collider: [1.3, 2.2] }),
  place("car-kit/firetruck", -18, 2, "vehicle", "traffic", { targetHeight: 1.55, yaw: -Math.PI / 2, collider: [1.5, 2.5] }),
  place("car-kit/garbage-truck", 18, -2, "vehicle", "traffic", { targetHeight: 1.6, yaw: Math.PI / 2, collider: [1.5, 2.5] })
];

export const WORLD_LAYOUT = [
  ...roads, ...commercial, ...towers, ...houses, ...distantBlocks,
  ...streetFurniture, ...park, ...traffic
];

function prepareModel(THREE, root, entry) {
  root.position.set(0, 0, 0);
  root.rotation.y = entry.yaw || 0;
  if (entry.scale) root.scale.multiplyScalar(entry.scale);
  if (entry.targetHeight) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.multiplyScalar(entry.targetHeight / Math.max(0.001, size.y));
  }
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.set(entry.x, (entry.y || 0) - bounds.min.y, entry.z);
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = !["road", "driveway"].includes(entry.kind);
    node.receiveShadow = true;
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of mats) material.roughness = Math.max(material.roughness ?? 0.8, 0.72);
    }
  });
  return root;
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
    new THREE.PlaneGeometry(220, 220),
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

  const parkLight = new THREE.PointLight(0xffc47c, 0, 19, 1.8);
  parkLight.name = "DEPOO / civic park light";
  parkLight.position.set(-8, 3.1, 8);
  scene.add(parkLight);
  meshes.push(parkLight);

  const streetLight = new THREE.PointLight(0xffb86b, 0, 26, 1.6);
  streetLight.name = "DEPOO / downtown street lighting";
  streetLight.position.set(0, 5.2, -8);
  scene.add(streetLight);
  meshes.push(streetLight);

  interactables.push({
    id: "city-park-light", name: "Zapnout osvětlení parku",
    x: -8, z: 5, range: 3.2,
    action() {
      parkLightOnline = !parkLightOnline;
      parkLight.intensity = parkLightOnline ? 5.5 : 0;
      this.name = parkLightOnline ? "Vypnout osvětlení parku" : "Zapnout osvětlení parku";
    }
  });
  interactables.push({
    id: "city-street-light", name: "Zapnout veřejné osvětlení",
    x: 0, z: -8, range: 3.2,
    action() {
      streetLightOnline = !streetLightOnline;
      streetLight.intensity = streetLightOnline ? 6.5 : 0;
      this.name = streetLightOnline ? "Vypnout veřejné osvětlení" : "Zapnout veřejné osvětlení";
    }
  });

  const ready = (async () => {
    const response = await fetch(APP_BASE + "models/manifest.json");
    if (!response.ok) throw new Error("DEPOO city asset manifest request failed: " + response.status);
    const manifest = await response.json();
    const assetMap = new Map((manifest.assets || []).map(asset => [asset.id, asset]));
    const uniqueIds = [...new Set(WORLD_LAYOUT.map(entry => entry.id))];
    let completed = 0;

    for (let offset = 0; offset < uniqueIds.length; offset += 6) {
      const batch = uniqueIds.slice(offset, offset + 6);
      await Promise.all(batch.map(async id => {
        const entries = WORLD_LAYOUT.filter(entry => entry.id === id);
        const asset = assetMap.get(id);
        if (!asset) {
          failedIds.push(id);
          completed += 1;
          onProgress(completed, uniqueIds.length, id);
          return;
        }
        try {
          const gltf = await loader.loadAsync(APP_BASE + "models/" + asset.file);
          for (const entry of entries) {
            const root = prepareModel(THREE, gltf.scene.clone(true), entry);
            root.name = entry.id + " / " + entry.kind;
            scene.add(root);
            meshes.push(root);
          }
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
      loaded: loadedIds.size, total: uniqueIds.length,
      instances: WORLD_LAYOUT.length, failed: failedIds.slice(), source: manifest.source
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
    if (parkLightOnline) parkLight.intensity = 5.3 + Math.sin(elapsed * 2.1) * 0.25;
    if (streetLightOnline) streetLight.intensity = 6.2 + Math.sin(elapsed * 1.4) * 0.3;
  }

  function getCoordinateData() {
    return {
      schemaVersion: "3.0", theme: "DEPOO",
      setting: "DEPOO / low-poly open city", units: "metres",
      objects: WORLD_LAYOUT.map((entry, index) => ({
        index, id: entry.id, x: entry.x, y: entry.y || 0, z: entry.z,
        yaw: entry.yaw || 0, kind: entry.kind, zone: entry.zone
      })),
      anchors: [
        { id: "spawn", x: 0, y: 0, z: 46 },
        { id: "town-square", x: 0, y: 0, z: 0 },
        { id: "downtown", x: 0, y: 0, z: -8 },
        { id: "civic-park", x: -8, y: 0, z: 8 },
        { id: "residential-quarter", x: 24, y: 0, z: 24 }
      ],
      loadedAssetIds: [...loadedIds], failedAssetIds: failedIds.slice()
    };
  }

  return {
    colliders, interactables, meshes,
    navigation: { theme: "DEPOO", floors: 1, verticalMovementEnabled: false, assetInstances: WORLD_LAYOUT.length },
    ready, addPlacedModel, tick, getCoordinateData,
    exportCoordinateCSV: () => "record_type,id,name,x,y,z\n" + WORLD_LAYOUT.map((entry, index) =>
      ["object", index + 1, entry.id, entry.x, entry.y || 0, entry.z].join(",")
    ).join("\n")
  };
}
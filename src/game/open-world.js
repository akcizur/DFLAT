import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const APP_BASE = typeof import.meta.env !== "undefined" && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : "/";

// The depot is built from independent CC0 Space Kit GLBs, not procedural buildings.
const ROAD_Z = Array.from({ length: 12 }, (_, index) => 4 - index * 10);
export const WORLD_LAYOUT = [
  ...ROAD_Z.map(z => ({ id: "space-kit/terrain-roadstraight", x: 0, z, kind: "road" })),
  { id: "space-kit/terrain-roadcross", x: 0, z: -36, kind: "road" },
  { id: "space-kit/terrain-roadcross", x: 0, z: -76, kind: "road" },
  { id: "space-kit/terrain-roadstraight", x: -10, z: -46, yaw: Math.PI / 2, kind: "road" },
  { id: "space-kit/terrain-roadstraight", x: 10, z: -66, yaw: Math.PI / 2, kind: "road" },
  { id: "space-kit/terrain-roadcorner", x: -10, z: -36, yaw: Math.PI / 2, kind: "road" },
  { id: "space-kit/terrain-roadcorner", x: 10, z: -76, yaw: -Math.PI / 2, kind: "road" },
  { id: "space-kit/terrain-roadend", x: -20, z: -46, yaw: Math.PI / 2, kind: "road" },
  { id: "space-kit/terrain-roadend", x: 20, z: -66, yaw: -Math.PI / 2, kind: "road" },

  { id: "space-kit/gate-complex", x: 0, z: -17, targetHeight: 5.8, kind: "gate" },
  { id: "space-kit/gate-simple", x: -19, z: -50, yaw: Math.PI / 2, targetHeight: 4.2, kind: "gate" },
  { id: "space-kit/gate-simple", x: 19, z: -70, yaw: -Math.PI / 2, targetHeight: 4.2, kind: "gate" },
  { id: "space-kit/platform-large", x: 0, z: -43, y: 0.08, kind: "platform" },
  { id: "space-kit/platform-long", x: 0, z: -50, y: 0.08, kind: "platform" },
  { id: "space-kit/platform-high", x: -7, z: -48, y: 0.1, kind: "platform" },
  { id: "space-kit/platform-straight", x: 7, z: -48, y: 0.08, kind: "platform" },
  { id: "space-kit/stairs", x: 8, z: -45, yaw: -Math.PI / 2, kind: "platform" },

  { id: "space-kit/hangar-largea", x: 0, z: -101, targetHeight: 12, collider: [10, 8], kind: "hangar" },
  { id: "space-kit/hangar-largeb", x: -29, z: -85, targetHeight: 10, collider: [8, 7], kind: "hangar" },
  { id: "space-kit/hangar-smalla", x: 28, z: -86, targetHeight: 8, collider: [6, 6], kind: "hangar" },
  { id: "space-kit/hangar-rounda", x: 29, z: -116, targetHeight: 7.5, collider: [6, 6], kind: "hangar" },
  { id: "space-kit/hangar-roundglass", x: -28, z: -116, targetHeight: 7.5, collider: [6, 6], kind: "hangar" },

  ...Array.from({ length: 11 }, (_, index) => ({
    id: "space-kit/monorail-trackstraight", x: -13, y: 5.2, z: 4 - index * 10, kind: "rail"
  })),
  { id: "space-kit/monorail-trackcornerlarge", x: -13, y: 5.2, z: -108, yaw: Math.PI, kind: "rail" },
  { id: "space-kit/monorail-tracksupport", x: -13, z: -10, kind: "rail-support" },
  { id: "space-kit/monorail-tracksupport", x: -13, z: -40, kind: "rail-support" },
  { id: "space-kit/monorail-tracksupport", x: -13, z: -70, kind: "rail-support" },
  { id: "space-kit/monorail-tracksupport", x: -13, z: -100, kind: "rail-support" },
  { id: "space-kit/monorail-trainfront", x: -13, y: 5.6, z: -43, kind: "train" },
  { id: "space-kit/monorail-traincargo", x: -13, y: 5.6, z: -50, kind: "train" },
  { id: "space-kit/monorail-trainbox", x: -13, y: 5.6, z: -57, kind: "train" },

  { id: "space-kit/craft-cargoa", x: 15, z: -57, yaw: Math.PI / 2, targetHeight: 3.6, collider: [3, 4], kind: "craft" },
  { id: "space-kit/craft-cargob", x: -17, z: -59, yaw: -Math.PI / 2, targetHeight: 3.6, collider: [3, 4], kind: "craft" },
  { id: "space-kit/craft-miner", x: 20, z: -91, yaw: Math.PI / 2, targetHeight: 3.1, collider: [3, 3], kind: "craft" },
  { id: "space-kit/machine-generatorlarge", x: 9, z: -39, targetHeight: 3.2, collider: [2, 2], kind: "machine" },
  { id: "space-kit/machine-generator", x: -9, z: -41, targetHeight: 2.5, collider: [1.5, 1.5], kind: "machine" },
  { id: "space-kit/machine-wireless", x: 7, z: -58, targetHeight: 2.8, kind: "machine" },
  { id: "space-kit/machine-barrellarge", x: -8, z: -59, targetHeight: 2.6, kind: "machine" },
  { id: "space-kit/barrels-rail", x: 11, z: -48, kind: "cargo" },
  { id: "space-kit/barrels", x: 12, z: -42, kind: "cargo" },
  { id: "space-kit/pipe-straight", x: -9, y: 1.4, z: -69, yaw: Math.PI / 2, kind: "pipe" },
  { id: "space-kit/pipe-straight", x: -9, y: 1.4, z: -77, yaw: Math.PI / 2, kind: "pipe" },
  { id: "space-kit/pipe-supporthigh", x: -9, z: -69, yaw: Math.PI / 2, kind: "pipe" },

  { id: "space-kit/astronauta", x: -4.5, z: -29, yaw: Math.PI / 2, targetHeight: 1.8, kind: "crew" },
  { id: "space-kit/astronautb", x: 7.5, z: -57, yaw: -Math.PI / 2, targetHeight: 1.8, kind: "crew" },
  { id: "space-kit/desk-computer", x: 4.2, z: -35.5, targetHeight: 1.5, kind: "console" },
  { id: "space-kit/desk-chair", x: 4.2, z: -37.2, yaw: Math.PI, targetHeight: 1.2, kind: "console" },
  { id: "space-kit/satellitedish-large", x: -25, z: -69, targetHeight: 5.2, collider: [2, 2], kind: "antenna" },
  { id: "space-kit/chimney-detailed", x: 11, z: -100, targetHeight: 5.5, kind: "structure" },

  { id: "space-kit/terrain", x: -30, z: -28, kind: "terrain" },
  { id: "space-kit/terrain", x: 30, z: -30, kind: "terrain" },
  { id: "space-kit/terrain", x: -34, z: -92, kind: "terrain" },
  { id: "space-kit/terrain", x: 35, z: -95, kind: "terrain" },
  { id: "space-kit/terrain-side", x: -30, z: -55, yaw: Math.PI / 2, kind: "terrain" },
  { id: "space-kit/terrain-side", x: 30, z: -58, yaw: -Math.PI / 2, kind: "terrain" },
  { id: "space-kit/rock-largea", x: -39, z: -78, targetHeight: 6, collider: [2.5, 2.5], kind: "rock" },
  { id: "space-kit/craterlarge", x: 39, z: -76, targetHeight: 4.5, collider: [3, 3], kind: "crater" },
  { id: "space-kit/meteor-detailed", x: 38, z: -112, targetHeight: 5.5, collider: [2, 2], kind: "rock" }
];

function prepareModel(THREE, root, entry) {
  root.position.set(0, 0, 0);
  root.rotation.y = entry.yaw || 0;
  if (entry.targetHeight) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.multiplyScalar(entry.targetHeight / Math.max(0.001, size.y));
  }
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.set(entry.x, (entry.y || 0) - bounds.min.y, entry.z);
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = !["road", "rail", "rail-support", "terrain"].includes(entry.kind);
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
  let controlOnline = false;
  let relayOnline = true;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    new THREE.MeshStandardMaterial({ color: 0x343a43, roughness: 1, metalness: 0 })
  );
  ground.name = "DEPOO outer-rim ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
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

  const dispatchLight = new THREE.PointLight(0x56d9ee, 0, 28, 1.7);
  dispatchLight.name = "DEPOO / dispatch core light";
  dispatchLight.position.set(4.2, 2.8, -35.5);
  scene.add(dispatchLight);
  meshes.push(dispatchLight);

  const relayLight = new THREE.PointLight(0xffb45d, 2.2, 20, 1.8);
  relayLight.name = "DEPOO / relay beacon";
  relayLight.position.set(-8.8, 2.4, -41);
  scene.add(relayLight);
  meshes.push(relayLight);

  interactables.push({
    id: "depoo-control", name: "Aktivovat řídicí konzoli",
    x: 4.2, z: -35.5, range: 3.8,
    action() {
      controlOnline = !controlOnline;
      dispatchLight.intensity = controlOnline ? 8.5 : 0;
      this.name = controlOnline ? "Vypnout řídicí konzoli" : "Aktivovat řídicí konzoli";
    }
  });
  interactables.push({
    id: "depoo-relay", name: "Vypnout servisní maják",
    x: -8.8, z: -41, range: 3.5,
    action() {
      relayOnline = !relayOnline;
      relayLight.visible = relayOnline;
      this.name = relayOnline ? "Vypnout servisní maják" : "Zapnout servisní maják";
    }
  });

  const ready = (async () => {
    const response = await fetch(APP_BASE + "models/manifest.json");
    if (!response.ok) throw new Error("DEPOO asset manifest request failed: " + response.status);
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
          console.warn("DEPOO asset could not be loaded:", id, error);
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
        name: root.name || "Placed CC0 asset"
      });
    }
    return root;
  }

  function tick(deltaTime) {
    elapsed += Math.max(0, deltaTime || 0);
    if (controlOnline) dispatchLight.intensity = 8.1 + Math.sin(elapsed * 2.1) * 0.55;
    if (relayOnline) relayLight.intensity = 1.9 + Math.sin(elapsed * 3.2) * 0.25;
  }

  function getCoordinateData() {
    return {
      schemaVersion: "2.0", theme: "DEPOO",
      setting: "Outer Rim / modular cargo depot", units: "metres",
      objects: WORLD_LAYOUT.map((entry, index) => ({
        index, id: entry.id, x: entry.x, y: entry.y || 0, z: entry.z,
        yaw: entry.yaw || 0, kind: entry.kind
      })),
      anchors: [
        { id: "spawn", x: 0, y: 0, z: 9.2 },
        { id: "dispatch-console", x: 4.2, y: 0, z: -35.5 },
        { id: "loading-apron", x: 0, y: 0, z: -48 },
        { id: "main-hangar", x: 0, y: 0, z: -101 }
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

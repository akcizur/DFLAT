import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const APP_BASE = typeof import.meta.env !== "undefined" && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : "/";

// The depot is built from independent CC0 Space Kit GLBs, not procedural buildings.
const module = (id, x, z, kind, zone, options = {}) => ({
  id, x, z, kind, zone, ...options
});

const ROAD_Z = Array.from({ length: 14 }, (_, index) => 12 - index * 10);

// DEPOO is arranged as a connected freight campus:
// arrival spine -> dispatch court -> cross-yard -> five-hangar crescent.
// Every visible structure, vehicle and prop is an independent Space Kit GLB.
export const WORLD_LAYOUT = [
  // Arrival spine and terminal threshold.
  ...ROAD_Z.map(z => module("space-kit/terrain-roadstraight", 0, z, "road", "arrival")),
  module("space-kit/terrain-roadcross", 0, -38, "road", "dispatch"),
  module("space-kit/terrain-roadcross", 0, -78, "road", "freight-yard"),
  module("space-kit/gate-complex", 0, -17, "gate", "arrival", { targetHeight: 5.8 }),
  module("space-kit/gate-simple", -20, -48, "gate", "west-service", { yaw: Math.PI / 2, targetHeight: 4.2 }),
  module("space-kit/gate-simple", 20, -88, "gate", "east-service", { yaw: -Math.PI / 2, targetHeight: 4.2 }),

  // A pair of service wings creates a proper cross-yard instead of one long road.
  ...[-10, 10].flatMap(x => [
    module("space-kit/terrain-roadstraight", x, -48, "road", "west-service", { yaw: Math.PI / 2 }),
    module("space-kit/terrain-roadstraight", x, -88, "road", "east-service", { yaw: Math.PI / 2 })
  ]),
  ...[-20, 20].flatMap(x => [-58, -68, -78].map(z =>
    module("space-kit/terrain-roadstraight", x, z, "road", x < 0 ? "west-service" : "east-service")
  )),
  module("space-kit/terrain-roadcorner", -10, -38, "road", "west-service", { yaw: Math.PI / 2 }),
  module("space-kit/terrain-roadcorner", 10, -38, "road", "east-service", { yaw: 0 }),
  module("space-kit/terrain-roadcorner", -10, -98, "road", "west-service", { yaw: Math.PI }),
  module("space-kit/terrain-roadcorner", 10, -98, "road", "east-service", { yaw: -Math.PI / 2 }),
  module("space-kit/terrain-roadend", -20, -48, "road", "west-service", { yaw: Math.PI / 2 }),
  module("space-kit/terrain-roadend", 20, -88, "road", "east-service", { yaw: -Math.PI / 2 }),

  // Dispatch court: console, crew, utilities and the first loading apron.
  module("space-kit/platform-large", 0, -43, "platform", "dispatch", { y: 0.08 }),
  module("space-kit/platform-long", 0, -50, "platform", "dispatch", { y: 0.08 }),
  module("space-kit/platform-high", -7, -48, "platform", "dispatch", { y: 0.1 }),
  module("space-kit/platform-straight", 7, -48, "platform", "dispatch", { y: 0.08 }),
  module("space-kit/stairs", 8, -45, "platform", "dispatch", { yaw: -Math.PI / 2 }),
  module("space-kit/desk-computer", 4.2, -35.5, "console", "dispatch", { targetHeight: 1.5 }),
  module("space-kit/desk-chair", 4.2, -37.2, "console", "dispatch", { yaw: Math.PI, targetHeight: 1.2 }),
  module("space-kit/astronauta", -4.5, -29, "crew", "dispatch", { yaw: Math.PI / 2, targetHeight: 1.8 }),
  module("space-kit/machine-generatorlarge", 9, -39, "machine", "dispatch", { targetHeight: 3.2, collider: [2, 2] }),
  module("space-kit/machine-generator", -9, -41, "machine", "dispatch", { targetHeight: 2.5, collider: [1.5, 1.5] }),
  module("space-kit/barrels", 12, -42, "cargo", "dispatch"),
  module("space-kit/barrels-rail", -12, -44, "cargo", "dispatch"),

  // Freight court: two craft pads and a dense service strip.
  module("space-kit/platform-large", -15, -60, "platform", "freight-yard", { y: 0.08 }),
  module("space-kit/platform-large", 15, -60, "platform", "freight-yard", { y: 0.08 }),
  module("space-kit/platform-long", 0, -68, "platform", "freight-yard", { y: 0.08 }),
  module("space-kit/platform-high", -15, -69, "platform", "freight-yard", { y: 0.1 }),
  module("space-kit/platform-straight", 15, -69, "platform", "freight-yard", { y: 0.08 }),
  module("space-kit/stairs", -8, -65, "platform", "freight-yard", { yaw: Math.PI / 2 }),
  module("space-kit/craft-cargoa", 15, -58, "craft", "freight-yard", { yaw: Math.PI / 2, targetHeight: 3.6, collider: [3, 4] }),
  module("space-kit/craft-cargob", -17, -61, "craft", "freight-yard", { yaw: -Math.PI / 2, targetHeight: 3.6, collider: [3, 4] }),
  module("space-kit/machine-wireless", 7, -74, "machine", "freight-yard", { targetHeight: 2.8 }),
  module("space-kit/machine-barrellarge", -8, -74, "machine", "freight-yard", { targetHeight: 2.6 }),
  module("space-kit/barrels-rail", 11, -52, "cargo", "freight-yard"),
  module("space-kit/barrels", -11, -81, "cargo", "freight-yard"),
  module("space-kit/pipe-straight", -9, -82, "pipe", "freight-yard", { y: 1.4, yaw: Math.PI / 2 }),
  module("space-kit/pipe-straight", -9, -90, "pipe", "freight-yard", { y: 1.4, yaw: Math.PI / 2 }),
  module("space-kit/pipe-supporthigh", -9, -82, "pipe", "freight-yard", { yaw: Math.PI / 2 }),
  module("space-kit/astronautb", 7.5, -57, "crew", "freight-yard", { yaw: -Math.PI / 2, targetHeight: 1.8 }),

  // Elevated freight monorail, kept as a continuous modular run.
  ...Array.from({ length: 13 }, (_, index) =>
    module("space-kit/monorail-trackstraight", -13, 12 - index * 10, "rail", "monorail", { y: 5.2 })
  ),
  module("space-kit/monorail-trackcornerlarge", -13, -118, "rail", "monorail", { y: 5.2, yaw: Math.PI }),
  ...[-10, -40, -70, -100].map(z =>
    module("space-kit/monorail-tracksupport", -13, z, "rail-support", "monorail")
  ),
  module("space-kit/monorail-trainfront", -13, -43, "train", "monorail", { y: 5.6 }),
  module("space-kit/monorail-traincargo", -13, -50, "train", "monorail", { y: 5.6 }),
  module("space-kit/monorail-trainbox", -13, -57, "train", "monorail", { y: 5.6 }),

  // Hangar crescent: one primary terminal and four satellite halls.
  module("space-kit/hangar-largea", 0, -106, "hangar", "hangar-crescent", { targetHeight: 12, collider: [10, 8] }),
  module("space-kit/hangar-largeb", -30, -94, "hangar", "hangar-crescent", { targetHeight: 10, collider: [8, 7] }),
  module("space-kit/hangar-smalla", 30, -94, "hangar", "hangar-crescent", { targetHeight: 8, collider: [6, 6] }),
  module("space-kit/hangar-rounda", 30, -122, "hangar", "hangar-crescent", { targetHeight: 7.5, collider: [6, 6] }),
  module("space-kit/hangar-roundglass", -30, -122, "hangar", "hangar-crescent", { targetHeight: 7.5, collider: [6, 6] }),
  module("space-kit/craft-miner", 20, -91, "craft", "hangar-crescent", { yaw: Math.PI / 2, targetHeight: 3.1, collider: [3, 3] }),
  module("space-kit/chimney-detailed", 11, -103, "structure", "hangar-crescent", { targetHeight: 5.5 }),
  module("space-kit/satellitedish-large", -25, -76, "antenna", "west-service", { targetHeight: 5.2, collider: [2, 2] }),

  // Lunar terrain, rock formations and a meteor mark the outer boundary.
  module("space-kit/terrain", -34, -28, "terrain", "perimeter"),
  module("space-kit/terrain", 34, -28, "terrain", "perimeter"),
  module("space-kit/terrain", -42, -66, "terrain", "perimeter"),
  module("space-kit/terrain", 42, -66, "terrain", "perimeter"),
  module("space-kit/terrain", -38, -106, "terrain", "perimeter"),
  module("space-kit/terrain", 38, -106, "terrain", "perimeter"),
  module("space-kit/terrain-side", -34, -51, "terrain", "perimeter", { yaw: Math.PI / 2 }),
  module("space-kit/terrain-side", 34, -55, "terrain", "perimeter", { yaw: -Math.PI / 2 }),
  module("space-kit/terrain-side", -36, -94, "terrain", "perimeter", { yaw: Math.PI / 2 }),
  module("space-kit/terrain-side", 36, -96, "terrain", "perimeter", { yaw: -Math.PI / 2 }),
  module("space-kit/rock-largea", -43, -82, "rock", "perimeter", { targetHeight: 6, collider: [2.5, 2.5] }),
  module("space-kit/craterlarge", 43, -78, "crater", "perimeter", { targetHeight: 4.5, collider: [3, 3] }),
  module("space-kit/meteor-detailed", 41, -119, "rock", "perimeter", { targetHeight: 5.5, collider: [2, 2] })
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
      setting: "DEPOO / modular freight campus", units: "metres",
      objects: WORLD_LAYOUT.map((entry, index) => ({
        index, id: entry.id, x: entry.x, y: entry.y || 0, z: entry.z,
        yaw: entry.yaw || 0, kind: entry.kind, zone: entry.zone
      })),
      anchors: [
        { id: "spawn", x: 0, y: 0, z: 9.2 },
        { id: "dispatch-court", x: 0, y: 0, z: -38 },
        { id: "freight-yard", x: 0, y: 0, z: -68 },
        { id: "main-hangar", x: 0, y: 0, z: -106 }
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

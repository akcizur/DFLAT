import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createPanelakDistrict, PANELAK_LAYOUT } from "./panelak.js";
import { createPanelakInterior } from "./panelak-interior.js";

const SOURCE_COMMIT = "eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3";
const SOURCE_ROOT = "https://raw.githubusercontent.com/Hidencod/tge-assets/" + SOURCE_COMMIT;
const APP_BASE = typeof import.meta.env !== "undefined" && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : "/";

export const WORLD_LAYOUT = [
  { id: "city-kit-roads/road-straight", x: 0, z: -6, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -16, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -26, kind: "road" },
  { id: "city-kit-roads/road-crossroad", x: 0, z: -36, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -46, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -56, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -66, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -76, kind: "road" },
  { id: "city-kit-roads/road-crossroad", x: 0, z: -76, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -86, kind: "road" },
  { id: "city-kit-roads/road-straight", x: 0, z: -96, kind: "road" },
  { id: "city-kit-roads/road-crossing", x: 0, z: -26, kind: "road" },

  // Keep the skyline outside the playable road; foreground housing is generated as paneláks.
  { id: "city-kit-commercial/building-skyscraper-a", x: -30, z: -118, yaw: 0, kind: "building", targetHeight: 17, collider: [7, 7] },

  { id: "car-kit/taxi", x: -2.1, z: -13, yaw: 0, kind: "vehicle", targetHeight: 1.45 },
  { id: "car-kit/ambulance", x: 2.2, z: -52, yaw: Math.PI, kind: "vehicle", targetHeight: 1.65 },
  { id: "prototype-kit/vehicle", x: 2.2, z: -42, yaw: Math.PI, kind: "vehicle", targetHeight: 1.45 },

  { id: "city-kit-roads/road-sign-stop", x: 5.2, z: -34, yaw: 0, kind: "street-prop", targetHeight: 2.3 },
  { id: "city-kit-roads/traffic-light", x: -5.2, z: -36, yaw: 0, kind: "street-prop", targetHeight: 3.3 },
  { id: "city-kit-suburban/planter", x: -8.5, z: -24, yaw: 0, kind: "prop", targetHeight: 0.8 },
  { id: "city-kit-suburban/planter", x: 8.5, z: -24, yaw: 0, kind: "prop", targetHeight: 0.8 },

  { id: "city-kit-suburban/tree-large", x: -8.2, z: -12, yaw: 0, kind: "tree", targetHeight: 5 },
  { id: "city-kit-suburban/tree-small", x: 8.2, z: -14, yaw: 0.8, kind: "tree", targetHeight: 3.2 },
  { id: "nature-kit/tree-oak", x: -8.5, z: -43, yaw: 0.4, kind: "tree", targetHeight: 4.6 },
  { id: "city-kit-suburban/tree-large", x: 8.4, z: -45, yaw: 2.2, kind: "tree", targetHeight: 5 },
  { id: "nature-kit/plant-bushlarge", x: -8, z: -29, yaw: 0.3, kind: "foliage", targetHeight: 1.4 },
  { id: "nature-kit/plant-bushlarge", x: 8, z: -30, yaw: 1.2, kind: "foliage", targetHeight: 1.4 },
  { id: "nature-kit/grass", x: -8, z: -50, yaw: 0, kind: "foliage", targetHeight: 0.8 },
  { id: "nature-kit/grass", x: 8, z: -51, yaw: 1.7, kind: "foliage", targetHeight: 0.8 },

  { id: "furniture-kit/bench", x: -7.2, z: -18.5, yaw: Math.PI / 2, kind: "street-prop", targetHeight: 0.95 },
  { id: "furniture-kit/trashcan", x: 7.4, z: -19.2, yaw: 0, kind: "street-prop", targetHeight: 0.9 },
  { id: "furniture-kit/pottedplant", x: -8.4, z: -40, yaw: 0, kind: "street-prop", targetHeight: 1.1 },
  { id: "furniture-kit/pottedplant", x: 8.4, z: -40, yaw: 0.8, kind: "street-prop", targetHeight: 1.1 },

  { id: "mini-characters/character-male-a", x: -6.3, z: -31, yaw: Math.PI / 2, kind: "character", targetHeight: 1.7 },
  { id: "mini-characters/character-female-a", x: 6.3, z: -45, yaw: -Math.PI / 2, kind: "character", targetHeight: 1.7 }
];

function makeBox(THREE, scene, { x, y, z, width, height, depth, color, name }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 })
  );
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function prepareModel(THREE, root, entry) {
  root.position.set(0, 0, 0);
  root.rotation.y = entry.yaw || 0;
  if (entry.targetHeight) {
    const initialBounds = new THREE.Box3().setFromObject(root);
    const dimensions = initialBounds.getSize(new THREE.Vector3());
    const height = Math.max(0.001, dimensions.y);
    root.scale.multiplyScalar(entry.targetHeight / height);
  }
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.y -= bounds.min.y;
  for (const node of root.children) {
    node.traverse?.(mesh => {
      if (mesh.isMesh) {
        mesh.castShadow = entry.kind !== "road";
        mesh.receiveShadow = true;
      }
    });
  }
  return root;
}

export function createOpenWorld({ THREE, scene, onProgress = () => {} }) {
  const loader = new GLTFLoader();
  const colliders = [];
  const interactables = [];
  const meshesToAnimate = [];
  const doorAnimations = [];
  const meshes = [];

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ color: 0x65735e, roughness: 1, metalness: 0 })
  );
  ground.name = "CC0 neighbourhood ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.frustumCulled = false;
  ground.receiveShadow = true;
  scene.add(ground);
  meshes.push(ground);

  // A quiet asphalt underlay keeps the street continuous if a source model fails to load.
  meshes.push(makeBox(THREE, scene, {
    x: 0, y: -0.055, z: -47.5, width: 8.8, height: 0.08, depth: 111,
    color: 0x34393a, name: "Asphalt road underlay"
  }));
  meshes.push(makeBox(THREE, scene, {
    x: 0, y: -0.047, z: -36, width: 66, height: 0.065, depth: 7.4,
    color: 0x34393a, name: "Asphalt cross street underlay"
  }));
  meshes.push(makeBox(THREE, scene, {
    x: 0, y: -0.047, z: -76, width: 66, height: 0.065, depth: 7.4,
    color: 0x34393a, name: "Asphalt cross street underlay north"
  }));
  meshes.push(makeBox(THREE, scene, {
    x: -5.6, y: -0.035, z: -47.5, width: 2, height: 0.08, depth: 111,
    color: 0x999a91, name: "West sidewalk"
  }));
  meshes.push(makeBox(THREE, scene, {
    x: 5.6, y: -0.035, z: -47.5, width: 2, height: 0.08, depth: 111,
    color: 0x999a91, name: "East sidewalk"
  }));

  const panelakDistrict = createPanelakDistrict({ THREE, scene });
  colliders.push(...panelakDistrict.colliders);
  meshes.push(...panelakDistrict.meshes);
  const panelakInterior = createPanelakInterior({ THREE, scene, colliders, interactables });
  meshes.push(...panelakInterior.meshes);

  for (const entry of WORLD_LAYOUT) {
    if (entry.collider) {
      const [halfWidth, halfDepth] = entry.collider;
      colliders.push({
        minX: entry.x - halfWidth,
        maxX: entry.x + halfWidth,
        minZ: entry.z - halfDepth,
        maxZ: entry.z + halfDepth
      });
    }
  }

  const ready = (async () => {
    const response = await fetch(APP_BASE + "models/manifest.json");
    if (!response.ok) throw new Error("Model manifest request failed: " + response.status);
    const manifest = await response.json();
    const localAssets = new Map(manifest.assets.map(asset => [asset.id, asset]));
    const uniqueIds = [...new Set(WORLD_LAYOUT.map(entry => entry.id))];
    let completed = 0;

    // Each GLB is loaded once and cloned for repeated placements to reduce network and parse work.
    await Promise.all(uniqueIds.map(async id => {
      const entries = WORLD_LAYOUT.filter(entry => entry.id === id);
      const asset = localAssets.get(id);
      if (!asset) {
        completed += 1;
        onProgress(completed, uniqueIds.length, id);
        return;
      }
      try {
        const gltf = await loader.loadAsync(APP_BASE + "models/" + asset.file);
        for (const entry of entries) {
          const root = prepareModel(THREE, gltf.scene.clone(true), entry);
          root.name = entry.id;
          root.position.x = entry.x;
          root.position.z = entry.z;
          scene.add(root);
          meshes.push(root);
        }
      } catch (error) {
        console.warn("Open model could not be loaded:", id, error);
      } finally {
        completed += 1;
        onProgress(completed, uniqueIds.length, id);
      }
    }));
    return { loaded: completed, total: uniqueIds.length, source: manifest.source };
  })();

  function addPlacedModel(root) {
    scene.add(root);
    const bounds = new THREE.Box3().setFromObject(root);
    const dimensions = bounds.getSize(new THREE.Vector3());
    if (dimensions.x > 0.25 && dimensions.z > 0.25 && dimensions.x < 8 && dimensions.z < 8) {
      const center = bounds.getCenter(new THREE.Vector3());
      colliders.push({
        minX: center.x - dimensions.x * 0.36,
        maxX: center.x + dimensions.x * 0.36,
        minZ: center.z - dimensions.z * 0.36,
        maxZ: center.z + dimensions.z * 0.36
      });
    }
    return root;
  }

  return {
    colliders,
    interactables,
    panelakDistrict,
    panelakInterior,
    meshesToAnimate,
    doorAnimations,
    meshes,
    navigation: { floorHeight: 0, floors: 1 },
    ready,
    addPlacedModel,
    getCoordinateData: () => ({
      schemaVersion: "1.0",
      units: "metres",
      objects: [
        ...PANELAK_LAYOUT.map(entry => ({ id: entry.id, x: entry.x, y: 0, z: entry.z, kind: "panelak" })),
        ...WORLD_LAYOUT.map(entry => ({ id: entry.id, x: entry.x, y: 0, z: entry.z, kind: entry.kind }))
      ],
      anchors: [{ id: "spawn", x: 0, y: 0, z: 9.2 }]
    }),
    exportCoordinateCSV: () => "record_type,id,name,x,y,z\n" + [
      ...PANELAK_LAYOUT.map(entry => ({ id: entry.id, x: entry.x, z: entry.z })),
      ...WORLD_LAYOUT
    ].map((entry, i) => ["object", i + 1, entry.id, entry.x, 0, entry.z].join(",")).join("\n")
  };
}

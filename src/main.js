import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createMainBuildingWorld } from "./game/main-building.js";
import { createPlayerController } from "./game/player.js";
import { createUI } from "./game/ui.js";
import { bindInput } from "./game/input.js";

const mount = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x858b8e);

const loadingScreen = document.getElementById("loadingScreen");
const loadingStartedAt = performance.now();
const MIN_LOADING_VISIBLE_MS = 900;
let firstSceneFrame = false;
let panoramaResolved = false;
let panelakResolved = false;
let startupComplete = false;
let highestLoadingProgress = 8;

function setLoadingProgress(value, title, detail, phase = title) {
  const progress = Math.max(highestLoadingProgress, Math.min(100, Math.max(0, Math.round(value))));
  highestLoadingProgress = progress;
  const titleNode = document.getElementById("loadingTitle");
  const detailNode = document.getElementById("loadingDetail");
  const bar = document.getElementById("loadingProgressBar");
  const progressNode = document.getElementById("loadingProgress");
  const percentNode = document.getElementById("loadingPercent");
  const phaseNode = document.getElementById("loadingPhase");
  if (titleNode) titleNode.textContent = title;
  if (detailNode) detailNode.textContent = detail;
  if (bar) bar.style.width = progress + "%";
  if (progressNode) progressNode.setAttribute("aria-valuenow", String(progress));
  if (percentNode) percentNode.textContent = String(progress).padStart(2, "0") + "%";
  if (phaseNode) phaseNode.textContent = phase;
}

function finishStartupWhenReady() {
  if (startupComplete || !firstSceneFrame || !panoramaResolved || !panelakResolved) return;
  startupComplete = true;
  state.ready = true;
  setLoadingProgress(100, "SVĚT JE PŘIPRAVEN", "Vstup do hlavní budovy.", "READY");
  if (!loadingScreen) return;
  const remainingVisibleMs = Math.max(
    0,
    MIN_LOADING_VISIBLE_MS - (performance.now() - loadingStartedAt)
  );
  window.setTimeout(() => {
    loadingScreen.classList.add("loading-exit");
    window.setTimeout(() => {
      loadingScreen.hidden = true;
      loadingScreen.setAttribute("aria-hidden", "true");
      document.getElementById("startButton")?.focus({ preventScroll: true });
    }, 240);
  }, remainingVisibleMs);
}

setLoadingProgress(12, "ZAPÍNÁM ENGINE", "Inicializuji 3D vykreslování.", "INITIALIZING");

const panorama = { mesh: null };
const panoramaFallbackTimer = window.setTimeout(() => {
  if (panoramaResolved) return;
  panoramaResolved = true;
  setLoadingProgress(78, "DOKONČUJI SVĚT", "Pozadí se načítá na pozadí.", "FALLBACK");
  finishStartupWhenReady();
}, 5500);
new THREE.TextureLoader().load(
  new URL("../assets/bg-scene-hq.png", import.meta.url).href,
  texture => {
    window.clearTimeout(panoramaFallbackTimer);
    if (!panoramaResolved) {
      panoramaResolved = true;
      setLoadingProgress(72, "NAČÍTÁM OKOLÍ", "Dokončuji panoramatické pozadí.", "ASSETS");
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: texture, side: THREE.BackSide, fog: false,
      depthWrite: false, toneMapped: false
    });
    panorama.mesh = new THREE.Mesh(new THREE.SphereGeometry(160, 64, 40), skyMaterial);
    panorama.mesh.name = "Outdoor city panorama";
    panorama.mesh.renderOrder = -1000;
    scene.add(panorama.mesh);
    finishStartupWhenReady();
  },
  undefined,
  error => {
    window.clearTimeout(panoramaFallbackTimer);
    panoramaResolved = true;
    console.error("The Flat: assets/bg-scene-hq.png sky background failed to load.", error);
    setLoadingProgress(78, "SVĚT PŘIPRAVEN", "Používám záložní pozadí.", "FALLBACK");
    finishStartupWhenReady();
  }
);
scene.fog = new THREE.FogExp2(0x858b8e, 0.0022);

// Global fill lights keep the scene readable even if local room lighting is unavailable.
const globalHemisphere = new THREE.HemisphereLight(0xdce8ff, 0x625648, 1.15);
globalHemisphere.name = "Global fill / hemisphere";
scene.add(globalHemisphere);
const globalSun = new THREE.DirectionalLight(0xffe6c2, 1.6);
globalSun.name = "Global fill / key light";
globalSun.position.set(-7, 12, 6);
globalSun.castShadow = false;
scene.add(globalSun);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 320);
camera.rotation.order = "YXZ";
const LOW_POWER = matchMedia("(pointer:coarse)").matches;
const renderer = new THREE.WebGLRenderer({
  antialias: false, alpha: false, preserveDrawingBuffer: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.domElement.id = "screenCanvas";
renderer.domElement.tabIndex = 0;
mount.appendChild(renderer.domElement);
setLoadingProgress(34, "VYKRESLOVAČ PŘIPRAVEN", "Připravuji terén a hlavní budovu.", "RENDERER");

function resize() {
  const displayWidth = Math.max(1, innerWidth);
  const displayHeight = Math.max(1, innerHeight);
  const PIXEL_SCALE = LOW_POWER ? 3.6 : 3.2;
  const width = Math.max(240, Math.floor(displayWidth / PIXEL_SCALE));
  const height = Math.max(135, Math.floor(displayHeight / PIXEL_SCALE));
  renderer.setSize(width, height, false);
  Object.assign(renderer.domElement.style, {
    position: "absolute",
    inset: "0",
    display: "block",
    width: "100%",
    height: "100%",
    zIndex: "1",
    imageRendering: "pixelated"
  });
  camera.aspect = displayWidth / displayHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const state = {
  hasKeys: false, doorOpen: false, finished: false, started: false,
  paused: false, balconyDoorOpen: false, emptyMap: true, mainBuildingScene: true, currentFloor: 0,
  ready: false, t06bModelActive: false
};
const ui = createUI();
const world = createMainBuildingWorld({ THREE, scene, state, ui });

// The Blender-authored five-module T06B model is the active building when its
// generated GLB is available. The procedural building stays as a safe fallback
// for direct/local runs where Blender has not yet generated the asset.
setLoadingProgress(62, "NAČÍTÁM ARCHITEKTURU", "Kontroluji geometrii sekce T06B.", "MODEL");
const t06bModelRoot = await new Promise(resolve => {
  let settled = false;
  const finish = value => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    resolve(value);
  };
  const timeout = window.setTimeout(() => finish(null), 10000);
  new GLTFLoader().load(
    `${import.meta.env.BASE_URL}models/t06b-panelak-v2.glb`,
    gltf => finish(gltf.scene),
    undefined,
    error => {
      console.warn("T06B Blender model unavailable; using the procedural fallback.", error);
      finish(null);
    }
  );
});

if (t06bModelRoot) {
  // Remove the legacy 28 m / 8-storey visual assembly before inserting T06B V2.
  for (const mesh of world.meshes) {
    scene.remove(mesh);
    mesh.geometry?.dispose();
  }
  world.meshes.length = 0;
  world.meshesToAnimate.length = 0;
  world.doorAnimations.length = 0;
  world.colliders.length = 0;
  world.interactables.length = 0;
  delete state.onElevatorMoved;

  t06bModelRoot.name = "T06B V2 | five-module panelak";
  scene.add(t06bModelRoot);
  world.navigation = {
    floorHeight: 2.8,
    floors: 4,
    coreOpening: { minX: -1.5, maxX: 1.5, minZ: -1.4, maxZ: 2.2 },
    stairs: {
      lowX: -1.22, highX: 1.22, firstZ: -0.55, secondZ: 1.35, steps: 8,
      stepRise: 0.175, stepRun: 0.305, treadDepth: 1.35, treadOverlap: 0.025,
      landingWidth: 2.7, landingDepth: 3.3,
      landingCenterX: 0, landingCenterZ: 0.4
    }
  };

  const addCollider = (minX, maxX, minZ, maxZ, floor = null) => {
    const collider = { minX, maxX, minZ, maxZ };
    if (Number.isInteger(floor)) collider.floor = floor;
    world.colliders.push(collider);
  };
  // Exterior walls. The ground-floor front has one entrance; upper front windows
  // stay non-passable, while the two rear loggia doors are open at every level.
  addCollider(-9.075, -8.925, -5.775, 5.775);
  addCollider(8.925, 9.075, -5.775, 5.775);
  const rearWallSegments = [[-9, -4.375], [-2.825, 2.825], [4.375, 9]];
  for (let floor = 0; floor < 4; floor++) {
    const frontSegments = floor === 0 ? [[-9, -0.9], [0.9, 9]] : [[-9, 9]];
    for (const [left, right] of frontSegments) {
      addCollider(left, right, -5.775, -5.625, floor);
    }
    for (const [left, right] of rearWallSegments) {
      addCollider(left, right, 5.625, 5.775, floor);
    }

    // Core walls and the two apartment entry partitions retain 0.88 m doorways.
    const entryZ0 = -1.01, entryZ1 = -0.13;
    for (const side of [-1, 1]) {
      for (const xCenter of [side * 1.8, side * 5.4]) {
        for (const [z0, z1] of [[-5.55, entryZ0], [entryZ1, 5.55]]) {
          addCollider(xCenter - 0.075, xCenter + 0.075, z0, z1, floor);
        }
      }
      const inner = side * 3.6;
      const doorwayX = inner - side * 1.12;
      for (const z of [-1.95, 0.80]) {
        for (const [left, right] of [
          [inner - 1.725, doorwayX - 0.48],
          [doorwayX + 0.48, inner + 1.725]
        ]) {
          if (right > left) addCollider(left, right, z - 0.075, z + 0.075, floor);
        }
      }
      for (const [z0, z1] of [[-1.42, -0.74], [-0.10, 0.58]]) {
        addCollider(inner - 0.075, inner + 0.075, z0, z1, floor);
      }
    }
  }
  world.interactables.push({
    id: "stairs", name: "Schodiště",
    description: "Čtyři podlaží. Vystoupej po skutečných schodišťových ramenech.",
    x: 0, z: -0.85, range: 2.0, used: false,
    action: () => ui.showToast("T06B / čtyři nadzemní podlaží / bez výtahu")
  });
  state.currentFloor = 0;
  state.t06bModelActive = true;
  setLoadingProgress(78, "PANELÁK T06B PŘIPRAVEN", "18 m / pět modulů / osm bytů.", "MODEL READY");
} else {
  setLoadingProgress(78, "ZÁLOŽNÍ SCÉNA", "Model T06B není dostupný; používám procedurální náhradní budovu.", "FALLBACK");
}
panelakResolved = true;
finishStartupWhenReady();
setLoadingProgress(56, "NAČÍTÁM SEKCI T06B", "Pět modulů, čtyři podlaží, suterén a schodiště.", "T06B MODEL");

// The outdoor map has no interior mission, furniture, or scripted interactables.

scene.traverse(object => {
  if (object.isMesh && object.geometry?.attributes?.uv && !object.geometry.attributes.uv2) {
    object.geometry.setAttribute("uv2", object.geometry.attributes.uv.clone());
  }
  if (object.isLight && object.castShadow) {
    object.shadow.mapSize.set(LOW_POWER ? 192 : 384, LOW_POWER ? 192 : 384);
    object.shadow.bias = -0.00035;
    object.shadow.normalBias = 0.025;
    object.shadow.radius = 0;
  }
});

const controller = createPlayerController({
  camera, colliders: world.colliders, interactables: world.interactables,
  navigation: world.navigation, state, ui
});
state.changeFloor = (floor, method = "Výtah") => {
  controller.goToFloor(floor, method);
};
if (new URLSearchParams(location.search).get("smoke") === "1") {
  Object.defineProperty(window, "__DFLAT_SMOKE__", {
    configurable: true,
    value: {
      playerPosition: () => ({ x: controller.player.x, z: controller.player.z, elevation: controller.player.elevation, floor: controller.player.floor }),
      keysDown: () => ({ ...controller.keysDown }),
      gameState: () => ({ started: state.started, paused: state.paused, t06bModelActive: state.t06bModelActive, currentFloor: state.currentFloor })
    }
  });
}
bindInput({ renderer, state, controller, ui });
setLoadingProgress(84, "KONTROLUJI SCÉNU", "Ověřuji vstupní body a připravuji první snímek.", "VALIDATION");

const clockStart = performance.now();
const SIMULATION_HZ = 60;
const SIMULATION_STEP_MS = 1000 / SIMULATION_HZ;
const SCENE_RENDER_HZ = 60;
const SCENE_RENDER_INTERVAL_MS = 1000 / SCENE_RENDER_HZ;
let previousTime = 0;
let simulationTime = clockStart;
let simulationAccumulator = 0;
let nextSceneRenderAt = 0;

const shimmerMaterials = (() => {
  const mats = new Set();
  scene.traverse(object => {
    if (!object.isMesh || object.name === "HQ sky image background") return;
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (material?.color && material.emissive && !mats.has(material)) {
        mats.add(material);
        material.userData.baseEmissiveIntensity = material.emissiveIntensity;
        material.userData.shimmerPhase = (object.id % 17) * 0.37;
      }
    }
  });
  return [...mats];
})();

function updateSimulation(deltaSeconds, nowMs) {
  const nearest = controller.update(deltaSeconds);
  for (const door of world.doorAnimations) {
    const target = door.targetOpen ? 1 : 0;
    door.progress += (target - door.progress) * (1 - Math.exp(-deltaSeconds * 5.5));
    if (Math.abs(target - door.progress) < 0.002) door.progress = target;
    const eased = door.progress * door.progress * (3 - 2 * door.progress);
    door.pivot.rotation.y = door.closedRotation + (door.openRotation - door.closedRotation) * eased;
    if (!door.targetOpen && door.progress < 0.9 && door.closedBounds) {
      Object.assign(door.collider, door.closedBounds);
    } else if (door.targetOpen) {
      door.collider.minX = 30;
      door.collider.maxX = 31;
    }
  }
  const shimmer = 0.012 + Math.sin(nowMs * 0.0017) * 0.004;
  for (const material of shimmerMaterials) {
    const phase = material.userData.shimmerPhase || 0;
    material.emissiveIntensity =
      (material.userData.baseEmissiveIntensity || 0) +
      shimmer * (0.5 + 0.5 * Math.sin(nowMs * 0.0022 + phase));
  }
  for (const item of world.meshesToAnimate) {
    item.object.position.y = item.baseY + Math.sin(nowMs * 0.002 + item.phase) * 0.045;
    item.object.rotation.y = 0.45 + Math.sin(nowMs * 0.001) * 0.18;
  }
  ui.setInteraction(nearest, state);
  ui.tick(nowMs, clockStart);
}

function animate(now) {
  requestAnimationFrame(animate);
  if (previousTime === 0) {
    previousTime = now;
    simulationTime = now;
    nextSceneRenderAt = now;
  }
  const elapsed = Math.min(now - previousTime, 100);
  previousTime = now;
  simulationAccumulator += elapsed;
  let steps = 0;
  while (simulationAccumulator >= SIMULATION_STEP_MS && steps < 5) {
    simulationTime += SIMULATION_STEP_MS;
    updateSimulation(SIMULATION_STEP_MS / 1000, simulationTime);
    simulationAccumulator -= SIMULATION_STEP_MS;
    steps += 1;
  }
  if (steps === 5 && simulationAccumulator >= SIMULATION_STEP_MS) {
    simulationAccumulator %= SIMULATION_STEP_MS;
  }
  if (now >= nextSceneRenderAt) {
    renderer.render(scene, camera);
    if (!firstSceneFrame) {
      firstSceneFrame = true;
      setLoadingProgress(92, "PRVNÍ SNÍMEK HOTOV", "Dokončuji poslední kontroly.", "FIRST FRAME");
      finishStartupWhenReady();
    }
    nextSceneRenderAt = now + SCENE_RENDER_INTERVAL_MS;
  }
}

ui.updateObjective(state);
requestAnimationFrame(animate);

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
setLoadingProgress(56, "NAČÍTÁM SEKCI T06B", "Pět modulů, čtyři podlaží, suterén a schodiště.", "T06B MODEL");
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
  // Preserve the outdoor site, but discard the old eight-storey building geometry.
  const siteMeshes = world.meshes.filter(mesh =>
    mesh.name.startsWith("Mapa /") || mesh.name.startsWith("Silnice /")
  );
  for (const mesh of world.meshes) {
    if (siteMeshes.includes(mesh)) continue;
    scene.remove(mesh);
    mesh.geometry?.dispose();
  }
  world.meshes.splice(0, world.meshes.length, ...siteMeshes);
  world.meshesToAnimate.length = 0;
  world.doorAnimations.length = 0;
  world.colliders.length = 0;
  world.interactables.length = 0;
  delete state.onElevatorMoved;

  // The authored model's front is local z=-6. Reflect depth and move its centre
  // to z=-22 so its front/back facades align with the existing outdoor approach.
  t06bModelRoot.name = "T06B V2 | five-module panelak";
  t06bModelRoot.scale.z = -1;
  t06bModelRoot.position.z = -22;
  scene.add(t06bModelRoot);
  const t06bRuntimeBounds = new THREE.Box3().setFromObject(t06bModelRoot);
  state.t06bRuntimeBounds = t06bRuntimeBounds;
  world.navigation = {
    floorHeight: 2.8,
    floors: 4,
    coreOpening: { minX: -1.5, maxX: 1.5, minZ: -24.2, maxZ: -19.8 },
    stairs: {
      lowX: -1.5, highX: 0.9, firstZ: -21.2, secondZ: -23.5, steps: 8,
      stepRise: 0.175, stepRun: 0.3, treadDepth: 1.2, treadOverlap: 0.025,
      landingWidth: 0.6, landingDepth: 4.3,
      landingCenterX: 1.2, landingCenterZ: -22.0
    }
  };

  const addCollider = (minX, maxX, minZ, maxZ, floor = null) => {
    const collider = { minX, maxX, minZ, maxZ };
    if (Number.isInteger(floor)) collider.floor = floor;
    world.colliders.push(collider);
  };
  // Convert authored Y-up/local-Z facade intervals into the site's world Z.
  const addLocalCollider = (minX, maxX, localMinZ, localMaxZ, floor = null) => {
    addCollider(minX, maxX, -22-localMaxZ, -22-localMinZ, floor);
  };

  // Full-height end walls remain solid on every storey.
  addLocalCollider(-9.075, -8.925, -6.075, 6.075);
  addLocalCollider(8.925, 9.075, -6.075, 6.075);

  const rearWallSegments = [[-9, -5.2], [-2.0, 2.0], [5.2, 9]];
  const entryZ0 = -1.74, entryZ1 = -0.86;
  for (let floor = 0; floor < 4; floor++) {
    // Only the ground floor has a walk-through exterior door; luxfer panels
    // on upper floors are glazing, not openings.
    const frontSegments = floor === 0 ? [[-9, -0.9], [0.9, 9]] : [[-9, 9]];
    for (const [left, right] of frontSegments) {
      addLocalCollider(left, right, -6.075, -5.925, floor);
    }
    // The rear wall is open across each 3.2 m recessed loggia doorway.
    for (const [left, right] of rearWallSegments) {
      addLocalCollider(left, right, 5.925, 6.075, floor);
    }

    // Apartment/core walls retain aligned 0.88 m doorways.
    for (const side of [-1, 1]) {
      for (const xCenter of [side * 1.8, side * 5.4]) {
        for (const [z0, z1] of [[-5.85, entryZ0], [entryZ1, 5.85]]) {
          addLocalCollider(xCenter-0.075, xCenter+0.075, z0, z1, floor);
        }
      }
      const inner = side * 3.6;
      const doorwayX = inner - side * 1.12;
      for (const z of [-2.275, -0.075]) {
        for (const [left, right] of [
          [inner-1.725, doorwayX-0.48],
          [doorwayX+0.48, inner+1.725]
        ]) {
          if (right > left) addLocalCollider(left, right, z-0.075, z+0.075, floor);
        }
      }

      const outer = side * 7.2;
      for (const z of [-2.775, -0.075]) {
        const halfDoor = 0.44;
        addLocalCollider(outer-1.725, outer-halfDoor, z-0.075, z+0.075, floor);
        addLocalCollider(outer+halfDoor, outer+1.725, z-0.075, z+0.075, floor);
      }
      for (const [z0, z1] of [[-2.20, -1.525], [-0.875, -0.20]]) {
        addLocalCollider(inner-0.075, inner+0.075, z0, z1, floor);
      }
    }
  }

  world.interactables.push({
    id: "stairs", name: "Schodiště",
    description: "Čtyři podlaží. Vystoupej po skutečných schodišťových ramenech.",
    x: 0, z: -22.0, range: 1.8, used: false,
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
      gameState: () => ({ started: state.started, paused: state.paused, ready: state.ready, t06bModelActive: state.t06bModelActive, currentFloor: state.currentFloor, floorCount: world.navigation?.floors ?? 8, modelBounds: state.t06bRuntimeBounds ? (() => { const b = state.t06bRuntimeBounds; return { min: { x: b.min.x, y: b.min.y, z: b.min.z }, max: { x: b.max.x, y: b.max.y, z: b.max.z }, size: { x: b.max.x-b.min.x, y: b.max.y-b.min.y, z: b.max.z-b.min.z } }; })() : null })
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

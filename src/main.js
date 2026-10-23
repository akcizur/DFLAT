import * as THREE from "three";
import { createMainBuildingWorld } from "./game/main-building.js";
import { createPlayerController } from "./game/player.js";
import { createUI } from "./game/ui.js";
import { bindInput } from "./game/input.js";
import { applyEnvironment, sampleEnvironment } from "./game/environment.js";

const mount = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x858b8e);

const loadingScreen = document.getElementById("loadingScreen");
const loadingStartedAt = performance.now();
const MIN_LOADING_VISIBLE_MS = 900;
let firstSceneFrame = false;
let panoramaResolved = false;
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
  if (startupComplete || !firstSceneFrame || !panoramaResolved) return;
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
  ready: false
};
const ui = createUI();
const world = createMainBuildingWorld({ THREE, scene, state, ui });
setLoadingProgress(59, "STAVÍM HLAVNÍ BUDOVU", "Čtyřpodlažní sekce T06B, lodžie a schodiště.", "GEOMETRY");

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
      playerPosition: () => ({ x: controller.player.x, z: controller.player.z }),
      keysDown: () => ({ ...controller.keysDown }),
      gameState: () => ({ started: state.started, paused: state.paused })
    }
  });
}
bindInput({ renderer, state, controller, ui });
setLoadingProgress(84, "KONTROLUJI SCÉNU", "Ověřuji vstupní body a připravuji první snímek.", "VALIDATION");

const clockStart = performance.now();
const WEATHER_PARTICLE_COUNT = LOW_POWER ? 110 : 320;
const rainPositions = new Float32Array(WEATHER_PARTICLE_COUNT * 6);
let rainSeed = 0xDF1A7;
function weatherRandom() {
  rainSeed = (Math.imul(rainSeed, 1664525) + 1013904223) >>> 0;
  return rainSeed / 0x100000000;
}
for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
  const offset = i * 6;
  const x = (weatherRandom() - 0.5) * 24;
  const y = 1 + weatherRandom() * 15;
  const z = (weatherRandom() - 0.5) * 24;
  rainPositions[offset] = x;
  rainPositions[offset + 1] = y;
  rainPositions[offset + 2] = z;
  rainPositions[offset + 3] = x - 0.035;
  rainPositions[offset + 4] = y - 0.24;
  rainPositions[offset + 5] = z;
}
const rainGeometry = new THREE.BufferGeometry();
const rainAttribute = new THREE.BufferAttribute(rainPositions, 3);
rainAttribute.setUsage(THREE.DynamicDrawUsage);
rainGeometry.setAttribute("position", rainAttribute);
const rainMaterial = new THREE.LineBasicMaterial({
  color: 0xb9cbd3, transparent: true, opacity: 0, depthWrite: false,
  blending: THREE.NormalBlending, toneMapped: false
});
const rainMesh = new THREE.LineSegments(rainGeometry, rainMaterial);
rainMesh.name = "Environment / rainfall";
rainMesh.frustumCulled = false;
rainMesh.renderOrder = 2;
rainMesh.visible = false;
scene.add(rainMesh);
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
  const environment = sampleEnvironment((nowMs - clockStart) / 1000);
  state.environment = environment;
  applyEnvironment({ THREE, scene, hemisphere: globalHemisphere, sun: globalSun, panorama, environment });
  rainMesh.visible = environment.precipitation > 0.025;
  rainMaterial.opacity = environment.precipitation * 0.52;
  rainMesh.position.set(controller.player.x, controller.player.elevation, controller.player.z);
  const dropsPerSecond = 9 + environment.precipitation * 24;
  for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
    const offset = i * 6;
    rainPositions[offset + 1] -= dropsPerSecond * deltaSeconds;
    rainPositions[offset + 4] = rainPositions[offset + 1] - 0.24;
    rainPositions[offset] += environment.wind * deltaSeconds;
    rainPositions[offset + 3] = rainPositions[offset] - 0.035;
    if (rainPositions[offset + 1] < 0.25) {
      rainPositions[offset] = (weatherRandom() - 0.5) * 24;
      rainPositions[offset + 1] = 10 + weatherRandom() * 10;
      rainPositions[offset + 2] = (weatherRandom() - 0.5) * 24;
      rainPositions[offset + 3] = rainPositions[offset] - 0.035;
      rainPositions[offset + 4] = rainPositions[offset + 1] - 0.24;
      rainPositions[offset + 5] = rainPositions[offset + 2];
    }
  }
  rainGeometry.attributes.position.needsUpdate = true;
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
  ui.tick(nowMs, clockStart, environment);
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

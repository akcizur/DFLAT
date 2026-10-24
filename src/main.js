import * as THREE from "three";
import { createEmptyWorld } from "./game/main-building.js";
import { createPlayerController } from "./game/player.js";
import { createUI } from "./game/ui.js";
import { bindInput } from "./game/input.js";

const mount = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x858b8e);
const loadingScreen = document.getElementById("loadingScreen");
let firstSceneFrame = false;
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
  if (startupComplete || !firstSceneFrame) return;
  startupComplete = true;
  state.ready = true;
  const startButton = document.getElementById("startButton");
  if (startButton) {
    startButton.disabled = false;
    startButton.setAttribute("aria-disabled", "false");
    const enterLabel = startButton.querySelector(".nexus-enter");
    if (enterLabel) enterLabel.textContent = "ENTER ↵";
  }
  setLoadingProgress(100, "PRÁZDNÁ MAPA JE PŘIPRAVENA", "Žádné budovy. Jen volný prostor.", "READY");
  if (!loadingScreen) return;
  window.setTimeout(() => {
    loadingScreen.classList.add("loading-exit");
    window.setTimeout(() => {
      loadingScreen.hidden = true;
      loadingScreen.setAttribute("aria-hidden", "true");
      document.getElementById("startButton")?.focus({ preventScroll: true });
    }, 240);
  }, 180);
}

setLoadingProgress(12, "ZAPÍNÁM ENGINE", "Inicializuji 3D vykreslování.", "INITIALIZING");
scene.fog = new THREE.FogExp2(0x858b8e, 0.0022);
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
setLoadingProgress(34, "VYKRESLOVAČ PŘIPRAVEN", "Připravuji prázdnou mapu.", "RENDERER");

function resize() {
  const displayWidth = Math.max(1, innerWidth);
  const displayHeight = Math.max(1, innerHeight);
  const pixelScale = LOW_POWER ? 3.6 : 3.2;
  renderer.setSize(Math.max(240, Math.floor(displayWidth / pixelScale)), Math.max(135, Math.floor(displayHeight / pixelScale)), false);
  Object.assign(renderer.domElement.style, {
    position: "absolute", inset: "0", display: "block", width: "100%", height: "100%",
    zIndex: "1", imageRendering: "pixelated"
  });
  camera.aspect = displayWidth / displayHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const state = {
  hasKeys: false, doorOpen: false, finished: false, started: false,
  paused: false, balconyDoorOpen: false, emptyMap: true, mainBuildingScene: false,
  currentFloor: 0, ready: false
};
const ui = createUI();
const world = createEmptyWorld({ THREE, scene });
setLoadingProgress(59, "PŘIPRAVUJI PRÁZDNOU MAPU", "Bez budov a architektonických objektů.", "EMPTY WORLD");
const controller = createPlayerController({
  camera, colliders: world.colliders, interactables: world.interactables,
  navigation: world.navigation, state, ui
});
state.changeFloor = () => ui.showToast("Prázdná mapa: nejsou zde žádná podlaží.");
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
setLoadingProgress(84, "KONTROLUJI SCÉNU", "Připravuji první snímek.", "VALIDATION");

const clockStart = performance.now();
const simulationStepMs = 1000 / 60;
const sceneRenderIntervalMs = 1000 / 60;
let previousTime = 0;
let simulationTime = clockStart;
let simulationAccumulator = 0;
let nextSceneRenderAt = 0;

function updateSimulation(deltaSeconds, nowMs) {
  const nearest = controller.update(deltaSeconds);
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
  simulationAccumulator += Math.min(now - previousTime, 100);
  previousTime = now;
  let steps = 0;
  while (simulationAccumulator >= simulationStepMs && steps < 5) {
    simulationTime += simulationStepMs;
    updateSimulation(simulationStepMs / 1000, simulationTime);
    simulationAccumulator -= simulationStepMs;
    steps += 1;
  }
  if (steps === 5 && simulationAccumulator >= simulationStepMs) simulationAccumulator %= simulationStepMs;
  if (now >= nextSceneRenderAt) {
    renderer.render(scene, camera);
    if (!firstSceneFrame) {
      firstSceneFrame = true;
      setLoadingProgress(92, "PRVNÍ SNÍMEK HOTOV", "Dokončuji poslední kontroly.", "FIRST FRAME");
      finishStartupWhenReady();
    }
    nextSceneRenderAt = now + sceneRenderIntervalMs;
  }
}
ui.updateObjective(state);
requestAnimationFrame(animate);

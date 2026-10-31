import * as THREE from "three";
import { createOpenWorld } from "./game/open-world.js";
import { createModelLibrary } from "./game/model-library.js";
import { createPlayerController } from "./game/player.js";
import { createUI } from "./game/ui.js";
import { bindInput } from "./game/input.js";

const mount = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8599a6);
const loadingScreen = document.getElementById("loadingScreen");
let firstSceneFrame = false;
let worldReady = false;
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
  if (startupComplete || !firstSceneFrame || !worldReady) return;
  startupComplete = true;
  state.ready = true;
  const startButton = document.getElementById("startButton");
  if (startButton) {
    startButton.disabled = false;
    startButton.setAttribute("aria-disabled", "false");
    const enterLabel = startButton.querySelector(".nexus-enter");
    if (enterLabel) enterLabel.textContent = "ENTER ↵";
  }
  setLoadingProgress(100, "SVĚT JE PŘIPRAVEN", "Město DEPOO a knihovna CC0 modelů jsou připraveny.", "READY");
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

setLoadingProgress(12, "ZAPÍNÁM ENGINE", "Inicializuji městskou 3D scénu.", "INITIALIZING");
scene.fog = new THREE.FogExp2(0x8599a6, 0.00135);
const globalHemisphere = new THREE.HemisphereLight(0xd2e0e8, 0x4b4642, 1.15);
globalHemisphere.name = "Global fill / hemisphere";
scene.add(globalHemisphere);
const globalSun = new THREE.DirectionalLight(0xffc68b, 1.85);
globalSun.name = "Global fill / key light";
globalSun.position.set(-34, 58, 24);
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
setLoadingProgress(34, "VYKRESLOVAČ PŘIPRAVEN", "Připravuji kompletní město DEPOO.", "RENDERER");

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
addEventListener("resize", resize, { passive: true });
addEventListener("orientationchange", () => {
  requestAnimationFrame(() => requestAnimationFrame(resize));
}, { passive: true });
// iOS Safari changes the visual viewport as browser chrome expands/collapses.
window.visualViewport?.addEventListener("resize", resize, { passive: true });
resize();

const state = {
  finished: false, started: false, paused: false, openWorld: true, ready: false
};
const ui = createUI();
setLoadingProgress(45, "STAVÍM MĚSTO DEPOO", "Skládám 36 městských bloků, celé čtvrti, parky a městský provoz.", "CITY KIT");
const world = createOpenWorld({
  THREE,
  scene,
  onProgress: (completed, total, modelId) => {
    const percent = 46 + Math.round(38 * completed / Math.max(1, total));
    setLoadingProgress(percent, "NAČÍTÁM 3D MODELY", completed + "/" + total + " · " + modelId, "WORLD ASSETS");
  }
});
const controller = createPlayerController({
  camera, colliders: world.colliders, interactables: world.interactables,
  navigation: world.navigation, state, ui
});
createModelLibrary({ THREE, scene, camera, state, ui, world });
state.changeFloor = () => ui.showToast("DEPOO je otevřené město. Prozkoumej jeho ulice.");

world.ready.then(result => {
  if (world.navigation.spawn) controller.setSpawn(world.navigation.spawn);
  worldReady = true;
  setLoadingProgress(87, "MĚSTO PŘIPRAVENO", result.loaded + " / " + result.total + " typů městských assetů načteno.", "CITY ASSETS");
  finishStartupWhenReady();
}).catch(error => {
  console.error("Open world initialization failed:", error);
  worldReady = true;
  setLoadingProgress(87, "MĚSTO PŘIPRAVENO S OMEZENÍM", "Některé modely nejsou dostupné; pohyb zůstává funkční.", "PARTIAL");
  finishStartupWhenReady();
});
if (new URLSearchParams(location.search).get("smoke") === "1") {
  Object.defineProperty(window, "__DEPOO_SMOKE__", {
    configurable: true,
    value: {
      playerPosition: () => ({ x: controller.player.x, z: controller.player.z, yaw: controller.player.yaw }),
      keysDown: () => ({ ...controller.keysDown }),
      gameState: () => ({ started: state.started, paused: state.paused }),
      worldMode: () => world.mode,
      assetDiagnostics: () => ({
        mode: world.mode,
        cityVisible: world.meshes.some(mesh => mesh.name === "Imported LowPoly City" && mesh.visible),
        housesVisible: world.meshes.some(mesh => mesh.name === "Imported modern houses" && mesh.visible),
        colliderCount: world.colliders.length
      }),
      blockingCollidersAt: (x, z) => controller.getBlockingCollidersAt(x, z),
      moveForFrames: (code, frames) => {
        if (!state.started || state.paused) return { error: "gameplay is inactive", state: { ...state } };
        controller.keysDown[code] = true;
        for (let frame = 0; frame < frames; frame++) controller.update(1 / 60);
        controller.keysDown[code] = false;
        return { x: controller.player.x, z: controller.player.z, yaw: controller.player.yaw };
      },
      setPlayerPosition: (x, z, yaw = controller.player.yaw) => {
        controller.player.x = x;
        controller.player.z = z;
        controller.player.yaw = yaw;
        controller.player.elevation = 0;
        controller.player.jumpHeight = 0;
        controller.syncCamera(1);
      },
      interact: id => {
        const item = world.interactables.find(entry => entry.id === id);
        if (!item) return false;
        item.action();
        return true;
      },
      worldDiagnostics: () => world.getCoordinateData()
    }
  });
}
bindInput({ renderer, state, controller, ui });
setLoadingProgress(46, "KONTROLUJI SCÉNU", "Připravuji první snímek.", "VALIDATION");

const clockStart = performance.now();
const simulationStepMs = 1000 / 60;
const sceneRenderIntervalMs = 1000 / 60;
let previousTime = 0;
let simulationTime = clockStart;
let simulationAccumulator = 0;
let nextSceneRenderAt = 0;

function updateSimulation(deltaSeconds, nowMs) {
  const nearest = controller.update(deltaSeconds);
  world.tick?.(deltaSeconds);
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
      setLoadingProgress(worldReady ? 92 : Math.min(84, highestLoadingProgress), "PRVNÍ SNÍMEK HOTOV", worldReady ? "Dokončuji poslední kontroly." : "Čekám na dokončení načítání CC0 modelů.", worldReady ? "FIRST FRAME" : "CC0 ASSETS");
      finishStartupWhenReady();
    }
    nextSceneRenderAt = now + sceneRenderIntervalMs;
  }
}
ui.updateObjective(state);
requestAnimationFrame(animate);

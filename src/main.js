import * as THREE from "three";
import { createMaterials } from "./game/materials.js";
import { createEmptyApartment } from "./game/world.js";
import { createPlayerController } from "./game/player.js";
import { createUI } from "./game/ui.js";
import { bindInput } from "./game/input.js";
import { createPixelPostProcess } from "./game/pixel-post.js";

const mount = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x25231f);

const panorama = { mesh: null };
new THREE.TextureLoader().load(
  new URL("../assets/bg-scene-hq.png", import.meta.url).href,
  texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: texture, side: THREE.BackSide, fog: false,
      depthWrite: false, toneMapped: false
    });
    panorama.mesh = new THREE.Mesh(new THREE.SphereGeometry(48, 48, 32), skyMaterial);
    panorama.mesh.name = "HQ sky image background";
    panorama.mesh.renderOrder = -1000;
    scene.add(panorama.mesh);
  },
  undefined,
  error => console.error("The Flat: assets/bg-scene-hq.png sky background failed to load.", error)
);
scene.fog = new THREE.FogExp2(0x34343b, 0.052);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 70);
camera.rotation.order = "YXZ";
const LOW_POWER = matchMedia("(pointer:coarse)").matches;
const renderer = new THREE.WebGLRenderer({
  antialias: false, alpha: false, preserveDrawingBuffer: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(1);
renderer.domElement.style.imageRendering = "pixelated";
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.domElement.style.filter = "contrast(1.025) saturate(.9) sepia(.06)";
renderer.toneMappingExposure = 1.04;
renderer.domElement.id = "screenCanvas";
renderer.domElement.tabIndex = 0;
mount.appendChild(renderer.domElement);

const postFx = createPixelPostProcess(THREE, renderer);
function resize() {
  const pixelScale = LOW_POWER ? 3.4 : 3.05;
  const width = Math.max(200, Math.floor(innerWidth / pixelScale));
  const height = Math.max(125, Math.floor(innerHeight / pixelScale));
  renderer.setSize(width, height, false);
  postFx.setSize(width, height);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const state = {
  hasKeys: false, doorOpen: false, finished: false, started: false,
  paused: false, balconyDoorOpen: false, emptyMap: true
};
const ui = createUI();
const { M, mat } = createMaterials(THREE);
const world = createEmptyApartment({ THREE, scene, M });

// Empty-apartment prototype: intentionally do not create the panelák, NPCs, props or objectives.

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
  camera, colliders: world.colliders, interactables: world.interactables, state, ui
});
bindInput({ renderer, state, controller, ui, postFx });

const clockStart = performance.now();
const SIMULATION_HZ = 60;
const SIMULATION_STEP_MS = 1000 / SIMULATION_HZ;
const SCENE_RENDER_HZ = 60;
const SCENE_RENDER_INTERVAL_MS = 1000 / SCENE_RENDER_HZ;
const PRESENT_HZ = 60;
const PRESENT_INTERVAL_MS = 1000 / PRESENT_HZ;
let previousTime = 0;
let simulationTime = clockStart;
let simulationAccumulator = 0;
let nextSceneRenderAt = 0;
let nextPresentAt = 0;

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
    nextPresentAt = now;
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
    postFx.renderScene(scene, camera, now / 1000);
    nextSceneRenderAt = now + SCENE_RENDER_INTERVAL_MS;
  }
  if (now >= nextPresentAt) {
    postFx.present(now / 1000);
    nextPresentAt = now + PRESENT_INTERVAL_MS;
  }
}

ui.updateObjective(state);
requestAnimationFrame(animate);

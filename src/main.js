import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { createMaterials } from "./game/materials.js";
import { createApartment } from "./game/world.js";
import { createPlayerController } from "./game/player.js";
import { createUI } from "./game/ui.js";
import { bindInput } from "./game/input.js";

const mount = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x25231f);
scene.fog = new THREE.Fog(0x25231f, 12, 29);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 70);
camera.rotation.order = "YXZ";

const LOW_POWER = matchMedia("(pointer:coarse)").matches;
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = !LOW_POWER;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.id = "screenCanvas";
renderer.domElement.tabIndex = 0;
mount.appendChild(renderer.domElement);

function resize() {
  const width = Math.max(240, Math.floor(innerWidth / 3.2));
  const height = Math.max(150, Math.floor(innerHeight / 3.2));
  renderer.setSize(width, height, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const state = {
  hasKeys: false,
  doorOpen: false,
  finished: false,
  started: false,
  paused: false
};
const ui = createUI();
const { M, mat } = createMaterials(THREE);
const world = createApartment({ THREE, scene, M, mat, LOW_POWER, state, ui });
const controller = createPlayerController({
  camera,
  colliders: world.colliders,
  interactables: world.interactables,
  state,
  ui
});
bindInput({ renderer, state, controller, ui });

const clockStart = performance.now();
let previous = clockStart;

function animate(now) {
  requestAnimationFrame(animate);
  const deltaTime = Math.min((now - previous) / 1000, 0.04);
  previous = now;

  const nearest = controller.update(deltaTime);
  for (const item of world.meshesToAnimate) {
    item.object.position.y = item.baseY + Math.sin(now * 0.002 + item.phase) * 0.045;
    item.object.rotation.y = 0.45 + Math.sin(now * 0.001) * 0.18;
  }

  ui.setInteraction(nearest, state);
  ui.tick(now, clockStart);
  renderer.render(scene, camera);
}

ui.updateObjective(state);
requestAnimationFrame(animate);

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { createMaterials } from "./game/materials.js";
import { createApartment } from "./game/world.js";
import { createPlayerController } from "./game/player.js";
import { createUI } from "./game/ui.js";
import { bindInput } from "./game/input.js";

const mount = document.getElementById("game");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x25231f);

// Render the supplied image as real scene geometry, not only as a renderer clear color.
// This makes the city image visible through window openings and around the apartment.
const panorama = { mesh: null };
new THREE.TextureLoader().load(
  new URL("../assets/bg-scene-hq.png", import.meta.url).href,
  texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      toneMapped: false
    });
    panorama.mesh = new THREE.Mesh(new THREE.SphereGeometry(48, 48, 32), skyMaterial);
    panorama.mesh.name = "HQ sky image background";
    panorama.mesh.renderOrder = -1000;
    scene.add(panorama.mesh);
  },
  undefined,
  error => console.error("The Flat: assets/bg-scene-hq.png sky background failed to load.", error)
);
scene.fog = new THREE.Fog(0x34343b, 12, 30);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 70);
camera.rotation.order = "YXZ";

const LOW_POWER = matchMedia("(pointer:coarse)").matches;
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(1);
renderer.domElement.style.imageRendering = "pixelated";
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.shadowMap.autoUpdate = true;
// Very subtle analog-like frame persistence for motion, kept deliberately restrained.
renderer.domElement.style.filter = 'contrast(1.06) saturate(1.04)';
renderer.toneMappingExposure = 1.12;
renderer.domElement.id = "screenCanvas";
renderer.domElement.tabIndex = 0;
mount.appendChild(renderer.domElement);

function resize() {
  const pixelScale = LOW_POWER ? 3.4 : 3.05;
  const width = Math.max(200, Math.floor(innerWidth / pixelScale));
  const height = Math.max(125, Math.floor(innerHeight / pixelScale));
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
  paused: false,
  balconyDoorOpen: false
};
const ui = createUI();
const { M, mat } = createMaterials(THREE);
const world = createApartment({ THREE, scene, M, mat, LOW_POWER, state, ui });
// Low-resolution shadow maps preserve the pixel-art look while adding readable contact shadows.
scene.traverse(object => {
  if (object.isLight && object.castShadow) {
    object.shadow.mapSize.set(LOW_POWER ? 192 : 384, LOW_POWER ? 192 : 384);
    object.shadow.bias = -0.00035;
    object.shadow.normalBias = 0.025;
    object.shadow.radius = 0;
  }
});
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
  // Cinematic hinge easing with smooth acceleration/deceleration; collision stays disabled while open.
  for (const door of world.doorAnimations) {
    const target = door.targetOpen ? 1 : 0;
    door.progress += (target - door.progress) * (1 - Math.exp(-deltaTime * 5.5));
    if (Math.abs(target - door.progress) < 0.002) door.progress = target;
    const eased = door.progress * door.progress * (3 - 2 * door.progress);
    door.pivot.rotation.y = door.closedRotation + (door.openRotation - door.closedRotation) * eased;
    if (!door.targetOpen && door.progress < 0.9 && door.closedBounds) {
      Object.assign(door.collider, door.closedBounds);
    } else if (door.targetOpen) {
      door.collider.minX = 30; door.collider.maxX = 31;
    }
  }
  // Subtle per-object luminance shimmer: tiny, slow, phase-shifted so the room feels
  // like a worn PS1/CRT capture rather than a visibly vibrating scene.
  const shimmer = 0.012 + Math.sin(now * 0.0017) * 0.004;
  if (!scene.userData.shimmerMaterials) {
    const mats = new Set();
    scene.traverse(object => {
      if (!object.isMesh || object.name === "HQ sky image background") return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (material && material.color && !mats.has(material)) {
          mats.add(material);
          if (material.emissive) {
            material.userData.baseEmissiveIntensity = material.emissiveIntensity;
            material.userData.shimmerPhase = (object.id % 17) * 0.37;
          }
        }
      }
    });
    scene.userData.shimmerMaterials = [...mats].filter(material => material.emissive);
  }
  for (const material of scene.userData.shimmerMaterials) {
    const phase = material.userData.shimmerPhase || 0;
    material.emissiveIntensity = (material.userData.baseEmissiveIntensity || 0) + shimmer * (0.5 + 0.5 * Math.sin(now * 0.0022 + phase));
  }
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

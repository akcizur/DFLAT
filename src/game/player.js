// First-person movement, collision handling, proximity and camera synchronization.
export function createPlayerController({ camera, colliders, interactables, state, ui }) {
  // Spawn outdoors, facing the main building. Floor changes are handled by the stair/lift core.
  const FLOOR_HEIGHT = 2.8;
  const MAX_FLOOR = 7;
  const player = { x: 0, z: 9.2, floor: 0, yaw: Math.PI * 0.02, pitch: -0.04, speed: 2.65, radius: 0.29 };
  camera.position.set(player.x, 1.68, player.z);
  camera.rotation.order = "YXZ";
  let walkTime = 0;
  let cameraYaw = player.yaw, cameraPitch = player.pitch;
  let walkBlend = 0;
  let cameraX = player.x, cameraY = 1.68, cameraZ = player.z;

  const keysDown = Object.create(null);

  function canMove(nx, nz) {
    const r = player.radius;
    for (const c of colliders) {
      if (Number.isInteger(c.floor) && c.floor !== player.floor) continue;
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) return false;
    }
    return true;
  }

  function movePlayer(dx, dz) {
    const nx = player.x + dx;
    const nz = player.z + dz;
    // Test axes separately so the player can slide along furniture and walls.
    if (canMove(nx, player.z)) player.x = nx;
    if (canMove(player.x, nz)) player.z = nz;
  }

  function nearestInteractable() {
    let found = null;
    let best = Infinity;
    for (const item of interactables) {
      if (item.id === "keys" && state.hasKeys) continue;
      const distance = Math.hypot(item.x - player.x, item.z - player.z);
      if (distance < item.range && distance < best) {
        found = item;
        best = distance;
      }
    }
    return found;
  }

  function doInteract() {
    const item = nearestInteractable();
    if (!item) {
      ui.showToast(state.mainBuildingScene ? "Volná mapa / hlavní budova." : "Nic zajímavého na dosah.");
      return;
    }
    item.action();
  }

  function syncCamera(deltaTime = 1 / 60) {
    // Eased first-person follow plus restrained head bob while actually moving.
    const desiredMoving = state.started && !state.paused &&
      (Math.abs(player.x - cameraX) + Math.abs(player.z - cameraZ) > 0.0005 ||
       Object.values(keysDown).some(Boolean));
    const blend = 1 - Math.exp(-deltaTime * 18);
    walkBlend += ((desiredMoving ? 1 : 0) - walkBlend) * (1 - Math.exp(-deltaTime * 3.2));
    if (desiredMoving) walkTime += deltaTime * 7.2;
    const bob = Math.sin(walkTime) * 0.012 * walkBlend;
    const sway = Math.sin(walkTime * 0.42) * 0.004 * walkBlend;
    const targetX = player.x + Math.cos(player.yaw) * sway;
    const targetY = player.floor * FLOOR_HEIGHT + 1.68 + bob;
    const targetZ = player.z - Math.sin(player.yaw) * sway;
    cameraX += (targetX - cameraX) * blend;
    cameraY += (targetY - cameraY) * blend;
    cameraZ += (targetZ - cameraZ) * blend;
    camera.position.set(cameraX, cameraY, cameraZ);
    camera.rotation.order = "YXZ";
    const lookBlend = 1;
    let yawDelta = player.yaw - cameraYaw;
    yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
    cameraYaw += yawDelta * lookBlend;
    cameraPitch += (player.pitch - cameraPitch) * lookBlend;
    camera.rotation.y = cameraYaw;
    camera.rotation.x = cameraPitch;
    camera.rotation.z = 0;
  }

  function update(deltaTime) {
    if (state.started && !state.paused) {
      let forward = 0;
      let strafe = 0;
      if (keysDown.KeyW || keysDown.ArrowUp) forward += 1;
      if (keysDown.KeyS || keysDown.ArrowDown) forward -= 1;
      if (keysDown.KeyD || keysDown.ArrowRight) strafe += 1;
      if (keysDown.KeyA || keysDown.ArrowLeft) strafe -= 1;

      const length = Math.hypot(forward, strafe);
      if (length > 0) { forward /= length; strafe /= length; }
      const dx = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) * player.speed * deltaTime;
      const dz = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * strafe) * player.speed * deltaTime;
      movePlayer(dx, dz);
    }

    syncCamera(deltaTime);
    return nearestInteractable();
  }

  function goToFloor(floor, method = "Výtah") {
    const nextFloor = Math.max(0, Math.min(MAX_FLOOR, Math.round(floor)));
    player.floor = nextFloor;
    player.x = method === "Schodiště" ? -1.8 : 2.2;
    player.z = -21.35;
    state.currentFloor = nextFloor;
    cameraX = player.x;
    cameraZ = player.z;
    syncCamera(1 / 30);
    ui.updateObjective(state);
    ui.showToast(method + ": " + (nextFloor + 1) + ". patro");
  }

  return { player, keysDown, doInteract, update, syncCamera, goToFloor };
}

// First-person movement, collision handling, proximity and camera synchronization.
export function createPlayerController({ camera, colliders, interactables, state, ui }) {
  const player = { x: 0, z: 4.95, yaw: Math.PI * 0.02, pitch: -0.04, speed: 3.45, radius: 0.29 };
  camera.position.set(player.x, 1.68, player.z);
  camera.rotation.order = "YXZ";
  let walkTime = 0;
  let walkBlend = 0;

  const keysDown = Object.create(null);

  function canMove(nx, nz) {
    const r = player.radius;
    for (const c of colliders) {
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
      ui.showToast("Nic zajímavého na dosah.");
      return;
    }
    item.action();
  }

  function syncCamera() {
    // Gentle player-like head sway: fades smoothly when movement starts/stops.
    const moving = Object.values(keysDown).some(Boolean) && state.started && !state.paused;
    walkBlend += ((moving ? 1 : 0) - walkBlend) * 0.12;
    if (moving) walkTime += 0.12;
    const bob = Math.sin(walkTime) * 0.035 * walkBlend;
    const sway = Math.sin(walkTime * 0.5) * 0.012 * walkBlend;
    camera.position.set(player.x + Math.cos(player.yaw) * sway, 1.68 + bob, player.z - Math.sin(player.yaw) * sway);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
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

      if (forward || strafe) {
        const length = Math.hypot(forward, strafe);
        forward /= length;
        strafe /= length;
        const dx = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) * player.speed * deltaTime;
        const dz = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * strafe) * player.speed * deltaTime;
        movePlayer(dx, dz);
      }
    }

    syncCamera();
    return nearestInteractable();
  }

  return { player, keysDown, doInteract, update, syncCamera };
}

// First-person movement, collision handling, proximity and camera synchronization.
export function createPlayerController({ camera, colliders, interactables, state, ui, navigation = null }) {

  const WALK_SPEED = 3.6;
  const RUN_MULTIPLIER = 1.8;
  const JUMP_SPEED = 5.4;
  const GRAVITY = 18.5;
  const movementCodes = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const player = {
    x: 0, z: 9.2, elevation: 0,
    yaw: Math.PI * 0.02, pitch: -0.04,
    speed: WALK_SPEED, radius: 0.29, jumpHeight: 0
  };
  let jumpVelocity = 0;
  camera.position.set(player.x, player.elevation + 1.68, player.z);
  camera.rotation.order = "YXZ";
  let walkTime = 0;
  let breathTime = 0;
  let cameraYaw = player.yaw, cameraPitch = player.pitch;
  let walkBlend = 0;
  let bodySpeed = 0;
  let forwardIntent = 0;
  let strafeIntent = 0;
  let isRunning = false;
  let bodyLean = 0;
  let bodyRoll = 0;
  let cameraMode = "first";

  let cameraX = player.x, cameraY = 1.68, cameraZ = player.z;

  const keysDown = Object.create(null);

  function canMove(nx, nz) {
    const r = player.radius;
    for (const c of colliders) {
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) return false;
    }
    return true;
  }

  // Open-world navigation: no storeys, stairs, elevators or architectural walls.
  function tryMoveTo(x, z) {
    if (!canMove(x, z)) return false;
    player.x = x;
    player.z = z;
    if (!state.vehicleMode) player.elevation = 0;
    return true;
  }

  function movePlayer(dx, dz) {
    if (Math.abs(dx) > 0) tryMoveTo(player.x + dx, player.z);
    if (Math.abs(dz) > 0) tryMoveTo(player.x, player.z + dz);
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
      ui.showToast("Prázdná mapa. Nic k interakci.");
      return;
    }
    item.action();
  }

  function syncCamera(deltaTime = 1 / 60) {
    // A quiet idle breath, grounded footstep cadence, and small body lean make
    // the first-person stance feel inhabited without adding a nauseating camera shake.
    const desiredMoving = state.started && !state.paused && bodySpeed > 0.06;
    const blend = 1 - Math.exp(-deltaTime * 18);
    const settle = 1 - Math.exp(-deltaTime * 5.5);

    walkBlend += ((desiredMoving ? 1 : 0) - walkBlend) *
      (1 - Math.exp(-deltaTime * 3.2));
    breathTime += deltaTime;
    if (desiredMoving) walkTime += deltaTime * (isRunning ? 10.4 : 7.2);

    const targetLean = desiredMoving
      ? (forwardIntent > 0 ? (isRunning ? 0.052 : 0.022) : forwardIntent < 0 ? -0.012 : 0)
      : 0;
    const targetRoll = desiredMoving ? -strafeIntent * (isRunning ? 0.042 : 0.026) : 0;
    bodyLean += (targetLean - bodyLean) * settle;
    bodyRoll += (targetRoll - bodyRoll) * settle;


    // Slow breathing remains visible when idle. Steps are firmer when running,
    // while the camera follows real foot elevation rather than snapping by floor.
    const breathing = Math.sin(breathTime * 1.35) * 0.008;
    const bobAmplitude = isRunning ? 0.017 : 0.010;
    const bob = Math.sin(walkTime * 1.65) * bobAmplitude * walkBlend;
    const sway = Math.sin(walkTime * 0.5) * 0.0035 * walkBlend;
    const thirdPerson = cameraMode === "third";
    const cameraDistance = state.vehicleMode ? 6.5 : 4.2;
    const targetX = thirdPerson ? player.x + Math.sin(player.yaw) * cameraDistance : player.x + Math.cos(player.yaw) * sway;
    const targetY = player.elevation + (thirdPerson ? (state.vehicleType === "flying" ? 3.8 : 2.8) : 1.68 + player.jumpHeight + breathing + bob);
    const targetZ = thirdPerson ? player.z + Math.cos(player.yaw) * cameraDistance : player.z - Math.sin(player.yaw) * sway;
    cameraX += (targetX - cameraX) * blend;
    cameraY += (targetY - cameraY) * blend;
    cameraZ += (targetZ - cameraZ) * blend;
    camera.position.set(cameraX, cameraY, cameraZ);

    camera.rotation.order = "YXZ";
    if (thirdPerson) {
      camera.lookAt(player.x, player.elevation + (state.vehicleMode ? 0.8 : 1.2), player.z);
      cameraYaw = camera.rotation.y;
      cameraPitch = camera.rotation.x;
      return;
    }
    let yawDelta = player.yaw - cameraYaw;
    yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
    cameraYaw += yawDelta;
    cameraPitch += (player.pitch - cameraPitch);
    camera.rotation.y = cameraYaw;
    camera.rotation.x = Math.max(-1.35, Math.min(1.35, cameraPitch + bodyLean * 0.60));
    camera.rotation.z = bodyRoll;
  }

  function update(deltaTime) {
    const previousX = player.x;
    const previousZ = player.z;
    forwardIntent = 0;
    strafeIntent = 0;
    isRunning = false;
    bodySpeed = 0;

    if (state.started && !state.paused) {
      let forward = 0;
      let strafe = 0;
      if (keysDown.KeyW || keysDown.ArrowUp) forward += 1;
      if (keysDown.KeyS || keysDown.ArrowDown) forward -= 1;
      if (keysDown.KeyD || keysDown.ArrowRight) strafe += 1;
      if (keysDown.KeyA || keysDown.ArrowLeft) strafe -= 1;

      const length = Math.hypot(forward, strafe);
      if (length > 0) { forward /= length; strafe /= length; }
      forwardIntent = forward;
      strafeIntent = strafe;
      isRunning = Boolean(keysDown.ShiftLeft || keysDown.ShiftRight);
      const vehicleSpeed = state.vehicleMode ? (state.vehicleType === "car" ? 10 : state.vehicleType === "hover" ? 13 : 16) : player.speed;
      const moveSpeed = vehicleSpeed * (state.vehicleMode ? 1 : (isRunning ? RUN_MULTIPLIER : 1));
      const dx = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) * moveSpeed * deltaTime;
      const dz = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * strafe) * moveSpeed * deltaTime;
      movePlayer(dx, dz);
      bodySpeed = deltaTime > 0
        ? Math.hypot(player.x - previousX, player.z - previousZ) / deltaTime
        : 0;

      if (state.vehicleMode) {
        if (state.vehicleType === "car") player.elevation = 0;
        else if (state.vehicleType === "hover") player.elevation += (2.3 - player.elevation) * (1 - Math.exp(-deltaTime * 2.8));
        if (keysDown.ControlLeft || keysDown.ControlRight) player.elevation = Math.max(0.5, player.elevation - 7 * deltaTime);
      }

      // Lightweight vertical physics for a short, responsive jump. The floor stays authoritative.
      if (!state.vehicleMode && (player.jumpHeight > 0 || jumpVelocity > 0)) {
        jumpVelocity -= GRAVITY * deltaTime;
        player.jumpHeight += jumpVelocity * deltaTime;
        if (player.jumpHeight <= 0) {
          player.jumpHeight = 0;
          jumpVelocity = 0;
        }
      }
    }

    syncCamera(deltaTime);
    return nearestInteractable();
  }

  function jump() {
    if (!state.started || state.paused) return false;
    if (state.vehicleMode) {
      if (state.vehicleType === "flying") { player.elevation = Math.min(16, player.elevation + 2.5); return true; }
      if (state.vehicleType === "hover") { player.elevation = Math.min(4.5, player.elevation + 1.2); return true; }
      return false;
    }
    if (player.jumpHeight > 0 || jumpVelocity > 0) return false;
    jumpVelocity = JUMP_SPEED;
    return true;
  }

  function toggleCameraMode() {
    cameraMode = cameraMode === "first" ? "third" : "first";
    state.cameraMode = cameraMode;
    syncCamera(1 / 60);
    return cameraMode;
  }

  return {
    player, keysDown, doInteract, update, syncCamera, jump, toggleCameraMode,
    get cameraMode() { return cameraMode; },
    get isGrounded() { return player.jumpHeight === 0 && jumpVelocity <= 0; },
    get navigationHeight() { return player.elevation; }
  };
}

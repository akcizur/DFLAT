// First-person movement, collision handling, proximity and camera synchronization.
export function createPlayerController({ camera, colliders, interactables, state, ui, navigation = null }) {
  const FLOOR_HEIGHT = navigation?.floorHeight ?? 2.8;
  const FLOOR_COUNT = navigation?.floors ?? 8;
  const MAX_FLOOR = FLOOR_COUNT - 1;
  const coreOpening = navigation?.coreOpening ?? { minX: -3.8, maxX: 3.8, minZ: -26.0, maxZ: -22.35 };
  const stair = navigation?.stairs ?? {
    lowX: -3.2, highX: -0.8, firstZ: -25.1, secondZ: -23.1, steps: 8,
    stepRise: FLOOR_HEIGHT / 16, stepRun: 0.3, treadDepth: 1.16,
    landingWidth: 1.28, landingDepth: 3.1,
    landingCenterX: -0.16, landingCenterZ: -24.1
  };
  const MAX_STEP_HEIGHT = stair.stepRise + 0.045;
  const WALK_SPEED = 3.6;
  const RUN_MULTIPLIER = 1.8;
  const JUMP_SPEED = 5.4;
  const GRAVITY = 18.5;
  const movementCodes = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const player = {
    x: 0, z: 9.2, floor: 0, elevation: 0, onStairs: false,
    yaw: Math.PI * 0.02, pitch: -0.04,
    speed: WALK_SPEED, radius: 0.29, jumpHeight: 0
  };
  let jumpVelocity = 0;
  camera.position.set(player.x, player.elevation + 1.68, player.z);
  camera.rotation.order = "YXZ";
  let walkTime = 0;
  let cameraYaw = player.yaw, cameraPitch = player.pitch;
  let walkBlend = 0;
  let cameraX = player.x, cameraY = 1.68, cameraZ = player.z;

  const keysDown = Object.create(null);

  function canMove(nx, nz) {
    const r = player.radius;
    for (const c of colliders) {
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) return false;
    }
    return true;
  }

  function isInsideCore(x, z) {
    const margin = 0.12;
    return x > coreOpening.minX - margin && x < coreOpening.maxX + margin &&
      z > coreOpening.minZ - margin && z < coreOpening.maxZ + margin;
  }

  function stairSurfaceCandidates(x, z) {
    const candidates = [];
    const halfTread = stair.treadDepth / 2;
    const halfLanding = stair.landingDepth / 2;
    const landingMinX = stair.landingCenterX - stair.landingWidth / 2;
    const landingMaxX = stair.landingCenterX + stair.landingWidth / 2;
    const inLanding = x >= landingMinX - 0.04 && x <= landingMaxX + 0.04 &&
      z >= stair.landingCenterZ - halfLanding - 0.04 &&
      z <= stair.landingCenterZ + halfLanding + 0.04;
    const inLowerFlight = x >= stair.lowX - 0.04 && x <= stair.highX + 0.04 &&
      z >= stair.firstZ - halfTread - 0.04 &&
      z <= stair.firstZ + halfTread + 0.04;
    // Extend the uppermost tread's navigation envelope to the slab edge so the
    // player capsule can step cleanly from the last tread onto the upper floor.
    const upperFrontEdge = Math.max(stair.secondZ + halfTread, coreOpening.maxZ);
    const inUpperFlight = x >= stair.lowX - 0.04 && x <= stair.highX + 0.04 &&
      z >= stair.secondZ - halfTread - 0.04 &&
      z <= upperFrontEdge + 0.04;

    if (!inLanding && !inLowerFlight && !inUpperFlight) return candidates;

    for (let baseFloor = 0; baseFloor < FLOOR_COUNT - 1; baseFloor++) {
      const baseY = baseFloor * FLOOR_HEIGHT;
      if (inLowerFlight) {
        const progress = Math.max(0, Math.min(stair.steps,
          Math.ceil((x - stair.lowX) / stair.stepRun - 1e-6)));
        candidates.push({ height: baseY + progress * stair.stepRise, kind: "stair" });
      }
      if (inUpperFlight) {
        const progress = Math.max(0, Math.min(stair.steps,
          Math.ceil((stair.highX - x) / stair.stepRun - 1e-6)));
        candidates.push({
          height: baseY + FLOOR_HEIGHT / 2 + progress * stair.stepRise,
          kind: "stair"
        });
      }
      if (inLanding) candidates.push({ height: baseY + FLOOR_HEIGHT / 2, kind: "landing" });
    }
    return candidates;
  }

  function findSupportedHeight(x, z, fromElevation = player.elevation) {
    const candidates = stairSurfaceCandidates(x, z)
      .map(surface => ({ ...surface, delta: Math.abs(surface.height - fromElevation) }))
      .filter(surface => surface.delta <= MAX_STEP_HEIGHT)
      .sort((a, b) => a.delta - b.delta);

    if (candidates.length) return candidates[0];

    // Upper-storey slabs have a real stairwell void. If there is no step or
    // landing beneath the player, reject the move rather than allowing a fall
    // through the lift shaft or open core.
    if (isInsideCore(x, z)) {
      const groundY = 0;
      if (Math.abs(fromElevation - groundY) <= MAX_STEP_HEIGHT) {
        return { height: groundY, kind: "ground-floor-core" };
      }
      return null;
    }

    const nearestFloor = Math.max(0, Math.min(MAX_FLOOR, Math.round(fromElevation / FLOOR_HEIGHT)));
    const floorY = nearestFloor * FLOOR_HEIGHT;
    if (Math.abs(floorY - fromElevation) > MAX_STEP_HEIGHT) return null;
    return { height: floorY, kind: "floor" };
  }

  function syncFloorIndex() {
    const floor = Math.max(0, Math.min(MAX_FLOOR, Math.round(player.elevation / FLOOR_HEIGHT)));
    if (Math.abs(player.elevation - floor * FLOOR_HEIGHT) > 0.025 || floor === player.floor) return;
    player.floor = floor;
    state.currentFloor = floor;
    ui.updateObjective(state);
  }

  function tryMoveTo(x, z) {
    if (!canMove(x, z)) return false;
    const support = findSupportedHeight(x, z, player.elevation);
    if (!support) return false;
    player.x = x;
    player.z = z;
    player.elevation = support.height;
    player.onStairs = support.kind === "stair" || support.kind === "landing";
    syncFloorIndex();
    return true;
  }

  function movePlayer(dx, dz) {
    // Axis-separated movement preserves wall sliding while checking the floor
    // surface each time. Step elevation therefore follows the actual tread grid.
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
      ui.showToast(state.mainBuildingScene ? "Volná mapa / hlavní budova." : "Nic zajímavého na dosah.");
      return;
    }
    item.action();
  }

  function syncCamera(deltaTime = 1 / 60) {
    // Eased first-person follow plus restrained head bob while actually moving.
    const movementInput = movementCodes.some(code => keysDown[code]);
    const desiredMoving = state.started && !state.paused &&
      (Math.abs(player.x - cameraX) + Math.abs(player.z - cameraZ) > 0.0005 || movementInput);
    const blend = 1 - Math.exp(-deltaTime * 18);
    walkBlend += ((desiredMoving ? 1 : 0) - walkBlend) * (1 - Math.exp(-deltaTime * 3.2));
    if (desiredMoving) walkTime += deltaTime * 7.2;
    const bob = Math.sin(walkTime) * 0.012 * walkBlend;
    const sway = Math.sin(walkTime * 0.42) * 0.004 * walkBlend;
    const targetX = player.x + Math.cos(player.yaw) * sway;
    const targetY = player.elevation + 1.68 + player.jumpHeight + bob;
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
      const isRunning = Boolean(keysDown.ShiftLeft || keysDown.ShiftRight);
      const moveSpeed = player.speed * (isRunning ? RUN_MULTIPLIER : 1);
      const dx = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) * moveSpeed * deltaTime;
      const dz = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * strafe) * moveSpeed * deltaTime;
      movePlayer(dx, dz);

      // Lightweight vertical physics for a short, responsive jump. The floor stays authoritative.
      if (player.jumpHeight > 0 || jumpVelocity > 0) {
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
    if (!state.started || state.paused || player.jumpHeight > 0 || jumpVelocity > 0) return false;
    jumpVelocity = JUMP_SPEED;
    return true;
  }

  function goToFloor(floor, method = "Výtah") {
    const nextFloor = Math.max(0, Math.min(MAX_FLOOR, Math.round(floor)));
    player.floor = nextFloor;
    player.elevation = nextFloor * FLOOR_HEIGHT;
    player.onStairs = false;
    player.jumpHeight = 0;
    jumpVelocity = 0;
    player.x = method === "Schodiště" ? -1.8 : 2.2;
    player.z = -21.35;
    state.currentFloor = nextFloor;
    cameraX = player.x;
    cameraZ = player.z;
    syncCamera(1 / 30);
    ui.updateObjective(state);
    ui.showToast(method + ": " + (nextFloor + 1) + ". patro");
  }

  return {
    player, keysDown, doInteract, update, syncCamera, goToFloor, jump,
    get isGrounded() { return player.jumpHeight === 0 && jumpVelocity <= 0; },
    get navigationHeight() { return player.elevation; }
  };
}

// Keyboard, pointer lock and touch controls. No game-world logic lives here.
export function bindInput({ renderer, state, controller, ui, postFx }) {
  const { player, keysDown, doInteract } = controller;
  let touchLook = null;
  // Conservative defaults: roughly half the original mouse sensitivity.
  const lookSensitivity = {
    mouseX: 0.0010,
    mouseY: 0.0009,
    touchX: 0.0028,
    touchY: 0.0018
  };

  function lockPointer() {
    if (renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
  }

  function startGame() {
    if (state.started) return;
    state.started = true;
    const startScreen = document.getElementById("startScreen");
    startScreen.classList.add("transition-out");
    postFx?.triggerZoom(0.065);
    state.paused = false;
    ui.hidePause();
    renderer.domElement.focus();
    if (matchMedia("(pointer:fine)").matches) lockPointer();
    window.setTimeout(() => {
      ui.hideStart();
      startScreen.classList.remove("transition-out");
    }, 260);
  }

  function pauseGame() {
    if (!state.started || state.finished) return;
    state.paused = true;
    postFx?.triggerZoom(-0.035);
    ui.showPause();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function resumeGame() {
    postFx?.triggerZoom(0.025);
    state.paused = false;
    ui.hidePause();
    if (matchMedia("(pointer:fine)").matches) lockPointer();
  }

  document.getElementById("startButton").addEventListener("click", startGame);
  document.getElementById("resumeButton").addEventListener("click", resumeGame);
  document.getElementById("touchAction").addEventListener("click", doInteract);

  document.addEventListener("keydown", event => {
    if (event.code !== "Enter") return;
    if (ui.isStartVisible()) {
      event.preventDefault();
      startGame();
    } else if (state.paused) {
      event.preventDefault();
      resumeGame();
    }
  });

  renderer.domElement.addEventListener("click", () => {
    if (state.started && !state.paused && !document.pointerLockElement && matchMedia("(pointer:fine)").matches) {
      lockPointer();
    }
  });

  document.addEventListener("mousemove", event => {
    if (document.pointerLockElement === renderer.domElement && state.started && !state.paused) {
      player.yaw -= event.movementX * lookSensitivity.mouseX;
      player.pitch -= event.movementY * lookSensitivity.mouseY;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch));
    }
  });

  // Touch drag controls looking; the directional buttons control walking.
  renderer.domElement.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch" && state.started && !state.paused) {
      touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  });

  renderer.domElement.addEventListener("pointermove", event => {
    if (!touchLook || touchLook.id !== event.pointerId) return;
    const dx = event.clientX - touchLook.x;
    const dy = event.clientY - touchLook.y;
    player.yaw -= dx * lookSensitivity.touchX;
    player.pitch -= dy * lookSensitivity.touchY;
    player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch));
    touchLook.x = event.clientX;
    touchLook.y = event.clientY;
  });

  addEventListener("pointerup", event => {
    if (touchLook && touchLook.id === event.pointerId) touchLook = null;
  });

  addEventListener("keydown", event => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    if (event.code === "Escape" && state.started && !state.finished) {
      if (state.paused) resumeGame();
      else pauseGame();
      return;
    }
    keysDown[event.code] = true;
    if (event.code === "KeyE" && !event.repeat && state.started && !state.paused) doInteract();
  });

  addEventListener("keyup", event => { keysDown[event.code] = false; });

  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    const down = event => { event.preventDefault(); keysDown[code] = true; };
    const up = event => { event.preventDefault(); keysDown[code] = false; };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerleave", up);
  });

  addEventListener("blur", () => {
    for (const key in keysDown) keysDown[key] = false;
  });
}

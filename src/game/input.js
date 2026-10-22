// Keyboard, mouse, virtual touch remote and Gamepad API. Game-world logic stays in player.js.
export function bindInput({ renderer, state, controller, ui }) {
  const { player, keysDown, doInteract } = controller;
  const moveStick = document.getElementById("moveStick");
  const moveKnob = document.getElementById("moveKnob");
  const lookZone = document.getElementById("touchLookZone");
  const fullscreenButton = document.getElementById("fullscreenButton");
  let touchLook = null;
  let stickPointer = null;
  let previousGamepadButtons = [];
  let gamepadLabel = "";
  const sensitivity = { mouseX: 0.0010, mouseY: 0.0009, touchX: 0.0032, touchY: 0.0022, padLook: 2.2 };

  function lockPointer() {
    if (renderer.domElement.requestPointerLock) {
      const result = renderer.domElement.requestPointerLock();
      // Browsers may reject pointer lock asynchronously, especially on touch devices.
      if (result && typeof result.catch === "function") {
        result.catch(error => console.warn("The Flat: pointer lock was denied; gameplay remains active.", error));
      }
    }
  }
  const movementCodes = ["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
  const sources = { keyboard: Object.create(null), touch: Object.create(null), gamepad: Object.create(null) };
  function setKey(code, value, source = "keyboard") {
    if (!movementCodes.includes(code)) { keysDown[code] = Boolean(value); return; }
    sources[source][code] = Boolean(value);
    keysDown[code] = Boolean(sources.keyboard[code] || sources.touch[code] || sources.gamepad[code]);
  }
  function clearSource(source) { for (const code of movementCodes) setKey(code, false, source); }
  function clearMovement() { clearSource("keyboard"); clearSource("touch"); clearSource("gamepad"); }
  function startGame() {
    if (state.started) return;
    clearMovement();
    state.started = true;
    const startScreen = document.getElementById("startScreen");
    startScreen.classList.add("transition-out");
    state.paused = false;
    ui.hidePause();
    renderer.domElement.focus();
    // Keep keyboard focus after starting. Pointer lock is acquired only after a click
    // in the actual game canvas, so menu activation never steals the first movement input.
    window.setTimeout(() => {
      ui.hideStart();
      startScreen.classList.remove("transition-out");
    }, 260);
  }
  function pauseGame() {
    if (!state.started || state.finished) return;
    state.paused = true;
    clearMovement();
    ui.showPause();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function resumeGame() {
    if (!state.started || state.finished) return;
    state.paused = false;
    ui.hidePause();
    // Click the game canvas to reacquire mouse-look; keyboard movement remains active.
  }
  function togglePause() { state.paused ? resumeGame() : pauseGame(); }
  document.getElementById("startButton").addEventListener("click", startGame);
  document.getElementById("resumeButton").addEventListener("click", resumeGame);
  document.getElementById("touchAction").addEventListener("click", doInteract);
  document.getElementById("pauseButton").addEventListener("click", togglePause);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        const host = document.documentElement;
        if (host.requestFullscreen) await host.requestFullscreen();
        else if (renderer.domElement.requestFullscreen) await renderer.domElement.requestFullscreen();
        else document.body.classList.toggle("fullscreen-fallback");
      }
    } catch (error) {
      // iOS Safari and some embedded browsers do not expose the Fullscreen API.
      document.body.classList.toggle("fullscreen-fallback");
      ui.showToast("Režim celé obrazovky");
    }
  }
  fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    const active = Boolean(document.fullscreenElement || document.body.classList.contains("fullscreen-fallback"));
    fullscreenButton.setAttribute("aria-label", active ? "Ukončit celou obrazovku" : "Celá obrazovka");
    fullscreenButton.textContent = active ? "↙" : "⛶";
    window.dispatchEvent(new Event("resize"));
  });

  function onKeyDown(event) {
    const isMovementKey = movementCodes.includes(event.code);
    if (isMovementKey) {
      event.preventDefault();
      // Ignore movement input until gameplay is active, then use the same shared key map
      // as touch and gamepad so inputs cannot overwrite one another.
      setKey(event.code, state.started && !state.paused);
      return;
    }
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    if (event.code === "Escape" && state.started && !state.finished) {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      togglePause(); return;
    }
    if (event.code === "Enter" && ui.isStartVisible()) { event.preventDefault(); startGame(); return; }
    if (event.code === "Enter" && state.paused) { event.preventDefault(); resumeGame(); return; }
    setKey(event.code, true);
    if (event.code === "KeyE" && !event.repeat && state.started && !state.paused) doInteract();
  }
  function onKeyUp(event) {
    if (movementCodes.includes(event.code)) event.preventDefault();
    setKey(event.code, false);
  }
  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("keyup", onKeyUp, { capture: true });

  renderer.domElement.addEventListener("click", () => {
    if (state.started && !state.paused && !document.pointerLockElement && matchMedia("(pointer:fine)").matches) lockPointer();
  });
  document.addEventListener("mousemove", event => {
    if (document.pointerLockElement === renderer.domElement && state.started && !state.paused) {
      player.yaw -= event.movementX * sensitivity.mouseX;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - event.movementY * sensitivity.mouseY));
    }
  });

  // Left thumb: analog virtual stick. It writes the same keys as a physical keyboard.
  function updateStick(event) {
    const rect = moveStick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const radius = rect.width * 0.34;
    const dx = event.clientX - cx, dy = event.clientY - cy;
    const length = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / Math.max(radius, length), ny = dy / Math.max(radius, length);
    moveKnob.style.transform = `translate(calc(-50% + ${nx * radius}px), calc(-50% + ${ny * radius}px))`;
    const x = dx / radius, y = dy / radius;
    setKey("KeyW", y < -0.22, "touch"); setKey("KeyS", y > 0.22, "touch");
    setKey("KeyA", x < -0.22, "touch"); setKey("KeyD", x > 0.22, "touch");
  }
  function releaseStick(event) {
    if (!stickPointer || (event && event.pointerId !== stickPointer)) return;
    stickPointer = null;
    clearSource("touch");
    moveKnob.style.transform = "translate(-50%, -50%)";
    moveStick.classList.remove("active");
  }
  moveStick.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || !state.started || state.paused) return;
    event.preventDefault(); stickPointer = event.pointerId;
    moveStick.setPointerCapture?.(event.pointerId);
    moveStick.classList.add("active"); updateStick(event);
  });
  moveStick.addEventListener("pointermove", event => { if (event.pointerId === stickPointer) { event.preventDefault(); updateStick(event); } });
  moveStick.addEventListener("pointerup", releaseStick);
  moveStick.addEventListener("pointercancel", releaseStick);
  moveStick.addEventListener("lostpointercapture", releaseStick);

  // Right thumb: drag to look. A window-level move listener allows smooth movement at zone edges.
  lookZone.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || !state.started || state.paused) return;
    event.preventDefault();
    touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
    lookZone.setPointerCapture?.(event.pointerId);
    lookZone.classList.add("active");
  });
  lookZone.addEventListener("pointermove", event => {
    if (!touchLook || touchLook.id !== event.pointerId) return;
    event.preventDefault();
    player.yaw -= (event.clientX - touchLook.x) * sensitivity.touchX;
    player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - (event.clientY - touchLook.y) * sensitivity.touchY));
    touchLook.x = event.clientX; touchLook.y = event.clientY;
  });
  function endLook(event) {
    if (touchLook && (!event || touchLook.id === event.pointerId)) { touchLook = null; lookZone.classList.remove("active"); }
  }
  lookZone.addEventListener("pointerup", endLook);
  lookZone.addEventListener("pointercancel", endLook);
  lookZone.addEventListener("lostpointercapture", endLook);

  // Legacy direction buttons remain supported for accessibility and external layouts.
  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    const down = event => { event.preventDefault(); setKey(code, true, "touch"); };
    const up = event => { event.preventDefault(); setKey(code, false, "touch"); };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerleave", up);
  });

  window.addEventListener("gamepadconnected", event => {
    gamepadLabel = event.gamepad.id || "Gamepad";
    ui.showToast("Ovladač připojen: " + gamepadLabel.slice(0, 34));
  });
  window.addEventListener("gamepaddisconnected", () => {
    gamepadLabel = ""; previousGamepadButtons = [];
    ui.showToast("Ovladač odpojen.");
    clearMovement();
  });

  // Poll at display rate; edge-triggered buttons avoid repeated actions while held.
  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find(item => item?.connected);
    if (pad && state.started && !state.paused) {
      const dead = value => Math.abs(value || 0) < 0.16 ? 0 : Math.sign(value) * ((Math.abs(value) - 0.16) / 0.84);
      const lx = dead(pad.axes[0]), ly = dead(pad.axes[1]);
      setKey("KeyW", ly < -0.2, "gamepad"); setKey("KeyS", ly > 0.2, "gamepad");
      setKey("KeyA", lx < -0.2, "gamepad"); setKey("KeyD", lx > 0.2, "gamepad");
      const rx = dead(pad.axes[2]), ry = dead(pad.axes[3]);
      player.yaw -= rx * sensitivity.padLook / 60;
      player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch + ry * sensitivity.padLook / 60));
    } else if (!stickPointer) clearMovement();

    if (pad) {
      const pressed = index => Boolean(pad.buttons[index]?.pressed);
      const edge = index => pressed(index) && !previousGamepadButtons[index];
      if (edge(0)) {
        if (ui.isStartVisible()) startGame();
        else if (state.paused) resumeGame();
        else if (!state.finished) doInteract();
      }
      if (edge(1)) togglePause();
      if (edge(9)) togglePause();
      previousGamepadButtons = pad.buttons.map(button => button.pressed);
    } else previousGamepadButtons = [];
    requestAnimationFrame(pollGamepad);
  }
  requestAnimationFrame(pollGamepad);

  window.addEventListener("blur", () => {
    clearMovement(); releaseStick(); endLook();
  });
}

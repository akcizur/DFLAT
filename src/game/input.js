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
  let touchLookDx = 0;
  let touchLookDy = 0;
  const sensitivity = { mouseX: 0.0010, mouseY: 0.0009, touchX: 0.0030, touchY: 0.0020, padLook: 2.2 };
  let resetTouchActions = () => {};

  function createTouchRemote() {
    if (document.getElementById("touchRemoteCluster")) return;
    const cluster = document.createElement("div");
    cluster.id = "touchRemoteCluster";
    cluster.className = "touch-remote-cluster";
    cluster.setAttribute("aria-label", "Mobilní ovládání");
    cluster.innerHTML = `
      <button class="touch-remote-btn is-interact" type="button" data-touch-action="interact">E</button>
      <button class="touch-remote-btn" type="button" data-touch-action="jump">JUMP</button>
      <button class="touch-remote-btn" type="button" data-touch-action="run">RUN</button>
      <button class="touch-remote-btn" type="button" data-touch-action="pause">Ⅱ</button>`;
    document.body.appendChild(cluster);

    const button = action => cluster.querySelector(`[data-touch-action="${action}"]`);
    const bindTap = (action, callback) => {
      const target = button(action);
      target?.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse" || !state.started || state.paused) return;
        event.preventDefault();
        try { target.setPointerCapture(event.pointerId); } catch {}
        callback();
      });
    };
    bindTap("interact", doInteract);
    bindTap("jump", () => controller.jump?.());

    const runButton = button("run");
    const runPointers = new Set();
    const releaseRun = event => {
      if (event && !runPointers.has(event.pointerId)) return;
      if (event) runPointers.delete(event.pointerId);
      else runPointers.clear();
      setKey("ShiftLeft", runPointers.size > 0, "touchButtons");
      runButton?.classList.toggle("is-held", runPointers.size > 0);
    };
    runButton?.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || !state.started || state.paused) return;
      event.preventDefault();
      runPointers.add(event.pointerId);
      setKey("ShiftLeft", true, "touchButtons");
      runButton.classList.add("is-held");
      try { runButton.setPointerCapture(event.pointerId); } catch {}
    });
    runButton?.addEventListener("pointerup", releaseRun);
    runButton?.addEventListener("pointercancel", releaseRun);
    runButton?.addEventListener("lostpointercapture", releaseRun);
    resetTouchActions = () => {
      runPointers.clear();
      setKey("ShiftLeft", false, "touchButtons");
      runButton?.classList.remove("is-held");
      cluster.querySelectorAll("[data-key].is-held").forEach(element => element.classList.remove("is-held"));
    };
    button("pause")?.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      togglePause();
    });
  }
  createTouchRemote();

  function lockPointer() {
    if (renderer.domElement.requestPointerLock) {
      const result = renderer.domElement.requestPointerLock();
      if (result && typeof result.catch === "function") {
        result.catch(error => console.warn("The Flat: pointer lock was denied; gameplay remains active.", error));
      }
    }
  }
  const movementCodes = ["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
  // Every held input is source-aware. Releasing one touch must never cancel another.
  const sources = {
    keyboard: Object.create(null),
    touchStick: Object.create(null),
    touchButtons: Object.create(null),
    gamepad: Object.create(null)
  };
  const knownCodes = new Set([...movementCodes, "ShiftLeft", "ShiftRight", "Space"]);
  function setKey(code, value, source = "keyboard") {
    if (!sources[source]) sources[source] = Object.create(null);
    knownCodes.add(code);
    sources[source][code] = Boolean(value);
    keysDown[code] = Object.values(sources).some(sourceKeys => Boolean(sourceKeys[code]));
  }
  function clearSource(source) {
    const sourceKeys = sources[source];
    if (!sourceKeys) return;
    for (const code of Object.keys(sourceKeys)) {
      sourceKeys[code] = false;
      keysDown[code] = Object.values(sources).some(entry => Boolean(entry[code]));
    }
  }
  function clearMovement() {
    for (const source of Object.keys(sources)) clearSource(source);
    for (const code of knownCodes) keysDown[code] = false;
    keysDown.ShiftLeft = false;
    keysDown.ShiftRight = false;
    keysDown.Space = false;
    document.querySelector('[data-touch-action="run"]')?.classList.remove("is-held");
    document.querySelectorAll("[data-key].is-held").forEach(button => button.classList.remove("is-held"));
    resetTouchActions();
    releaseStick();
    endLook();
  }
  function startGame() {
    if (state.started || !state.ready) return;
    clearMovement();
    state.started = true;
    const startScreen = document.getElementById("startScreen");
    startScreen.classList.add("transition-out");
    state.paused = false;
    ui.hidePause();
    renderer.domElement.focus();
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
    const modelLibrary = document.getElementById("modelLibraryScreen");
    if (event.code === "Escape" && modelLibrary && !modelLibrary.hidden) {
      event.preventDefault();
      document.getElementById("modelLibraryClose")?.click();
      return;
    }
    const target = event.target;
    if (target instanceof Element && (target.matches("input, textarea, select") || target.isContentEditable)) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat && state.started && !state.paused) controller.jump?.();
      return;
    }
    const isMovementKey = movementCodes.includes(event.code);
    if (isMovementKey) {
      event.preventDefault();
      setKey(event.code, state.started && !state.paused);
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    if (event.code === "Escape" && state.started && !state.finished) {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      togglePause(); return;
    }
    if (event.code === "Enter" && ui.isStartVisible()) { event.preventDefault(); startGame(); return; }
    if (event.code === "Enter" && state.paused) { event.preventDefault(); resumeGame(); return; }
    if (event.code === "KeyM" && !event.repeat) {
      event.preventDefault();
      document.getElementById("modelLibraryButton")?.click();
      return;
    }
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

  // Left thumb: analog virtual stick with a larger usable travel area and a dead zone.
  function updateStick(event) {
    const rect = moveStick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.34;
    const dx = event.clientX - cx, dy = event.clientY - cy;
    const length = Math.hypot(dx, dy);
    const nx = length > radius ? dx / length : dx / Math.max(radius, 1);
    const ny = length > radius ? dy / length : dy / Math.max(radius, 1);
    const px = Math.max(-radius, Math.min(radius, dx));
    const py = Math.max(-radius, Math.min(radius, dy));
    moveKnob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    const x = dx / Math.max(radius, 1), y = dy / Math.max(radius, 1);
    const dead = 0.18;
    setKey("KeyW", y < -dead, "touchStick"); setKey("KeyS", y > dead, "touchStick");
    setKey("KeyA", x < -dead, "touchStick"); setKey("KeyD", x > dead, "touchStick");
    moveStick.style.setProperty("--stick-x", `${nx * 100}%`);
    moveStick.style.setProperty("--stick-y", `${ny * 100}%`);
  }
  function releaseStick(event) {
    if (!stickPointer || (event && event.pointerId !== stickPointer)) return;
    const pointerId = stickPointer;
    stickPointer = null;
    try {
      if (moveStick.hasPointerCapture?.(pointerId)) moveStick.releasePointerCapture(pointerId);
    } catch {}
    clearSource("touchStick");
    moveKnob.style.transform = "translate(-50%, -50%)";
    moveStick.classList.remove("active");
  }
  moveStick.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || !state.started || state.paused || stickPointer !== null) return;
    event.preventDefault(); stickPointer = event.pointerId;
    moveStick.setPointerCapture?.(event.pointerId);
    moveStick.classList.add("active"); updateStick(event);
  });
  moveStick.addEventListener("pointermove", event => { if (event.pointerId === stickPointer) { event.preventDefault(); updateStick(event); } });
  moveStick.addEventListener("pointerup", releaseStick);
  moveStick.addEventListener("pointercancel", releaseStick);
  moveStick.addEventListener("lostpointercapture", releaseStick);

  // Right thumb: drag to look. Accumulate deltas and apply them once per frame to remove jitter.
  lookZone.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || !state.started || state.paused || touchLook) return;
    event.preventDefault();
    touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
    touchLookDx = 0; touchLookDy = 0;
    try { lookZone.setPointerCapture(event.pointerId); } catch {}
    lookZone.classList.add("active");
  });
  lookZone.addEventListener("pointermove", event => {
    if (!touchLook || touchLook.id !== event.pointerId) return;
    event.preventDefault();
    touchLookDx += event.clientX - touchLook.x;
    touchLookDy += event.clientY - touchLook.y;
    touchLook.x = event.clientX; touchLook.y = event.clientY;
  });
  function endLook(event) {
    if (touchLook && (!event || touchLook.id === event.pointerId)) {
      const pointerId = touchLook.id;
      touchLook = null; touchLookDx = 0; touchLookDy = 0; lookZone.classList.remove("active");
      try {
        if (lookZone.hasPointerCapture?.(pointerId)) lookZone.releasePointerCapture(pointerId);
      } catch {}
    }
  }
  lookZone.addEventListener("pointerup", endLook);
  lookZone.addEventListener("pointercancel", endLook);
  lookZone.addEventListener("lostpointercapture", endLook);
  function pollTouchLook() {
    if (touchLook && state.started && !state.paused) {
      player.yaw -= touchLookDx * sensitivity.touchX;
      player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - touchLookDy * sensitivity.touchY));
      touchLookDx *= 0.22;
      touchLookDy *= 0.22;
    } else { touchLookDx = 0; touchLookDy = 0; }
    requestAnimationFrame(pollTouchLook);
  }
  requestAnimationFrame(pollTouchLook);

  document.querySelectorAll("[data-key]").forEach(button => {
    const code = button.dataset.key;
    const down = event => {
      if (event.pointerType === "mouse" || !state.started || state.paused) return;
      event.preventDefault();
      setKey(code, true, "touchButtons");
      button.classList.add("is-held");
      try { button.setPointerCapture(event.pointerId); } catch {}
    };
    const up = event => {
      event.preventDefault();
      setKey(code, false, "touchButtons");
      button.classList.remove("is-held");
    };
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
    clearSource("gamepad");
  });

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
    } else clearSource("gamepad");
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

  function resetTransientInput() {
    clearMovement();
    releaseStick();
    endLook();
  }
  window.addEventListener("blur", resetTransientInput);
  window.addEventListener("pagehide", resetTransientInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetTransientInput();
  });
}

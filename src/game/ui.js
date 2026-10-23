// DOM-only user interface: overlays, objectives, feedback and in-game clock.
export function createUI() {
  const startScreen = document.getElementById("startScreen");
  const pauseScreen = document.getElementById("pauseScreen");
  const interactionEl = document.getElementById("interaction");
  const toastEl = document.getElementById("toast");
  const objectiveText = document.getElementById("objectiveText");
  const inventoryText = document.getElementById("inventoryText");
  const clockEl = document.getElementById("clock");
  let lastToast = 0;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    lastToast = performance.now();
  }

  function updateObjective(state) {
    if (state.mainBuildingScene) {
      const floor = Math.max(0, Math.min(3, Number(state.currentFloor) || 0));
      objectiveText.textContent = "Panelák T06B. Prozkoumej čtyři podlaží, schodiště a lodžie.";
      inventoryText.textContent = "PODLAŽÍ: " + (floor + 1) + " / 4";
      return;
    }
    if (state.emptyMap) {
      objectiveText.textContent = "Holobyt: zatím bez nábytku a úkolů.";
      inventoryText.textContent = "MAPA: HOLOBYT";
      return;
    }
    if (state.finished) {
      objectiveText.textContent = "Hotovo. Můžeš pokračovat ven.";
      inventoryText.textContent = "ÚKOL: DOKONČEN";
      return;
    }

    objectiveText.textContent = state.doorOpen
      ? "Otevři dveře a vyjdi z bytu."
      : state.hasKeys
        ? "Vrať se ke vstupním dveřím."
        : "Prozkoumej byt. Najdi klíče.";
    inventoryText.textContent = "KLÍČE: " + (state.hasKeys ? "SEBRÁNY" : "—");
  }

  function completeGame(state) {
    if (state.finished) return;
    state.finished = true;
    objectiveText.textContent = "Vyšel jsi na chodbu.";
    inventoryText.textContent = "EPIZODA 01 / DOKONČENO";
    showToast("KONEC EPIZODY 01 — Díky, že jsi byl doma.");
  }

  function setInteraction(item, state) {
    if (state.started && !state.paused && item) {
      interactionEl.innerHTML = "<b>E</b> — " + item.name;
      interactionEl.classList.add("show");
    } else {
      interactionEl.classList.remove("show");
    }
  }

  function tick(now, clockStart) {
    if (toastEl.classList.contains("show") && now - lastToast > 2600) {
      toastEl.classList.remove("show");
    }
    const minute = 7 + Math.floor((now - clockStart) / 45000);
    clockEl.innerHTML = "21:" + String(minute % 60).padStart(2, "0") + "<br>ÚTERÝ";
  }

  return {
    showToast,
    updateObjective,
    completeGame,
    setInteraction,
    tick,
    isStartVisible: () => !startScreen.classList.contains("hidden"),
    showStart: () => startScreen.classList.remove("hidden"),
    hideStart: () => startScreen.classList.add("hidden"),
    showPause: () => pauseScreen.classList.remove("hidden", "transition-out"),
    hidePause: () => {
      if (pauseScreen.classList.contains("hidden") || pauseScreen.classList.contains("transition-out")) return;
      pauseScreen.classList.add("transition-out");
      window.setTimeout(() => {
        if (!pauseScreen.classList.contains("transition-out")) return;
        pauseScreen.classList.add("hidden");
        pauseScreen.classList.remove("transition-out");
      }, 220);
    }
  };
}

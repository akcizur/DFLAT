import { spawn } from "node:child_process";
import { chromium } from "playwright";

const server = spawn("bun", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
  stdio: "ignore",
  env: { ...process.env, CI: "1" }
});
let browser;

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Vite preview did not become ready within 30 seconds.");
}

try {
  await waitForServer("http://127.0.0.1:4173/");
  browser = await chromium.launch({
    headless: true,
    args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("http://127.0.0.1:4173/?smoke=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#screenCanvas", { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector("#startButton")?.disabled === false, null, { timeout: 30000 });
  await page.locator("#loadingScreen").waitFor({ state: "hidden", timeout: 30000 });

  const beforeStart = await page.evaluate(() => ({
    webgl: (() => {
      const canvas = document.querySelector("#screenCanvas");
      return Boolean(canvas?.getContext("webgl2") || canvas?.getContext("webgl"));
    })(),
    renderCanvas: Boolean(document.querySelector("#screenCanvas")),
    startEnabled: document.querySelector("#startButton")?.disabled === false,
    debugText: document.querySelector("#boot-debug")?.textContent || ""
  }));
  if (!beforeStart.webgl) throw new Error("WebGL context could not be created.");
  if (beforeStart.debugText.trim()) throw new Error("Boot diagnostics reported an error: " + beforeStart.debugText);

  await page.locator("#startButton").click();
  await page.waitForTimeout(500);
  const movementBefore = await page.evaluate(() => ({
    position: window.__DEPOO_SMOKE__?.playerPosition(),
    state: window.__DEPOO_SMOKE__?.gameState()
  }));
  await page.keyboard.down("w");
  // Wait for actual simulation progress instead of assuming a fixed frame budget.
  // The low-poly scene can render more slowly on software WebGL runners.
  await page.waitForFunction(
    beforeZ => window.__DEPOO_SMOKE__?.playerPosition()?.z < beforeZ - 0.20,
    movementBefore.position.z,
    { timeout: 8000 }
  ).catch(() => {});
  const movementDuring = await page.evaluate(() => ({
    position: window.__DEPOO_SMOKE__?.playerPosition(),
    keys: window.__DEPOO_SMOKE__?.keysDown(),
    state: window.__DEPOO_SMOKE__?.gameState()
  }));
  await page.keyboard.up("w");
  if (
    !movementBefore?.position || !movementDuring?.position ||
    !movementBefore.state?.started || movementBefore.state.paused ||
    !movementDuring.keys?.KeyW ||
    movementDuring.position.z > movementBefore.position.z - 0.20
  ) {
    const diagnostics = await page.evaluate(() => {
      const position = window.__DEPOO_SMOKE__?.playerPosition();
      return {
        blockers: position ? window.__DEPOO_SMOKE__?.blockingCollidersAt(position.x, position.z) : null,
        manualSimulation: window.__DEPOO_SMOKE__?.moveForFrames("KeyW", 30),
        state: window.__DEPOO_SMOKE__?.gameState()
      };
    });
    throw new Error("WASD movement failed: " + JSON.stringify({ movementBefore, movementDuring, diagnostics, pageErrors, consoleErrors }));
  }
  await page.waitForTimeout(400);

  const visual = await page.evaluate(() => {
    const canvas = document.querySelector("#screenCanvas");
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 100 || canvas.height < 100) {
      return { ok: false, reason: "direct WebGL canvas is missing or too small" };
    }
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { ok: false, reason: "WebGL context unavailable" };
    gl.finish();
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const colors = new Set();
    let lit = 0, nonBlack = 0, samples = 0;
    const stride = Math.max(4, Math.floor(Math.sqrt(canvas.width * canvas.height / 20000)) * 4);
    for (let i = 0; i < data.length; i += stride) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      colors.add((r >> 3) + ":" + (g >> 3) + ":" + (b >> 3));
      if (r + g + b > 30) lit++;
      if (r + g + b > 6) nonBlack++;
      samples++;
    }
    return {
      ok: colors.size > 16 && lit > samples * 0.03 && nonBlack > samples * 0.15,
      width: canvas.width, height: canvas.height, distinctColorBuckets: colors.size,
      litRatio: lit / samples, nonBlackRatio: nonBlack / samples, samples
    };
  });

  if (!visual.ok && visual.distinctColorBuckets < 2) throw new Error("3D frame appears blank: " + JSON.stringify({ visual, pageErrors, consoleErrors }));

  // Exercise the catalog end-to-end: query all CC0 entries, find a model shipped locally,
  // and place it into the live world. This catches missing controls, catalog/CORS errors,
  // bad manifests and failures in the GLB loading path.
  await page.locator("#modelLibraryButton").click();
  await page.locator("#modelLibraryScreen").waitFor({ state: "visible", timeout: 5000 });
  await page.waitForFunction(() => {
    const count = document.querySelector("#modelLibraryCount")?.textContent || "";
    return Number(count.replace(/[^0-9]/g, "")) >= 1883;
  }, null, { timeout: 20000 });
  await page.locator("#modelLibrarySearch").fill("building-a");
  const modelCard = page.locator("#modelLibraryGrid .model-card").filter({ hasText: "Building a" }).first();
  await modelCard.waitFor({ state: "visible", timeout: 10000 });
  await modelCard.click();
  await page.locator("#modelLibraryPlace").click();
  await page.locator("#modelLibraryScreen").waitFor({ state: "hidden", timeout: 10000 });

  // Check the assembled modular DEPOO world and its live controls.
  const worldCheck = await page.evaluate(() => {
    const data = window.__DEPOO_SMOKE__?.worldDiagnostics();
    const objects = data?.objects || [];
    const geometry = data?.geometry || [];
    const roads = geometry.filter(item => item.kind === "road");
    const buildings = geometry.filter(item =>
      ["tower", "commercial", "civic-building", "house", "skyline-building"].includes(item.kind)
    );
    const vehicles = geometry.filter(item => item.kind === "vehicle");
    const overlaps = (a, b, epsilon = 0.02) =>
      a.minX < b.maxX - epsilon && a.maxX > b.minX + epsilon &&
      a.minZ < b.maxZ - epsilon && a.maxZ > b.minZ + epsilon;
    const roadOverlaps = [...buildings, ...vehicles].flatMap(item =>
      roads.filter(road => overlaps(item, road)).map(road => ({
        item: item.id + " @ " + item.x + "," + item.z,
        road: road.x + "," + road.z
      }))
    );
    const buildingOverlaps = [];
    for (let i = 0; i < buildings.length; i += 1) {
      for (let j = i + 1; j < buildings.length; j += 1) {
        if (overlaps(buildings[i], buildings[j])) buildingOverlaps.push([
          buildings[i].id + " @ " + buildings[i].x + "," + buildings[i].z,
          buildings[j].id + " @ " + buildings[j].x + "," + buildings[j].z
        ]);
      }
    }
    const roadMap = new Set(roads.map(item => Math.round(item.x) + ":" + Math.round(item.z)));
    const streetLines = [-72, -48, -24, 0, 24, 48, 72];
    const roadCells = Array.from({ length: 23 }, (_, index) => -88 + index * 8);
    const missingRoadCells = [];
    for (const line of streetLines) for (const cell of roadCells) {
      if (!roadMap.has(line + ":" + cell)) missingRoadCells.push(line + "," + cell);
      if (!roadMap.has(cell + ":" + line)) missingRoadCells.push(cell + "," + line);
    }
    const wrongRoadSizes = roads.filter(item =>
      Math.abs(item.width - 8) > 0.08 || Math.abs(item.depth - 8) > 0.08
    );
    const modelFitViolations = geometry.filter(item =>
      (item.targetFootprint && Math.max(item.width, item.depth) > item.targetFootprint + 0.08) ||
      (item.targetHeight && item.height > item.targetHeight + 0.08)
    ).map(item => ({
      id: item.id, kind: item.kind, position: [item.x, item.z],
      size: [item.width, item.height, item.depth],
      expectedMax: [item.targetFootprint, item.targetHeight]
    }));
    const offCenter = geometry.filter(item =>
      Math.abs((item.minX + item.maxX) / 2 - item.x) > 0.02 ||
      Math.abs((item.minZ + item.maxZ) / 2 - item.z) > 0.02
    ).map(item => item.id + " @ " + item.x + "," + item.z);
    return {
      theme: data?.theme,
      count: objects.length,
      geometryCount: geometry.length,
      colliderCount: data?.colliderCount || 0,
      roadCount: roads.length,
      buildingCount: buildings.length,
      vehicleCount: vehicles.length,
      ids: [...new Set(objects.map(item => item.id))],
      missingRoadCells, wrongRoadSizes, modelFitViolations, roadOverlaps, buildingOverlaps, offCenter,
      spawnBlockers: window.__DEPOO_SMOKE__?.blockingCollidersAt(0, 100) || [],
      fifthTowerBlockers: window.__DEPOO_SMOKE__?.blockingCollidersAt(-12, -36) || []
    };
  });
  if (
    worldCheck.theme !== "DEPOO" || worldCheck.count < 600 ||
    worldCheck.geometryCount < worldCheck.count ||
    worldCheck.roadCount !== 273 ||
    !worldCheck.ids.includes("city-kit-roads/road-roundabout") ||
    !worldCheck.ids.includes("city-kit-commercial/building-skyscraper-a") ||
    !worldCheck.ids.includes("city-kit-suburban/building-type-a") ||
    !worldCheck.ids.includes("car-kit/sedan") ||
    !worldCheck.ids.includes("mini-characters/character-female-a")
  ) throw new Error("DEPOO modular city is incomplete: " + JSON.stringify(worldCheck));
  if (worldCheck.missingRoadCells.length || worldCheck.wrongRoadSizes.length || worldCheck.modelFitViolations.length) {
    throw new Error("DEPOO road grid or fitted model dimensions are incorrect: " + JSON.stringify(worldCheck));
  }
  if (worldCheck.roadOverlaps.length || worldCheck.buildingOverlaps.length || worldCheck.offCenter.length) {
    throw new Error("DEPOO geometry overlaps or off-center models were found: " + JSON.stringify(worldCheck));
  }
  if (worldCheck.spawnBlockers.length || !worldCheck.fifthTowerBlockers.length) {
    throw new Error("DEPOO entrance/tower collision geometry is incorrect: " + JSON.stringify(worldCheck));
  }

  const entranceRoute = await page.evaluate(() => {
    const smoke = window.__DEPOO_SMOKE__;
    smoke.setPlayerPosition(0, 100, 0);
    return smoke.moveForFrames("KeyW", 360);
  });
  if (!entranceRoute || entranceRoute.z > 82) {
    throw new Error("The central entrance route is obstructed: " + JSON.stringify({ entranceRoute, worldCheck }));
  }

  const controls = await page.evaluate(() => ({
    park: window.__DEPOO_SMOKE__.interact("city-park-light"),
    street: window.__DEPOO_SMOKE__.interact("city-street-light")
  }));
  if (!controls.park || !controls.street) {
    throw new Error("DEPOO park/street lighting interaction failed: " + JSON.stringify(controls));
  }

  // Mobile touch regression: use a real touch-enabled Chromium context and
  // dispatch independent pointer IDs to exercise two-thumb control ownership.
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const mobileErrors = [];
  mobilePage.on("pageerror", error => mobileErrors.push(error.message));
  await mobilePage.goto("http://127.0.0.1:4173/?smoke=1&touch=1", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await mobilePage.waitForSelector("#screenCanvas", { timeout: 10000 });
  await mobilePage.waitForFunction(() => document.querySelector("#startButton")?.disabled === false, null, { timeout: 20000 });
  await mobilePage.locator("#loadingScreen").waitFor({ state: "hidden", timeout: 20000 });
  await mobilePage.locator("#startButton").click();
  await mobilePage.waitForTimeout(350);
  const mobileReady = await mobilePage.evaluate(() => ({
    touchRemote: getComputedStyle(document.querySelector("#touchRemoteCluster")).display !== "none",
    joystick: getComputedStyle(document.querySelector("#touchControls")).display !== "none",
    lookZone: getComputedStyle(document.querySelector("#touchLookZone")).display !== "none"
  }));
  if (!mobileReady.touchRemote || !mobileReady.joystick || !mobileReady.lookZone) {
    throw new Error("Mobile touch controls are not visible: " + JSON.stringify(mobileReady));
  }

  const touchMovement = await mobilePage.evaluate(async () => {
    // Synthetic pointer events let the smoke test address two simultaneous touch IDs
    // deterministically; capture is stubbed because synthetic events are not trusted.
    Element.prototype.setPointerCapture = function () {};
    const send = (element, type, pointerId, x, y) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: "touch",
      clientX: x, clientY: y, buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1
    }));
    const stick = document.querySelector("#moveStick");
    const rect = stick.getBoundingClientRect();
    const sx = rect.left + rect.width / 2, sy = rect.top + rect.height / 2;
    const look = document.querySelector("#touchLookZone");
    const lookX = innerWidth - 24, lookY = innerHeight * 0.45;
    const yawBefore = window.__DEPOO_SMOKE__.playerPosition().yaw;
    send(stick, "pointerdown", 11, sx, sy);
    send(stick, "pointermove", 11, sx, sy - rect.height * 0.34);
    send(look, "pointerdown", 22, lookX, lookY);
    send(look, "pointermove", 22, lookX - 36, lookY + 12);
    await new Promise(resolve => setTimeout(resolve, 100));
    const held = window.__DEPOO_SMOKE__.keysDown();
    const yawAfter = window.__DEPOO_SMOKE__.playerPosition().yaw;
    send(stick, "pointerup", 11, sx, sy - rect.height * 0.34);
    const afterStickRelease = window.__DEPOO_SMOKE__.keysDown();
    const lookStillActive = look.classList.contains("active");
    send(look, "pointerup", 22, lookX - 36, lookY + 12);
    return { held, afterStickRelease, lookStillActive, yawBefore, yawAfter };
  });
  if (!touchMovement.held.KeyW || touchMovement.afterStickRelease.KeyW ||
      !touchMovement.lookStillActive || Math.abs(touchMovement.yawAfter - touchMovement.yawBefore) < 0.001) {
    throw new Error("Two-thumb joystick/look test failed: " + JSON.stringify(touchMovement));
  }

  const runRelease = await mobilePage.evaluate(() => {
    const run = document.querySelector('[data-touch-action="run"]');
    const send = (type, pointerId) => run.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: "touch", buttons: type === "pointercancel" ? 0 : 1
    }));
    send("pointerdown", 33);
    const during = window.__DEPOO_SMOKE__.keysDown().ShiftLeft;
    send("pointercancel", 33);
    const after = window.__DEPOO_SMOKE__.keysDown().ShiftLeft;
    return { during, after };
  });
  if (!runRelease.during || runRelease.after) {
    throw new Error("RUN button did not release after pointercancel: " + JSON.stringify(runRelease));
  }
  const pauseRelease = await mobilePage.evaluate(() => {
    const stick = document.querySelector("#moveStick");
    const look = document.querySelector("#touchLookZone");
    const pause = document.querySelector('[data-touch-action="pause"]');
    Element.prototype.setPointerCapture = function () {};
    const send = (element, type, pointerId, x = 100, y = 100) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: "touch",
      clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1
    }));
    const rect = stick.getBoundingClientRect();
    send(stick, "pointerdown", 41, rect.left + rect.width / 2, rect.top + rect.height / 2);
    send(stick, "pointermove", 41, rect.left + rect.width / 2, rect.top + rect.height * 0.2);
    send(look, "pointerdown", 42, innerWidth - 20, innerHeight * 0.4);
    const activeBeforePause = window.__DEPOO_SMOKE__.keysDown().KeyW && look.classList.contains("active");
    send(pause, "pointerdown", 43);
    return {
      activeBeforePause,
      paused: window.__DEPOO_SMOKE__.gameState().paused,
      keyAfterPause: window.__DEPOO_SMOKE__.keysDown().KeyW,
      lookAfterPause: look.classList.contains("active")
    };
  });
  if (!pauseRelease.activeBeforePause || !pauseRelease.paused ||
      pauseRelease.keyAfterPause || pauseRelease.lookAfterPause) {
    throw new Error("Pause did not release active touch input: " + JSON.stringify(pauseRelease));
  }
  await mobilePage.locator("#resumeButton").click();

  if (mobileErrors.length) throw new Error("Mobile browser runtime errors: " + mobileErrors.join(" | "));

  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  const shaderErrors = consoleErrors.filter(message => /shader error|program linking failed|webgl.*context|failed to compile/i.test(message));
  if (shaderErrors.length) throw new Error("WebGL/shader errors: " + shaderErrors.join(" | "));

  console.log("Browser smoke test passed:", JSON.stringify({ beforeStart, movementBefore, movementDuring, visual, pageErrors, consoleErrors }));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

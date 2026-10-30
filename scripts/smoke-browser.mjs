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
  await page.waitForFunction(() => document.querySelector("#startButton")?.disabled === false, null, { timeout: 15000 });
  await page.locator("#loadingScreen").waitFor({ state: "hidden", timeout: 15000 });

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
    position: window.__DFLAT_SMOKE__?.playerPosition(),
    state: window.__DFLAT_SMOKE__?.gameState()
  }));
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  const movementDuring = await page.evaluate(() => ({
    position: window.__DFLAT_SMOKE__?.playerPosition(),
    keys: window.__DFLAT_SMOKE__?.keysDown(),
    state: window.__DFLAT_SMOKE__?.gameState()
  }));
  await page.keyboard.up("w");
  if (
    !movementBefore?.position || !movementDuring?.position ||
    !movementBefore.state?.started || movementBefore.state.paused ||
    !movementDuring.keys?.KeyW ||
    movementDuring.position.z > movementBefore.position.z - 0.20
  ) {
    throw new Error("WASD movement failed: " + JSON.stringify({ movementBefore, movementDuring }));
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
  await page.locator("#modelLibrarySearch").fill("building-type-a");
  const modelCard = page.locator("#modelLibraryGrid .model-card").filter({ hasText: "Building type a" }).first();
  await modelCard.waitFor({ state: "visible", timeout: 10000 });
  await modelCard.click();
  await page.locator("#modelLibraryPlace").click();
  await page.locator("#modelLibraryScreen").waitFor({ state: "hidden", timeout: 10000 });

  // Walk into the panelák through the live entrance, then traverse the hall and stairwell.
  const interiorBefore = await page.evaluate(() => window.__DFLAT_SMOKE__?.interiorDiagnostics());
  if (
    !interiorBefore?.rootVisible ||
    interiorBefore.meshCount < 40 ||
    interiorBefore.visibleMeshCount < 40 ||
    interiorBefore.hasCeiling
  ) {
    throw new Error("Panelák interior geometry is missing or hidden: " + JSON.stringify(interiorBefore));
  }

  const route = await page.evaluate(() => {
    const smoke = window.__DFLAT_SMOKE__;
    smoke.setPlayerPosition(-10.9, -29, Math.PI / 2);
    if (!smoke.interact("door-vchodove-dvere")) throw new Error("Entrance door interactable is missing");
    const door = smoke.interiorDiagnostics();
    if (!door.doorName.startsWith("Zavřít") || door.doorRotationY === Math.PI / 2) {
      throw new Error("Entrance interaction did not open the door: " + JSON.stringify(door));
    }
    const doorway = smoke.moveForFrames("KeyW", 60);
    if (doorway.error || doorway.x > -12.4) {
      throw new Error("Player could not cross the opened entrance: " + JSON.stringify({
        doorway, door, blockers: smoke.blockingCollidersAt(doorway.x, doorway.z)
      }));
    }
    smoke.setPlayerPosition(doorway.x, doorway.z, 0);
    const hall = smoke.moveForFrames("KeyW", 65);
    if (hall.error || hall.x > -12.4 || hall.z > -32.0 || hall.z < -34.4) {
      throw new Error("Player could not walk down the entrance hall: " + JSON.stringify({
        hall, blockers: smoke.blockingCollidersAt(hall.x, hall.z)
      }));
    }
    smoke.setPlayerPosition(hall.x, hall.z, 0);
    const stairApproach = smoke.moveForFrames("KeyA", 60);
    if (stairApproach.error || stairApproach.x > -17.7) {
      throw new Error("Player could not cross the hall to the stairwell passage: " + JSON.stringify({
        stairApproach, blockers: smoke.blockingCollidersAt(stairApproach.x, stairApproach.z)
      }));
    }
    smoke.setPlayerPosition(stairApproach.x, stairApproach.z, 0);
    const stairs = smoke.moveForFrames("KeyW", 60);
    if (stairs.error || stairs.z > -35.5) {
      throw new Error("Player is blocked by the stairwell partition: " + JSON.stringify({
        stairs, blockers: smoke.blockingCollidersAt(stairs.x, stairs.z)
      }));
    }
    smoke.setPlayerPosition(-18.2, -37.5, -Math.PI / 2);
    return { doorway, hall, stairApproach, stairs };
  });
  await page.waitForTimeout(300);
  const interiorVisual = await page.evaluate(() => {
    const canvas = document.querySelector("#screenCanvas");
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    if (!gl || !canvas) return { ok: false, reason: "WebGL canvas unavailable inside panelák" };
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
      distinctColorBuckets: colors.size, litRatio: lit / samples, nonBlackRatio: nonBlack / samples
    };
  });
  if (!interiorVisual.ok) {
    throw new Error("Panelák interior frame is not visibly rendered: " + JSON.stringify({ interiorBefore, interiorVisual }));
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
    const yawBefore = window.__DFLAT_SMOKE__.playerPosition().yaw;
    send(stick, "pointerdown", 11, sx, sy);
    send(stick, "pointermove", 11, sx, sy - rect.height * 0.34);
    send(look, "pointerdown", 22, lookX, lookY);
    send(look, "pointermove", 22, lookX - 36, lookY + 12);
    await new Promise(resolve => setTimeout(resolve, 100));
    const held = window.__DFLAT_SMOKE__.keysDown();
    const yawAfter = window.__DFLAT_SMOKE__.playerPosition().yaw;
    send(stick, "pointerup", 11, sx, sy - rect.height * 0.34);
    const afterStickRelease = window.__DFLAT_SMOKE__.keysDown();
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
    const during = window.__DFLAT_SMOKE__.keysDown().ShiftLeft;
    send("pointercancel", 33);
    const after = window.__DFLAT_SMOKE__.keysDown().ShiftLeft;
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
    const activeBeforePause = window.__DFLAT_SMOKE__.keysDown().KeyW && look.classList.contains("active");
    send(pause, "pointerdown", 43);
    return {
      activeBeforePause,
      paused: window.__DFLAT_SMOKE__.gameState().paused,
      keyAfterPause: window.__DFLAT_SMOKE__.keysDown().KeyW,
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

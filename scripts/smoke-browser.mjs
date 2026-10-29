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
  await page.locator("#loadingScreen").waitFor({ state: "hidden", timeout: 5000 });

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

  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  const shaderErrors = consoleErrors.filter(message => /shader error|program linking failed|webgl.*context|failed to compile/i.test(message));
  if (shaderErrors.length) throw new Error("WebGL/shader errors: " + shaderErrors.join(" | "));

  console.log("Browser smoke test passed:", JSON.stringify({ beforeStart, movementBefore, movementDuring, visual, pageErrors, consoleErrors }));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

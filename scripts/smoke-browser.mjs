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
  await page.waitForSelector("#loadingScreen", { state: "visible", timeout: 10000 });

  const initialStartup = await page.evaluate(() => {
    const start = document.querySelector("#startButton");
    const loading = document.querySelector("#loadingScreen");
    const menu = document.querySelector("#startScreen .nexus-monitor");
    const panel = document.querySelector("#loadingScreen .loading-panel");
    const centre = element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    return {
      startDisabled: Boolean(start?.disabled),
      loadingVisible: Boolean(loading && !loading.hidden),
      menuCentre: menu ? centre(menu) : null,
      loaderCentre: panel ? centre(panel) : null,
      viewportCentre: { x: innerWidth / 2, y: innerHeight / 2 }
    };
  });
  if (!initialStartup.startDisabled) throw new Error("Start must remain disabled during initial loading.");
  if (!initialStartup.loadingVisible) throw new Error("Loading overlay should be visible on first startup.");
  for (const key of ["menuCentre", "loaderCentre"]) {
    const point = initialStartup[key];
    const tolerance = key === "menuCentre" ? 6 : 3;
    if (!point || Math.abs(point.x - initialStartup.viewportCentre.x) > tolerance ||
        Math.abs(point.y - initialStartup.viewportCentre.y) > tolerance) {
      throw new Error(key + " is not viewport-centred: " + JSON.stringify(initialStartup));
    }
  }
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

  if (!visual.ok) throw new Error("3D frame appears blank or nearly black: " + JSON.stringify({ visual, pageErrors, consoleErrors }));
  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  const shaderErrors = consoleErrors.filter(message => /shader error|program linking failed|webgl.*context|failed to compile/i.test(message));
  if (shaderErrors.length) throw new Error("WebGL/shader errors: " + shaderErrors.join(" | "));

  console.log("Browser smoke test passed:", JSON.stringify({ beforeStart, movementBefore, movementDuring, visual, pageErrors, consoleErrors }));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

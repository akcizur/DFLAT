// Lightweight pixel/CRT compositor for Three.js r169.
// The 3D scene renders at up to 60 FPS into a low-resolution WebGL canvas.
// Canvas2D keeps nearest-neighbour pixels and adds restrained monochrome scanlines.
// No custom GLSL, glow, shadows or progressive frame-loading effect is used.
export function createPixelPostProcess(THREE, renderer) {
  const displayCanvas = document.createElement("canvas");
  displayCanvas.id = "pixelDisplayCanvas";
  displayCanvas.setAttribute("aria-hidden", "true");
  const displayContext = displayCanvas.getContext("2d", { alpha: false, desynchronized: true });

  if (!displayContext) {
    return {
      setSize() {},
      renderScene(scene, camera) { renderer.render(scene, camera); },
      present() {},
      triggerZoom() {},
      dispose() {}
    };
  }

  const frameCanvas = document.createElement("canvas");
  const frameContext = frameCanvas.getContext("2d", { alpha: false });
  if (!frameContext) {
    return {
      setSize() {},
      renderScene(scene, camera) { renderer.render(scene, camera); },
      present() {},
      triggerZoom() {},
      dispose() {}
    };
  }

  let width = 1;
  let height = 1;
  let hasFrame = false;
  let zoomStart = -1000;
  let zoomAmount = 0;
  const size = new THREE.Vector2();
  const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  function configureContext(context) {
    context.imageSmoothingEnabled = false;
  }

  configureContext(displayContext);
  configureContext(frameContext);

  displayCanvas.style.position = "absolute";
  displayCanvas.style.inset = "0";
  displayCanvas.style.width = "100%";
  displayCanvas.style.height = "100%";
  displayCanvas.style.zIndex = "1";
  displayCanvas.style.pointerEvents = "none";
  displayCanvas.style.imageRendering = "pixelated";
  displayCanvas.style.display = "block";

  const mount = renderer.domElement.parentElement;
  if (mount) mount.appendChild(displayCanvas);

  // Keep the WebGL canvas as the input/pointer-lock target; show the compositor above it.
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "0";
  renderer.domElement.style.opacity = "0";

  function setSize(nextWidth, nextHeight) {
    width = Math.max(1, Math.floor(nextWidth));
    height = Math.max(1, Math.floor(nextHeight));
    displayCanvas.width = width;
    displayCanvas.height = height;
    frameCanvas.width = width;
    frameCanvas.height = height;
    configureContext(displayContext);
    configureContext(frameContext);
    frameContext.fillStyle = "#080808";
    frameContext.fillRect(0, 0, width, height);
    hasFrame = false;
  }

  function renderScene(scene, camera) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    frameContext.clearRect(0, 0, width, height);
    frameContext.drawImage(renderer.domElement, 0, 0, width, height);
    hasFrame = true;
  }

  function present(timeSeconds = performance.now() / 1000) {
    if (!hasFrame) return;

    const elapsed = timeSeconds - zoomStart;
    const zoom = !reducedMotion && elapsed >= 0 && elapsed < 0.7
      ? zoomAmount * Math.exp(-elapsed * 6) * Math.cos(elapsed * 9)
      : 0;

    displayContext.setTransform(1, 0, 0, 1, 0, 0);
    displayContext.clearRect(0, 0, width, height);
    displayContext.save();

    if (zoom !== 0) {
      const scale = 1 + zoom;
      displayContext.translate(width / 2, height / 2);
      displayContext.scale(scale, scale);
      displayContext.translate(-width / 2, -height / 2);
    }

    displayContext.drawImage(frameCanvas, 0, 0, width, height);
    displayContext.restore();

    // Thin scanlines only: crisp pixels, no bloom, no canvas shadows.
    displayContext.save();
    displayContext.globalAlpha = 0.10;
    displayContext.fillStyle = "#000000";
    for (let y = 1; y < height; y += 3) {
      displayContext.fillRect(0, y, width, 1);
    }

    // Very mild global phosphor fluctuation, disabled for reduced-motion users.
    if (!reducedMotion) {
      const flicker = 0.012 + Math.sin(timeSeconds * 31) * 0.006;
      displayContext.globalAlpha = flicker;
      displayContext.fillStyle = "#ffffff";
      displayContext.fillRect(0, 0, width, height);
    }
    displayContext.restore();
  }

  function triggerZoom(amount = 0.025) {
    if (reducedMotion) return;
    zoomAmount = Math.max(-0.04, Math.min(0.04, amount));
    zoomStart = performance.now() / 1000;
  }

  function dispose() {
    displayCanvas.remove();
    renderer.domElement.style.opacity = "";
    renderer.domElement.style.position = "";
    renderer.domElement.style.inset = "";
    renderer.domElement.style.zIndex = "";
  }

  renderer.getSize(size);
  setSize(size.x, size.y);
  return { setSize, renderScene, present, triggerZoom, dispose };
}

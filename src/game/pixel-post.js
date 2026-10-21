// Stable pixel compositor for Three.js r169.
// The real 3D scene is rendered at 15 FPS into the existing low-resolution WebGL canvas.
// A Canvas2D presentation layer displays the saved frame at 60 Hz and reveals each new
// image progressively from top to bottom. No custom GLSL shader is required, so shader
// compilation failures cannot turn the game into a black screen.
export function createPixelPostProcess(THREE, renderer) {
  const displayCanvas = document.createElement("canvas");
  displayCanvas.id = "pixelDisplayCanvas";
  displayCanvas.setAttribute("aria-hidden", "true");
  const displayContext = displayCanvas.getContext("2d", { alpha: false, desynchronized: true });

  // Very old or constrained browsers can still play the game, without the scan effect.
  if (!displayContext) {
    return {
      setSize() {},
      renderScene(scene, camera) { renderer.render(scene, camera); },
      present() {},
      triggerZoom() {},
      dispose() {}
    };
  }

  const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reducedMotion = Boolean(reduceMotionQuery?.matches);
  const buffers = [0, 1].map(() => ({
    canvas: document.createElement("canvas"),
    context: null
  }));

  let width = 1;
  let height = 1;
  let currentIndex = -1;
  let previousIndex = 0;
  let lastSceneRenderTime = 0;
  let zoomStart = -1000;
  let zoomAmount = 0;

  const size = new THREE.Vector2();

  function configureContext(context) {
    context.imageSmoothingEnabled = false;
  }

  buffers.forEach(buffer => {
    buffer.context = buffer.canvas.getContext("2d", { alpha: false });
    if (buffer.context) configureContext(buffer.context);
  });

  if (buffers.some(buffer => !buffer.context)) {
    return {
      setSize() {},
      renderScene(scene, camera) { renderer.render(scene, camera); },
      present() {},
      triggerZoom() {},
      dispose() {}
    };
  }

  displayCanvas.style.position = "absolute";
  displayCanvas.style.inset = "0";
  displayCanvas.style.width = "100%";
  displayCanvas.style.height = "100%";
  displayCanvas.style.zIndex = "1";
  displayCanvas.style.pointerEvents = "none";
  displayCanvas.style.imageRendering = "pixelated";
  displayCanvas.style.filter = "contrast(1.06) saturate(1.07)";
  displayCanvas.style.display = "block";

  const mount = renderer.domElement.parentElement;
  if (mount) mount.appendChild(displayCanvas);

  // Opacity keeps the WebGL canvas as the interaction/pointer-lock target while the
  // 2D canvas above it presents the captured low-resolution image.
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "0";
  renderer.domElement.style.opacity = "0";

  function setSize(nextWidth, nextHeight) {
    width = Math.max(1, Math.floor(nextWidth));
    height = Math.max(1, Math.floor(nextHeight));
    displayCanvas.width = width;
    displayCanvas.height = height;
    displayContext.imageSmoothingEnabled = false;

    for (const buffer of buffers) {
      buffer.canvas.width = width;
      buffer.canvas.height = height;
      configureContext(buffer.context);
      buffer.context.fillStyle = "#080604";
      buffer.context.fillRect(0, 0, width, height);
    }

    // Don't expose an empty frame during a resize; the next scene render will refill it.
    currentIndex = -1;
    previousIndex = 0;
  }

  function renderScene(scene, camera, timeSeconds = performance.now() / 1000) {
    // Always render to the browser-visible WebGL canvas; no render targets/shaders.
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    const nextIndex = currentIndex < 0 ? 0 : 1 - currentIndex;
    const buffer = buffers[nextIndex];
    buffer.context.clearRect(0, 0, width, height);
    buffer.context.drawImage(renderer.domElement, 0, 0, width, height);

    if (currentIndex < 0) {
      // Duplicate the first frame into both buffers, avoiding an initial blank flash.
      buffers[1 - nextIndex].context.clearRect(0, 0, width, height);
      buffers[1 - nextIndex].context.drawImage(buffer.canvas, 0, 0, width, height);
      previousIndex = nextIndex;
    } else {
      previousIndex = currentIndex;
    }

    currentIndex = nextIndex;
    lastSceneRenderTime = timeSeconds;
  }

  function present(timeSeconds = performance.now() / 1000) {
    if (currentIndex < 0) return;

    const current = buffers[currentIndex].canvas;
    const previous = buffers[previousIndex].canvas;
    const elapsed = timeSeconds - zoomStart;
    const zoom = elapsed >= 0 && elapsed < 1.15
      ? zoomAmount * Math.exp(-elapsed * 4.8) * Math.cos(elapsed * 8.0)
      : 0;
    const progress = reducedMotion
      ? 1
      : Math.max(0, Math.min(1, (timeSeconds - lastSceneRenderTime) / (1 / 15)));
    const loadedHeight = Math.max(0, Math.min(height, Math.floor(height * progress)));

    displayContext.setTransform(1, 0, 0, 1, 0, 0);
    displayContext.clearRect(0, 0, width, height);
    displayContext.save();

    if (zoom !== 0) {
      const scale = 1 + zoom;
      displayContext.translate(width / 2, height / 2);
      displayContext.scale(scale, scale);
      displayContext.translate(-width / 2, -height / 2);
    }

    displayContext.drawImage(previous, 0, 0, width, height);
    if (loadedHeight > 0) {
      displayContext.save();
      displayContext.beginPath();
      displayContext.rect(0, 0, width, loadedHeight);
      displayContext.clip();
      displayContext.drawImage(current, 0, 0, width, height);
      displayContext.restore();
    }
    displayContext.restore();

    // Restrained stepped CRT scanlines are composited cheaply at presentation rate.
    displayContext.save();
    displayContext.globalAlpha = 0.095;
    displayContext.fillStyle = "#160b04";
    for (let y = 3; y < height; y += 4) displayContext.fillRect(0, y, width, 1);
    displayContext.restore();

    // A chunky amber load line marks the current boundary as the new pixels arrive.
    if (!reducedMotion && progress < 0.999) {
      const y = Math.min(height - 1, loadedHeight);
      displayContext.save();
      displayContext.globalAlpha = 0.82;
      displayContext.shadowColor = "#ff9c3b";
      displayContext.shadowBlur = Math.max(2, height / 180);
      displayContext.fillStyle = "#ffb85c";
      displayContext.fillRect(0, y, width, Math.max(1, Math.ceil(height / 220)));
      displayContext.restore();
    }
  }

  function triggerZoom(amount = 0.05) {
    if (reducedMotion) return;
    zoomAmount = Math.max(-0.08, Math.min(0.09, amount));
    zoomStart = performance.now() / 1000;
  }

  function dispose() {
    displayCanvas.remove();
    // Restore the underlying canvas if this compositor is torn down.
    renderer.domElement.style.opacity = "";
    renderer.domElement.style.position = "";
    renderer.domElement.style.inset = "";
    renderer.domElement.style.zIndex = "";
  }

  renderer.getSize(size);
  setSize(size.x, size.y);
  return { setSize, renderScene, present, triggerZoom, dispose };
}

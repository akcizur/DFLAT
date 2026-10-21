// Lightweight pixel/CRT compositor with depth-aware Gaussian blur for Three.js r169.
// Foreground stays crisp; surfaces beyond roughly 2–3 m receive a restrained blur.
// Canvas2D preserves nearest-neighbour pixels and adds thin monochrome scanlines.
export function createPixelPostProcess(THREE, renderer) {
  const displayCanvas = document.createElement("canvas");
  displayCanvas.id = "pixelDisplayCanvas";
  displayCanvas.setAttribute("aria-hidden", "true");
  const displayContext = displayCanvas.getContext("2d", { alpha: false, desynchronized: true });

  if (!displayContext) {
    return { setSize() {}, renderScene(scene, camera) { renderer.render(scene, camera); }, present() {}, triggerZoom() {}, dispose() {} };
  }

  const frameCanvas = document.createElement("canvas");
  const frameContext = frameCanvas.getContext("2d", { alpha: false });
  if (!frameContext) {
    return { setSize() {}, renderScene(scene, camera) { renderer.render(scene, camera); }, present() {}, triggerZoom() {}, dispose() {} };
  }

  let width = 1;
  let height = 1;
  let hasFrame = false;
  let zoomStart = -1000;
  let zoomAmount = 0;
  const size = new THREE.Vector2();
  const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    depthBuffer: true,
    stencilBuffer: false
  });
  target.texture.generateMipmaps = false;
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  target.depthTexture.minFilter = THREE.NearestFilter;
  target.depthTexture.magFilter = THREE.NearestFilter;

  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture },
      tDepth: { value: target.depthTexture },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 0.08 },
      cameraFar: { value: 70 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 resolution;
      uniform float cameraNear;
      uniform float cameraFar;
      varying vec2 vUv;

      float viewDistance(float depth) {
        float z = depth * 2.0 - 1.0;
        return (2.0 * cameraNear * cameraFar) /
          (cameraFar + cameraNear - z * (cameraFar - cameraNear));
      }

      void main() {
        float depth = texture2D(tDepth, vUv).x;
        float distanceToCamera = viewDistance(depth);
        // Keep objects within ~2 m crisp; gradually blur geometry from 2–3 m onward.
        float blur = smoothstep(2.0, 3.2, distanceToCamera) * 2.2;
        vec2 px = 1.0 / resolution;
        vec4 color = texture2D(tDiffuse, vUv) * 0.227027;
        color += texture2D(tDiffuse, vUv + vec2(px.x * blur * 1.384615, 0.0)) * 0.158108;
        color += texture2D(tDiffuse, vUv - vec2(px.x * blur * 1.384615, 0.0)) * 0.158108;
        color += texture2D(tDiffuse, vUv + vec2(0.0, px.y * blur * 1.384615)) * 0.158108;
        color += texture2D(tDiffuse, vUv - vec2(0.0, px.y * blur * 1.384615)) * 0.158108;
        color += texture2D(tDiffuse, vUv + vec2(px.x * blur * 3.230769, 0.0)) * 0.070270;
        color += texture2D(tDiffuse, vUv - vec2(px.x * blur * 3.230769, 0.0)) * 0.070270;
        gl_FragColor = vec4(color.rgb, 1.0);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));

  function configureContext(context) { context.imageSmoothingEnabled = false; }
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
    target.setSize(width, height);
    postMaterial.uniforms.resolution.value.set(width, height);
    configureContext(displayContext);
    configureContext(frameContext);
    frameContext.fillStyle = "#080808";
    frameContext.fillRect(0, 0, width, height);
    hasFrame = false;
  }

  function renderScene(scene, camera) {
    postMaterial.uniforms.cameraNear.value = camera.near;
    postMaterial.uniforms.cameraFar.value = camera.far;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
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
    displayContext.save();
    displayContext.globalAlpha = 0.10;
    displayContext.fillStyle = "#000000";
    for (let y = 1; y < height; y += 3) displayContext.fillRect(0, y, width, 1);
    if (!reducedMotion) {
      displayContext.globalAlpha = 0.012 + Math.sin(timeSeconds * 31) * 0.006;
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
    target.dispose();
    postMaterial.dispose();
    postScene.children[0]?.geometry?.dispose();
    renderer.domElement.style.opacity = "";
    renderer.domElement.style.position = "";
    renderer.domElement.style.inset = "";
    renderer.domElement.style.zIndex = "";
  }

  renderer.getSize(size);
  setSize(size.x, size.y);
  return { setSize, renderScene, present, triggerZoom, dispose };
}

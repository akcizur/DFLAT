// Lightweight pixel/CRT compositor for Three.js r169.
// Keeps the depth-aware blur and nearest-neighbour raster while adding configurable,
// GPU-side CRT/VHS effects. Profiles can be selected with ?fx=crt|vhs|psx|clean|off.
export function createPixelPostProcess(THREE, renderer) {
  const displayCanvas = document.createElement("canvas");
  displayCanvas.id = "pixelDisplayCanvas";
  displayCanvas.setAttribute("aria-hidden", "true");
  const displayContext = displayCanvas.getContext("2d", { alpha: false, desynchronized: true });

  const fallback = {
    setSize() {},
    renderScene(scene, camera) { renderer.render(scene, camera); },
    present() {},
    triggerZoom() {},
    setProfile() {},
    getProfile() { return "off"; },
    dispose() {}
  };
  if (!displayContext) return fallback;

  const frameCanvas = document.createElement("canvas");
  const frameContext = frameCanvas.getContext("2d", { alpha: false });
  if (!frameContext) return fallback;

  let width = 1;
  let height = 1;
  let hasFrame = false;
  let zoomStart = -1000;
  let zoomAmount = 0;
  const size = new THREE.Vector2();
  const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const lowPower = Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);

  const profiles = {
    off:   { curvature: 0, chroma: 0, scanline: 0, vignette: 0, noise: 0, jitter: 0, interlace: 0, mask: 0, levels: 0 },
    clean: { curvature: 0.015, chroma: 0.0002, scanline: 0.025, vignette: 0.12, noise: 0.004, jitter: 0, interlace: 0, mask: 0, levels: 0 },
    crt:   { curvature: 0.035, chroma: 0.00035, scanline: 0.035, vignette: 0.15, noise: 0.004, jitter: 0.00005, interlace: 0.012, mask: 0.012, levels: 0 },
    vhs:   { curvature: 0.055, chroma: 0.0026, scanline: 0.055, vignette: 0.18, noise: 0.035, jitter: 0.0018, interlace: 0.075, mask: 0.015, levels: 0 },
    psx:   { curvature: 0.035, chroma: 0.0008, scanline: 0.04, vignette: 0.16, noise: 0.008, jitter: 0.0001, interlace: 0.02, mask: 0.025, levels: 20 }
  };
  let profileName = "crt";

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
      cameraFar: { value: 70 },
      time: { value: 0 },
      curvature: { value: 0.075 },
      chroma: { value: 0.0012 },
      scanline: { value: 0.075 },
      vignette: { value: 0.24 },
      noise: { value: 0.012 },
      jitter: { value: 0.0002 },
      interlace: { value: 0.035 },
      mask: { value: 0.035 },
      levels: { value: 0 }
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
      uniform float time;
      uniform float curvature;
      uniform float chroma;
      uniform float scanline;
      uniform float vignette;
      uniform float noise;
      uniform float jitter;
      uniform float interlace;
      uniform float mask;
      uniform float levels;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float viewDistance(float depth) {
        float z = depth * 2.0 - 1.0;
        return (2.0 * cameraNear * cameraFar) /
          (cameraFar + cameraNear - z * (cameraFar - cameraNear));
      }

      vec3 sampleScene(vec2 uv) {
        vec2 texel = 1.0 / resolution;
        float depth = texture2D(tDepth, uv).x;
        float distanceToCamera = viewDistance(depth);
        // 13-tap Gaussian-like blur, ramping in between roughly 2 and 3.2 metres.
        float blur = smoothstep(2.0, 3.2, distanceToCamera) * 2.2;
        vec2 px = texel * blur;
        vec3 color = texture2D(tDiffuse, uv).rgb * 0.20;
        color += texture2D(tDiffuse, uv + vec2( px.x, 0.0)).rgb * 0.12;
        color += texture2D(tDiffuse, uv - vec2( px.x, 0.0)).rgb * 0.12;
        color += texture2D(tDiffuse, uv + vec2(0.0,  px.y)).rgb * 0.12;
        color += texture2D(tDiffuse, uv - vec2(0.0,  px.y)).rgb * 0.12;
        color += texture2D(tDiffuse, uv + vec2( px.x,  px.y)).rgb * 0.06;
        color += texture2D(tDiffuse, uv + vec2(-px.x,  px.y)).rgb * 0.06;
        color += texture2D(tDiffuse, uv + vec2( px.x, -px.y)).rgb * 0.06;
        color += texture2D(tDiffuse, uv + vec2(-px.x, -px.y)).rgb * 0.06;
        color += texture2D(tDiffuse, uv + vec2( px.x * 2.0, 0.0)).rgb * 0.02;
        color += texture2D(tDiffuse, uv + vec2(-px.x * 2.0, 0.0)).rgb * 0.02;
        color += texture2D(tDiffuse, uv + vec2(0.0,  px.y * 2.0)).rgb * 0.02;
        color += texture2D(tDiffuse, uv + vec2(0.0, -px.y * 2.0)).rgb * 0.02;
        return color;
      }

      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float r2 = dot(centered, centered);
        vec2 uv = centered * (1.0 + curvature * r2) * 0.5 + 0.5;

        // VHS horizontal tracking wobble is intentionally tiny and disabled in reduced-motion mode.
        float lineId = floor(vUv.y * resolution.y);
        float wobble = sin(lineId * 0.37 + floor(time * 12.0)) * jitter;
        uv.x += wobble;
        float edge = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        vec2 rgbShift = vec2(chroma * (0.35 + r2), 0.0);
        float depth = texture2D(tDepth, clamp(uv, 0.001, 0.999)).x;
        float distanceToCamera = viewDistance(depth);
        vec3 color = sampleScene(clamp(uv, 0.001, 0.999));
        if (chroma > 0.0) {
          // Two inexpensive edge samples add RGB separation without tripling the blur kernel.
          float splitAmount = clamp(chroma * 150.0, 0.0, 0.5);
          color.r = mix(color.r, texture2D(tDiffuse, clamp(uv + rgbShift, 0.001, 0.999)).r, splitAmount);
          color.b = mix(color.b, texture2D(tDiffuse, clamp(uv - rgbShift, 0.001, 0.999)).b, splitAmount);
        }

        float scan = 0.5 + 0.5 * sin(vUv.y * resolution.y * 3.14159265);
        color *= 1.0 - scanline * scan;
        float field = mod(floor(vUv.y * resolution.y) + floor(time * 30.0), 2.0);
        color *= 1.0 - interlace * field;
        float subpixel = mod(floor(vUv.x * resolution.x), 3.0);
        vec3 maskTint = subpixel < 1.0 ? vec3(1.0, 0.93, 0.93)
          : (subpixel < 2.0 ? vec3(0.93, 1.0, 0.93) : vec3(0.93, 0.93, 1.0));
        color *= mix(vec3(1.0), maskTint, mask);

        float vignetteStrength = smoothstep(0.25, 1.45, r2);
        color *= 1.0 - vignette * vignetteStrength;
        float grain = (hash(floor(vUv * resolution) + floor(time * 24.0)) - 0.5) * noise;
        color += grain;
        if (levels > 1.0) color = floor(color * levels + 0.5) / levels;
        color *= edge;
        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
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
  displayCanvas.style.filter = "contrast(1.015) saturate(1.01)";
  displayCanvas.style.display = "block";

  const mount = renderer.domElement.parentElement;
  if (mount) mount.appendChild(displayCanvas);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.zIndex = "0";
  renderer.domElement.style.opacity = "0";

  function setProfile(name) {
    if (!Object.prototype.hasOwnProperty.call(profiles, name)) return false;
    profileName = name;
    const profile = { ...profiles[name] };
    // Mobile devices and reduced-motion users get a less noisy, cheaper-looking signal.
    if (lowPower) {
      profile.noise *= 0.65;
      profile.jitter *= 0.4;
      profile.mask *= 0.5;
    }
    if (reducedMotion) {
      profile.jitter = 0;
      profile.interlace = 0;
      profile.noise *= 0.45;
    }
    for (const key of Object.keys(profile)) {
      const uniformName = key === "levels" ? "levels" : key;
      postMaterial.uniforms[uniformName].value = profile[key];
    }
    return true;
  }

  function getProfile() { return profileName; }

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

  function renderScene(scene, camera, timeSeconds = performance.now() / 1000) {
    postMaterial.uniforms.cameraNear.value = camera.near;
    postMaterial.uniforms.cameraFar.value = camera.far;
    postMaterial.uniforms.time.value = timeSeconds;
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
    displayContext.globalAlpha = 0.035;
    displayContext.fillStyle = "#000000";
    for (let y = 1; y < height; y += 4) displayContext.fillRect(0, y, width, 1);
    if (!reducedMotion) {
      displayContext.globalAlpha = 0.003 + Math.sin(timeSeconds * 4.5) * 0.0015;
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

  const requestedProfile = new URLSearchParams(window.location.search).get("fx");
  setProfile(requestedProfile && profiles[requestedProfile] ? requestedProfile : "clean");
  renderer.getSize(size);
  setSize(size.x, size.y);
  return { setSize, renderScene, present, triggerZoom, setProfile, getProfile, profiles, dispose };
}

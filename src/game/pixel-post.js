// Lightweight pixel/CRT compositor for Three.js r169.
// Keeps the depth-aware blur and nearest-neighbour raster while adding configurable,
// GPU-side CRT/VHS effects. Profiles can be selected with ?fx=dos|vintage|crt|vhs|psx|clean|off.
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
    off:   { curvature: 0, chroma: 0, scanline: 0, vignette: 0, noise: 0, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 0 },
    clean: { curvature: 0.008, chroma: 0, scanline: 0, vignette: 0.08, noise: 0.002, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 0 },
    crt:   { curvature: 0.035, chroma: 0.00035, scanline: 0.035, vignette: 0.15, noise: 0.004, jitter: 0.00005, interlace: 0.012, mask: 0.012, levels: 0, retro: 0 },
    vhs:   { curvature: 0.055, chroma: 0.0026, scanline: 0.055, vignette: 0.18, noise: 0.035, jitter: 0.0018, interlace: 0.075, mask: 0.015, levels: 0 },
    psx:     { curvature: 0.018, chroma: 0.0002, scanline: 0, vignette: 0.09, noise: 0.002, jitter: 0, interlace: 0, mask: 0, levels: 20, retro: 0 },
    vintage: { curvature: 0.006, chroma: 0, scanline: 0, vignette: 0.13, noise: 0.006, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 1 },
    dos:     { curvature: 0, chroma: 0, scanline: 0, vignette: 0.04, noise: 0, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 2 }
  };
  let profileName = "vintage";

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
      levels: { value: 0 },
      retro: { value: 1 }
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
      uniform float retro;
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

        // Warm, slightly faded archival grade. No analog scanline or RGB-split effect.
        if (retro > 0.5) {
          vec3 faded = mix(color, vec3(0.91, 0.84, 0.68), 0.10);
          faded = (faded - vec3(0.025)) * 0.96 + vec3(0.035, 0.027, 0.012);
          color = mix(color, faded, min(retro, 1.0));
        }

        // Optional Windows/DOS 256-colour look: RGB 3:3:2 quantisation with restrained
        // ordered dithering, using the source pixel grid rather than screen-line overlays.
        if (retro > 1.5) {
          vec2 cell = mod(floor(vUv * resolution), 4.0);
          float bayer = (cell.x == 0.0 ? (cell.y == 0.0 ? 0.0 : cell.y == 1.0 ? 8.0 : cell.y == 2.0 ? 2.0 : 10.0)
                                      : cell.x == 1.0 ? (cell.y == 0.0 ? 12.0 : cell.y == 1.0 ? 4.0 : cell.y == 2.0 ? 14.0 : 6.0)
                                      : cell.x == 2.0 ? (cell.y == 0.0 ? 3.0 : cell.y == 1.0 ? 11.0 : cell.y == 2.0 ? 1.0 : 9.0)
                                                      : (cell.y == 0.0 ? 15.0 : cell.y == 1.0 ? 7.0 : cell.y == 2.0 ? 13.0 : 5.0);
          float dither = (bayer / 16.0 - 0.5) / 7.0;
          color.r = floor(clamp(color.r + dither, 0.0, 1.0) * 7.0 + 0.5) / 7.0;
          color.g = floor(clamp(color.g + dither, 0.0, 1.0) * 7.0 + 0.5) / 7.0;
          color.b = floor(clamp(color.b + dither * 0.5, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
        } else if (levels > 1.0) {
          color = floor(color * levels + 0.5) / levels;
        }
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
  displayCanvas.style.filter = "contrast(1.035) saturate(.84) sepia(.10)";
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
    // Keep the presentation clean: no fixed scanline overlay, flicker, or fake TV noise.
    // The vintage grade and optional DOS palette are applied in the scene shader instead.
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
  setProfile(requestedProfile && profiles[requestedProfile] ? requestedProfile : "dos");
  renderer.getSize(size);
  setSize(size.x, size.y);
  return { setSize, renderScene, present, triggerZoom, setProfile, getProfile, profiles, dispose };
}

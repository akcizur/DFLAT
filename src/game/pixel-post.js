// Low-resolution pixel compositor for Three.js r169.
//
// The world is rasterized only 15 times per second. A very cheap full-screen pass
// presents at 60 Hz and reveals each saved frame in a horizontal scan, like pixels
// being loaded into a slow retro display. The scan uses two nearest-filtered buffers.
export function createPixelPostProcess(THREE, renderer) {
  const makeTarget = () => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false
    });
    target.texture.generateMipmaps = false;
    // Keep the world buffer in linear space; the final pass applies tone mapping
    // and converts to the display color space exactly once.
    target.texture.colorSpace = THREE.NoColorSpace;
    return target;
  };

  const targets = [makeTarget(), makeTarget()];
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const uniforms = {
    tDiffuse: { value: targets[0].texture },
    tPrevious: { value: targets[0].texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uBloomStrength: { value: 0.15 },
    uSaturation: { value: 0.91 },
    uScanProgress: { value: 1 },
    uScanGlow: { value: reducedMotion ? 0 : 1 },
    uZoom: { value: 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tDiffuse;
      uniform sampler2D tPrevious;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uBloomStrength;
      uniform float uSaturation;
      uniform float uScanProgress;
      uniform float uScanGlow;
      uniform float uZoom;
      varying vec2 vUv;

      float luminance(vec3 c) {
        return dot(c, vec3(0.2126, 0.7152, 0.0722));
      }
      vec3 acesFit(vec3 x) {
        x = max(x, vec3(0.0));
        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
      }
      float toSrgb(float c) {
        c = max(c, 0.0);
        return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
      }
      vec3 toSrgb(vec3 c) {
        return vec3(toSrgb(c.r), toSrgb(c.g), toSrgb(c.b));
      }

      vec3 scenePixel(vec2 p) {
        p = clamp(p, vec2(0.001), vec2(0.999));
        float scanY = 1.0 - uScanProgress;
        float loaded = step(scanY, p.y);
        return mix(texture2D(tPrevious, p).rgb, texture2D(tDiffuse, p).rgb, loaded);
      }
      vec3 brightTap(vec2 p) {
        vec3 c = scenePixel(p);
        return c * smoothstep(0.64, 0.94, luminance(c));
      }

      void main() {
        vec2 texel = 1.0 / max(uResolution, vec2(1.0));
        // A damped camera pulse can be triggered by the start/pause UI.
        vec2 uv = (vUv - 0.5) / max(0.82, 1.0 + uZoom) + 0.5;
        uv = clamp(uv, vec2(0.001), vec2(0.999));
        vec3 base = scenePixel(uv);

        // Chunky nearest-filtered glow: small taps bloom without smearing pixel edges.
        vec3 bloom =
          brightTap(uv + vec2(texel.x, 0.0)) * 0.18 +
          brightTap(uv - vec2(texel.x, 0.0)) * 0.18 +
          brightTap(uv + vec2(0.0, texel.y)) * 0.18 +
          brightTap(uv - vec2(0.0, texel.y)) * 0.18 +
          brightTap(uv + vec2(texel.x * 2.0, 0.0)) * 0.08 +
          brightTap(uv - vec2(texel.x * 2.0, 0.0)) * 0.08 +
          brightTap(uv + vec2(0.0, texel.y * 2.0)) * 0.08 +
          brightTap(uv - vec2(0.0, texel.y * 2.0)) * 0.08;
        base += bloom * uBloomStrength * (0.98 + 0.02 * sin(uTime * 0.7));

        // Gentle warmth around bright scenery, quantized to render-pixel scale.
        float sunDistance = length((uv - vec2(0.82, 0.20)) * vec2(1.0, 1.15));
        float sunMask = smoothstep(0.20, 0.72, luminance(base)) * (1.0 - smoothstep(0.12, 0.82, sunDistance));
        float rayA = exp(-abs(uv.y - (0.20 + (uv.x - 0.82) * 0.27)) * 84.0);
        float rayB = exp(-abs(uv.y - (0.275 + (uv.x - 0.82) * 0.27)) * 108.0);
        float rays = (rayA + rayB * 0.65) * sunMask;
        base += vec3(0.92, 0.70, 0.42) * rays * 0.035;

        float gray = luminance(base);
        base = mix(vec3(gray), base, uSaturation);
        base = max((base - vec3(0.12)) * 1.04 + vec3(0.12), vec3(0.0));

        // Tiny deterministic dither is locked to source pixels, not CSS pixels.
        float dither = (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y) * 3.0, 4.0) - 1.5) / 768.0;
        base += vec3(dither);

        // Load line descends through the frame. Amber glow is only a few source pixels wide.
        float scanY = 1.0 - uScanProgress;
        float lineDistance = abs(vUv.y - scanY);
        float lineWidth = max(texel.y * 1.25, 0.002);
        float lineGlow = (1.0 - smoothstep(lineWidth, lineWidth * 2.5, lineDistance)) *
                         (1.0 - step(0.999, uScanProgress)) * uScanGlow;
        base += vec3(1.0, 0.30, 0.055) * lineGlow * 0.085;

        base = acesFit(base);
        float vignette = smoothstep(0.28, 0.78, length(vUv - 0.5));
        base *= 1.0 - vignette * 0.09;
        gl_FragColor = vec4(clamp(toSrgb(base), 0.0, 1.0), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });

  const postScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  postCamera.position.z = 1;

  let currentIndex = -1;
  let previousIndex = 0;
  let lastSceneRenderTime = 0;
  let zoomStart = -1000;
  let zoomAmount = 0;
  const size = new THREE.Vector2();

  function setSize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    for (const target of targets) target.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
  }

  function triggerZoom(amount = 0.05) {
    if (reducedMotion) return;
    zoomAmount = Math.max(-0.08, Math.min(0.09, amount));
    zoomStart = performance.now() / 1000;
  }

  function renderScene(scene, camera, timeSeconds = 0) {
    const nextIndex = currentIndex < 0 ? 0 : 1 - currentIndex;
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(targets[nextIndex]);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(previousTarget);

    previousIndex = currentIndex < 0 ? nextIndex : currentIndex;
    currentIndex = nextIndex;
    lastSceneRenderTime = timeSeconds;
  }

  function present(timeSeconds = 0) {
    if (currentIndex < 0) return;

    uniforms.tDiffuse.value = targets[currentIndex].texture;
    uniforms.tPrevious.value = targets[previousIndex].texture;
    uniforms.uTime.value = timeSeconds;

    const elapsed = timeSeconds - zoomStart;
    uniforms.uZoom.value = elapsed >= 0 && elapsed < 1.15
      ? zoomAmount * Math.exp(-elapsed * 4.8) * Math.cos(elapsed * 8.0)
      : 0;

    const renderIntervalSeconds = 1 / 15;
    uniforms.uScanProgress.value = Math.max(0, Math.min(1,
      (timeSeconds - lastSceneRenderTime) / renderIntervalSeconds
    ));

    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  function dispose() {
    targets.forEach(target => target.dispose());
    material.dispose();
    quad.geometry.dispose();
  }

  renderer.getSize(size);
  setSize(size.x, size.y);
  return { setSize, renderScene, present, triggerZoom, dispose };
}

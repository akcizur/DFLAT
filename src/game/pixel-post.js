// Low-resolution, pixel-preserving cinematic post-process for Three.js r169.
// Bright pixels bloom in chunky screen-space taps; scene geometry stays un-antialiased.
export function createPixelPostProcess(THREE, renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false
  });
  target.texture.generateMipmaps = false;
  target.texture.colorSpace = THREE.NoColorSpace;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const uniforms = {
    tDiffuse: { value: target.texture },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uBloomStrength: { value: 0.19 },
    uSaturation: { value: 0.88 },
    uZoom: { value: 0 },
    uMotion: { value: reducedMotion ? 0 : 1 }
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
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uBloomStrength;
      uniform float uSaturation;
      uniform float uZoom;
      uniform float uMotion;
      varying vec2 vUv;

      float luminance(vec3 c) {
        return dot(c, vec3(0.2126, 0.7152, 0.0722));
      }
      vec3 brightTap(vec2 p) {
        vec3 c = texture2D(tDiffuse, clamp(p, vec2(0.001), vec2(0.999))).rgb;
        return c * smoothstep(0.68, 0.94, luminance(c));
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

      void main() {
        vec2 texel = 1.0 / max(uResolution, vec2(1.0));
        // A tiny damped zoom pulse gives screen transitions a camera-like cut.
        vec2 uv = (vUv - 0.5) / max(0.82, 1.0 + uZoom) + 0.5;
        uv = clamp(uv, vec2(0.001), vec2(0.999));
        vec3 base = texture2D(tDiffuse, uv).rgb;
        float lum = luminance(base);

        // Nearest-filtered, thresholded bloom: deliberately chunky, never a smooth blur.
        vec3 bloom =
          brightTap(uv + vec2(texel.x, 0.0)) * 0.18 +
          brightTap(uv - vec2(texel.x, 0.0)) * 0.18 +
          brightTap(uv + vec2(0.0, texel.y)) * 0.18 +
          brightTap(uv - vec2(0.0, texel.y)) * 0.18 +
          brightTap(uv + vec2(texel.x * 2.0, 0.0)) * 0.08 +
          brightTap(uv - vec2(texel.x * 2.0, 0.0)) * 0.08 +
          brightTap(uv + vec2(0.0, texel.y * 2.0)) * 0.08 +
          brightTap(uv - vec2(0.0, texel.y * 2.0)) * 0.08;
        float pulse = 0.97 + 0.03 * sin(uTime * 0.65 * uMotion);
        base += bloom * uBloomStrength * pulse;

        // Two restrained, pixel-width sunshine streaks near bright upper scenery.
        float sunDistance = length((uv - vec2(0.82, 0.20)) * vec2(1.0, 1.15));
        float sunMask = smoothstep(0.22, 0.68, lum) * (1.0 - smoothstep(0.12, 0.82, sunDistance));
        float rayA = exp(-abs(uv.y - (0.20 + (uv.x - 0.82) * 0.27)) * 84.0);
        float rayB = exp(-abs(uv.y - (0.275 + (uv.x - 0.82) * 0.27)) * 108.0);
        float stripeMod = 0.58 + 0.42 * sin((uv.x * 0.72 + uv.y * 0.18 + uTime * 0.012 * uMotion) * 44.0);
        float rays = (rayA + rayB * 0.65) * stripeMod * sunMask;
        base += vec3(0.92, 0.83, 0.66) * rays * 0.055;

        // Slightly faded cinematic palette; keep enough contrast for crisp PS1 silhouettes.
        float gray = luminance(base);
        base = mix(vec3(gray), base, uSaturation);
        base = max((base - vec3(0.18)) * 1.035 + vec3(0.18), vec3(0.0));

        // Deterministic low-amplitude dither locked to render pixels (not CSS pixels).
        float dither = (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y) * 3.0, 4.0) - 1.5) / 1024.0;
        base += vec3(dither);
        base = acesFit(base);
        float vignette = smoothstep(0.28, 0.78, length(vUv - 0.5));
        base *= 1.0 - vignette * 0.10;
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

  let zoomStart = -1000;
  let zoomAmount = 0;
  const size = new THREE.Vector2();

  function setSize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    target.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
  }

  function triggerZoom(amount = 0.05) {
    if (reducedMotion) return;
    zoomAmount = Math.max(-0.08, Math.min(0.09, amount));
    zoomStart = performance.now() / 1000;
  }

  function render(scene, camera, timeSeconds = 0) {
    uniforms.uTime.value = timeSeconds;
    const elapsed = timeSeconds - zoomStart;
    uniforms.uZoom.value = elapsed >= 0 && elapsed < 1.15
      ? zoomAmount * Math.exp(-elapsed * 4.8) * Math.cos(elapsed * 8.0)
      : 0;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  function dispose() {
    target.dispose();
    material.dispose();
    quad.geometry.dispose();
  }

  // The resize() call updates this target to the same internal pixel resolution.
  renderer.getSize(size);
  setSize(size.x, size.y);
  return { setSize, render, triggerZoom, dispose };
}

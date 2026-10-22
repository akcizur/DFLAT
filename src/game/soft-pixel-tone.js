// One lightweight color-grade pass at the game's existing low resolution.
// No blur, noise, scanlines, bloom, or chromatic offset.
export function createSoftPixelTone({ THREE, renderer, enabled = true, strength = 0.2 }) {
  const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    depthBuffer: true,
    stencilBuffer: false
  });
  renderTarget.texture.generateMipmaps = false;

  const passScene = new THREE.Scene();
  const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  passCamera.position.z = 1;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: renderTarget.texture },
      uStrength: { value: Math.max(0, Math.min(1, strength)) }
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
      uniform float uStrength;
      varying vec2 vUv;

      void main() {
        vec4 sampleColor = texture2D(tDiffuse, vUv);
        vec3 source = max(sampleColor.rgb, vec3(0.0));
        float luminance = dot(source, vec3(0.2126, 0.7152, 0.0722));

        // A restrained warm grade with a tiny contrast and saturation lift.
        vec3 warmTone = source * vec3(1.055, 1.018, 0.965);
        warmTone = (warmTone - vec3(0.5)) * 1.035 + vec3(0.5);
        warmTone = mix(vec3(luminance), warmTone, 1.04);

        vec3 graded = mix(source, warmTone, clamp(uStrength, 0.0, 1.0));
        gl_FragColor = vec4(max(graded, vec3(0.0)), sampleColor.a);
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  passScene.add(quad);

  let isEnabled = Boolean(enabled);

  function setSize(width, height) {
    renderTarget.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
  }

  function render(scene, camera) {
    if (!isEnabled) {
      renderer.render(scene, camera);
      return;
    }

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    try {
      renderer.render(scene, camera);
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
    renderer.render(passScene, passCamera);
  }

  return {
    get enabled() { return isEnabled; },
    toggle() {
      isEnabled = !isEnabled;
      return isEnabled;
    },
    setEnabled(value) {
      isEnabled = Boolean(value);
      return isEnabled;
    },
    setSize,
    render,
    dispose() {
      renderTarget.dispose();
      material.dispose();
      quad.geometry.dispose();
    }
  };
}

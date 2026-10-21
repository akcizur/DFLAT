// Shared low-poly palette with small, tiled pixel textures for tactile surfaces.
export function createMaterials(THREE) {
  const mat = (color, roughness = 1, map = null, metalness = 0) => new THREE.MeshStandardMaterial({
    color, roughness: Math.max(roughness, 0.78), metalness: Math.min(metalness, 0.12), flatShading: true, dithering: false, ...(map ? { map } : {})
  });

  function pixelTexture(base, accent, seed = 1, repeatX = 3, repeatY = 3) {
    const canvas = document.createElement("canvas");
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = base; ctx.fillRect(0, 0, 16, 16);
    // Deterministic chunky dither marks: deliberately no smooth noise or filtering.
    let n = seed >>> 0;
    const rand = () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
    for (let i = 0; i < 34; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.28;
      ctx.fillStyle = accent;
      const x = Math.floor(rand() * 8) * 2, y = Math.floor(rand() * 8) * 2;
      ctx.fillRect(x, y, 2 * (rand() > 0.8 ? 2 : 1), 2);
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  const wallTex = pixelTexture("#d2c7ac", "#a89b80", 11, 2, 1);
  const floorTex = pixelTexture("#806c55", "#b18a62", 23, 6, 4);
  const woodTex = pixelTexture("#77563f", "#c09162", 37, 3, 2);
  const clothTex = pixelTexture("#657267", "#a6b09b", 49, 2, 2);
  const M = {
    wall: mat(0xd2c7ac, 1, wallTex), wall2: mat(0xb8ad95), white: mat(0xe6dfcd),
    floor: mat(0x806c55, 1, floorTex), wood: mat(0x77563f, 1, woodTex), wood2: mat(0x9b7455, 1, woodTex),
    darkWood: mat(0x4e3a2e), black: mat(0x252625), metal: mat(0x85877f, .32, null, 0.42), glass: mat(0x6b8990, .24, null, 0.12),
    sofa: mat(0x657267, 1, clothTex), sofaDark: mat(0x4e5a50), cloth: mat(0xc4b6a1), rug: mat(0x9b5544),
    green: mat(0x718365), leaf: mat(0x70815d), yellow: mat(0xd7b85a), ceramic: mat(0xd4d4c8, .28),
    tile: mat(0xaaa99d), dark: mat(0x3a3833), light: mat(0xf4d8a2), screen: mat(0x37474a, .2, null, 0.08),
    fridge: mat(0xc6c6ba), bedding: mat(0x8b9a9a), blanket: mat(0x994c43), plant: mat(0x47634a)
  };
  return { M, mat };
}

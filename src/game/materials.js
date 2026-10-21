// Shared low-poly material palette for the apartment scene.
export function createMaterials(THREE) {
  const mat = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
      const M = {
        wall: mat(0xd2c7ac), wall2: mat(0xb8ad95), white: mat(0xe6dfcd), floor: mat(0x806c55), wood: mat(0x77563f), wood2: mat(0x9b7455), darkWood: mat(0x4e3a2e), black: mat(0x252625), metal: mat(0x85877f), glass: mat(0x6b8990, .65), sofa: mat(0x657267), sofaDark: mat(0x4e5a50), cloth: mat(0xc4b6a1), rug: mat(0x9b5544), green: mat(0x718365), leaf: mat(0x70815d), yellow: mat(0xd7b85a), ceramic: mat(0xd4d4c8), tile: mat(0xaaa99d), dark: mat(0x3a3833), light: mat(0xf4d8a2), screen: mat(0x37474a), fridge: mat(0xc6c6ba), bedding: mat(0x8b9a9a), blanket: mat(0x994c43), plant: mat(0x47634a)
      };

  return { M, mat };
}

// Original procedural architecture for a compact late-1980s Central European panel-housing estate.
export const PANELAK_LAYOUT = Object.freeze([
  { id: "panelak-west-a", x: -17.2, z: -29, floors: 4, width: 10.6, length: 34.4, height: 11.6 },
  { id: "panelak-east-a", x: 17.2, z: -29, floors: 4, width: 10.6, length: 34.4, height: 11.6 },
  { id: "panelak-west-b", x: -17.2, z: -67, floors: 4, width: 10.6, length: 34.4, height: 11.6 },
  { id: "panelak-east-b", x: 17.2, z: -67, floors: 4, width: 10.6, length: 34.4, height: 11.6 }
]);

const MATERIALS = Object.freeze({
  concrete: 0xa6a69e, concreteLight: 0xb7b5aa, concreteCool: 0x979d9b,
  concreteBand: 0x858983, plinth: 0x747873, windowFrame: 0xd0cec3,
  glass: 0x35474b, glassWarm: 0x625c4d, balcony: 0xaaa99f,
  metal: 0x626a68, doorFrame: 0x8d918b, door: 0x464f4b,
  doorGlass: 0x293b3c, canopy: 0x8c918b, sign: 0xc3bfa9,
  roof: 0x777c77, roofRoom: 0x92958c, vent: 0x626a66,
  path: 0x8e918a, pathLight: 0xa5a59a, curb: 0xaaa99f,
  asphaltMark: 0xc9c8bb, lamp: 0x555e5b, lampGlass: 0xc8c2a4,
  bench: 0x5b625b, benchWood: 0x777064, bin: 0x515a57,
  planter: 0x777d75, soil: 0x5f675a, grass: 0x68745f
});

export function createPanelakDistrict({ THREE, scene }) {
  const batches = new Map();
  const meshes = [];
  // The first block has a walkable ground floor. Its perimeter and door opening
  // are collision-tested by panelak-interior.js; the other blocks remain solid.
  const colliders = PANELAK_LAYOUT.slice(1).map(building => ({
    minX: building.x - building.width / 2,
    maxX: building.x + building.width / 2,
    minZ: building.z - building.length / 2,
    maxZ: building.z + building.length / 2
  }));

  function box(materialName, width, height, depth, x, y, z) {
    const dimensions = [width, height, depth].map(value => Math.max(0.01, Math.round(value * 1000) / 1000));
    const key = dimensions.join(",") + "|" + materialName;
    let batch = batches.get(key);
    if (!batch) {
      batch = { dimensions, materialName, positions: [] };
      batches.set(key, batch);
    }
    batch.positions.push({ x, y, z });
  }

  const bayOffsets = [-14, -10, -6, -2, 2, 6, 10, 14];

  PANELAK_LAYOUT.forEach((building, buildingIndex) => {
    const { x, z, floors, width, length, height } = building;
    const halfWidth = width / 2;
    const halfLength = length / 2;
    const floorHeight = height / floors;

    if (buildingIndex === 0) {
      // Keep the upper three floors solid, leaving the ground floor open for the interior.
      box("concrete", width, height - floorHeight, length, x, (height + floorHeight) / 2, z);
    } else {
      box(buildingIndex % 2 === 0 ? "concrete" : "concreteCool", width, height, length, x, height / 2, z);
    }
    if (buildingIndex === 0) {
      // Keep the street-facing east plinth aligned with the entrance opening.
      const entranceZ = z;
      box("plinth", 0.18, 0.64, length+0.16, x-halfWidth-0.02, 0.32, z);
      for (const [start, end] of [[z-halfLength-0.08, entranceZ-1.3], [entranceZ+1.3, z+halfLength+0.08]]) {
        box("plinth", 0.18, 0.64, end-start, x+halfWidth+0.02, 0.32, (start+end)/2);
      }
      box("plinth", width+0.16, 0.64, 0.18, x, 0.32, z-halfLength-0.02);
      box("plinth", width+0.16, 0.64, 0.18, x, 0.32, z+halfLength+0.02);
    } else {
      box("plinth", width + 0.16, 0.64, length + 0.16, x, 0.32, z);
    }

    // Flat roof, low parapet and a small service room typical of prefabricated blocks.
    box("roof", width + 0.08, 0.16, length + 0.08, x, height + 0.04, z);
    box("roofRoom", 2.55, 1.12, 3.8, x, height + 0.64, z + 1.1);
    box("doorFrame", 0.10, 0.82, 0.66, x, height + 0.49, z + 3.15);
    for (const side of [-1, 1]) {
      box("roof", 0.18, 0.42, length + 0.18, x + side * (halfWidth + 0.02), height + 0.27, z);
      box("roof", width + 0.18, 0.42, 0.18, x, height + 0.27, z + side * (halfLength + 0.02));
      for (const offset of [-12.5, -7.5, 7.5, 12.5]) {
        box("vent", 0.42, 0.68, 0.48, x + side * 3.55, height + 0.42, z + offset);
        box("roof", 0.54, 0.10, 0.60, x + side * 3.55, height + 0.80, z + offset);
      }
    }

    // Both long facades use repeated panels, deep-set windows and metal balconies.
    for (const side of [-1, 1]) {
      const faceX = x + side * halfWidth;
      for (let floor = 0; floor < floors; floor += 1) {
        const floorY = floorHeight * (floor + 0.5);
        for (let bay = 0; bay < bayOffsets.length; bay += 1) {
          const bayZ = z + bayOffsets[bay];
          if (buildingIndex !== 0 || floor > 0) {
            box((bay + floor + buildingIndex) % 3 === 0 ? "concreteLight" : "concrete",
              0.045, floorHeight - 0.13, 3.88, faceX + side * 0.026, floorY, bayZ);
          }
        }
        const windowY = floorHeight * (floor + 0.51);
        for (let bay = 0; bay < bayOffsets.length; bay += 1) {
          if (buildingIndex === 0 && floor === 0) continue;
          const bayZ = z + bayOffsets[bay];
          const glassType = (bay + floor * 3 + buildingIndex) % 9 === 0 ? "glassWarm" : "glass";
          box("windowFrame", 0.14, 1.48, 1.28, faceX + side * 0.064, windowY, bayZ);
          box(glassType, 0.045, 1.27, 1.05, faceX + side * 0.146, windowY + 0.015, bayZ);
          box("windowFrame", 0.035, 1.20, 0.045, faceX + side * 0.174, windowY, bayZ);
          box("windowFrame", 0.17, 0.075, 1.34, faceX + side * 0.075, windowY - 0.77, bayZ);
        }

        if (floor > 0) {
          for (const offset of [-10, -6, -2, 2, 6, 10]) {
            const balconyY = floorHeight * floor + 0.12;
            const balconyX = faceX + side * 0.66;
            box("balcony", 1.42, 0.16, 1.72, balconyX, balconyY, z + offset);
            box("metal", 0.065, 0.065, 1.72, faceX + side * 1.34, balconyY + 0.70, z + offset);
            box("metal", 0.055, 0.055, 1.72, faceX + side * 1.34, balconyY + 0.30, z + offset);
            for (let rail = 0; rail < 7; rail += 1) {
              box("metal", 0.045, 0.56, 0.045, faceX + side * 1.34, balconyY + 0.48, z + offset + (rail - 3) * 0.245);
            }
            for (const end of [-1, 1]) {
              box("metal", 0.72, 0.055, 0.055, faceX + side * 0.72, balconyY + 0.70, z + offset + end * 0.82);
              box("metal", 0.055, 0.49, 0.055, faceX + side * 1.01, balconyY + 0.48, z + offset + end * 0.82);
            }
          }
        }

        if (floor > 0) {
          box("concreteBand", 0.085, 0.075, length, faceX + side * 0.075, floorHeight * floor, z);
        }
      }

      for (const joint of [-16, -12, -8, -4, 4, 8, 12, 16]) {
        box("concreteBand", 0.075, height - 0.08, 0.055, faceX + side * 0.061, height / 2, z + joint);
      }

      // Recessed entrances with a flat canopy, plaque, light and shallow steps.
      for (const entrance of (buildingIndex === 0 ? [] : [-8, 0, 8])) {
        box("doorFrame", 0.18, 2.28, 1.92, faceX + side * 0.075, 1.13, z + entrance);
        box("door", 0.075, 2.06, 1.48, faceX + side * 0.16, 1.08, z + entrance);
        box("doorGlass", 0.035, 0.67, 0.47, faceX + side * 0.205, 1.52, z + entrance);
        box("canopy", 1.42, 0.14, 2.24, faceX + side * 0.70, 2.34, z + entrance);
        box("sign", 0.055, 0.18, 0.46, faceX + side * 0.19, 2.02, z + entrance);
        box("lampGlass", 0.10, 0.08, 0.25, faceX + side * 0.82, 2.17, z + entrance + 0.62);
        box("pathLight", 0.48, 0.24, 1.93, faceX + side * 0.26, 0.16, z + entrance);
        box("path", 0.38, 0.16, 1.78, faceX + side * 0.63, 0.08, z + entrance);
      }
    }

    // End-wall windows keep the block readable from its corners.
    for (const endSide of [-1, 1]) {
      const faceZ = z + endSide * halfLength;
      for (let floor = 0; floor < floors; floor += 1) {
        const windowY = floorHeight * (floor + 0.51);
        for (const offset of [-2.0, 2.0]) {
          box("windowFrame", 1.38, 1.48, 0.15, x + offset, windowY, faceZ + endSide * 0.065);
          box("glass", 1.14, 1.27, 0.045, x + offset, windowY + 0.015, faceZ + endSide * 0.15);
          box("windowFrame", 0.045, 1.20, 0.035, x + offset, windowY, faceZ + endSide * 0.176);
        }
      }
    }

    // Walkways, planted beds, benches and bins make the outer courtyard usable.
    for (const side of [-1, 1]) {
      const pathX = x + side * (halfWidth + 1.85);
      box("path", 3.05, 0.07, length - 3.2, pathX, 0.015, z);
      for (const entrance of [-8, 0, 8]) {
        box("pathLight", 3.15, 0.055, 1.35, pathX, 0.055, z + entrance);
      }
    }
    const outerSide = x < 0 ? -1 : 1;
    const gardenX = x + outerSide * (halfWidth + 4.15);
    for (const offset of [-11, 0, 11]) {
      const benchZ = z + offset;
      box("benchWood", 1.18, 0.10, 1.85, gardenX, 0.52, benchZ);
      box("bench", 1.22, 0.10, 1.90, gardenX, 0.37, benchZ);
      box("bench", 0.11, 0.39, 0.13, gardenX - 0.45, 0.19, benchZ - 0.70);
      box("bench", 0.11, 0.39, 0.13, gardenX + 0.45, 0.19, benchZ - 0.70);
      box("bench", 0.11, 0.39, 0.13, gardenX - 0.45, 0.19, benchZ + 0.70);
      box("bench", 0.11, 0.39, 0.13, gardenX + 0.45, 0.19, benchZ + 0.70);
      box("bin", 0.42, 0.73, 0.42, gardenX + outerSide * 1.6, 0.38, benchZ + 1.25);
      box("metal", 0.46, 0.08, 0.46, gardenX + outerSide * 1.6, 0.77, benchZ + 1.25);
      box("planter", 1.45, 0.48, 1.65, gardenX + outerSide * 2.2, 0.25, benchZ - 1.6);
      box("soil", 1.27, 0.08, 1.46, gardenX + outerSide * 2.2, 0.52, benchZ - 1.6);
      box("grass", 1.10, 0.20, 1.25, gardenX + outerSide * 2.2, 0.63, benchZ - 1.6);
    }
  });

  // Raised curbs, dashed center line, zebra crossings and simple street lights.
  for (const side of [-1, 1]) {
    box("curb", 0.14, 0.16, 110, side * 4.48, 0.02, -48);
    for (const z of [-19, -30, -41, -52, -63, -74, -85, -94]) {
      const poleX = side * 6.28;
      box("lamp", 0.14, 4.15, 0.14, poleX, 2.075, z);
      box("lamp", 0.72, 0.09, 0.11, poleX - side * 0.35, 4.08, z);
      box("lampGlass", 0.42, 0.10, 0.28, poleX - side * 0.58, 4.00, z);
      box("lamp", 0.20, 0.25, 0.20, poleX, 0.18, z);
    }
  }
  for (const z of [-7, -17, -27, -47, -57, -67, -87, -97]) {
    box("asphaltMark", 0.12, 0.025, 2.15, 0, 0.025, z);
  }
  for (const crossing of [-33, -39, -71, -77]) {
    for (let stripe = 0; stripe < 7; stripe += 1) {
      box("asphaltMark", 8.15, 0.028, 0.23, 0, 0.028, crossing + (stripe - 3) * 0.48);
    }
  }

  const materialCache = new Map();
  for (const batch of batches.values()) {
    const materialName = batch.materialName;
    let material = materialCache.get(materialName);
    if (!material) {
      const isGlass = materialName === "glass" || materialName === "glassWarm" || materialName === "doorGlass";
      const isMetal = materialName === "metal" || materialName === "lamp";
      material = new THREE.MeshStandardMaterial({
        color: MATERIALS[materialName],
        roughness: isGlass ? 0.52 : 0.96,
        metalness: isMetal ? 0.12 : 0
      });
      materialCache.set(materialName, material);
    }
    const [width, height, depth] = batch.dimensions;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const instanced = new THREE.InstancedMesh(geometry, material, batch.positions.length);
    const transform = new THREE.Object3D();
    batch.positions.forEach((position, index) => {
      transform.position.set(position.x, position.y, position.z);
      transform.updateMatrix();
      instanced.setMatrixAt(index, transform.matrix);
    });
    if (THREE.StaticDrawUsage !== undefined) instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    instanced.instanceMatrix.needsUpdate = true;
    instanced.name = "Panelak district / " + materialName + " (" + batch.positions.length + ")";
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    scene.add(instanced);
    meshes.push(instanced);
  }

  return { colliders, meshes, layout: PANELAK_LAYOUT };
}

// DFLAT apartment blockout: clean room volumes, true door openings and stable PS1-style materials.
export function createEmptyWorld({ THREE, scene }) {
  const colliders = [];
  const meshes = [];
  const roomLights = [];
  const interactables = [];
  const meshesToAnimate = [];
  const doorAnimations = [];

  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: 0xaaa59a, roughness: 1, metalness: 0 }),
    wallSide: new THREE.MeshStandardMaterial({ color: 0x89867f, roughness: 1, metalness: 0 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x69665e, roughness: 1, metalness: 0 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x77756e, roughness: 1, metalness: 0 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x62564b, roughness: 1, metalness: 0 }),
    door: new THREE.MeshStandardMaterial({ color: 0x51483f, roughness: 1, metalness: 0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x3d3934, roughness: 1, metalness: 0 }),
    ground: new THREE.MeshBasicMaterial({ color: 0x77786d })
  };

  const WALL_H = 2.8;
  const WALL_T = 0.18;
  const DOOR_W = 1.08;
  const DOOR_H = 2.08;
  const FRAME_T = 0.075;
  const FLOOR_T = 0.16;
  let objectId = 0;

  function box(name, x, y, z, sx, sy, sz, material, { solid = false, castShadow = true, receiveShadow = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    meshes.push(mesh);
    if (solid) colliders.push({
      minX: x - sx / 2, maxX: x + sx / 2,
      minZ: z - sz / 2, maxZ: z + sz / 2
    });
    return mesh;
  }

  function pointLight(name, x, y, z, intensity = 1.15) {
    const light = new THREE.PointLight(0xffe3b4, intensity, 8.5, 1.7);
    light.name = name;
    light.position.set(x, y, z);
    light.castShadow = false;
    scene.add(light);
    roomLights.push(light);
    return light;
  }

  function floorAndCeiling(name, minX, maxX, minZ, maxZ) {
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const sx = maxX - minX;
    const sz = maxZ - minZ;
    box(name + " / floor", cx, -FLOOR_T / 2, cz, sx, FLOOR_T, sz, materials.floor, { receiveShadow: true });
    box(name + " / ceiling", cx, WALL_H + 0.08, cz, sx, 0.16, sz, materials.ceiling, { castShadow: false });
  }

  // A wall parallel to Z. Door opening is cut into the wall first; the lintel
  // only occupies the space above the opening and never intersects the jambs.
  function wallZ(name, x, minZ, maxZ, doorCenterZ = null) {
    const length = maxZ - minZ;
    if (doorCenterZ === null) {
      box(name, x, WALL_H / 2, (minZ + maxZ) / 2, WALL_T, WALL_H, length, materials.wall, { solid: true });
      return;
    }
    const halfDoor = DOOR_W / 2;
    const leftEnd = doorCenterZ - halfDoor;
    const rightStart = doorCenterZ + halfDoor;
    if (leftEnd > minZ) box(name + " / left pier", x, WALL_H / 2, (minZ + leftEnd) / 2, WALL_T, WALL_H, leftEnd - minZ, materials.wall, { solid: true });
    if (maxZ > rightStart) box(name + " / right pier", x, WALL_H / 2, (rightStart + maxZ) / 2, WALL_T, WALL_H, maxZ - rightStart, materials.wall, { solid: true });
    box(name + " / lintel", x, DOOR_H + (WALL_H - DOOR_H) / 2, doorCenterZ, WALL_T, WALL_H - DOOR_H, DOOR_W, materials.wall);
    const frameX = x + (x < 0 ? WALL_T / 2 : -WALL_T / 2);
    box(name + " / frame left jamb", frameX, DOOR_H / 2, doorCenterZ - halfDoor - FRAME_T / 2, WALL_T + FRAME_T, DOOR_H, FRAME_T, materials.frame);
    box(name + " / frame right jamb", frameX, DOOR_H / 2, doorCenterZ + halfDoor + FRAME_T / 2, WALL_T + FRAME_T, DOOR_H, FRAME_T, materials.frame);
    box(name + " / frame head", frameX, DOOR_H + FRAME_T / 2, doorCenterZ, WALL_T + FRAME_T, FRAME_T, DOOR_W + FRAME_T * 2, materials.frame);
  }

  // A wall parallel to X. The header is exactly above the clear doorway.
  function wallX(name, z, minX, maxX, doorCenterX = null) {
    if (doorCenterX === null) {
      box(name, (minX + maxX) / 2, WALL_H / 2, z, maxX - minX, WALL_H, WALL_T, materials.wall, { solid: true });
      return;
    }
    const halfDoor = DOOR_W / 2;
    const leftEnd = doorCenterX - halfDoor;
    const rightStart = doorCenterX + halfDoor;
    if (leftEnd > minX) box(name + " / left pier", (minX + leftEnd) / 2, WALL_H / 2, z, leftEnd - minX, WALL_H, WALL_T, materials.wall, { solid: true });
    if (maxX > rightStart) box(name + " / right pier", (rightStart + maxX) / 2, WALL_H / 2, z, maxX - rightStart, WALL_H, WALL_T, materials.wall, { solid: true });
    box(name + " / lintel", doorCenterX, DOOR_H + (WALL_H - DOOR_H) / 2, z, DOOR_W, WALL_H - DOOR_H, WALL_T, materials.wall);
    box(name + " / frame left jamb", doorCenterX - halfDoor - FRAME_T / 2, DOOR_H / 2, z + WALL_T / 2, FRAME_T, DOOR_H, WALL_T + FRAME_T, materials.frame);
    box(name + " / frame right jamb", doorCenterX + halfDoor + FRAME_T / 2, DOOR_H / 2, z + WALL_T / 2, FRAME_T, DOOR_H, WALL_T + FRAME_T, materials.frame);
    box(name + " / frame head", doorCenterX, DOOR_H + FRAME_T / 2, z + WALL_T / 2, DOOR_W + FRAME_T * 2, FRAME_T, WALL_T + FRAME_T, materials.frame);
  }

  // A basic rectangular room with a single, correctly framed entrance.
  function makeRoom({ name, side, minZ, maxZ, doorZ }) {
    const minX = side === "left" ? -7.2 : 1.55;
    const maxX = side === "left" ? -1.55 : 7.2;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    floorAndCeiling(name, minX, maxX, minZ, maxZ);
    wallZ(name + " / outer wall", side === "left" ? minX : maxX, minZ, maxZ);
    wallX(name + " / end wall A", minZ, minX, maxX);
    wallX(name + " / end wall B", maxZ, minX, maxX);
    wallZ(name + " / corridor wall", side === "left" ? maxX : minX, minZ, maxZ, doorZ);
    pointLight(name + " / ceiling light", centerX, WALL_H - 0.18, centerZ, 1.05);
  }

  // Main corridor and entry threshold.
  floorAndCeiling("Hall", -1.55, 1.55, -11, 11);
  // Room corridor walls form the hallway sides; do not overlay them with solid walls,
  // otherwise their door openings would be visually covered and physically blocked.
  wallX("Hall / back wall", -11, -1.55, 1.55);
  wallX("Hall / entry wall", 11, -1.55, 1.55, 0);
  pointLight("Hall / ceiling light", 0, WALL_H - 0.18, 0, 1.25);
  pointLight("Entry / ceiling light", 0, WALL_H - 0.18, 8.5, 0.85);

  const roomDepth = 7.1;
  const rooms = [
    { name: "Living room", side: "left", minZ: -10.5, maxZ: -3.4, doorZ: -6.95 },
    { name: "Bedroom", side: "left", minZ: -3.25, maxZ: 3.85, doorZ: 0.25 },
    { name: "Kitchen", side: "left", minZ: 4, maxZ: 10.5, doorZ: 7.25 },
    { name: "Bathroom", side: "right", minZ: -10.5, maxZ: -3.4, doorZ: -6.95 },
    { name: "Study", side: "right", minZ: -3.25, maxZ: 3.85, doorZ: 0.25 },
    { name: "Storage", side: "right", minZ: 4, maxZ: 10.5, doorZ: 7.25 }
  ];
  for (const room of rooms) makeRoom(room);

  // Ground extends beyond the apartment for a simple, neutral void backdrop.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), materials.ground);
  ground.name = "Empty world ground / exterior";
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.18;
  ground.frustumCulled = false;
  scene.add(ground);
  meshes.push(ground);

  const coordinateObjects = meshes.map((mesh) => ({
    id: "mesh-" + (++objectId),
    name: mesh.name,
    x: Number(mesh.position.x.toFixed(3)),
    y: Number(mesh.position.y.toFixed(3)),
    z: Number(mesh.position.z.toFixed(3))
  }));

  return {
    colliders,
    interactables,
    meshesToAnimate,
    doorAnimations,
    meshes,
    roomLights,
    navigation: { floorHeight: 0, floors: 1 },
    getCoordinateData: () => ({ schemaVersion: "1.0", units: "metres", objects: coordinateObjects, anchors: [] }),
    exportCoordinateCSV: () => [
      "record_type,id,name,x,y,z",
      ...coordinateObjects.map((o) => ["mesh", o.id, '"' + o.name.replaceAll('"', '""') + '"', o.x, o.y, o.z].join(","))
    ].join("\n")
  };
}

// Additive cyberpunk expansion. Keeps the original CC0 neighbourhood and its model library intact.
export const CYBERPUNK_LAYERS = [
  { id: "street", y: 0, label: "STREET LEVEL" },
  { id: "skyway", y: 5.5, label: "ELEVATED SKYWAY" },
  { id: "upper", y: 11, label: "UPPER TRANSIT" },
  { id: "rooftops", y: 17, label: "ROOFTOP CORRIDORS" }
];

export function createCyberpunkExpansion({ THREE, scene, world, state, ui }) {
  const animated = [];
  const interactables = world.interactables;
  const material = (color, roughness = 0.72, metalness = 0.18, emissive = 0x000000, intensity = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: intensity });
  const mats = {
    concrete: material(0x222b3b, 0.92, 0.12),
    dark: material(0x101622, 0.58, 0.35),
    glass: material(0x172d48, 0.25, 0.55, 0x07172b, 0.8),
    cyan: material(0x30dfff, 0.28, 0.35, 0x00bde8, 2.4),
    pink: material(0xff3fba, 0.3, 0.25, 0x970050, 2.2),
    amber: material(0xffbd62, 0.3, 0.25, 0x9c4a08, 1.6),
    road: material(0x151a25, 0.95, 0.08),
    tire: material(0x080b10, 0.95, 0.05),
    body: material(0x34445d, 0.38, 0.62),
    canopy: material(0x142d42, 0.18, 0.55, 0x061b2b, 1.1)
  };

  function box(name, x, y, z, w, h, d, mat, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createTower(x, z, width, height, depth, index) {
    const root = new THREE.Group();
    root.name = "Cyberpunk vertical tower " + index;
    root.position.set(x, 0, z);
    box("Tower core", 0, height / 2, 0, width, height, depth, mats.concrete, root);
    box("Tower glass facade", 0, height * 0.53, depth / 2 + 0.025, width * 0.78, height * 0.78, 0.05, mats.glass, root);
    for (let floor = 2; floor < height - 1; floor += 2.2) {
      box("Neon floor strip", 0, floor, depth / 2 + 0.09, width * 0.82, 0.055, 0.08, index % 2 ? mats.cyan : mats.pink, root);
    }
    const sideX = (index % 2 ? 1 : -1) * (width / 2 + 0.11);
    box("Vertical neon spine", sideX, height * 0.52, 0, 0.09, height * 0.92, depth * 0.78, index % 2 ? mats.pink : mats.cyan, root);
    scene.add(root);
    world.colliders.push({
      minX: x - width / 2, maxX: x + width / 2,
      minZ: z - depth / 2, maxZ: z + depth / 2
    });
    return root;
  }

  function createSkyway(y, z, width = 12) {
    box("Skyway deck", 0, y, z, width, 0.34, 28, mats.road);
    box("Skyway cyan rail", -width / 2 + 0.12, y + 0.48, z, 0.12, 0.7, 28, mats.cyan);
    box("Skyway pink rail", width / 2 - 0.12, y + 0.48, z, 0.12, 0.7, 28, mats.pink);
    for (let i = -12; i <= 12; i += 4) {
      box("Skyway lane marker", 0, y + 0.18, z + i, 0.12, 0.025, 1.5, mats.amber);
    }
    for (let x = -width / 2 + 1; x <= width / 2 - 1; x += width - 2) {
      box("Skyway support", x, y / 2, z, 0.3, y, 0.3, mats.dark);
    }
  }

  function createVehicle({ x, y, z, type, name, color = null }) {
    const root = new THREE.Group();
    root.name = name;
    root.position.set(x, y, z);
    const bodyMat = color ? material(color, 0.34, 0.58, color, 0.15) : mats.body;
    box(name + " chassis", 0, 0.46, 0, 2.05, 0.48, 3.55, bodyMat, root);
    box(name + " cabin", 0, 0.83, -0.15, 1.42, 0.48, 1.55, mats.canopy, root);
    box(name + " front light L", -0.68, 0.48, -1.79, 0.34, 0.12, 0.06, mats.cyan, root);
    box(name + " front light R", 0.68, 0.48, -1.79, 0.34, 0.12, 0.06, mats.cyan, root);
    if (type === "car") {
      for (const wx of [-0.98, 0.98]) for (const wz of [-1.08, 1.08]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 8), mats.tire);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.3, wz);
        root.add(wheel);
      }
    } else {
      for (const sx of [-1, 1]) {
        box(name + " hover pod", sx * 0.94, 0.18, 0, 0.2, 0.1, 2.3, mats.pink, root);
        const glow = box(name + " hover glow", sx * 0.94, 0.07, 0, 0.42, 0.035, 2.0, mats.cyan, root);
        animated.push({ mesh: glow, baseY: 0.07, phase: sx * 1.7, amplitude: 0.025 });
      }
    }
    scene.add(root);
    const entry = { id: "vehicle-" + type + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, x, z, range: 4.4,
      action: () => {
        if (state.vehicleMode && state.activeVehicleId === entry.id) {
          state.vehicleMode = false;
          state.vehicleType = null;
          state.activeVehicleId = null;
          ui.showToast("Vystoupil jsi. Pohyb pěšky obnoven.");
        } else {
          state.vehicleMode = true;
          state.verticalTraversal = false;
          state.elevationTarget = null;
          state.vehicleType = type;
          state.activeVehicleId = entry.id;
          state.vehicleEntryPosition = { x: entry.x, y, z: entry.z };
          state.cameraMode = "third";
          ui.showToast(type === "car" ? "Vozidlo aktivní: WASD řízení, E vystoupit." :
            type === "hover" ? "Hover car aktivní: arkádový vznos, WASD, E vystoupit." :
              "Flying car aktivní: WASD, SPACE výška letu, E vystoupit.");
        }
      }
    };
    root.userData.vehicleId = entry.id;
    interactables.push(entry);
    return root;
  }

  // The expansion occupies the next district beyond the original street, not its spawn corridor.
  const towerSpecs = [
    [-17, -32, 8, 24, 8], [17, -34, 9, 31, 9],
    [-19, -58, 10, 38, 10], [19, -61, 9, 29, 9],
    [-15, -88, 11, 46, 11], [15, -91, 12, 54, 12],
    [-28, -73, 8, 22, 8], [28, -76, 8, 27, 8]
  ];
  towerSpecs.forEach((spec, index) => createTower(...spec, index));
  createSkyway(CYBERPUNK_LAYERS[1].y, -54, 13);
  createSkyway(CYBERPUNK_LAYERS[2].y, -82, 14);

  // Walkable links between levels: ramps are deliberately broad and arcade-friendly.
  for (const [x, z, y, length] of [[-7, -54, 2.65, 24], [7, -82, 8.1, 24]]) {
    const ramp = box("Vertical city connector ramp", x, y, z, 3.2, 0.22, length, mats.dark);
    ramp.rotation.x = -0.14;
    box("Ramp neon guide", x - 1.5, y + 0.3, z, 0.08, 0.08, length, mats.cyan);
  }

  // Physical props can be picked up and dropped with E. Their transform stays in the scene.
  const props = [];
  for (const [x, z, name, mat] of [
    [-3.4, -20, "Neon cargo crate", mats.pink],
    [3.5, -28, "Utility battery", mats.cyan],
    [-4.1, -43, "Street supply box", mats.amber]
  ]) {
    const mesh = box(name, x, 0.55, z, 0.9, 1.1, 0.9, mat);
    const item = { id: "prop-" + name.toLowerCase().replace(/\s+/g, "-"), name, x, z, range: 3.2, mesh, held: false,
      action: () => {
        if (state.heldObject === item) {
          state.heldObject = null;
          item.held = false;
          item.mesh.position.y = 0.55;
          item.mesh.position.x = state.playerPosition?.x ?? item.mesh.position.x;
          item.mesh.position.z = state.playerPosition?.z ?? item.mesh.position.z;
          item.x = item.mesh.position.x;
          item.z = item.mesh.position.z;
          ui.showToast(name + " odloženo.");
        } else if (!state.heldObject) {
          state.heldObject = item;
          item.held = true;
          ui.showToast(name + " zvednuto. Stiskni E pro odložení.");
        } else {
          ui.showToast("Nejdřív odlož držený objekt.");
        }
      }
    };
    props.push(item);
    interactables.push(item);
  }

  // Smooth arcade lifts make vertical levels reachable without replacing the existing movement system.
  const liftStops = [0, 5.5, 11, 17];
  for (const [x, z, label] of [[-5.2, -53, "Skyway lift"], [5.2, -81, "Upper transit lift"]]) {
    box(label + " platform", x, 0.12, z, 2.5, 0.24, 2.5, mats.dark);
    box(label + " beacon", x, 1.25, z, 0.12, 2.3, 0.12, mats.cyan);
    interactables.push({
      id: "lift-" + label.toLowerCase().replace(/\\s+/g, "-"),
      name: label + " · E / change level",
      x, z, range: 3.4,
      action: () => {
        const current = Number.isFinite(state.elevationTarget) ? state.elevationTarget : 0;
        const index = liftStops.findIndex(level => Math.abs(level - current) < 0.35);
        const next = liftStops[(index + 1 + liftStops.length) % liftStops.length];
        state.elevationTarget = next;
        state.verticalTraversal = true;
        ui.showToast(label + ": přesun na úroveň " + next.toFixed(1) + " m.");
      }
    });
  }

  const traffic = [
    createVehicle({ x: -2.4, y: 0, z: -23, type: "car", name: "Street car", color: 0x46546c }),
    createVehicle({ x: 2.8, y: 0, z: -46, type: "car", name: "Neon taxi", color: 0x8c3b77 }),
    createVehicle({ x: -2.2, y: 5.5, z: -54, type: "hover", name: "Hover car", color: 0x264b75 }),
    createVehicle({ x: 2.2, y: 11, z: -83, type: "flying", name: "Flying car", color: 0x3c3e61 })
  ];

  function update(delta, player) {
    state.playerPosition = { x: player.x, y: player.elevation, z: player.z };
    for (const item of props) {
      if (item.held) {
        const forwardX = -Math.sin(player.yaw), forwardZ = -Math.cos(player.yaw);
        item.mesh.position.set(player.x + forwardX * 1.45, player.elevation + 1.15 + player.jumpHeight, player.z + forwardZ * 1.45);
        item.mesh.rotation.y += delta * 0.35;
        item.x = item.mesh.position.x;
        item.z = item.mesh.position.z;
      }
    }
    const time = performance.now() * 0.001;
    for (const item of animated) item.mesh.position.y = item.baseY + Math.sin(time * 2 + item.phase) * item.amplitude;
    // Tiny hover bob, deterministic and cheap. The city remains low-poly with emissive accents.
    for (const vehicle of traffic) {
      if (state.vehicleMode && vehicle.userData.vehicleId === state.activeVehicleId) {
        vehicle.position.set(player.x, player.elevation, player.z);
        vehicle.rotation.y = player.yaw;
      }
    }
  }

  return { update, traffic, props, layers: CYBERPUNK_LAYERS };
}

// First playable panelák ground-floor interior. Coordinates are metres in the existing world.
export const PANELAK_INTERIOR_LAYOUT = Object.freeze({
  bounds: Object.freeze({ west: -22.5, east: -11.9, north: -46.2, south: -11.8 }),
  entrance: Object.freeze({ x: -22.38, z: -29, width: 1.64 }),
  rooms: Object.freeze(["entrance-hall", "stairwell", "kitchen", "living-room", "bedroom", "bathroom"]),
  interactions: Object.freeze(["entrance-door", "lights"]), staticDoors: Object.freeze(["apartment", "bedroom", "bathroom"])
});
export function createPanelakInterior({ THREE, scene, colliders, interactables }) {
  const root = new THREE.Group();
  root.name = "Panelák A / ground-floor interior";
  scene.add(root);
  const meshes = [];
  const lights = [];
  const material = (color, roughness = 0.94, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mats = {
    concrete: material(0xaaa99e), plaster: material(0xd1cbb9),
    paint: material(0xb6b7ad), floor: material(0x777b77),
    tile: material(0xb9b8aa), wood: material(0x795d43),
    darkWood: material(0x493a30), metal: material(0x59615e, 0.55, 0.28),
    glass: material(0x4e6869, 0.32), fabric: material(0x777f77),
    cushion: material(0x9b8e78), white: material(0xe1dfd1),
    ceramic: material(0xd4d3c7, 0.28), screen: material(0x242b2c, 0.25),
    warm: material(0xf1d8a2, 0.45), green: material(0x536a4d), staticDoor: material(0x858985)
  };
  const box = (name, x, y, z, w, h, d, mat, { collider = false, castShadow = true } = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    root.add(mesh);
    meshes.push(mesh);
    if (collider) colliders.push({ minX: x-w/2, maxX: x+w/2, minZ: z-d/2, maxZ: z+d/2, name });
    return mesh;
  };
  // First west block bounds: x [-22.5,-11.9], z [-46.2,-11.8].
  const west = -22.5, east = -11.9, north = -46.2, south = -11.8;
  const floorY = 0.06, wallY = 1.48, wallH = 2.84;
  box("Interior / terrazzo entrance floor", -17.2, floorY, -29, 10.2, 0.12, 33.8, mats.floor);
  box("Interior / ceiling slab", -17.2, 2.91, -29, 10.2, 0.16, 33.8, mats.concrete, { castShadow: false });

  // Exterior perimeter. The west wall has a real 1.55 m entrance opening.
  const doorwayZ = -29, doorwayHalf = 0.82;
  for (const [a,b] of [[north, doorwayZ-doorwayHalf],[doorwayZ+doorwayHalf,south]]) {
    const length = b-a;
    box("West exterior wall", west+0.08, wallY, (a+b)/2, 0.16, wallH, length, mats.concrete, { collider: true });
  }
  box("East exterior wall", east-0.08, wallY, -29, 0.16, wallH, 33.8, mats.concrete, { collider: true });
  box("North end wall", -17.2, wallY, north+0.08, 10.2, wallH, 0.16, mats.concrete, { collider: true });
  box("South end wall", -17.2, wallY, south-0.08, 10.2, wallH, 0.16, mats.concrete, { collider: true });

  // Wall segments keep the apartment plan open while leaving real door-sized gaps.
  const partition = (z, gapX, gapWidth, name) => {
    const leftEdge = west+0.16, rightEdge = east-0.16;
    const gapA = gapX-gapWidth/2, gapB = gapX+gapWidth/2;
    if (gapA > leftEdge) box(name, (leftEdge+gapA)/2, wallY, z, gapA-leftEdge, wallH, 0.12, mats.plaster, { collider: true });
    if (gapB < rightEdge) box(name, (gapB+rightEdge)/2, wallY, z, rightEdge-gapB, wallH, 0.12, mats.plaster, { collider: true });
  };
  partition(-35.2, -18.1, 1.05, "Stairwell partition");
  partition(-23.2, -15.1, 1.0, "Apartment entry partition");
  partition(-17.4, -15.1, 0.95, "Bedroom partition");
  // Bathroom side walls, with an open door gap facing the small hall.
  box("Bathroom north wall", -14.0, wallY, -20.0, 4.0, wallH, 0.12, mats.plaster, { collider: true });
  box("Bathroom west wall segment", -16.1, wallY, -18.9, 0.12, wallH, 1.9, mats.plaster, { collider: true });
  box("Bathroom west wall segment", -16.1, wallY, -16.7, 0.12, wallH, 1.1, mats.plaster, { collider: true });
  box("Bedroom east wall", -12.05, wallY, -20.3, 0.12, wallH, 6.0, mats.plaster, { collider: true });

  // Stair flight and landings: repeated treads, solid stringers, and a handrail.
  for (let i=0;i<10;i++) {
    const rise = 0.17*(i+1);
    box("Stair tread "+(i+1), -20.1, 0.18+rise/2, -43.2+i*0.72, 3.1, 0.12, 0.68, mats.concrete);
    box("Stair riser "+(i+1), -20.1, 0.18+rise/2-0.09, -43.2+i*0.72-0.31, 3.1, rise, 0.07, mats.plaster);
  }
  box("Stair landing", -20.1, 1.95, -35.9, 3.1, 0.18, 1.55, mats.concrete);
  box("Stair handrail", -18.55, 1.10, -39.8, 0.07, 0.07, 7.2, mats.metal);
  for (let i=0;i<12;i++) box("Stair baluster", -18.55, 0.65, -43.1+i*0.58, 0.055, 0.88, 0.055, mats.metal);
  box("Mailbox bank", -21.25, 1.35, -31.1, 0.24, 0.86, 2.1, mats.metal);
  for (let i=0;i<8;i++) box("Mailbox door "+i, -21.11, 1.15+(i%4)*0.19, -31.75+Math.floor(i/4)*0.65, 0.035, 0.15, 0.55, mats.white);
  box("Intercom panel", -21.12, 1.52, -28.0, 0.06, 0.52, 0.28, mats.metal);
  box("Building notice board", -21.1, 1.5, -26.7, 0.06, 0.72, 0.9, mats.wood);

  // Only the exterior entrance is animated. Interior doors are plain, fixed grey
  // models: no interaction prompt, rotation or moving-door collision.
  const makeStaticDoor = ({ name, x, z, width=0.88, height=2.05, depth=0.07, axis="x", openOffset=0.95 }) => {
    // Static grey door leaves are shown swung open against the adjacent wall.
    // They are deliberately non-interactive and have no collision, so they
    // cannot seal the room openings or trap the player in the hallway.
    const alongZ = axis === "z";
    const offset = openOffset;
    const leaf = box(
      name,
      alongZ ? x : x + offset,
      1.12,
      alongZ ? z + offset : z,
      alongZ ? depth : width,
      height,
      alongZ ? width : depth,
      mats.staticDoor
    );
    return leaf;
  };
  const makeEntranceDoor = () => {
    const width = 1.5, depth = 0.08, x = west + 0.12, z = doorwayZ;
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.1, z + width/2);
    pivot.rotation.y = Math.PI / 2;
    pivot.name = "vchodové dveře hinge";
    root.add(pivot);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(width, 2.05, depth), mats.staticDoor);
    leaf.position.set(width/2, 1.025, 0);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leaf.name = "vchodové dveře";
    pivot.add(leaf);
    const collider = { minX:x-depth/2-0.04, maxX:x+depth/2+0.04, minZ:z-width/2, maxZ:z+width/2, name:"vchodové dveře" };
    colliders.push(collider);
    let opened = false;
    const item = {
      id: "door-vchodove-dvere", name: "Otevřít vchodové dveře", x, z, range: 2.4,
      action() {
        opened = !opened;
        pivot.rotation.y = opened ? 0 : Math.PI / 2;
        if (opened) {
          const index = colliders.indexOf(collider);
          if (index >= 0) colliders.splice(index, 1);
        } else if (!colliders.includes(collider)) colliders.push(collider);
        item.name = (opened ? "Zavřít " : "Otevřít ") + "vchodové dveře";
      }
    };
    interactables.push(item);
    return { pivot, item };
  };
  const entranceDoor = makeEntranceDoor();
  makeStaticDoor({ name:"dveře bytu 1", x:-15.1, z:-23.2, width:0.9, openOffset:0.95 });
  makeStaticDoor({ name:"ložnice", x:-15.1, z:-17.4, width:0.82, openOffset:0.885 });
  makeStaticDoor({ name:"koupelna", x:-16.1, z:-17.6, width:0.72, axis:"z", openOffset:0.91 });

  // A compact, fully furnished late-1980s flat.
  // Kitchen: cabinets, sink, cooker, table and four chairs.
  box("Kitchen floor", -14.2, 0.14, -26.9, 4.0, 0.08, 7.2, mats.tile);
  box("Kitchen counter", -13.0, 0.92, -29.2, 0.55, 0.12, 4.0, mats.wood);
  box("Kitchen cabinet base", -13.0, 0.52, -29.2, 0.55, 0.68, 4.0, mats.plaster);
  for (let i=0;i<4;i++) box("Kitchen upper cabinet "+i, -13.15, 1.9, -30.55+i*0.9, 0.45, 0.62, 0.78, mats.wood);
  box("Sink", -13.0, 1.00, -30.1, 0.30, 0.05, 0.48, mats.ceramic);
  box("Cooker", -13.0, 0.66, -27.2, 0.58, 0.88, 0.62, mats.white);
  box("Kitchen table", -15.0, 0.82, -26.5, 1.3, 0.10, 1.45, mats.wood, {collider:true});
  for (const [x,z] of [[-15.5,-27.1],[-14.5,-27.1],[-15.5,-25.9],[-14.5,-25.9]]) {
    box("Kitchen chair seat", x, 0.48, z, 0.42, 0.09, 0.42, mats.wood, {collider:true});
    box("Kitchen chair back", x, 0.78, z+0.18, 0.42, 0.58, 0.08, mats.wood);
  }
  // Living room: sofa, low table, carpet, cabinet and CRT television.
  box("Living-room carpet", -14.4, 0.17, -35.9, 4.2, 0.04, 5.5, mats.fabric);
  box("Sofa base", -13.1, 0.52, -36.0, 1.0, 0.55, 2.45, mats.fabric, {collider:true});
  box("Sofa back", -12.65, 0.92, -36.0, 0.22, 0.68, 2.45, mats.cushion);
  for (const z of [-36.75,-36.0,-35.25]) box("Sofa cushion", -12.55, 0.82, z, 0.25, 0.16, 0.62, mats.cushion);
  box("Coffee table", -14.4, 0.52, -36.0, 0.92, 0.12, 1.4, mats.wood, {collider:true});
  box("TV cabinet", -16.0, 0.48, -36.0, 0.55, 0.72, 1.8, mats.wood, {collider:true});
  box("CRT television", -15.65, 1.10, -36.0, 0.72, 0.62, 1.1, mats.screen);
  box("TV screen", -15.25, 1.12, -36.0, 0.04, 0.42, 0.76, mats.glass);
  // Bedroom: bed, headboard, bedside table, wardrobe.
  box("Bedroom rug", -13.9, 0.17, -19.1, 3.7, 0.04, 2.9, mats.fabric);
  box("Bed frame", -13.2, 0.42, -18.7, 1.9, 0.35, 2.2, mats.wood, {collider:true});
  box("Mattress", -13.2, 0.66, -18.7, 1.82, 0.18, 2.12, mats.white);
  box("Pillow", -13.2, 0.79, -19.45, 0.62, 0.12, 0.45, mats.cushion);
  box("Wardrobe", -12.35, 1.15, -21.5, 0.78, 2.05, 1.9, mats.wood, {collider:true});
  box("Bedside table", -14.65, 0.48, -19.0, 0.52, 0.68, 0.52, mats.wood, {collider:true});
  // Bathroom: tiled floor, bathtub, sink and WC.
  box("Bathroom tiled floor", -14.0, 0.16, -17.0, 3.7, 0.06, 2.7, mats.tile);
  box("Bathtub", -12.8, 0.48, -16.9, 0.82, 0.55, 2.0, mats.ceramic, {collider:true});
  box("Bathroom sink", -15.0, 0.78, -16.1, 0.58, 0.16, 0.55, mats.ceramic);
  box("Bathroom pedestal", -15.0, 0.42, -16.1, 0.20, 0.55, 0.20, mats.white);
  box("Toilet bowl", -15.1, 0.40, -18.2, 0.52, 0.42, 0.72, mats.ceramic, {collider:true});
  box("Toilet tank", -15.1, 0.83, -18.48, 0.48, 0.52, 0.20, mats.white);

  // Ceiling lamps use real point lights and can be toggled with E.
  const addLamp = (name,x,z,intensity=0.72) => {
    const fixture = box(name+" fixture", x, 2.78, z, 0.42, 0.08, 0.42, mats.warm, {castShadow:false});
    const light = new THREE.PointLight(0xffdfac, intensity, 8, 1.8);
    light.position.set(x,2.62,z);
    light.name = name+" light";
    root.add(light);
    lights.push({light, fixture, on:true});
    interactables.push({
      id:"light-"+name, name:"Zhasnout "+name, x, z, range:1.8,
      action() {
        const record=lights.find(entry=>entry.light===light);
        record.on=!record.on;
        light.visible=record.on;
        fixture.material=record.on?mats.warm:mats.metal;
        this.name=(record.on?"Zhasnout ":"Rozsvítit ")+name;
      }
    });
  };
  addLamp("světlo ve vstupní hale",-20.0,-29.0,0.85);
  addLamp("světlo na schodišti",-20.0,-38.0,0.65);
  addLamp("světlo v kuchyni",-14.0,-27.5,0.7);
  addLamp("světlo v obýváku",-14.0,-35.5,0.8);
  addLamp("světlo v ložnici",-13.8,-19.2,0.55);
  addLamp("světlo v koupelně",-14.0,-17.2,0.5);

  box("Kitchen plant pot", -13.5, 0.52, -25.0, 0.32, 0.65, 0.32, mats.wood);
  box("Kitchen plant leaves", -13.5, 0.96, -25.0, 0.68, 0.52, 0.68, mats.green);
  box("Living-room radiator", -21.9, 0.58, -36.0, 0.22, 0.76, 2.1, mats.white);
  box("Entrance mat", -22.0, 0.14, -29.0, 0.65, 0.03, 1.3, mats.fabric);
  box("Apartment number plaque", -22.25, 2.20, -28.0, 0.05, 0.18, 0.35, mats.white);

  return { meshes, root, entranceDoor, lights, bounds: { west,east,north,south } };
}

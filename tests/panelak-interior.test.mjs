import assert from "node:assert/strict";
import test from "node:test";
import { createPanelakInterior, PANELAK_INTERIOR_LAYOUT } from "../src/game/panelak-interior.js";
import { createPlayerController } from "../src/game/player.js";

class Vector3 {
  set(x, y, z) { this.x=x; this.y=y; this.z=z; return this; }
}
class BoxGeometry { constructor(width,height,depth) { Object.assign(this,{width,height,depth}); } }
class MeshStandardMaterial { constructor(options={}) { Object.assign(this,options); } }
class Mesh {
  constructor(geometry, material) {
    this.geometry=geometry; this.material=material; this.position=new Vector3();
    this.rotation={x:0,y:0,z:0}; this.children=[]; this.visible=true;
  }
  add(child) { this.children.push(child); child.parent=this; }
}
class Group extends Mesh {
  constructor() { super(null,null); this.rotation={x:0,y:0,z:0}; }
}
class PointLight extends Mesh {
  constructor(color,intensity,distance,decay) { super(null,null); Object.assign(this,{color,intensity,distance,decay}); }
}
const THREE={ BoxGeometry, MeshStandardMaterial, Mesh, Group, PointLight };

function makeInterior() {
  const scene=new Group();
  const colliders=[];
  const interactables=[];
  const result=createPanelakInterior({THREE,scene,colliders,interactables});
  return {scene,colliders,interactables,result};
}

test("the first panelak has a documented, human-scale walkable footprint and rooms", () => {
  const {bounds,entrance,rooms,interactions}=PANELAK_INTERIOR_LAYOUT;
  assert.ok(bounds.west < bounds.east && bounds.north < bounds.south);
  assert.ok(entrance.width >= 1.5);
  assert.ok(entrance.x < bounds.east && entrance.x > bounds.east-0.3, "entrance should face the street on the east side");
  assert.equal(entrance.side, "east");
  for (const room of ["entrance-hall","stairwell","kitchen","living-room","bedroom","bathroom"]) {
    assert.ok(rooms.includes(room), "missing room: "+room);
  }
  assert.ok(interactions.includes("entrance-door"));
  assert.ok(interactions.includes("lights"));
  assert.deepEqual(PANELAK_INTERIOR_LAYOUT.staticDoors, ["apartment", "bedroom", "bathroom"]);
});

test("the entrance door opens a collision gap and can be closed again", () => {
  const {colliders,interactables,result}=makeInterior();
  const door=interactables.find(item=>item.name==="Otevřít vchodové dveře");
  assert.ok(door, "entrance door should be interactive");
  const containsEntrance = () => colliders.some(c =>
    -11.98 > c.minX && -11.98 < c.maxX && -29 > c.minZ && -29 < c.maxZ
  );
  assert.equal(containsEntrance(),true,"closed door blocks the doorway");
  door.action();
  assert.equal(containsEntrance(),false,"open door clears its collision volume");
  assert.ok(result.entranceDoor.pivot.rotation.y !== Math.PI/2,"open door rotates on its hinge");
  door.action();
  assert.equal(containsEntrance(),true,"closed door restores its collision volume");
});

test("the interior includes real room geometry, stair parts, and toggleable lights", () => {
  const {colliders,interactables,result}=makeInterior();
  const names=result.meshes.map(mesh=>mesh.name);
  for (const fragment of ["Stair tread","Stair return tread","Stair upper landing","Kitchen counter","Sofa base","Bed frame","Bathtub","Mailbox bank"]) {
    assert.ok(names.some(name=>name.includes(fragment)), "missing geometry: "+fragment);
  }
  const doors=interactables.filter(item=>item.id.startsWith("door-"));
  assert.deepEqual(doors.map(item=>item.id), ["door-vchodove-dvere"], "only the exterior entrance should move");
  assert.ok(names.includes("dveře bytu 1") && names.includes("ložnice") && names.includes("koupelna"), "other doors remain visible as static models");
  for (const name of ["dveře bytu 1", "ložnice", "koupelna"]) {
    const doorMesh=result.meshes.find(mesh=>mesh.name===name);
    assert.ok(doorMesh, "static grey door model should exist: "+name);
    assert.equal(doorMesh.rotation.y, 0, "static door should remain a plain, unanimated model: "+name);
    assert.equal(colliders.some(c=>c.name===name), false, "static door model must not block its opening: "+name);
  }
  const lights=interactables.filter(item=>item.id.startsWith("light-"));
  assert.ok(lights.length>=6,"each room should have a light interaction");
  const light=lights[0];
  const previous=light.name;
  light.action();
  assert.notEqual(light.name,previous,"light interaction label changes");
});

test("the street-facing entrance leads into a visible, navigable interior", () => {
  const {scene,colliders,interactables,result}=makeInterior();
  assert.ok(scene.children.includes(result.root), "the interior root must be attached to the scene");
  assert.equal(result.root.visible, true);
  assert.ok(result.meshes.length > 40, "the interior should contain visible room and furnishing meshes");
  assert.equal(result.meshes.some(mesh=>mesh.name==="Interior / ceiling slab"), false, "the playable blockout stays open-topped for visibility");

  const camera = {
    position: { set() {} },
    rotation: { order: "YXZ", x: 0, y: 0, z: 0 }
  };
  const controller = createPlayerController({
    camera, colliders, interactables, state: { started:true, paused:false },
    ui: { showToast() {}, updateObjective() {} }
  });
  const door=interactables.find(item=>item.id==="door-vchodove-dvere");
  assert.ok(door, "the street entrance needs one interactive door");
  controller.player.x=-10.9;
  controller.player.z=-29;
  controller.player.yaw=Math.PI/2;
  door.action();

  controller.keysDown.KeyW=true;
  for (let frame=0;frame<30;frame++) controller.update(1/60);
  controller.keysDown.KeyW=false;
  assert.ok(controller.player.x < -12.4, "the player must pass through the opened east entrance");

  controller.player.yaw=0;
  controller.keysDown.KeyW=true;
  for (let frame=0;frame<84;frame++) controller.update(1/60);
  controller.keysDown.KeyW=false;
  assert.ok(controller.player.z < -33.8, "the player must be able to walk down the entrance hall");

  controller.keysDown.KeyA=true;
  for (let frame=0;frame<90;frame++) controller.update(1/60);
  controller.keysDown.KeyA=false;
  assert.ok(Math.abs(controller.player.x+18.1)<0.25, "the hall must allow turning toward the stairwell opening");

  controller.keysDown.KeyW=true;
  for (let frame=0;frame<28;frame++) controller.update(1/60);
  controller.keysDown.KeyW=false;
  assert.ok(controller.player.z < -35.4, "the widened stairwell opening must be traversable");
});

test("ground-floor rooms align to the four-storey block's facade window rhythm", () => {
  const { floor, windowBays, roomWindowBays } = PANELAK_INTERIOR_LAYOUT;
  assert.equal(floor.index, 0);
  assert.equal(floor.elevation, 0);
  assert.equal(floor.height, 2.9);
  assert.deepEqual(windowBays, [-43,-39,-35,-31,-27,-23,-19,-15]);
  for (const room of ["living-room","kitchen","bedroom","bathroom","stairwell"]) {
    assert.ok(windowBays.includes(roomWindowBays[room]), room+" should sit on a real facade window bay");
  }

  const { result } = makeInterior();
  const windowGlass = result.meshes.filter(mesh => mesh.name.includes("/ window glass"));
  const windowFrames = result.meshes.filter(mesh => mesh.name.includes("/ window frame"));
  assert.equal(windowGlass.length, 20, "both long facades and both end walls need matching ground-floor windows");
  assert.equal(windowFrames.length, 20, "every glass opening needs a visible frame");
  const longFacadeBays = windowGlass
    .filter(mesh => mesh.userData?.facadeSide)
    .map(mesh => mesh.userData.bayZ);
  assert.equal(longFacadeBays.length, 16, "both long facades should expose all eight window bays");
  assert.deepEqual([...new Set(longFacadeBays)].sort((a,b)=>a-b), [...windowBays].sort((a,b)=>a-b));
  assert.ok(!longFacadeBays.includes(-29), "the east-facing entrance must remain clear instead of becoming a window");
});

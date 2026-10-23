import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PANELAK_LAYOUT } from "../src/game/panelak-config.js";
import { createMainBuildingWorld } from "../src/game/main-building.js";

function makeWorld() {
  const scene = new THREE.Scene();
  const state = { currentFloor: 0, mainBuildingScene: true };
  const ui = { showToast() {}, updateObjective() {} };
  const world = createMainBuildingWorld({ THREE, scene, state, ui });
  scene.updateMatrixWorld(true);
  return { scene, state, world };
}


test("the browser can create a building-free scene with no residual colliders", () => {
  const scene = new THREE.Scene();
  const world = createMainBuildingWorld({
    THREE, scene, state: { currentFloor: 0, emptyMap: true }, ui: { showToast() {} },
    showBuilding: false
  });
  assert.equal(world.colliders.length, 0);
  assert.equal(world.interactables.length, 0);
  const names = world.meshes.map(mesh => mesh.name);
  assert.ok(names.includes("Sídliště / travnatý pozemek"));
  assert.ok(names.some(name => name.startsWith("Silnice /")));
  assert.equal(names.some(name => /Fasáda|Lodžie|Suterén|Schodiště|Hlavní budova|Vchod \/|Okno \/|Střecha \/|Podlaha \/ přízemí/i.test(name)), false);
  assert.deepEqual(world.getCoordinateData().anchors, []);
});

test("the runtime model is an 18 m five-module, four-storey section", () => {
  const { world } = makeWorld();
  const data = world.getCoordinateData();
  assert.equal(PANELAK_LAYOUT.moduleCount, 5);
  assert.equal(PANELAK_LAYOUT.moduleWidth, 3.6);
  assert.equal(data.building.width, 18);
  assert.equal(data.building.depth, 12);
  assert.equal(data.building.floors, 4);
  assert.equal(data.building.modules, 5);
  assert.equal(data.building.moduleWidth, 3.6);
  assert.equal(data.building.apartmentsPerFloor, 2);
  assert.equal(data.building.elevator, false);
  assert.equal(data.building.height, 11.2);
});

test("declared room dimensions reconcile to the 65.4 m² area budget", () => {
  assert.ok(Math.abs(PANELAK_LAYOUT.calculatedRoomArea - 65.4) < 0.01);
  assert.ok(Math.abs(PANELAK_LAYOUT.rooms.reduce((sum, room) => sum + room.area, 0) - 65.4) < 0.01);
  assert.ok(PANELAK_LAYOUT.hallDepth > 1.7 && PANELAK_LAYOUT.hallDepth < 1.8);
  assert.equal(PANELAK_LAYOUT.hallDepth, PANELAK_LAYOUT.bathDepth);
});

test("the outdoor terrain and ground-floor slab no longer share a coplanar surface", () => {
  const { world } = makeWorld();
  const terrain = world.meshes.find(mesh => mesh.name === "Sídliště / travnatý pozemek");
  const slab = world.meshes.find(mesh => mesh.name === "Podlaha / přízemí");
  const plinths = world.meshes.filter(mesh => mesh.name.startsWith("Suterén / základový sokl /"));
  assert.ok(terrain, "outdoor terrain is missing");
  assert.ok(slab, "ground-floor slab is missing");
  assert.equal(plinths.length, 4, "foundation plinth must be a perimeter ring, not a solid cover over the floor");
  const top = mesh => mesh.position.y + mesh.geometry.parameters.height / 2;
  const terrainTop = top(terrain);
  const slabTop = top(slab);
  assert.ok(slabTop > terrainTop, "ground slab must sit above the terrain to prevent z-fighting");
  assert.ok(slabTop - terrainTop <= 0.03, "ground-floor threshold should remain nearly flush");
  for (const plinth of plinths) {
    const plinthTop = top(plinth);
    assert.ok(plinthTop > terrainTop, "foundation plinth must not be coplanar with the terrain");
    assert.ok(plinthTop - terrainTop >= 0.03, "the foundation edge needs a visible vertical separation");
    const size = plinth.geometry.parameters;
    const coversInteriorCenter = Math.abs(plinth.position.x) < size.width / 2 &&
      Math.abs(-22 - plinth.position.z) < size.depth / 2;
    assert.equal(coversInteriorCenter, false, "foundation strip must not cover the central walkable floor");
  }
});


test("staircase is a U-shaped pair of parallel flights inside the glazed stairwell", () => {
  const { world } = makeWorld();
  const lower = world.meshes.filter(mesh => mesh.name === "Schodiště / dolní rameno / stupeň");
  const upper = world.meshes.filter(mesh => mesh.name === "Schodiště / horní rameno / stupeň");
  assert.equal(lower.length, 24);
  assert.equal(upper.length, 24);
  const zSpan = meshes => ({
    min: Math.min(...meshes.map(mesh => mesh.position.z - mesh.geometry.parameters.depth / 2)),
    max: Math.max(...meshes.map(mesh => mesh.position.z + mesh.geometry.parameters.depth / 2))
  });
  const a = zSpan(lower), b = zSpan(upper);
  assert.ok(Math.abs(a.min - b.min) < 0.1 && Math.abs(a.max - b.max) < 0.1,
    "upper and lower flights should be parallel and share the same run");
  const xs = [...new Set(lower.map(mesh => Math.round(mesh.position.x * 100) / 100))];
  assert.equal(xs.length, 1, "lower flight must stay in one stairwell lane");
  assert.ok(world.meshes.filter(mesh => mesh.name === "Schodiště / stěna jádra").length > 0);
  assert.ok(world.meshes.filter(mesh => mesh.name === "Schodiště / mezipodesta").every(mesh =>
    mesh.geometry.parameters.width > 3.0 && mesh.geometry.parameters.depth < 1.5));
  const luxfer = world.meshes.find(mesh => mesh.name === "Schodiště / luxferová tvárnice");
  assert.ok(luxfer, "stairwell luxfer glazing must be present");
  assert.ok(Math.abs(luxfer.position.z - lower[0].position.z) < 8,
    "stair flights should be spatially aligned with the stairwell glazing");
});

test("the stairwell provides three floor transitions and the building has no lift", () => {
  const { world } = makeWorld();
  const lower = world.meshes.filter(mesh => mesh.name === "Schodiště / dolní rameno / stupeň");
  const upper = world.meshes.filter(mesh => mesh.name === "Schodiště / horní rameno / stupeň");
  assert.equal(lower.length, (PANELAK_LAYOUT.totalFloors - 1) * 8);
  assert.equal(upper.length, (PANELAK_LAYOUT.totalFloors - 1) * 8);
  assert.ok(world.meshes.some(mesh => mesh.name === "Schodiště / mezipodesta"));
  assert.equal(world.interactables.some(item => item.id === "elevator"), false);
  assert.equal(world.meshes.some(mesh => /výtah|elevator/i.test(mesh.name)), false);
});

test("each storey has both recessed loggia doorways and the central luxfer stair window", () => {
  const { world } = makeWorld();
  const anchors = new Map(world.getCoordinateData().anchors.map(anchor => [anchor.id, anchor]));
  for (let floor = 0; floor < PANELAK_LAYOUT.totalFloors; floor++) {
    for (const x of [-3.6, 3.6]) {
      const doorway = anchors.get("loggia-door-f" + floor + "-x" + (x < 0 ? "L" : "R"));
      assert.ok(doorway, "missing loggia doorway anchor for floor " + floor + " at x=" + x);
    }
  }
  assert.ok(world.meshes.some(mesh => mesh.name === "Schodiště / luxferová tvárnice"));
  assert.equal(world.getCoordinateData().building.floors, 4);
});


test("loggia floors do not volumetrically overlap apartment floor slabs", () => {
  const { world } = makeWorld();
  const loggias = world.meshes.filter(mesh => mesh.name === "Lodžie / betonová podlaha");
  const terrain = world.meshes.find(mesh => mesh.name === "Sídliště / travnatý pozemek");
  const slabs = world.meshes.filter(mesh =>
    mesh.name === "Podlaha / přízemí" ||
    mesh.name === "Podlaha / přízemí / pás mimo lodžie" ||
    mesh.name.startsWith("Stropní panel /")
  );
  assert.equal(loggias.length, PANELAK_LAYOUT.totalFloors * 2);
  assert.ok(terrain, "terrain is missing");
  const terrainTop = terrain.position.y + terrain.geometry.parameters.height / 2;
  const bounds = mesh => {
    const p = mesh.geometry.parameters;
    return {
      minX: mesh.position.x - p.width / 2, maxX: mesh.position.x + p.width / 2,
      minY: mesh.position.y - p.height / 2, maxY: mesh.position.y + p.height / 2,
      minZ: mesh.position.z - p.depth / 2, maxZ: mesh.position.z + p.depth / 2
    };
  };
  for (const loggia of loggias) {
    const a = bounds(loggia);
    assert.ok(Math.abs(a.maxY - terrainTop) > 1e-3,
      "loggia top must not be coplanar with the terrain");
    for (const slab of slabs) {
      const b = bounds(slab);
      const overlaps = a.maxX > b.minX + 1e-5 && a.minX < b.maxX - 1e-5 &&
        a.maxY > b.minY + 1e-5 && a.minY < b.maxY - 1e-5 &&
        a.maxZ > b.minZ + 1e-5 && a.minZ < b.maxZ - 1e-5;
      assert.equal(overlaps, false, "a loggia floor intersects a floor slab: " + slab.name);
    }
  }
});

test("foundation plinth stays outside the footprint and clear of the ground entrance", () => {
  const { world } = makeWorld();
  const plinths = world.meshes.filter(mesh => mesh.name.startsWith("Suterén / základový sokl /"));
  assert.equal(plinths.length, 4);
  const bounds = mesh => {
    const p = mesh.geometry.parameters;
    return {
      minX: mesh.position.x - p.width / 2, maxX: mesh.position.x + p.width / 2,
      minZ: mesh.position.z - p.depth / 2, maxZ: mesh.position.z + p.depth / 2
    };
  };
  for (const plinth of plinths) {
    const b = bounds(plinth);
    assert.ok(b.maxZ <= -16 + 1e-6 || b.minZ >= -16 - 1e-6 ||
      b.minZ >= -28 - 1e-6 || b.maxZ <= -28 + 1e-6 ||
      b.maxX <= -9 + 1e-6 || b.minX >= 9 - 1e-6,
      "plinth should stay at the building perimeter");
  }
  const frontPlinth = plinths.find(mesh => mesh.name.endsWith("/ přední"));
  assert.ok(frontPlinth.position.z - frontPlinth.geometry.parameters.depth / 2 >= -16 - 1e-6);
});

test("runtime coordinates include finite corners, bounds, and exact footprint anchors", () => {
  const { world } = makeWorld();
  const data = world.getCoordinateData();
  assert.ok(data.objects.length > 500);
  assert.ok(data.anchors.length > 10);
  const anchors = new Map(data.anchors.map(anchor => [anchor.id, anchor]));
  assert.equal(anchors.size, data.anchors.length);
  assert.equal(anchors.get("front-left-ground").position.x, -9);
  assert.equal(anchors.get("front-right-ground").position.x, 9);
  assert.equal(anchors.get("front-left-ground").position.z, -16);
  assert.equal(anchors.get("rear-left-ground").position.z, -28);
  assert.equal(anchors.get("roof-datum").position.y, 11.2);
  for (const object of data.objects) {
    for (const point of [object.center, object.bounds.min, object.bounds.max, ...object.corners]) {
      assert.ok(point && [point.x, point.y, point.z].every(Number.isFinite),
        "non-finite point in " + object.id);
    }
  }
  assert.match(world.exportCoordinateCSV(), /^record_type,id,name,x,y,z,/);
});

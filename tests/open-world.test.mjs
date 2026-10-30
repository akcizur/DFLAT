import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_LAYOUT } from "../src/game/open-world.js";

const ids = new Set(WORLD_LAYOUT.map(item => item.id));
const kinds = new Set(WORLD_LAYOUT.map(item => item.kind));
const zones = new Set(WORLD_LAYOUT.map(item => item.zone));

test("DEPOO is a city assembled from Kenney modular city components", () => {
  assert.ok(WORLD_LAYOUT.length >= 140, "the city should contain a substantial modular layout");
  assert.ok([...ids].every(id => !id.startsWith("space-kit/")), "no space depot assets may remain");
  for (const id of [
    "city-kit-roads/road-straight", "city-kit-roads/road-crossroad",
    "city-kit-commercial/building-a", "city-kit-commercial/building-skyscraper-a",
    "city-kit-suburban/building-type-a", "car-kit/sedan", "nature-kit/tree-oak"
  ]) assert.ok(ids.has(id), "missing DEPOO city component: " + id);
});

test("the city contains connected streets, downtown, housing, civic park and traffic", () => {
  for (const zone of ["street-grid","downtown","market-street","civic-district","residential","civic-park","traffic","city-edge"]) {
    assert.ok(zones.has(zone), "missing DEPOO city zone: " + zone);
  }
  for (const kind of ["road","commercial","tower","house","distant-building","streetlight","traffic-light","vehicle","tree","bench"]) {
    assert.ok(kinds.has(kind), "missing city component category: " + kind);
  }
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "road").length >= 80);
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "house").length >= 8);
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "tower").length >= 4);
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "vehicle").length >= 6);
});

test("every city component has valid coordinates, dimensions and a district", () => {
  for (const item of WORLD_LAYOUT) {
    assert.equal(typeof item.id, "string");
    assert.ok(Number.isFinite(item.x) && Number.isFinite(item.z));
    assert.ok(Number.isFinite(item.y || 0) && Number.isFinite(item.yaw || 0));
    assert.equal(typeof item.zone, "string");
    if (item.scale !== undefined) assert.ok(item.scale > 0);
    if (item.targetHeight !== undefined) assert.ok(item.targetHeight > 0);
    if (item.collider) assert.ok(item.collider.length === 2 && item.collider.every(n => Number.isFinite(n) && n > 0));
  }
});

test("the spawn street and central avenue stay open for first-person movement", () => {
  const anchors = [{ x: 0, z: 46 }, { x: 0, z: 0 }, { x: 0, z: -8 }];
  const blockers = WORLD_LAYOUT.filter(item => item.collider).filter(item =>
    anchors.some(anchor =>
      Math.abs(item.x - anchor.x) < item.collider[0] + 0.35 &&
      Math.abs(item.z - anchor.z) < item.collider[1] + 0.35
    )
  );
  assert.deepEqual(blockers, [], "spawn and central avenue must remain walkable");
});

test("the downtown includes a roundabout, a park and a varied residential ring", () => {
  assert.ok(WORLD_LAYOUT.some(item => item.id === "city-kit-roads/road-roundabout" && item.x === 0 && item.z === 0));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "civic-park" && item.kind === "tree"));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "residential" && item.kind === "house"));
});

test("no depot, monorail, hangar or panelak assets remain", () => {
  assert.ok(WORLD_LAYOUT.every(item => !/space-kit|hangar|monorail|panelak|apartment/.test(item.id)));
});

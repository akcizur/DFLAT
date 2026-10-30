import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_LAYOUT } from "../src/game/open-world.js";

const ids = new Set(WORLD_LAYOUT.map(item => item.id));
const kinds = new Set(WORLD_LAYOUT.map(item => item.kind));
const zones = new Set(WORLD_LAYOUT.map(item => item.zone));
const count = kind => WORLD_LAYOUT.filter(item => item.kind === kind).length;

test("DEPOO is a complete seven-by-seven modular city", () => {
  assert.ok(WORLD_LAYOUT.length >= 600, "the complete city should contain more than 600 placed modules");
  assert.equal(count("road"), 273, "the 7 × 7 connected street grid must have no duplicate road tiles");
  assert.ok([...ids].every(id => !id.startsWith("space-kit/")), "no space depot assets may remain");
  for (const id of [
    "city-kit-roads/road-straight", "city-kit-roads/road-crossroad",
    "city-kit-roads/road-roundabout", "city-kit-commercial/building-a",
    "city-kit-commercial/building-skyscraper-a", "city-kit-suburban/building-type-a",
    "car-kit/sedan", "mini-characters/character-female-a", "nature-kit/tree-oak"
  ]) assert.ok(ids.has(id), "missing DEPOO city component: " + id);
});

test("the complete city includes downtown, market, civic, residential and utility districts", () => {
  for (const zone of [
    "street-network", "downtown", "market-district", "civic-quarter",
    "residential", "central-park", "neighborhood-garden",
    "utility-quarter", "city-edge", "parking-and-traffic"
  ]) assert.ok(zones.has(zone), "missing DEPOO district: " + zone);
  for (const kind of [
    "road", "tower", "commercial", "civic-building", "house", "vehicle",
    "pedestrian", "streetlight", "traffic-light", "tree", "bench", "park-path"
  ]) assert.ok(kinds.has(kind), "missing city component category: " + kind);
  assert.ok(count("tower") >= 5);
  assert.ok(count("commercial") >= 12);
  assert.ok(count("house") >= 65);
  assert.ok(count("vehicle") >= 12);
  assert.ok(count("pedestrian") >= 12);
  assert.ok(count("streetlight") >= 80);
  assert.ok(count("tree") >= 35);
});

test("every city component has valid coordinates, fit dimensions and a district", () => {
  for (const item of WORLD_LAYOUT) {
    assert.equal(typeof item.id, "string");
    assert.ok(Number.isFinite(item.x) && Number.isFinite(item.z));
    assert.ok(Number.isFinite(item.y || 0) && Number.isFinite(item.yaw || 0));
    assert.equal(typeof item.zone, "string");
    if (item.targetFootprint !== undefined) assert.ok(item.targetFootprint > 0);
    if (item.targetHeight !== undefined) assert.ok(item.targetHeight > 0);
    if (item.collider) assert.ok(item.collider.length === 2 && item.collider.every(n => Number.isFinite(n) && n > 0));
  }
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "road").every(item => item.targetFootprint === 8));
});

test("the city entrance, central roundabout and main walking route remain unobstructed", () => {
  const anchors = [{ x: 0, z: 100 }, { x: 0, z: 0 }, { x: 0, z: 46 }];
  const blockers = WORLD_LAYOUT.filter(item => item.collider).filter(item =>
    anchors.some(anchor =>
      Math.abs(item.x - anchor.x) < item.collider[0] + 0.35 &&
      Math.abs(item.z - anchor.z) < item.collider[1] + 0.35
    )
  );
  assert.deepEqual(blockers, [], "the spawn and central walking routes must remain clear");
});

test("the downtown roundabout, central park and neighborhood garden are distinct landmarks", () => {
  assert.ok(WORLD_LAYOUT.some(item => item.id === "city-kit-roads/road-roundabout" && item.x === 0 && item.z === 0));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "central-park" && item.kind === "tree"));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "neighborhood-garden" && item.kind === "bench"));
});

test("repeated assets are authored for GPU instancing and no depot assets remain", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/game/open-world.js", import.meta.url), "utf8");
  assert.match(source, /new THREE\.InstancedMesh/);
  assert.match(source, /addStaticInstances/);
  assert.ok(WORLD_LAYOUT.every(item => !/space-kit|hangar|monorail|panelak|apartment/.test(item.id)));
});

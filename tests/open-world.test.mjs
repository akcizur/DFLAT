import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { WORLD_LAYOUT, ROAD_CELLS, STREET_LINES } from "../src/game/open-world.js";

const worldSource = await readFile(new URL("../src/game/open-world.js", import.meta.url), "utf8");
const ids = new Set(WORLD_LAYOUT.map(item => item.id));
const kinds = new Set(WORLD_LAYOUT.map(item => item.kind));
const zones = new Set(WORLD_LAYOUT.map(item => item.zone));
const count = kind => WORLD_LAYOUT.filter(item => item.kind === kind).length;
const buildingKinds = new Set(["tower", "commercial", "civic-building", "house", "skyline-building"]);
const roadKey = (x, z) => Math.round(x) + ":" + Math.round(z);
const roads = WORLD_LAYOUT.filter(item => item.kind === "road");
const buildings = WORLD_LAYOUT.filter(item => buildingKinds.has(item.kind));

function overlapsSquare(a, aHalf, b, bHalf, gap = 0) {
  return Math.abs(a.x - b.x) < aHalf + bHalf + gap &&
    Math.abs(a.z - b.z) < aHalf + bHalf + gap;
}

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

test("every 8 m road module connects to its exact neighbours without gaps", () => {
  const roadMap = new Map(roads.map(item => [roadKey(item.x, item.z), item]));
  for (const line of STREET_LINES) {
    for (const cell of ROAD_CELLS) {
      assert.ok(roadMap.has(roadKey(line, cell)), "missing north-south road tile at " + line + "," + cell);
      assert.ok(roadMap.has(roadKey(cell, line)), "missing east-west road tile at " + cell + "," + line);
    }
  }
  assert.equal(roadMap.size, 273, "road intersections must be represented once, not duplicated");
  assert.ok(roads.every(item => item.targetFootprint === 8), "all road tiles must use the 8 m module size");
  const source = worldSource;
  assert.match(source, /const fitLimits = \[\]/, "GLB fitting must calculate the actual scale required");
  assert.match(source, /fitLimits\.push\(entry\.targetFootprint/, "fitting must allow sub-unit assets to scale up to their footprint");
  assert.doesNotMatch(source, /Math\.min\(fitScale, entry\.target/, "the fitting routine must not clamp all assets to scale 1");
});

test("district coverage, building counts and city hierarchy are complete", () => {
  for (const zone of [
    "street-network", "downtown", "market-district", "civic-quarter",
    "residential", "central-park", "neighborhood-garden",
    "utility-quarter", "city-edge", "parking-and-traffic"
  ]) assert.ok(zones.has(zone), "missing DEPOO district: " + zone);
  for (const kind of [
    "road", "tower", "commercial", "civic-building", "house", "vehicle",
    "pedestrian", "streetlight", "traffic-light", "tree", "bench", "park-path"
  ]) assert.ok(kinds.has(kind), "missing city component category: " + kind);
  assert.equal(count("tower"), 5);
  assert.ok(count("commercial") >= 12);
  assert.ok(count("house") >= 65);
  assert.ok(count("vehicle") >= 12);
  assert.ok(count("pedestrian") >= 12);
  assert.ok(count("streetlight") >= 80);
  assert.ok(count("tree") >= 35);
});

test("every placed component has finite coordinates and valid fitting metadata", () => {
  for (const item of WORLD_LAYOUT) {
    assert.equal(typeof item.id, "string");
    assert.ok(Number.isFinite(item.x) && Number.isFinite(item.z));
    assert.ok(Number.isFinite(item.y || 0) && Number.isFinite(item.yaw || 0));
    assert.equal(typeof item.zone, "string");
    if (item.targetFootprint !== undefined) assert.ok(item.targetFootprint > 0);
    if (item.targetHeight !== undefined) assert.ok(item.targetHeight > 0);
    if (item.collider) assert.equal(item.collider, true, "colliders are derived from the GLB bounds");
  }
});

test("reserved building footprints are separated from every road tile", () => {
  for (const building of buildings) {
    const radius = (building.targetFootprint || 0) / 2;
    for (const road of roads) {
      assert.equal(
        overlapsSquare(building, radius, road, 4, 0.02),
        false,
        building.kind + " overlaps roadway " + road.x + "," + road.z
      );
    }
  }
});

test("building lots have non-overlapping footprints and keep a pedestrian setback", () => {
  for (let i = 0; i < buildings.length; i += 1) {
    const a = buildings[i];
    const radiusA = (a.targetFootprint || 0) / 2;
    for (let j = i + 1; j < buildings.length; j += 1) {
      const b = buildings[j];
      const radiusB = (b.targetFootprint || 0) / 2;
      assert.equal(overlapsSquare(a, radiusA, b, radiusB, 0.02), false,
        "building footprints overlap: " + a.id + " and " + b.id);
    }
  }
});

test("entrance, tower frontage and park plaza are clear and usable", () => {
  const spawn = { x: 0, z: 100 };
  const spawnBlockers = buildings.filter(item =>
    overlapsSquare(spawn, 0.29, item, (item.targetFootprint || 0) / 2)
  );
  assert.deepEqual(spawnBlockers, [], "the entrance must not start inside a skyline building");
  assert.ok(WORLD_LAYOUT.some(item => item.kind === "tower" && item.x === -12 && item.z === -36),
    "the fifth tower must occupy the reserved block, not the main road");
  assert.ok(!WORLD_LAYOUT.some(item => item.kind === "tower" && item.x === 0 && item.z === -36));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "central-park" && item.kind === "park-path" && item.x === -36 && item.z === 12));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "central-park" && item.kind === "pedestrian" && item.id.includes("wheelchair")));
  assert.ok(!WORLD_LAYOUT.some(item => item.zone === "central-park" && item.kind === "street-detail"),
    "park furniture must not occupy the accessible plaza");
});

test("all solid buildings and vehicles use geometry-derived collision bounds", () => {
  const solidKinds = new Set(["tower", "commercial", "civic-building", "house", "vehicle", "skyline-building"]);
  const solids = WORLD_LAYOUT.filter(item => solidKinds.has(item.kind));
  assert.ok(solids.length >= 100, "the major city structures must be represented in collision geometry");
  assert.ok(solids.every(item => item.collider === true), "solid items must get exact transformed GLB colliders");
});

test("the downtown roundabout, central park and neighbourhood garden are distinct landmarks", () => {
  assert.ok(WORLD_LAYOUT.some(item => item.id === "city-kit-roads/road-roundabout" && item.x === 0 && item.z === 0));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "central-park" && item.kind === "tree"));
  assert.ok(WORLD_LAYOUT.some(item => item.zone === "neighborhood-garden" && item.kind === "bench"));
});

test("repeated assets use GPU instancing and no depot assets remain", async () => {
  const source = worldSource;
  assert.match(source, /new THREE\.InstancedMesh/);
  assert.match(source, /addStaticInstances/);
  assert.match(source, /placementBounds/);
  assert.match(source, /bounds\.min\.x - padding/);
  assert.ok(WORLD_LAYOUT.every(item => !/space-kit|hangar|monorail|panelak|apartment/.test(item.id)));
});

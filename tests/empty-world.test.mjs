import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_LAYOUT } from "../src/game/open-world.js";

test("open world uses a broad curated set of CC0 neighbourhood models", () => {
  const ids = new Set(WORLD_LAYOUT.map(item => item.id));
  assert.ok(WORLD_LAYOUT.length >= 25, "the initial world should have a real asset layout");
  assert.ok([...ids].some(id => id.startsWith("city-kit-suburban/building-")), "suburban buildings are present");
  assert.ok([...ids].some(id => id.startsWith("city-kit-roads/road-")), "road kit pieces are present");
  assert.ok([...ids].some(id => id.startsWith("car-kit/")), "vehicles are present");
  assert.ok([...ids].some(id => id.startsWith("nature-kit/") || id.startsWith("city-kit-suburban/tree-")), "vegetation is present");
  assert.ok([...ids].some(id => id.startsWith("furniture-kit/")), "street furniture is present");
  assert.ok([...ids].some(id => id.startsWith("mini-characters/")), "static characters are present");
});

test("all building colliders are finite, positive and placed outside the spawn area", () => {
  const buildings = WORLD_LAYOUT.filter(item => item.collider);
  assert.ok(buildings.length >= 5);
  for (const item of buildings) {
    assert.equal(item.collider.length, 2);
    assert.ok(item.collider.every(value => Number.isFinite(value) && value > 0));
    assert.ok(Number.isFinite(item.x) && Number.isFinite(item.z));
    assert.ok(Math.abs(item.x) >= 8, "building must not block the central spawn corridor");
  }
});

test("layout positions are valid metre coordinates and include repeated road tiles", () => {
  assert.ok(WORLD_LAYOUT.every(item =>
    typeof item.id === "string" &&
    Number.isFinite(item.x) &&
    Number.isFinite(item.z) &&
    typeof item.kind === "string"
  ));
  assert.ok(WORLD_LAYOUT.filter(item => item.id === "city-kit-roads/road-straight").length >= 3);
});

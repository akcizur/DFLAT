import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_LAYOUT } from "../src/game/open-world.js";

const ids = new Set(WORLD_LAYOUT.map(item => item.id));
const kinds = new Set(WORLD_LAYOUT.map(item => item.kind));
const zones = new Set(WORLD_LAYOUT.map(item => item.zone));

test("DEPOO is assembled entirely from modular Space Kit components", () => {
  assert.ok(WORLD_LAYOUT.length >= 80, "the new campus should use a substantial modular layout");
  assert.ok([...ids].every(id => id.startsWith("space-kit/")), "world geometry must come from the pinned Space Kit set");
  for (const id of [
    "space-kit/hangar-largea", "space-kit/hangar-largeb",
    "space-kit/monorail-trackstraight", "space-kit/monorail-trainfront",
    "space-kit/craft-cargoa", "space-kit/machine-generatorlarge",
    "space-kit/astronauta", "space-kit/craterlarge"
  ]) assert.ok(ids.has(id), "missing DEPOO component: " + id);
});

test("the world is split into connected operational districts", () => {
  for (const zone of ["arrival", "dispatch", "west-service", "east-service", "freight-yard", "monorail", "hangar-crescent", "perimeter"]) {
    assert.ok(zones.has(zone), "missing DEPOO district: " + zone);
  }
  for (const kind of ["road", "gate", "platform", "hangar", "rail", "rail-support", "train", "craft", "machine", "crew", "terrain", "rock"]) {
    assert.ok(kinds.has(kind), "missing world component category: " + kind);
  }
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "hangar").length >= 5);
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "rail").length >= 10);
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "train").length >= 3);
  assert.ok(WORLD_LAYOUT.filter(item => item.zone === "west-service").length >= 6);
  assert.ok(WORLD_LAYOUT.filter(item => item.zone === "east-service").length >= 6);
});

test("every placed module has finite coordinates and valid dimensions", () => {
  for (const item of WORLD_LAYOUT) {
    assert.equal(typeof item.id, "string");
    assert.ok(Number.isFinite(item.x) && Number.isFinite(item.z));
    assert.ok(Number.isFinite(item.y || 0) && Number.isFinite(item.yaw || 0));
    assert.equal(typeof item.zone, "string");
    if (item.targetHeight !== undefined) assert.ok(item.targetHeight > 0);
    if (item.collider) assert.ok(item.collider.length === 2 && item.collider.every(n => Number.isFinite(n) && n > 0));
  }
});

test("arrival, dispatch approach and main walking spine remain unobstructed", () => {
  const anchors = [{ x: 0, z: 9.2 }, { x: 0, z: -35.5 }, { x: 0, z: -68 }];
  const blockers = WORLD_LAYOUT.filter(item => item.collider).filter(item =>
    anchors.some(anchor =>
      Math.abs(item.x - anchor.x) < item.collider[0] + 0.5 &&
      Math.abs(item.z - anchor.z) < item.collider[1] + 0.5
    )
  );
  assert.deepEqual(blockers, [], "spawn and central walking spine must remain clear");
});

test("the monorail spans the campus and the hangars form a separate destination district", () => {
  const rail = WORLD_LAYOUT.filter(item => item.kind === "rail" && item.id === "space-kit/monorail-trackstraight");
  assert.ok(Math.min(...rail.map(item => item.z)) <= -108);
  assert.ok(Math.max(...rail.map(item => item.z)) >= 12);
  const hangars = WORLD_LAYOUT.filter(item => item.kind === "hangar");
  assert.ok(hangars.some(item => item.x === 0 && item.z < -100));
  assert.ok(hangars.some(item => item.x < -20));
  assert.ok(hangars.some(item => item.x > 20));
});

test("no residential or panelák assets remain in DEPOO", () => {
  assert.ok(WORLD_LAYOUT.every(item => !/panelak|apartment|building-type/.test(item.id)));
});

import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_LAYOUT } from "../src/game/open-world.js";

const ids = new Set(WORLD_LAYOUT.map(item => item.id));

test("DEPOO is assembled from Space Kit components", () => {
  assert.ok(WORLD_LAYOUT.length >= 55, "the depot should have a substantial modular asset layout");
  assert.ok([...ids].every(id => id.startsWith("space-kit/")), "all world assets must be from Space Kit");
  for (const id of [
    "space-kit/hangar-largea", "space-kit/hangar-largeb",
    "space-kit/monorail-trackstraight", "space-kit/monorail-trainfront",
    "space-kit/craft-cargoa", "space-kit/machine-generatorlarge",
    "space-kit/astronauta", "space-kit/craterlarge"
  ]) assert.ok(ids.has(id), "missing DEPOO component: " + id);
});

test("the layout includes the depot's distinct zones", () => {
  const kinds = new Set(WORLD_LAYOUT.map(item => item.kind));
  for (const kind of ["road","gate","platform","hangar","rail","train","craft","machine","crew","terrain","rock"]) {
    assert.ok(kinds.has(kind), "missing world zone: " + kind);
  }
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "hangar").length >= 5);
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "rail").length >= 10);
  assert.ok(WORLD_LAYOUT.filter(item => item.kind === "train").length >= 3);
});

test("every placed module has finite coordinates and valid dimensions", () => {
  for (const item of WORLD_LAYOUT) {
    assert.equal(typeof item.id, "string");
    assert.ok(Number.isFinite(item.x) && Number.isFinite(item.z));
    assert.ok(Number.isFinite(item.y || 0) && Number.isFinite(item.yaw || 0));
    if (item.targetHeight !== undefined) assert.ok(item.targetHeight > 0);
    if (item.collider) assert.ok(item.collider.length === 2 && item.collider.every(n => Number.isFinite(n) && n > 0));
  }
});

test("arrival and dispatch approaches remain clear", () => {
  const anchors = [{ x: 0, z: 9.2 }, { x: 0, z: -35.5 }];
  const blockers = WORLD_LAYOUT.filter(item => item.collider).filter(item =>
    anchors.some(anchor =>
      Math.abs(item.x - anchor.x) < item.collider[0] + 0.5 &&
      Math.abs(item.z - anchor.z) < item.collider[1] + 0.5
    )
  );
  assert.deepEqual(blockers, [], "the spawn and central access route must remain walkable");
});

test("no residential or panelák assets remain in the current world", () => {
  assert.ok(WORLD_LAYOUT.every(item => !/panelak|apartment|building-type/.test(item.id)));
  assert.ok(WORLD_LAYOUT.some(item => item.id === "space-kit/hangar-largea" && item.z < -90));
});

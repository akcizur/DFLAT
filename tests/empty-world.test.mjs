import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyWorld } from "../src/game/empty-world.js";

test("empty-world generator creates only a flat ground plane", () => {
  const scene = { children: [], add(object) { this.children.push(object); } };
  const THREE = {
    MeshBasicMaterial: class { constructor(options) { this.options = options; } },
    PlaneGeometry: class { constructor(width, height) { this.width = width; this.height = height; } },
    Mesh: class { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = {}; this.rotation = {}; } }
  };
  const world = createEmptyWorld({ THREE, scene });
  assert.equal(scene.children.length, 1);
  assert.equal(scene.children[0].name, "Empty world ground");
  assert.equal(scene.children[0].geometry.width, 2000);
  assert.deepEqual(world.colliders, []);
  assert.deepEqual(world.interactables, []);
  assert.deepEqual(world.meshesToAnimate, []);
  assert.deepEqual(world.doorAnimations, []);
  assert.equal(world.navigation.floors, 1);
});

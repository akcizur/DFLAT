import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createMainBuildingWorld } from "../src/game/main-building.js";

test("site-only world constructs terrain and roads without allocating any building meshes", () => {
  const scene = new THREE.Scene();
  const state = { mainBuildingScene: true, allBuildingsRemoved: true, currentFloor: 0 };
  const ui = { showToast() {}, updateObjective() {} };
  const world = createMainBuildingWorld({ THREE, scene, state, ui, siteOnly: true });

  assert.ok(world.meshes.length > 10, "the empty site should retain terrain, road and path geometry");
  assert.ok(world.meshes.some(mesh => mesh.name === "Mapa / terén"));
  assert.ok(world.meshes.some(mesh => mesh.name === "Mapa / hlavní silnice"));
  assert.ok(world.meshes.some(mesh => mesh.name === "Mapa / přístupová cesta"));
  assert.ok(world.meshes.every(mesh =>
    mesh.name.startsWith("Mapa /") || mesh.name.startsWith("Silnice /")
  ), "site-only mode must not create a building mesh");
  assert.ok(scene.children.filter(object => object.isMesh).every(mesh =>
    mesh.name.startsWith("Mapa /") || mesh.name.startsWith("Silnice /")
  ), "every mesh in the live site-only scene must be non-building geometry");
  assert.equal(world.colliders.length, 0);
  assert.equal(world.interactables.length, 0);
  assert.equal(world.navigation.floors, 1);
  assert.equal(world.navigation.stairs, null);
});

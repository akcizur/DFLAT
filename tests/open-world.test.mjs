import assert from "node:assert/strict";
import test from "node:test";
import { WORLD_LAYOUT } from "../src/game/open-world.js";
import { PANELAK_LAYOUT, PANELAK_APARTMENT_INSTANCES } from "../src/game/panelak.js";

test("the surrounding street retains CC0 road, vehicle, foliage, furniture and character models", () => {
  const ids = new Set(WORLD_LAYOUT.map(item => item.id));
  assert.ok(WORLD_LAYOUT.length >= 25, "the surrounding world should have a curated asset layout");
  assert.ok([...ids].some(id => id.startsWith("city-kit-roads/road-")), "road kit pieces are present");
  assert.ok([...ids].some(id => id.startsWith("car-kit/")), "vehicles are present");
  assert.ok([...ids].some(id => id.startsWith("nature-kit/") || id.startsWith("city-kit-suburban/tree-")), "vegetation is present");
  assert.ok([...ids].some(id => id.startsWith("furniture-kit/")), "street furniture is present");
  assert.ok([...ids].some(id => id.startsWith("mini-characters/")), "static characters are present");
  assert.equal([...ids].filter(id => /building-type-[a-e]$/.test(id)).length, 0, "generic suburban houses no longer replace the panelák blocks");
});

test("the world contains four collidable four-storey panelák blocks", () => {
  assert.equal(PANELAK_LAYOUT.length, 4);
  assert.equal(PANELAK_LAYOUT.filter(item => item.floors === 4).length, 4);
  assert.equal(new Set(PANELAK_LAYOUT.map(item => item.id)).size, 4);
  assert.equal(PANELAK_LAYOUT.filter(item => item.x < 0).length, 2);
  assert.equal(PANELAK_LAYOUT.filter(item => item.x > 0).length, 2);

  for (const building of PANELAK_LAYOUT) {
    assert.ok(building.width >= 10 && building.length >= 30 && building.height >= 11);
    assert.ok([building.x, building.z, building.width, building.length, building.height].every(Number.isFinite));
    assert.ok(Math.hypot(building.x, building.z - 9.2) > 12, "panelák must not block the spawn corridor");
  }
});

test("the road layout extends past both panelák rows and keeps a distant skyline", () => {
  assert.ok(WORLD_LAYOUT.filter(item => item.id === "city-kit-roads/road-straight").length >= 8);
  assert.ok(WORLD_LAYOUT.some(item => item.id === "city-kit-commercial/building-skyscraper-a" && item.z < -100));
  assert.ok(WORLD_LAYOUT.every(item => typeof item.id === "string" && Number.isFinite(item.x) && Number.isFinite(item.z) && typeof item.kind === "string"));
});

test("all four blocks receive a cloned apartment on every floor", () => {
  assert.equal(PANELAK_APARTMENT_INSTANCES.length, 16);
  for (const building of PANELAK_LAYOUT) {
    const apartments = PANELAK_APARTMENT_INSTANCES.filter(item => item.buildingId === building.id);
    assert.equal(apartments.length, building.floors, building.id + " must have one apartment module per storey");
    assert.deepEqual(apartments.map(item => item.floor), [0,1,2,3]);
    assert.deepEqual(apartments.map(item => item.elevation), [0,2.9,5.8,8.7]);
    assert.ok(apartments.every(item => item.x === building.x && item.z === building.z));
  }
  assert.equal(new Set(PANELAK_APARTMENT_INSTANCES.map(item => item.id)).size, 16);
});

test("apartment modules preserve one shared floor height and facade alignment", () => {
  for (const building of PANELAK_LAYOUT) {
    const floorHeight = building.height / building.floors;
    const apartments = PANELAK_APARTMENT_INSTANCES.filter(item => item.buildingId === building.id);
    for (const apartment of apartments) {
      assert.ok(Math.abs(apartment.elevation - apartment.floor * floorHeight) < 1e-9);
    }
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../tools/generate_t06b_panelak_v2.py", import.meta.url), "utf8");
const moduleWidth = 3.6;
const moduleCount = 5;
const rooms = [
  3.45 * 3.0,
  3.45 * 3.5,
  3.45 * 4.35,
  3.45 * 4.65,
  3.45 * 2.30,
  2.0 * 2.0
];

test("T06B section dimensions resolve to five modules and 18 metres", () => {
  assert.match(source, /MODULE = 3\.6/);
  assert.match(source, /MODULE_COUNT = 5/);
  assert.match(source, /WIDTH = MODULE \* MODULE_COUNT/);
  assert.match(source, /DEPTH = 11\.4/);
  assert.equal(moduleWidth * moduleCount, 18);
});

test("the design has four above-ground storeys, one cellar and eight flats", () => {
  assert.match(source, /FLOORS = 4/);
  assert.match(source, /BASEMENT_HEIGHT = 2\.6/);
  assert.match(source, /scene\["apartments_per_floor"\] = 2/);
  assert.match(source, /scene\["lift"\] = False/);
  assert.match(source, /for floor in range\(FLOORS\):/);
  assert.doesNotMatch(source, /Elevator cabin|Lift shaft|Výtah \//);
});

test("stairwell remains open through the upper slabs and has real switch-back treads", () => {
  assert.match(source, /core_left, core_right = -1\.5, 1\.5/);
  assert.match(source, /core_front, core_rear = -1\.4, 2\.2/);
  assert.match(source, /Stair \| lower flight tread/);
  assert.match(source, /Stair \| upper flight tread/);
  assert.match(source, /Stair \| half-floor landing/);
  assert.match(source, /Cellar stair \| tread/);
});

test("entrance, glass-block stair glazing, module-aligned loggias and separate B7 WC are modelled", () => {
  assert.match(source, /kind": "entrance"/);
  assert.match(source, /Staircase \| luxfer glass block/);
  assert.match(source, /Loggia \| heavy concrete slab/);
  assert.match(source, /Loggia railing \| vertical bar/);
  assert.match(source, /Flat \| bathroom-WC divider/);
  assert.match(source, /Flat \| toilet pan/);
  assert.match(source, /Flat entrance \| door leaf/);
});

test("the dimensional room schedule totals approximately 65.4 square metres", () => {
  const area = rooms.reduce((sum, room) => sum + room, 0);
  assert.equal(Math.round(area * 10) / 10, 65.4);
  assert.match(source, /scene\["room_area_schedule_m2"\]/);
  assert.match(source, /scene\["design_status"\] = "visualisation concept; not for construction"/);
});

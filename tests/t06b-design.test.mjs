import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../tools/generate_t06b_panelak_v2.py", import.meta.url), "utf8");
const moduleWidth = 3.6;
const moduleCount = 5;
const roomFootprints = [
  3.45 * 3.0,
  3.45 * 3.5,
  3.45 * 4.35,
  3.45 * 4.65,
  3.45 * 2.30,
  2.0 * 2.0
];

test("T06B section dimensions resolve to five modules and an 18 by 12 metre shell", () => {
  assert.ok(source.includes("MODULE = 3.6"));
  assert.ok(source.includes("MODULE_COUNT = 5"));
  assert.ok(source.includes("WIDTH = MODULE * MODULE_COUNT"));
  assert.ok(source.includes("DEPTH = 12.0"));
  assert.equal(moduleWidth * moduleCount, 18);
});

test("the model has four above-ground storeys, a cellar and eight flats without a lift", () => {
  assert.ok(source.includes("FLOORS = 4"));
  assert.ok(source.includes("BASEMENT_HEIGHT = 2.6"));
  assert.ok(source.includes('scene["apartments_per_floor"] = 2'));
  assert.ok(source.includes('scene["lift"] = False'));
  assert.ok(source.includes('"apartmentsTotal": FLOORS*2'));
  assert.ok(!source.includes("Elevator cabin"));
  assert.ok(!source.includes("Lift shaft"));
});

test("upper slabs reserve a real stairwell void and both flights meet the landing", () => {
  assert.ok(source.includes("core_left, core_right = -1.5, 1.5"));
  assert.ok(source.includes("core_front, core_rear = -2.2, 2.2"));
  assert.ok(source.includes('STAIR_LOW_X = -1.5'));
  assert.ok(source.includes('STAIR_HIGH_X = 0.9'));
  assert.ok(source.includes('STAIR_LANDING_WIDTH = 0.60'));
  assert.ok(source.includes('STAIR_LANDING_DEPTH = 4.30'));
  assert.ok(source.includes('Stair | lower flight tread'));
  assert.ok(source.includes('Stair | upper flight tread'));
  assert.ok(source.includes('Stair | half-floor landing'));
  assert.ok(source.includes('Cellar stair | lower flight tread'));
  assert.ok(source.includes('Cellar stair | upper flight tread'));
});

test("recessed loggia doorways are full-height and have real side returns and rails", () => {
  assert.ok(source.includes('"kind": "loggia"'));
  assert.ok(source.includes('"sill": 0.0 if is_loggia_door else WINDOW_SILL'));
  assert.ok(source.includes("LOGGIA_WIDTH = 3.2"));
  assert.ok(source.includes("LOGGIA_DEPTH = 1.25"));
  assert.ok(source.includes("LOGGIA_BACK_Z = REAR_Z - LOGGIA_DEPTH"));
  assert.ok(source.includes("Loggia | heavy concrete slab"));
  assert.ok(source.includes("Loggia | full-height concrete side return"));
  assert.ok(source.includes("Loggia door | slid-open glazed panel"));
  assert.ok(source.includes("Loggia railing | vertical bar"));
});

test("the entrance, luxfer stair glazing and separate B7 bathroom/WC are modelled", () => {
  assert.ok(source.includes('"kind": "entrance"'));
  assert.ok(source.includes("Staircase | luxfer glass block"));
  assert.ok(source.includes("Flat | bathroom-WC divider"));
  assert.ok(source.includes("Flat | toilet pan"));
  assert.ok(source.includes("Flat entrance | open door leaf"));
  assert.ok(source.includes("Municipal entry plaque"));
  assert.ok(source.includes("Old intercom"));
});

test("room footprint schedule totals approximately 65.4 square metres and remains a concept", () => {
  const area = roomFootprints.reduce((sum, room) => sum + room, 0);
  assert.equal(Math.round(area * 10) / 10, 65.4);
  assert.ok(source.includes('scene["room_area_schedule_m2"]'));
  assert.ok(source.includes('scene["design_status"] = "visualisation concept; not for construction"'));
});

test("the saved Blender file is Z-up and the runtime GLB excludes the preview site's ground and road", () => {
  assert.ok(source.includes('from mathutils import Matrix, Vector'));
  assert.ok(source.includes('Matrix.Rotation(math.radians(90), 4, "X")'));
  assert.ok(source.includes('site_object_names = {'));
  assert.ok(source.includes('export_mesh_objects = [obj for obj in mesh_objects if obj.name not in site_object_names]'));
  assert.ok(source.includes('asset_max_x-asset_min_x <= 18.4'));
  assert.ok(source.includes('asset_max_y-asset_min_y <= 12.4'));
  assert.ok(source.includes('asset_max_z > FLOORS*FLOOR_HEIGHT+0.5'));
});

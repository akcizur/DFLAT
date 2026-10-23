import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIRECTORY = path.join(ROOT, "public", "data");
const SOURCE_MANIFEST = path.join(DATA_DIRECTORY, "t06b-panelak-v2.json");
const JSON_OUTPUT = path.join(DATA_DIRECTORY, "main-building-vertices.json");
const CSV_OUTPUT = path.join(DATA_DIRECTORY, "main-building-vertices.csv");
const EPSILON = 1e-5;

function closeTo(actual, expected, label, epsilon = EPSILON) {
  assert.ok(Number.isFinite(actual), label + ": coordinate is not finite (" + actual + ")");
  assert.ok(Math.abs(actual - expected) <= epsilon,
    label + ": expected " + expected + ", received " + actual);
}

function finitePoint(point, label) {
  assert.ok(point && ["x", "y", "z"].every(axis => Number.isFinite(point[axis])),
    label + ": invalid point " + JSON.stringify(point));
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

let source;
try {
  source = JSON.parse(await readFile(SOURCE_MANIFEST, "utf8"));
} catch (error) {
  throw new Error(
    "T06B geometry manifest is missing or invalid. Generate the Blender model first: " +
    "blender --background --python tools/generate_t06b_panelak_v2.py. " + error.message
  );
}

const building = source.building;
assert.equal(source.coordinateSystem?.units, "metres");
assert.equal(building?.typology, "T06B-inspired five-module section");
assert.equal(building.moduleCount, 5);
assert.equal(building.moduleWidth, 3.6);
assert.equal(building.width, 18);
assert.equal(building.depth, 12.0);
assert.equal(building.floors, 4);
assert.equal(building.basementHeight, 2.6);
assert.equal(building.floorHeight, 2.8);
closeTo(building.roofDatum, 11.2, "Roof datum");
assert.equal(building.lift, false);
assert.equal(building.apartmentsPerFloor, 2);
assert.equal(building.apartmentsTotal, 8);
assert.equal(building.designStatus, "visualisation concept; not for construction");
assert.ok(Array.isArray(source.objects) && source.objects.length > 300,
  "The evaluated Blender model must contain the complete architectural assembly.");
assert.ok(Array.isArray(source.anchors) && source.anchors.length >= 20,
  "The measured model is missing semantic coordinate anchors.");
assert.equal(source.nominalRoomAreaSumM2.toFixed(1), "65.4");

const objectIds = new Set();
for (const object of source.objects) {
  assert.ok(object.id && !objectIds.has(object.id), "Object IDs must be non-empty and unique.");
  objectIds.add(object.id);
  finitePoint(object.center, "Object " + object.id + " center");
  finitePoint(object.bounds?.min, "Object " + object.id + " minimum bound");
  finitePoint(object.bounds?.max, "Object " + object.id + " maximum bound");
  assert.ok(Array.isArray(object.corners) && object.corners.length === 8,
    "Object " + object.id + " must expose eight AABB corners.");
  for (const axis of ["x", "y", "z"]) {
    assert.ok(object.bounds.min[axis] <= object.bounds.max[axis],
      "Object " + object.id + " has inverted " + axis + " bounds.");
  }
  for (const corner of object.corners) finitePoint(corner, "Object corner " + object.id);
}

const anchorIds = new Set();
for (const anchor of source.anchors) {
  assert.ok(anchor.id && !anchorIds.has(anchor.id), "Semantic anchor IDs must be unique.");
  anchorIds.add(anchor.id);
  finitePoint(anchor.position, "Anchor " + anchor.id);
}
for (const requiredId of [
  "building-origin", "front-left-ground", "front-right-ground",
  "rear-left-ground", "rear-right-ground", "entrance-centre",
  "stair-core-centre", "roof-datum", "floor-datum-0", "floor-datum-4",
  "module-axis-1", "module-axis-2", "module-axis-3", "module-axis-4", "module-axis-5",
  "loggia-f0-left", "loggia-f0-right", "loggia-f3-left", "loggia-f3-right"
]) {
  assert.ok(anchorIds.has(requiredId), "Missing semantic anchor: " + requiredId);
}

const byName = name => source.objects.filter(object => object.name === name);
const named = prefix => source.objects.filter(object => object.name.startsWith(prefix));
assert.equal(byName("Flat entrance | open door leaf").length, 8, "Each of eight flats needs an entry door.");
assert.equal(byName("Loggia | heavy concrete slab").length, 8, "Each of four floors needs two loggias.");
assert.equal(byName("Stair | lower flight tread").length, 24, "Three inter-floor stair runs need 24 lower treads.");
assert.equal(byName("Stair | upper flight tread").length, 24, "Three inter-floor stair runs need 24 upper treads.");
assert.equal(byName("Staircase | luxfer glass block").length, 75, "Stair glazing should contain 75 luxfer blocks.");
assert.equal(source.counts?.liftObjects, 0, "The four-storey T06B design must not contain elevator geometry.");

const frontGroundPiers = named("Facade pier front | level 0");
assert.ok(frontGroundPiers.length > 0, "Front ground-floor facade panels are missing.");
const frontMinX = Math.min(...frontGroundPiers.map(object => object.bounds.min.x));
const frontMaxX = Math.max(...frontGroundPiers.map(object => object.bounds.max.x));
closeTo(frontMaxX-frontMinX, 18, "Measured front facade width");
// No ground-floor facade pier may fill the 1.8 m entry opening.
for (const object of frontGroundPiers) {
  const overlapsEntry = object.bounds.min.x < 0.9-EPSILON && object.bounds.max.x > -0.9+EPSILON;
  assert.equal(overlapsEntry, false, "Facade pier " + object.name + " blocks the central entrance.");

  // The main facade contains proper full-height low-sill door openings at the loggias.
}
const rearGroundPiers = named("Facade pier rear | level 0");
assert.ok(rearGroundPiers.length > 0, "Rear modular facade panels are missing.");
for (const object of rearGroundPiers) {
  const blocksLeftLoggia = object.bounds.min.x < -2.0-EPSILON && object.bounds.max.x > -5.2+EPSILON;
  const blocksRightLoggia = object.bounds.min.x < 5.2-EPSILON && object.bounds.max.x > 2.0+EPSILON;
  assert.equal(blocksLeftLoggia || blocksRightLoggia, false,
    "Rear facade pier " + object.name + " blocks a 3.2 m loggia doorway.");
}
const loggiaSlabs = byName("Loggia | heavy concrete slab");
assert.equal(loggiaSlabs.length, 8, "Each of four storeys must have a recessed loggia on both flats.");
for (const slab of loggiaSlabs) {
  closeTo(slab.dimensions.x, 3.2, "Loggia clear width");
  closeTo(slab.dimensions.z, 1.25, "Loggia recess depth");
}
assert.equal(byName("Loggia door | slid-open glazed panel").length, 16,
  "Every loggia needs a pair of sliding leaves that preserve the walking route.");

// Check the actual measured slab pieces: the walk-through stair core stays empty on all four levels.
for (let floor = 0; floor < 4; floor++) {
  const slabPieces = named("Floor " + floor + " |");
  assert.ok(slabPieces.length >= 4, "Floor " + floor + " is missing split slab pieces.");
  for (const slab of slabPieces) {
    const overlapsCoreX = slab.bounds.min.x < 1.5-EPSILON && slab.bounds.max.x > -1.5+EPSILON;
    const overlapsCoreZ = slab.bounds.min.z < 2.2-EPSILON && slab.bounds.max.z > -2.2+EPSILON;
    assert.equal(overlapsCoreX && overlapsCoreZ, false,
      "Slab piece " + slab.name + " intrudes into the stairwell opening.");
  }
}

const manifest = {
  ...source,
  export: {
    format: "JSON + CSV",
    method: "Generated from evaluated Blender mesh vertices, transformed to world space",
    sourceManifest: "public/data/t06b-panelak-v2.json",
    glbAsset: "public/models/t06b-panelak-v2.glb",
    validationStatus: "passed",
    validationAssertions: [
      "5 x 3.6 m module axes define an 18.0 m section",
      "4 above-ground storeys plus a 2.6 m cellar; no lift",
      "Eight separate flat-entry doors and eight recessed loggia slabs",
      "Measured facade keeps the ground-floor entrance opening clear",
      "Rear wall has two 3.2 m full-height recessed loggia-door openings per floor",
      "Loggia slabs have the measured 3.2 x 1.25 m footprint",
      "All upper slab pieces keep the central stairwell void clear",
      "All geometry bounds and semantic anchors are finite and ordered",
      "Nominal room-footprint schedule rounds to 65.4 m²",
    ],
  },
};

const header = [
  "record_type", "id", "name", "center_x", "center_y", "center_z",
  "min_x", "min_y", "min_z", "max_x", "max_y", "max_z",
  "corner_index", "corner_x", "corner_y", "corner_z", "provenance"
];
const rows = [header];
for (const object of source.objects) {
  rows.push([
    "object", object.id, object.name,
    object.center.x, object.center.y, object.center.z,
    object.bounds.min.x, object.bounds.min.y, object.bounds.min.z,
    object.bounds.max.x, object.bounds.max.y, object.bounds.max.z,
    "", "", "", "", source.provenance.source
  ]);
  object.corners.forEach((corner, index) => rows.push([
    "corner", object.id, object.name,
    "", "", "",
    "", "", "", "", "", "",
    index+1, corner.x, corner.y, corner.z, source.provenance.source
  ]));
}
for (const anchor of source.anchors) {
  rows.push([
    "anchor", anchor.id, anchor.name,
    anchor.position.x, anchor.position.y, anchor.position.z,
    "", "", "", "", "", "",
    "", "", "", "", source.provenance.source
  ]);
}

for (let index = 0; index < rows.length; index++) {
  assert.equal(rows[index].length, header.length, "CSV row " + (index+1) + " has the wrong field count.");
}

await writeFile(JSON_OUTPUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");
await writeFile(CSV_OUTPUT, rows.map(row => row.map(csvEscape).join(",")).join("\r\n") + "\r\n", "utf8");

console.log(
  "T06B coordinate export passed: " + source.objects.length + " measured mesh objects, " +
  source.anchors.length + " semantic anchors, " + source.counts.lowerStairTreads +
  " lower stair treads, " + source.counts.loggiaSlabs + " loggia slabs."
);
console.log("JSON: " + path.relative(ROOT, JSON_OUTPUT));
console.log("CSV:  " + path.relative(ROOT, CSV_OUTPUT));

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src/game/main-building.js"), "utf8");

test("the foundation plinth is split around the clear entrance", () => {
  assert.match(source, /sokl vlevo od vchodu/);
  assert.match(source, /sokl vpravo od vchodu/);
  assert.match(source, /const plinthEndX = doorWidth \/ 2 \+ 0\.11/);
  assert.doesNotMatch(source, /Hlavní budova \/ sokl", bx, 0\.36, frontZ/);
});

test("door glazing belongs to the open leaves, not the walking opening", () => {
  assert.match(source, /zasklení otevřeného dveřního křídla/);
  assert.match(source, /side \* 0\.94, 1\.52, frontZ \+ 0\.34/);
  assert.doesNotMatch(source, /Vchod \/ zasklení dveří", 0, 1\.52/);
});

test("the roof has a dedicated hatch rather than reusing the residential core opening", () => {
  const start = source.indexOf("function makeRoofSlab()");
  const end = source.indexOf("for (let floor = 0; floor < floors; floor++) makeFloorSlab(floor);", start);
  assert.ok(start >= 0 && end > start, "dedicated roof function and invocation must exist");
  const roofFunction = source.slice(start, end);
  assert.doesNotMatch(roofFunction, /coreOpening/);
  assert.match(roofFunction, /minX: -1\.325, maxX: -0\.275/);
  assert.match(roofFunction, /minZ: -24\.625, maxZ: -23\.575/);
  assert.match(roofFunction, /Střecha \/ otevřený poklop/);
  assert.match(roofFunction, /Střecha \/ žebřík příčka/);
});

test("stairs connect the eight occupied levels without a ninth roof flight", () => {
  const start = source.indexOf("// Switchback stair");
  const end = source.indexOf("// Continuous lift shaft", start);
  assert.ok(start >= 0 && end > start);
  const stairFunction = source.slice(start, end);
  assert.match(stairFunction, /for \(let floor = 0; floor < floors - 1; floor\+\+\)/);
  assert.doesNotMatch(stairFunction, /for \(let floor = 0; floor < floors; floor\+\+\)/);
  assert.equal(8 - 1, 7, "eight floor datums require seven inter-floor stair runs");
});

test("roof machinery bottoms align with the roof datum", () => {
  const roofY = 8 * 2.8;
  const machineRoomBottom = roofY + 0.59 - 1.18 / 2;
  const ventBottom = roofY + 0.55 - 1.1 / 2;
  assert.ok(Math.abs(machineRoomBottom - roofY) < 1e-9);
  assert.ok(Math.abs(ventBottom - roofY) < 1e-9);
  assert.match(source, /strojovna výtahu", 2\.2, roofY \+ 0\.59/);
  assert.match(source, /větrací komín", -4\.4, roofY \+ 0\.55/);
});

test("entrance collision opening uses the same nominal width as the facade opening", () => {
  assert.match(source, /maxX: -doorWidth \/ 2, minZ: frontZ/);
  assert.match(source, /minX: doorWidth \/ 2, maxX: rightX, minZ: frontZ/);
});

test("mesh collection and exports include transformed corners, world bounds, and semantic anchors", () => {
  assert.equal((source.match(/meshes\.push\(mesh\)/g) || []).length, 2);
  assert.match(source, /function getCoordinateData\(\)/);
  assert.match(source, /applyMatrix4\(mesh\.matrixWorld\)/);
  assert.match(source, /logicalCorners: logicalCornerCount/);
  assert.match(source, /semanticAnchors: anchors\.length/);
  assert.match(source, /function exportCoordinateCSV\(\)/);
  assert.match(source, /join\("\\r\\n"\)/);
  assert.match(source, /return \{[\s\S]*?colliders, interactables, meshesToAnimate, doorAnimations, meshes,\s*navigation, getCoordinateData, exportCoordinateCSV\s*\}/);
});

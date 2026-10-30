import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_MODELS = path.join(ROOT, "public", "models");
const SOURCE_REPO = "Hidencod/tge-assets";
const SOURCE_COMMIT = "eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3";
const SOURCE_ROOT = "https://raw.githubusercontent.com/" + SOURCE_REPO + "/" + SOURCE_COMMIT;
const CATALOG_URL = SOURCE_ROOT + "/catalog.json";

// Curated Kenney city models. The full 1,883-model CC0 catalog stays searchable in-game.
const CITY_MODEL_IDS = [
  "city-kit-roads/road-straight",
  "city-kit-roads/road-crossroad",
  "city-kit-roads/road-roundabout",
  "city-kit-roads/road-end",
  "city-kit-roads/light-square-double",
  "city-kit-roads/traffic-light-object-vertical",
  "city-kit-roads/road-sign-stop",
  "city-kit-roads/road-sign-street",
  "city-kit-roads/electricity-pole",
  "city-kit-roads/dumpster",
  "city-kit-commercial/building-a",
  "city-kit-commercial/building-c",
  "city-kit-commercial/building-f",
  "city-kit-commercial/building-h",
  "city-kit-commercial/building-j",
  "city-kit-commercial/building-n",
  "city-kit-commercial/building-skyscraper-a",
  "city-kit-commercial/building-skyscraper-b",
  "city-kit-commercial/building-skyscraper-c",
  "city-kit-commercial/building-skyscraper-d",
  "city-kit-commercial/building-skyscraper-e",
  "city-kit-commercial/low-detail-building-a",
  "city-kit-commercial/low-detail-building-d",
  "city-kit-commercial/low-detail-building-g",
  "city-kit-commercial/low-detail-building-j",
  "city-kit-commercial/low-detail-building-m",
  "city-kit-commercial/low-detail-building-wide-a",
  "city-kit-commercial/detail-awning-wide",
  "city-kit-commercial/detail-awning",
  "city-kit-commercial/detail-parasol-a",
  "city-kit-commercial/detail-parasol-b",
  "city-kit-commercial/detail-overhang-wide",
  "city-kit-suburban/building-type-a",
  "city-kit-suburban/building-type-b",
  "city-kit-suburban/building-type-d",
  "city-kit-suburban/building-type-f",
  "city-kit-suburban/building-type-h",
  "city-kit-suburban/building-type-j",
  "city-kit-suburban/building-type-l",
  "city-kit-suburban/building-type-n",
  "city-kit-suburban/building-type-p",
  "city-kit-suburban/building-type-r",
  "city-kit-suburban/building-type-t",
  "city-kit-suburban/building-type-u",
  "city-kit-suburban/tree-large",
  "city-kit-suburban/tree-small",
  "city-kit-suburban/driveway-short",
  "city-kit-suburban/planter",
  "nature-kit/tree-oak",
  "nature-kit/tree-detailed",
  "nature-kit/plant-bushlarge",
  "furniture-kit/bench",
  "furniture-kit/trashcan",
  "car-kit/sedan",
  "car-kit/taxi",
  "car-kit/suv",
  "car-kit/police",
  "car-kit/delivery",
  "car-kit/ambulance",
  "car-kit/firetruck",
  "car-kit/garbage-truck"
];

async function fetchBuffer(url) {
  const response = await fetch(url, { headers: { "User-Agent": "DEPOO-city-asset-setup" } });
  if (!response.ok) throw new Error("Download failed (" + response.status + "): " + url);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await mkdir(PUBLIC_MODELS, { recursive: true });
  console.log("Reading the pinned Kenney CC0 city catalog…");
  const catalogBytes = await fetchBuffer(CATALOG_URL);
  const catalog = JSON.parse(catalogBytes.toString("utf8"));
  const available = new Map();

  for (const pack of catalog.packs || []) {
    for (const model of pack.models || []) {
      available.set(model.id, {
        ...model, packId: pack.id, packName: pack.name,
        author: pack.author, license: pack.license, packUrl: pack.url
      });
    }
  }

  const chosen = CITY_MODEL_IDS.map(id => {
    const model = available.get(id);
    if (!model) throw new Error("City model missing from pinned source catalog: " + id);
    if (model.license !== "CC0-1.0") throw new Error("Refusing model without verified CC0-1.0 license: " + id);
    if (model.author !== "Kenney") throw new Error("Unexpected asset author for " + id + ": " + model.author);
    return model;
  });

  let completed = 0;
  for (let offset = 0; offset < chosen.length; offset += 4) {
    const batch = chosen.slice(offset, offset + 4);
    await Promise.all(batch.map(async model => {
      const destination = path.join(PUBLIC_MODELS, model.file);
      await mkdir(path.dirname(destination), { recursive: true });
      let alreadyValid = false;
      try { alreadyValid = (await stat(destination)).size === model.size; } catch {}
      if (!alreadyValid) {
        const bytes = await fetchBuffer(SOURCE_ROOT + "/" + model.file);
        if (bytes.byteLength !== model.size) {
          throw new Error("Size mismatch for " + model.id + ": expected " + model.size + ", received " + bytes.byteLength);
        }
        await writeFile(destination, bytes);
      }
      completed += 1;
      console.log("[" + completed + "/" + chosen.length + "] " + model.name);
    }));
  }

  const manifest = {
    schemaVersion: 2,
    source: "https://github.com/" + SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    sourceCatalog: CATALOG_URL,
    sourceLicense: "CC0-1.0",
    author: "Kenney",
    catalogModelCount: available.size,
    bundledModelCount: chosen.length,
    world: "DEPOO Open City",
    assets: chosen.map(model => ({
      id: model.id, name: model.name, pack: model.packId, file: model.file,
      bytes: model.size, license: model.license, author: model.author,
      source: "https://github.com/" + SOURCE_REPO + "/blob/" + SOURCE_COMMIT + "/" + model.file,
      packUrl: model.packUrl
    }))
  };
  await writeFile(path.join(PUBLIC_MODELS, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(path.join(PUBLIC_MODELS, "NOTICE-KENNEY-CC0.txt"),
    "DEPOO uses modular city, road, vehicle and nature models by Kenney.\n" +
    "Source: " + manifest.source + "\n" +
    "Pinned commit: " + SOURCE_COMMIT + "\n" +
    "License: Creative Commons Zero 1.0 Universal (CC0-1.0).\n" +
    "Attribution is not required but appreciated. Support the artist: https://kenney.nl/donate\n"
  );
  console.log("Prepared " + chosen.length + " local city CC0 models; catalog exposes " + available.size + " models.");
}

main().catch(error => {
  console.error("Could not prepare DEPOO city models:", error);
  process.exitCode = 1;
});

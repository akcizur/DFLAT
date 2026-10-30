import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_MODELS = path.join(ROOT, "public", "models");
const SOURCE_REPO = "Hidencod/tge-assets";
const SOURCE_COMMIT = "eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3";
const SOURCE_ROOT = "https://raw.githubusercontent.com/" + SOURCE_REPO + "/" + SOURCE_COMMIT;
const CATALOG_URL = SOURCE_ROOT + "/catalog.json";

// Only the modular Space Kit components used by DEPOO are downloaded at build time.
// The complete 1,883-model catalog remains discoverable on demand in the in-game browser.
const WORLD_MODEL_IDS = [
  "space-kit/terrain-roadstraight",
  "space-kit/terrain-roadcross",
  "space-kit/terrain-roadcorner",
  "space-kit/terrain-roadend",
  "space-kit/terrain",
  "space-kit/terrain-side",
  "space-kit/gate-complex",
  "space-kit/gate-simple",
  "space-kit/platform-large",
  "space-kit/platform-long",
  "space-kit/platform-high",
  "space-kit/platform-straight",
  "space-kit/stairs",
  "space-kit/hangar-largea",
  "space-kit/hangar-largeb",
  "space-kit/hangar-smalla",
  "space-kit/hangar-rounda",
  "space-kit/hangar-roundglass",
  "space-kit/monorail-trackstraight",
  "space-kit/monorail-trackcornerlarge",
  "space-kit/monorail-tracksupport",
  "space-kit/monorail-trainfront",
  "space-kit/monorail-traincargo",
  "space-kit/monorail-trainbox",
  "space-kit/craft-cargoa",
  "space-kit/craft-cargob",
  "space-kit/craft-miner",
  "space-kit/machine-generatorlarge",
  "space-kit/machine-generator",
  "space-kit/machine-wireless",
  "space-kit/machine-barrellarge",
  "space-kit/barrels-rail",
  "space-kit/barrels",
  "space-kit/pipe-straight",
  "space-kit/pipe-supporthigh",
  "space-kit/astronauta",
  "space-kit/astronautb",
  "space-kit/desk-computer",
  "space-kit/desk-chair",
  "space-kit/satellitedish-large",
  "space-kit/chimney-detailed",
  "space-kit/rock-largea",
  "space-kit/craterlarge",
  "space-kit/meteor-detailed"


async function fetchBuffer(url) {
  const response = await fetch(url, { headers: { "User-Agent": "DFLAT-open-source-model-setup" } });
  if (!response.ok) throw new Error("Download failed (" + response.status + "): " + url);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  await mkdir(PUBLIC_MODELS, { recursive: true });

  console.log("Reading the pinned CC0 model catalog…");
  const catalogBytes = await fetchBuffer(CATALOG_URL);
  const catalog = JSON.parse(catalogBytes.toString("utf8"));
  const available = new Map();
  for (const pack of catalog.packs || []) {
    for (const model of pack.models || []) {
      available.set(model.id, { ...model, packId: pack.id, packName: pack.name, author: pack.author, license: pack.license, packUrl: pack.url });
    }
  }

  const chosen = WORLD_MODEL_IDS.map(id => {
    const model = available.get(id);
    if (!model) throw new Error("Model missing from pinned source catalog: " + id);
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
      try {
        alreadyValid = (await stat(destination)).size === model.size;
      } catch {}
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
    schemaVersion: 1,
    source: "https://github.com/" + SOURCE_REPO,
    sourceCommit: SOURCE_COMMIT,
    sourceCatalog: CATALOG_URL,
    sourceLicense: "CC0-1.0",
    author: "Kenney",
    catalogModelCount: available.size,
    bundledModelCount: chosen.length,
    assets: chosen.map(model => ({
      id: model.id,
      name: model.name,
      pack: model.packId,
      file: model.file,
      bytes: model.size,
      license: model.license,
      author: model.author,
      source: "https://github.com/" + SOURCE_REPO + "/blob/" + SOURCE_COMMIT + "/" + model.file,
      packUrl: model.packUrl
    }))
  };
  await writeFile(path.join(PUBLIC_MODELS, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(path.join(PUBLIC_MODELS, "NOTICE-KENNEY-CC0.txt"),
    "DFLAT uses selected 3D models by Kenney from the tge-assets GLB library.\n" +
    "Source: " + manifest.source + "\n" +
    "Pinned commit: " + SOURCE_COMMIT + "\n" +
    "License: Creative Commons Zero 1.0 Universal (CC0-1.0).\n" +
    "The source repository states that the models and its converted GLB files are CC0.\n" +
    "Attribution is not required but appreciated. Support the artist: https://kenney.nl/donate\n"
  );
  console.log("Prepared " + chosen.length + " local CC0 models; catalog exposes " + available.size + " models.");
}

main().catch(error => {
  console.error("Could not prepare the open model library:", error);
  process.exitCode = 1;
});

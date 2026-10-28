import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SOURCE_COMMIT = "eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3";
const SOURCE_ROOT = "https://raw.githubusercontent.com/Hidencod/tge-assets/" + SOURCE_COMMIT;
const APP_BASE = typeof import.meta.env !== "undefined" && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : "/";
const PAGE_SIZE = 48;

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function targetHeight(model) {
  const value = (model.name + " " + model.packId).toLowerCase();
  if (/skyscraper|building|tower/.test(value)) return 8;
  if (/tree|palm/.test(value)) return 4;
  if (/car|vehicle|taxi|ambulance|truck|bus/.test(value)) return 1.55;
  if (/character|human|person|female|male/.test(value)) return 1.7;
  return 1.15;
}

export function createModelLibrary({ THREE, scene, camera, state, ui, world }) {
  const overlay = document.getElementById("modelLibraryScreen");
  const openButton = document.getElementById("modelLibraryButton");
  const menuButton = document.getElementById("modelLibraryMenuButton");
  const openButtons = [openButton, menuButton].filter(Boolean);
  const closeButton = document.getElementById("modelLibraryClose");
  const searchInput = document.getElementById("modelLibrarySearch");
  const packSelect = document.getElementById("modelLibraryPack");
  const resultCount = document.getElementById("modelLibraryCount");
  const grid = document.getElementById("modelLibraryGrid");
  const moreButton = document.getElementById("modelLibraryMore");
  const selectedTitle = document.getElementById("modelLibrarySelectedTitle");
  const selectedMeta = document.getElementById("modelLibrarySelectedMeta");
  const placeButton = document.getElementById("modelLibraryPlace");
  const status = document.getElementById("modelLibraryStatus");

  const loader = new GLTFLoader();
  const loadedModels = new Map();
  let models = [];
  let localAssets = new Map();
  let selected = null;
  let page = 0;
  let previousPaused = false;
  let busy = false;
  let lastTrigger = openButton;

  function open(trigger = openButton) {
    lastTrigger = trigger || openButton;
    previousPaused = state.paused;
    if (state.started) state.paused = true;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    for (const button of openButtons) button.setAttribute("aria-expanded", "true");
    document.body.classList.add("model-library-open");
    if (!models.length) loadCatalog();
    else searchInput?.focus({ preventScroll: true });
  }

  function close() {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    for (const button of openButtons) button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("model-library-open");
    if (state.started) state.paused = previousPaused;
    lastTrigger?.focus({ preventScroll: true });
  }

  for (const button of openButtons) {
    button.addEventListener("click", () => overlay.hidden ? open(button) : close());
  }
  closeButton?.addEventListener("click", close);
  searchInput?.addEventListener("input", () => { page = 0; renderGrid(); });
  packSelect?.addEventListener("change", () => { page = 0; renderGrid(); });
  moreButton?.addEventListener("click", () => { page += 1; renderGrid(true); });
  placeButton?.addEventListener("click", placeSelected);

  async function loadCatalog() {
    status.textContent = "Načítám katalog 1 883 CC0 modelů…";
    grid.replaceChildren();
    try {
      const [catalogResponse, manifestResponse] = await Promise.all([
        fetch(SOURCE_ROOT + "/catalog.json"),
        fetch(APP_BASE + "models/manifest.json")
      ]);
      if (!catalogResponse.ok) throw new Error("Katalog modelů není dostupný (" + catalogResponse.status + ").");
      if (!manifestResponse.ok) throw new Error("Lokální manifest modelů není dostupný.");
      const catalog = await catalogResponse.json();
      const manifest = await manifestResponse.json();
      localAssets = new Map((manifest.assets || []).map(asset => [asset.id, asset]));
      models = [];
      for (const pack of catalog.packs || []) {
        for (const model of pack.models || []) {
          models.push({
            ...model,
            packId: pack.id,
            packName: pack.name,
            author: pack.author,
            license: pack.license,
            packUrl: pack.url
          });
        }
      }
      packSelect.replaceChildren();
      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = "Všechny kolekce";
      packSelect.append(allOption);
      for (const pack of catalog.packs || []) {
        const option = document.createElement("option");
        option.value = pack.id;
        option.textContent = pack.name + " (" + pack.models.length + ")";
        packSelect.append(option);
      }
      status.textContent = "Katalog načten. Modely se načítají až na vyžádání.";
      renderGrid();
    } catch (error) {
      console.error("Open model catalog unavailable:", error);
      status.textContent = error.message || "Katalog nelze načíst. Samotná hra zůstává funkční.";
      resultCount.textContent = "Katalog není dostupný";
    }
  }

  function filteredModels() {
    const query = (searchInput.value || "").trim().toLocaleLowerCase("cs");
    const packId = packSelect.value;
    return models.filter(model => {
      if (packId && model.packId !== packId) return false;
      if (!query) return true;
      return (model.name + " " + model.packName + " " + model.id).toLocaleLowerCase("cs").includes(query);
    });
  }

  function renderGrid(append = false) {
    const results = filteredModels();
    const end = Math.min(results.length, (page + 1) * PAGE_SIZE);
    if (!append) grid.replaceChildren();

    for (const model of results.slice(append ? page * PAGE_SIZE : 0, end)) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "model-card" + (selected?.id === model.id ? " is-selected" : "");
      card.setAttribute("aria-pressed", selected?.id === model.id ? "true" : "false");
      const thumb = document.createElement("img");
      thumb.className = "model-card-thumb";
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.decoding = "async";
      thumb.src = SOURCE_ROOT + "/" + model.thumb;
      thumb.addEventListener("error", () => {
        thumb.removeAttribute("src");
        thumb.classList.add("thumb-unavailable");
      }, { once: true });
      const name = document.createElement("span");
      name.className = "model-card-name";
      name.textContent = model.name;
      const meta = document.createElement("span");
      meta.className = "model-card-meta";
      meta.textContent = model.packName + " · " + formatSize(model.size);
      card.append(thumb, name, meta);
      card.addEventListener("click", () => selectModel(model));
      grid.append(card);
    }

    resultCount.textContent = results.length.toLocaleString("cs-CZ") + " modelů";
    moreButton.hidden = end >= results.length;
    moreButton.textContent = end >= results.length ? "Vše načteno" : "Načíst další (" + Math.min(PAGE_SIZE, results.length - end) + ")";
    if (!results.length) {
      const empty = document.createElement("p");
      empty.className = "model-library-empty";
      empty.textContent = "Žádné modely neodpovídají hledání.";
      grid.append(empty);
    }
  }

  function selectModel(model) {
    selected = model;
    selectedTitle.textContent = model.name;
    selectedMeta.textContent = model.packName + " · " + model.license + " · " + formatSize(model.size);
    placeButton.disabled = false;
    placeButton.textContent = "VLOŽIT DO SVĚTA";
    status.textContent = "Vybráno: " + model.id + ". Model se stáhne až při vložení.";
    renderGrid();
  }

  async function loadModel(model) {
    if (loadedModels.has(model.id)) return loadedModels.get(model.id);
    const local = localAssets.get(model.id);
    const url = local
      ? APP_BASE + "models/" + local.file
      : SOURCE_ROOT + "/" + model.file;
    const promise = loader.loadAsync(url).then(gltf => gltf.scene);
    loadedModels.set(model.id, promise);
    try {
      return await promise;
    } catch (error) {
      loadedModels.delete(model.id);
      throw error;
    }
  }

  async function placeSelected() {
    if (!selected || busy) return;
    busy = true;
    placeButton.disabled = true;
    placeButton.textContent = "NAČÍTÁM MODEL…";
    status.textContent = "Stahuji a připravuji " + selected.name + "…";
    try {
      const source = await loadModel(selected);
      const root = source.clone(true);
      root.name = "Placed CC0 model: " + selected.name;
      const yaw = camera.rotation.y;
      root.rotation.y = yaw;
      const bounds = new THREE.Box3().setFromObject(root);
      const dimensions = bounds.getSize(new THREE.Vector3());
      const scale = targetHeight(selected) / Math.max(0.001, dimensions.y);
      root.scale.multiplyScalar(scale);
      const scaledBounds = new THREE.Box3().setFromObject(root);
      const x = camera.position.x - Math.sin(yaw) * 4.2;
      const z = camera.position.z - Math.cos(yaw) * 4.2;
      root.position.set(x, -scaledBounds.min.y, z);
      for (const mesh of root.children) {
        mesh.traverse?.(node => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
      }
      world.addPlacedModel(root);
      ui.showToast("Vloženo do světa: " + selected.name);
      close();
    } catch (error) {
      console.error("Could not load selected open model:", error);
      status.textContent = "Model se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.";
      placeButton.disabled = false;
      placeButton.textContent = "ZKUSIT ZNOVU";
      ui.showToast("Model se nepodařilo načíst.");
    } finally {
      busy = false;
    }
  }

  return { open, close };
}

import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "index.html",
  "styles.css",
  "styles-cinematic.css",
  "assets/city-sunset.webp",
  "src/main.js",
  "src/game/pixel-post.js",
  "src/game/materials.js",
  "src/game/world.js",
  "src/game/player.js",
  "src/game/ui.js",
  "src/game/input.js"
];

function fail(message) {
  console.error("Architecture check failed: " + message);
  process.exitCode = 1;
}

for (const relativePath of required) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    fail("missing required file: " + relativePath);
  }
}

const html = await readFile(path.join(root, "index.html"), "utf8");
if (!html.includes('href="./styles.css"')) fail("index.html must load styles.css");
if (!html.includes('<script type="module" src="./src/main.js"></script>')) fail("index.html must load src/main.js");
if (/<style(?:\s|>)/i.test(html)) fail("inline CSS remains in index.html");
if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail("inline JavaScript remains in index.html");

const modules = required.filter(file => file.endsWith(".js"));
for (const relativePath of modules) {
  const fullPath = path.join(root, relativePath);
  let source;
  try {
    source = await readFile(fullPath, "utf8");
  } catch {
    continue;
  }

  const check = spawnSync(process.execPath, ["--check", fullPath], { encoding: "utf8" });
  if (check.status !== 0) {
    fail("JavaScript syntax error in " + relativePath + ": " + (check.stderr || check.stdout).trim());
  }

  const imports = source.matchAll(/from\s+["'](\.\/[^"']+)["']/g);
  for (const match of imports) {
    const importPath = path.resolve(path.dirname(fullPath), match[1]);
    try {
      await access(importPath);
    } catch {
      fail(relativePath + " imports missing file: " + match[1]);
    }
  }
}

if (!process.exitCode) console.log("Architecture check passed: required files, external entry points, local imports and JavaScript syntax are valid.");

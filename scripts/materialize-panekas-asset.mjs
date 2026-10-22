import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const partsDir=path.join(root,"tools","panekas-source"),outputPath=path.join(root,"public","panekas.data");
let partNames=[];
try { partNames=(await readdir(partsDir)).filter(name=>/^part-\d{3}\.b64$/.test(name)).sort(); }
catch { console.warn("Panekas payload is not installed yet; runtime will keep the fallback building."); process.exit(0); }
if(partNames.length<2){console.warn("Panekas payload is incomplete; runtime will keep the fallback building.");process.exit(0);}
const base64=(await Promise.all(partNames.map(name=>readFile(path.join(partsDir,name),"utf8")))).join("").replace(/\s+/g,"");
if(!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)||base64.length%4!==0)throw new Error("Panekas model payload is not valid base64.");
const compressed=Buffer.from(base64,"base64");
if(compressed[0]!==0x1f||compressed[1]!==0x8b)throw new Error("Panekas model payload does not begin with a gzip header.");
const digest=createHash("sha256").update(compressed).digest("hex");
if(digest!=="fbd0164bb4414fba394b87617e0a0252eb43a34867b0865a6c6cddc42ffd4570")throw new Error("Panekas model payload checksum mismatch: "+digest);
const glb=gunzipSync(compressed);
if(glb.length<20||glb.readUInt32LE(0)!==0x46546c67||glb.readUInt32LE(4)!==2||glb.readUInt32LE(8)!==glb.length)throw new Error("Panekas model payload is not a complete GLB 2.0 file.");
await mkdir(path.dirname(outputPath),{recursive:true});await writeFile(outputPath,compressed);
console.log("Panekas model ready:",glb.length,"bytes GLB,",compressed.length,"bytes gzip,",partNames.length,"source parts.");

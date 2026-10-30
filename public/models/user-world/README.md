# Imported Low-Poly City

Place the three binary assets from `DFLAT_imported_world_assets.zip` in this directory:

- `LowPoly_City_01Ready.glb.gz`
- `LowPoly_Modern_Houses_fbx.FBX`
- `LowPoly_City_Colliders.json`

The app detects the three files at startup. When all are present and load correctly, they replace the bundled DEPOO grid. If any file is missing or invalid, the bundled city remains available as a safe fallback.

## Install

Extract the supplied asset ZIP at the repository root, then commit the folder:

```sh
unzip DFLAT_imported_world_assets.zip -d .
git add public/models/user-world
git commit -m "Add imported low-poly city assets"
git push
```

The compressed GLB is fetched and decompressed in the browser with `DecompressionStream`. Keep the `.gz` file compressed in Git. The modern-houses FBX is loaded by Three.js `FBXLoader`.

## Source notes

The city was converted from the supplied OBJ. Its accompanying MTL referred to a diffuse texture that was not included in the uploaded RAR, so the optimized GLB uses a restrained category-based palette instead of the missing image. The FBX is included unchanged. The collider JSON contains coarse building footprints for player collision.

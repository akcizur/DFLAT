# Open-source 3D model library

DFLAT now uses a pinned, searchable catalog of 1,883 Kenney low-poly GLB models supplied by the public `Hidencod/tge-assets` library. Its README lists 19 packs and identifies the models as CC0 1.0; the repository license covers the converted GLB files as well.

## What ships with DFLAT

- A curated set of 32 CC0 GLB models is downloaded during `bun run dev` and `bun run build`.
- The startup scene uses a small subset of that set: buildings, road tiles, vehicles, street signs, trees, plants, street furniture, and static characters.
- The in-game model browser can search all 1,883 catalog entries. The other model files are loaded only when selected, so they are not all downloaded or rendered at startup.
- The catalog browser and on-demand models require an internet connection. The curated neighbourhood models are downloaded locally before Vite starts or builds the site.

## Source and license

- Catalog: https://github.com/Hidencod/tge-assets
- Static source root: https://raw.githubusercontent.com/Hidencod/tge-assets/eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3/
- Source license: CC0 1.0 Universal
- Original asset author: Kenney — https://kenney.nl/
- Pinned source commit: `eb99f44e0a4ff36a3d5e52eb1256cb566d8854c3`

The build script checks each selected model's catalog license and expected byte size before writing it to `public/models`. The generated `public/models/manifest.json` and `public/models/NOTICE-KENNEY-CC0.txt` record the exact assets and their sources.

Additional open asset sources for future additions:

- Poly Haven — CC0 models, textures, and HDRIs: https://polyhaven.com/license
- Quaternius — CC0 game-ready model packs: https://quaternius.com/
- Kenney — individual asset pages list the applicable CC0 license: https://kenney.nl/assets

DFLAT does not automatically import arbitrary assets just because a website says “free.” New source packs must be checked asset-by-asset for redistribution rights and compatible formats before being bundled.

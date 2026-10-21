# Retro CRT / PS1 URP

Vlastní balíček fullscreen CRT efektů a PS1-inspirovaného shaderu pro Unity Universal Render Pipeline.

## Obsah

- `RetroCRTRendererFeature.cs` – fullscreen post-process; používá Render Graph v Unity 6 a `Blitter` v URP 14 / Unity 2022.3.
- `RetroCRTPostProcess.shader` – zakřivení, pixelace, RGB separace, scanlines, interlace, phosphor mask, pseudo-glow, VHS jitter/noise, flicker, vignette a ordered dithering.
- `RetroPS1Lit.shader` – materiál pro 3D modely s vertex snappingem, affine UV, normal mapou a kvantizovaným osvětlením.
- `RetroCRTFrameRateCap.cs` – volitelný runtime limit FPS.
- `Presets/` – profily PS1, CRT, VHS a PSX-TV.
- `Materials/` – materiál pro renderer feature a výchozí PS1 materiál.

## Požadavky

- Unity 2022.3 LTS s URP 14 nebo Unity 6.x s URP.
- Desktop je hlavní cíl. Mobilní/VR/konzolová kompatibilita není garantována.
- Balíček byl staticky zkontrolován, ale v tomto prostředí nebylo možné spustit Unity Editor ani skutečný GPU shader compile. První kontrolu proveď v Console v cílové verzi Unity.

## Instalace

### Varianta A – import složky

1. Rozbal ZIP.
2. Zkopíruj složku `RetroCRT-URP` do `Assets/RetroCRT-URP`.
3. Ujisti se, že projekt používá URP.

### Varianta B – jako lokální UPM balíček

1. Rozbal ZIP mimo složku projektu, aby kořenová složka obsahovala `package.json`.
2. Unity: **Window → Package Manager → + → Add package from disk…**
3. Vyber `package.json`.

## Aktivace Renderer Feature

1. Otevři renderer asset používaný URP (typicky `UniversalRendererData` / `ForwardRenderer`). Najdeš jej v URP Pipeline Assetu v poli Renderer.
2. V Inspectoru stiskni **Add Renderer Feature**.
3. Vyber **Retro CRT Renderer Feature**.
4. Do `Material Template` přetáhni `Materials/RetroCRT_PostProcess.mat`. Tím se shader bezpečně zahrne do buildu.
5. Do `Profile` přetáhni jeden z assetů `Presets/RetroCRT_*.asset`. Pokud zůstane prázdný, použijí se inline hodnoty v Renderer Feature.
6. Výchozí místo efektu je `After Rendering Post Processing`, aby CRT linky nerozmazával další URP post-processing.

### Unity 6 / Render Graph

Balíček implementuje `RecordRenderGraph`. Nevyžaduje vypnutí Render Graphu. Pokud používáš Unity 2022.3 / URP 14, balíček použije kompatibilní `Execute` + `Blitter` cestu.

### Pokud efekt nevidíš

- Ověř, že Renderer Feature je přidaná do rendereru skutečně používaného aktivním URP Pipeline Assetem.
- Zkontroluj `Material Template` a `Profile`.
- Feature standardně běží jen pro Game kameru a vynechává Overlay kamery. Pro Scene view zapni `Include Scene View`.
- Vypni jiné fullscreen efekty, které přepisují výstup po této feature.
- Zkontroluj první chyby shader compileru v Unity Console.

## Materiál PS1 na 3D modelu

1. Vyber mesh/objekt a přiřaď `Materials/PS1_Default.mat`.
2. Nastav `Base Texture` a volitelně `Normal Map`. Normal map musí být importována jako **Texture Type: Normal map** a mesh musí mít tangenty (v import settings nastav **Calculate Tangents**).
3. Doporučený start: `Vertex Snap 0.65–1`, `Affine Texture Mapping 1`, `Vertex / Texel Lighting 0.6–1`, `Lighting Steps 3–5`.
4. Pro výraznější ploché stínování nastav modelu v import settings normals na **Calculate** s vysokým smoothing angle nebo použij flat-shaded mesh. Efekt nemůže zpětně rekonstruovat původní trojúhelníkové normály z uhlazeného mesh shadingu.

## Limit FPS

Přidej `RetroCRTFrameRateCap` na GameObject v aktivní scéně a nastav `Target Frame Rate` například na 30 nebo 60. Komponenta mění FPS jen v Play Mode a při vypnutí obnoví předchozí nastavení `Application.targetFrameRate` a VSync.

## Profily

- **PS1** – výrazná pixelace, malé zakřivení a jemné CRT artefakty.
- **CRT** – silnější scanlines, phosphor mask, zakřivení a RGB odchylka.
- **VHS** – noise, horizontální jitter a interlace.
- **PSX-TV** – kompromis mezi PS1 pixelací a CRT obrazovkou.

## Co shader dělá a co ne

Fullscreen shader upravuje již vyrenderovaný obraz. Proto pixelace/quantization funguje na scéně jako celku. `RetroPS1Lit.shader` dělá skutečný vertex snapping a affine UV na objektech s tímto materiálem. Normální URP materiály se automaticky nepřepnou na PS1 shader a jejich UV mapování zůstane beze změny.

`Glow` je úsporný halo efekt z okolních vzorků, nikoliv samostatný víceprůchodový HDR bloom. `Affine Texture Mapping` je screen-space aproximace PS1 affine interpolace. Výsledky závisí na GPU/API, geometrii, nastavení barevného prostoru a rozlišení cílové kamery.

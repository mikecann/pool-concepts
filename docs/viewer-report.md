# Viewer report: the 3D walkthrough at /model/

## Round 6 goal (performance and realism pass)

**Goal:** make Live 3D look closer to the Cycles renders while keeping it as fast as possible, iterating measure → one change → re-measure → screenshot compare.

**Targets**
- **Load:** navigation to first interactive frame under 8 s on a warm cache.
- **Frame rate:** Medium at 1600×900 ≥ 60 fps at the alfresco, in the sunken lounge and at the pool's edge on this M-series Mac; High as close to 60 as possible; Low clearly faster again.
- **Realism:** closer to `05_pool_north_end__proposed.jpg`, `15_lounge_from_alfresco__proposed.jpg` and `times_15_lounge_from_alfresco_summer_1940.jpg`, with every Medium-cost change earning its keep.
- **Stop when:** the targets are met and three iterations in a row bring no visible gain, or after about 3 hours.

**How it's measured:** `scripts/perf.mjs` reports wall fps, GPU ms per frame (timestamp queries), JS ms per frame, draw calls and triangles. `scripts/profile-load.mjs` reports load times (warm/cold, optionally `CPU_SLOWDOWN=4`).

**Caveat:** a Cycles batch was using the GPU throughout, so fps and GPU ms are noisy and low. I compared A/B in the same session, interleaved, and lean on draw calls, triangles and JS time, which don't depend on GPU contention.

(The iteration log is in the Round 6 section below.)

Both parts of `docs/viewer-brief.md` are done. Nothing is committed, pushed or deployed. `pool-model.blend` was only ever opened read-only with `Blender -b`, and every screenshot run used headless Chromium on the real GPU (the scripts check for an Apple Metal adapter and stop if they get SwiftShader).

## What I built (Part B, pool-concepts)

`/model/` is now a full-screen first-person walkthrough. It loads behind a progress screen and starts you on the alfresco, looking past the lounge to the pool and the canal. The renders, options and notes from the old page sit in a collapsible 380 px panel on the right, which becomes a bottom drawer on phones.

**Light and atmosphere** (`src/atmosphere.ts`, `src/sun.ts`)
- **Sun position:** NOAA position ported from `build_time.py`. It matches the Python to the last decimal at all the brief's times.
- **Sun colour and strength:** three's Preetham `SkyMesh` drives the sky. Its extinction maths also sets the sun's colour and strength, so a low sun goes orange and weak without hand-tuned curves. Units follow Blender: the sun peaks at 6.5, lights are W/4π.
- **Environment light:** the sky is rendered through PMREM into the env map, with a lit ground disc under it. It only re-renders when the sun has moved, and at most every 120 ms.
- **Twilight and night:** the sky's twilight glow is held after sunset and then fades to a dark blue night with stars once it's properly dark.
- **Sun shadows:** a 4096 map (2048 on Low/Medium) about 76 m across. It follows you, snaps to whole texels, and only re-renders when the sun or you move.
- **Post-processing:** three's TSL `RenderPipeline` on `WebGPURenderer`, which falls back to WebGL 2. The chain is MRT scene pass → SSGI (AO plus a little one-bounce GI by day) → TRAA → bloom → AgX tone mapping.
- **Exposure:** follows the renders: 0 by day, rising through dusk to about +2.2 EV at night.

**Water** (`src/water.ts`, `src/mirror.ts`)
- **Pool, spa and canal** share one node material:
  - refraction from the scene colour buffer, offset by the ripples
  - per-channel absorption by the depth of water the ray passes through, so it gets bluer as it deepens
  - light scattered back out of the water body
  - Fresnel (IOR 1.33)
  - the shadowed sun glint
  - procedural ripples: gentle on the pool, choppier on the spa, longer waves on the canal
- **Reflections:** planar, one per water level, from my own small mirror pass (see "couldn't do" for why not three's `ReflectorNode`).
- **Caustics:** brighten the albedo of anything under the pool or spa water, so they follow the real sun shadow and disappear in shade.

**Day and night**
- **Controls:** 24 h slider with the sunrise-to-sunset band marked, 16 Jan / 21 Jun presets, a custom date, and a play button (about 12 minutes of day per second, slower around dusk).
- **From sunset:** the 14 fittings from `lights.json` fade in. The fire pit and one alfresco downlight cast shadows. The LED strips and markers glow, the fire pit flickers (an animated light plus unlit additive flames), and the house windows glow warm.

**Walking** (`src/walk.ts`)
- **Viewpoint and controls:** first person at 1.65 m. WASD/arrows, pointer-lock mouse look, Shift to run. On phones, a virtual stick plus drag to look.
- **Collisions:** a capsule against a three-mesh-bvh collider built from the visible, collidable meshes. It's rebuilt when you switch scenario or option. Window glass blocks you even though it's tagged `collide: false`.
- **Floors and water:** a ray down handles floors and steps up to 0.26 m, with gravity off ledges. Water blocks movement, and you slide along the coping.
- **Tested with real key presses** (`scripts/walk-test.mjs`):
  - spa deck down into the lounge: 2.39 → 1.67 m
  - back up the steps: 1.67 → 2.37
  - walking at the pool from the coping stops at the edge
  - walking at the house stops at the wall
- **Other modes:** Drone mode uses OrbitControls. "Go to…" glides to any `cameras.json` viewpoint and switches to drone mode for the aerial ones.

**Controls and layout**
- **Scenario and options:** Today/Proposed, the pool roller (none, shallow, deep, in-ground box) and the kitchen layout (which also switches the gate).
- **Settings:** people on/off, a frame-rate readout, and quality Low/Medium/High/Ultra. Quality is auto-detected (phones Low, no WebGPU Medium, otherwise High) and remembered.
- **Panel:** keeps the old page's `VIEWS`/`ROLLER`/`KITCHEN`/`DAY`/`SUN` arrays and copy word for word: before/after wipe, options, the lounge through the day, after dark, the fence comparison, the sun plan, and the notes and assumptions.
- **Stand here:** each render has a "Stand here" button that flies the 3D view to that camera, time and options (the nice-to-have).
- **Theme:** the drawing-sheet tokens, Barlow Condensed and IBM Plex, light/dark/auto.

**Performance** (headless Chromium, Apple GPU, 1600×900)
- High holds 60 fps day and night. Night is the heavy case: High needed its render scale cut from 1.5 to 1.25 to stay at 60.
- Medium, Low and Ultra also hold 60 at night.
- I couldn't test on a real iPhone. Low is the cheap path (no SSGI, TAA or reflections), but it's untested on the device.

**Libraries** (pinned in `package.json`)
- three 0.186.1 (`WebGPURenderer`, TSL, `RenderPipeline`, SSGINode, TRAANode, BloomNode, SkyMesh, GLTFLoader + meshopt decoder, OrbitControls, RectAreaLight LTC)
- three-mesh-bvh 0.9.16
- Vite 8.3.4, TypeScript 7.0.2, Playwright 1.64.1, @gltf-transform/cli 4.5.1

**Why WebGPU/TSL rather than pmndrs postprocessing + N8AO:** three r186's TSL nodes gave every effect the brief lists in one pipeline: SSGI (whose AO replaces GTAO), TRAA, bloom and AgX. The real-GPU screenshots look right with it, so I didn't need the WebGL fallback stack.

**Build**
- `npm run build` type-checks, clears only `public/model/assets/`, and writes `public/model/index.html` + `assets/`. `img/` and `web/` are left alone.
- `npm run dev` serves `img/` and `web/` through a small Vite middleware.
- `scripts/sync-model.sh` still syncs `img/` and `web/` (now including `lights.json`) but no longer writes the page.

**Codex's leftovers:**
- Replaced: `src/`, `index.html` and `package.json`. The versions were unpinned, the gallery was a straight copy of the old page, and there was no `main.ts`.
- Kept: the `.gitignore` change (`review/`).

## What the export changed (Part A, the-pool)

A sub-agent did this. I reviewed and used its output. Changes are in `scripts/blender/export_web.py` plus new `scripts/web/{export.sh, optimize.mjs, instance.mjs, gltf.mjs, inspect.mjs}`. Codex's `upgrade_export.py` patch script is deleted.

- **Options:** all 8 option collections are kept and tagged `option`. `set` stays.
- **Light fittings:** LED strips, markers and flames are emissive (colour from their Emission node) with `night: true` and material extras `led`/`ledLevel`.
- **`lights.json`:** written for every light except `Sun`, in three.js coordinates, with night watts from the brief's table.
- **Material maps:** `pbr` materials get base colour at 1024 px (tint and joints baked; the old ×1.7 brightening is gone, so this is true albedo), plus a normal map and roughness (in the green channel).
- **Plants:** real Poly Haven meshes at about 3k triangles each (the island tree at 12k, because 3k made it a blob), with alpha leaves, instanced.
- **Far trees:** Treeline and context trees are 120-triangle canopies, instanced, tagged `lod: "far"`.
- **Collision tags:** `collide` on every node. `water` is tagged pool/spa/canal and `window` is on the house glass.
- **Optimised:** with extras-preserving instancing, dedup, weld, meshopt geometry and WebP textures. **14.65 MB** (target was under 35).

## What's left, or couldn't be done

- **Planar reflections:** `ReflectorNode` kept disposing its own render target mid-frame inside the MRT pipeline (black frame, "destroyed texture" errors). `src/mirror.ts` does the same job with lifetimes under my control.
- **SSGI bounce:**
  - Full strength flattened the sun shadows. By day it's mixed in at 12% on top of the sky IBL.
  - At night it lit the far bank for no good reason, so it fades out through dusk and night is AO only.
  - The cause looks like SSGI itself in r186. Worth another look on a later three release.
- **Interior lights** (`int_light*`) aren't real lights: without the house interior blocking them they'd shine through the walls. The windows glow instead.
- **LED strips** glow and bloom but don't light the surfaces near them. Only the bench area lights and fittings in `lights.json` do. The Cycles renders get extra wash from emissive meshes acting as lights.
- **Fire pit flames** are the Blender cones, unlit and additive with a flicker and wobble. They read as warm flame but aren't a proper particle or volumetric fire.
- **Not checked on real devices:** I couldn't test a real iPhone or an M-series MacBook's own display (retina pixel ratios, thermal limits). The numbers above are from headless Chromium on this Mac's GPU.
- **Viewpoint FOV:** "Go to" and "Stand here" use each render's lens. Walking eases you back to the normal field of view.

## Screenshots

All under `pool-concepts/review/` (gitignored):

- **The brief's set** (16 Jan, 07:30 / 13:00 / 17:30 / 19:40 / 21:00 × alfresco, standing in the sunken lounge, pool edge): `review/final/{alfresco,lounge,pooledge}_{0730,1300,1730,1940,2100}.png`. Contact sheet: `review/sheet_final.png`.
- **Extra views:** `review/final/{house,canal,drone}_{1300,1800,2100}.png` (sheets `review/sheet_final2.png`, `review/sheet_final3.png`).
- **UI:**
  - panel open: `review/ui/desktop_panel_light.png`, `desktop_panel_dark.png`
  - aerial drone: `drone_aerial_1600.png`
  - winter: `winter_alfresco_1300.png`
  - Today: `today_alfresco_1445.png`
  - phone at Low, plus the drawer: `phone_low.png`, `phone_drawer.png`
- **Rerunning them:** `npm run build && npm run serve`, then `node scripts/review.mjs` (it takes `--times`, `--views`, `--quality`, `--out`), `node scripts/ui-shots.mjs` and `node scripts/walk-test.mjs`. All are headless.

## Round 2

1. **People are on by default** (`model.people = true`, and the checkbox starts ticked). In the default start view on the alfresco, the figures sit in the lounge below eye level. None of them blocks the view to the pool or the canal, so nothing needs moving in Blender. In my own review spots a couple of figures sit close to the camera: `person_lounge_3` stands in the lounge shot and `person_child` / `person_pool` sit in the pool-edge shot. That's just where I put the review camera, so leave the figures where they are.
2. **The grass** is in `src/grass.ts`.
   - **Texture:** on every quality the lawn texture gets soft world-space patchiness: greener and drier patches over a few metres, plus finer mottling. It keeps its normal map and the export's 2 m tiling, and the 2 m repeat no longer shows.
   - **Blades:** on High and Ultra, instanced tufts of 12 short blades (4 to 8 cm) are scattered over the lawn top faces at 110 per m² on High and 150 on Ultra, in 4 m cells. Only cells near you are drawn. The blades sink into the ground between about 7 m and 12 m out (18 m on Ultra), so they fade into the texture with no edge.
   - **Look:** their colour comes from the lawn texture's own average, lit with the ground's normal so the blades and the lawn shade the same way. They sway slightly and pick up the sun's shadows.
   - **Cost:** Low and Medium get the texture only, so they cost nothing extra. About 33k tufts in all. High and Ultra both hold 60 fps.
3. **Pool reflections:**
   - **Calmer water:** the pool's swell is now about 1 mm, spread over metre-long waves. The reflection offset is a fifth of what it was, and the spa is calmer too. The canal is unchanged, so it stays the choppiest.
   - **Aliasing:** the stripes had a second cause. Thin fence pickets aliased in the half-resolution, non-anti-aliased reflection target and broke into dashes, so the mirror target now has 4x MSAA.
   - **Caustics:** they now scale with sun height, so a low evening sun gives only a faint shimmer instead of bright bars between the picket shadows.
   - Result: `house_1800` now shows a continuous, gently wavy picket reflection.
4. **Canal-wall brick lights** have their own material copy at emission level 1.1 instead of the markers' 9. That's under the bloom threshold, so they read as small step lights with no glare. They're emissive only and don't cast light on the path.
5. **Copy:** the roller line now says "the tube sits about 0.5 m up, so the roll clears the coping by about a hand's width". The rest of the copy is unchanged.
6. **Sync and images:**
   - `scripts/sync-model.sh ../the-pool` ran: 113 images, plus the GLB, `lights.json` and `cameras.json`. Then I rebuilt.
   - New `scripts/check-images.mjs` checks every image the panel can show (all views and thumbs, `options_*`, `times_*`, `night_*`, `sun_*`, `*__glass.jpg`). Result: **112 checked, 0 missing**.
   - The GLB from the-pool (11:23) is newer than `pool-model.blend` (10:50), so the 3D model already matches the scene the new renders came from, and no re-export was needed.
7. **Review set** re-run, all headless on the Apple Metal GPU:
   - **Contact sheets:** `review/round2/sheet_final.png` (the brief's 15 views), `sheet_final2.png`, `sheet_final3.png`, plus `sheet_round2_fixes.png`. The last one sets the four views from your feedback side by side: `house_1800`, `alfresco_1730`, the Today lawn, and `canal_2100`.
   - **Frames:** `review/round2/final/`.
   - **UI:** `review/round2/ui/`.
   - **Walking:** `review/round2/walk-test.txt`. Walking down into the lounge, up the steps, and stopping at the pool coping and the house wall all pass. I moved the down-the-steps test to start at the top of the steps, because the old start point wedged the capsule against the spa-side bench wall.
   - **Performance:** High holds 60 fps by day. The night drone view measures 54 to 60 on a fresh page. It dips to about 43 at the end of long back-to-back headless runs, but a single-page test showed no drift (54 → 60 after 14 view changes), so that dip is the GPU warming up during the runs, not a leak. Ultra holds 60 at night.

## Round 3

1. **Far trees** (`src/trees.ts`). They're still instanced.
   - **Shape:** the canopies' faceted normals are welded and smoothed, then bent outward from the canopy centre, which gives soft foliage lighting.
   - **Edges:** an alpha-tested ragged edge cuts leaf-shaped holes where the crown turns side-on.
   - **Colour:** world-space noise adds leafy clumps and gaps, and the undersides are darker. Each tree gets its own tint, size, squash and spin.
   - **Cost:** the trees are lit by the sun only, because the garden lights can't reach 70 m away anyway. Without that the extra shader work cost about 9 fps at night.
   - **Checked** at 13:00 and 18:00 from the alfresco and from the drone: `review/round3_trees_before_after.png`, `review/round3_trees_drone.png`.
2. **First-visit help:** a small card titled "How to walk around".
   - **Content:** desktop shows the click, W A S D/arrows, Shift and Esc controls. Phone shows the stick and drag-to-look.
   - **Timing:** it appears one frame after the scene is up, so it never holds back the first frame.
   - **Dismissing:** it closes on "Got it", Esc or Enter, or your first click or touch on the view, and stays closed after that (`localStorage`, wrapped in try/catch).
   - **Return visits** just get the short "click to look around" hint.
   - **Screenshots:** `review/round3/ui/desktop_first_visit.png`, `phone_first_visit.png`.
3. **Phone, 390×844 at Low:**
   - The top bar wrapped to three rows, so it's now two. Phones get a shorter "Renders" label, and "Go to" stretches to fill the second row.
   - A layout check in `scripts/ui-shots.mjs` finds no overlaps, nothing off-screen and no horizontal scroll.
   - The 3D view gets 75% of the screen height: top bar 103 px, time bar 104 px.
   - **Sheet:** `review/round3/phone_sheet.png`.
4. **Most obviously CG thing in the start view:** a hard, saturated, textbook-clear sky meeting a crisp far bank. Real coastal air pales the blue towards the horizon and softens anything 100 m away, as the Cycles renders do.
   - **Fix:** the sky is a little hazier (turbidity 2.4 → 6, rayleigh 1.6 → 1.15), and distance haze now starts at 35 m instead of 90 m in a softer colour. It costs nothing, and the 18:00 sky now glows towards the sun instead of staying flat blue.
   - **Compare:** `review/round3/start_compare.png` (before | after) and `start_compare2.png` (first step | final).
5. **Checks:**
   - The rebuild is clean, and `check-images` reports 112 checked, 0 missing.
   - The walk test passes: down into the lounge, back up the steps, and stopped at the pool coping and the house wall.
   - The full review set runs at 60 fps on High, night drone included.
   - **Sheets:** `review/round3/sheet_final.png` and `sheet_final3.png`.

## Round 4

### 1. Two ways in
- **`/model/`** is now a chooser with two big cards, each with a preview and one line: **A, Renders** (`/model/renders/`) and **B, Live 3D** (`/model/walk/`). Each page links back to the chooser and across to the other.
- **The renders page** is the old sidebar gallery at full width: the before/after wipe across the 16 views, the roller and kitchen options, the lounge through the day, after dark, the fence comparison, the sun plan, and the notes and assumptions.
  - Wide screens put the picture on the left and the choices and notes on the right.
  - Every picture has **Open in 3D**, which deep-links to the walkthrough at the same camera, time, scenario and options (e.g. `walk/?cam=17_pool_overview&t=885&roller=roller_shallow`).
- **Separate builds:** Vite now builds three pages (`index.html`, `renders/index.html`, `walk/index.html`). The renders page bundle is 24 KB and the network log shows **no three.js and no GLB** there. The walkthrough loads **no gallery renders**: only its loading-screen picture and 9 new small card thumbnails (`img/card_*.jpg`, about 9 KB each, made by `scripts/make-cards.mjs`, which `sync-model.sh` now runs).
- **Moves and shared code:**
  - The old root `index.html` is now `walk/index.html`.
  - `src/views.ts` holds the 16 view names for both pages.
  - `src/tokens.css` holds the shared drawing-sheet tokens.
  - `src/sheet.css` styles the chooser and the renders page.

### 2. The walkthrough's panel is 3D only
- **What's there:**
  - Today/Proposed
  - people
  - frame rate
  - quality
  - "How to walk around", which reopens the help card
  - design-choice cards
  - a viewpoint list
  - a link to the renders page
- **The cards:** each has a thumbnail and a one- or two-line note trimmed from the ROLLER/KITCHEN/fence copy (`src/choices.ts`).
- **Clicking a card** switches to Proposed, updates the world (and rebuilds the collider) and glides the camera to where the change shows:
  - Shallow end, in-ground box and no roller look up the pool from the deep end (camera 13).
  - Deep end looks down it from the north fence (camera 05).
  - Kitchen cards go to the outdoor kitchen view (16), which also shows the gate moving.
  - Fence cards go to the lawn steps (03).
- **The glass fence** swaps the pool fence infill and gate infill to a pale-green 20% glass that casts no shadow. The frames stay charcoal, so it reads as framed glass, not quite SK02's frameless spigots.

### 3. Gates
- **Pivots:** each gate leaf (`gate` extras) is re-parented into a pivot group at `gate_hinge` and swung about +Y by `gate_swing` × 90°.
- **Prompt:** within 1.5 m and roughly facing a gate, a tooltip says **Press E to open the gate** ("close" when open). Phones get a tap button instead.
- **Swing:** about 0.6 s, eased.
- **Self-closing:** once you're clear of the swing, an open gate shuts itself after 5 s.
- **Collision:** the leaves are out of the static collider and checked every step as a moving strip, so a closed gate blocks you and an open one doesn't.
- **Walk test:**
  - walking into the closed north gate stops you
  - E opens it and you walk through
  - it swung shut on its own about 5 s after the walker cleared its swing

### 4. Jump
- **Space** gives a 0.45 m hop (measured peak +0.42 m), with gravity, landing on whatever's below.
- **The pool fence:** the test runs and jumps at the east pool fence from the lawn. Walking stops at a 0.6 m terrace step. Jumping gets you up that step, and you then stop against the fence (x 3.32, fence line 3.10), so you **can't clear the 1.2 m pool fence**.

### 5. Loading

Headless Chromium on this Mac's GPU, localhost. Cold = fresh browser (empty HTTP and shader caches); warm = reload.

| | First frame (cold) | Settled (cold) | First frame (warm) | Settled (warm) |
|---|---|---|---|---|
| Before | 2.69 to 2.72 s | 2.99 to 3.02 s | 2.19 to 2.20 s | 2.50 to 2.51 s |
| After | **1.26 to 1.34 s** | 2.72 to 2.88 s | **0.74 to 1.07 s** | 2.20 to 2.80 s |

"Settled" is the old "interactive" metric: 10 frames in a row under 50 ms. Before, nothing moved until that point. Now you can walk from the first frame, while the full lighting, the mirrors, the far trees and the grass arrive over the next ~1.5 s. That costs one ~0.35 s frame when the full lighting swaps in, and a few 70 to 120 ms frames. Logs: `review/profile_before.txt`, `review/round4/profile_after.txt`.

On an emulated 50 Mbps connection (`THROTTLE_MBPS=50`), the 15 MB download takes ~2.7 s and the first frame lands at 3.4 to 3.8 s, so only ~0.65 s after the download (log: `review/round4/profile_after_50mbps.txt`). I didn't measure the old build throttled. Its post-download part was ~2.2 s on localhost, so on a 50 Mbps line expect the first frame about 1.5 s sooner than before.

What changed (`src/compile.ts`, `main.ts`, `post.ts`):
- **Download alongside start-up:** the GLB starts downloading at once, in parallel with WebGPU start-up.
- **Parallel compile:** pipelines are compiled for the first view only (three culls to the frustum), all in parallel. three's `compileAsync` waits for each object's pipeline before starting the next; `compileFor()` hands the promises to one shared list instead.
- **The real target:** it compiles for the post pass's MRT target, which the frames actually use, not the canvas.
- **Three keying bugs** meant the old precompile mostly didn't count:
  - The 14 night lights were still visible when it ran, so every shader was built for the night lighting.
  - three keys render contexts by call depth, and the scene pass is drawn at depth 1 by the boot chain but depth 2 inside SSGI, so after the upgrade everything rebuilt again. `pinRenderDepth()` fixes each scene target to one depth.
  - The precompile's target and MRT leaked into frames drawn during background compiles. Frames now draw through `renderClean()`.
- **Boot pipeline:** the first frame shows the scene pass as it is (same MRT, so nothing compiled is wasted). The full SSGI/TRAA/bloom chain warms up in a second pipeline and swaps in once its pipelines are ready.
- **Deferred:**
  - Water mirrors: the water uses the sky reflection meanwhile, then fades to the mirror.
  - Far trees and grass: built a batch per task.
  - Precompiles for turning around and for the night lighting: done in the background, so neither stalls later.
- **Textures** upload alongside the compile.
- **Async pipelines while loading:** any pipeline still missing is created asynchronously, so objects appear a frame later instead of freezing the page. It's switched off once loading is done.
- **Material dedupe:** identical flat materials now share one material. This cut materials but barely changed timings, because three already shares shaders between same-shaped materials.
- **Honest progress text:**
  - On the loading screen: "Loading the model… N%" → "Building the scene…" → "Compiling shaders… k of n" → "Drawing the first frame…".
  - After the first frame, a small status pill: "Adding soft shadows and reflections…" → "Adding trees and grass…" → "Getting the rest of the yard ready…", then it disappears.
  - "Ready" is gone.

### 6 and 7. Sync, checks and review
- **Sync:** `scripts/sync-model.sh ../the-pool` ran with the re-exported GLB (closed gates with the new extras), and I rebuilt.
- **Image check:** `scripts/check-images.mjs` reports 121 checked, 0 missing. That's every renders-page image, the card thumbnails and the chooser's pictures. It now loads the TS modules through Vite.
- **Walk test** (`review/round4/walk-test.txt`) passes:
  - steps down and up
  - pool coping and house wall
  - closed gate blocks, E opens, walk through, self-closes
  - jump height and landing
  - can't clear the pool fence
- **Page checks** (`scripts/pages-check.mjs`, results in `review/round4/pages-check.txt`):
  - network per page
  - every card click checked for its camera move
  - the gate tooltip and button
  - screenshots in `review/round4/pages/`
- **Review set:** re-run.
  - Sheets: `review/round4/sheet_final.png` (the brief's 15) and `sheet_final3.png`.
  - Pages and walkthrough: `review/round4/sheet_pages.png`, `sheet_walk.png`, `sheet_phone.png`.
  - Fresh pages hold 57 to 60 fps on High at night. The long back-to-back headless runs end lower (37 to 42), as in Round 2, and a single-page drift check showed none (57.6 → 60.1 fps after 15 changes).

### Caveats
- **The upgrade frame:** SSGI/TRAA/bloom build their shaders synchronously in three, and there's no API to precompile them. That's the one ~0.35 s frame just after the first.
- **Relies on three internals:** the loading fixes patch three r186 internals (`_pipelines`, `_renderContexts`). They're isolated in `src/compile.ts` and commented, and need re-checking on a three upgrade.

## Round 6

### Iteration log

Medium, 1600×900, 13:00 at the alfresco / lounge / pool edge unless noted. Draws, triangles and JS ms are per frame across all passes. fps and GPU ms are noisy because Blender held the GPU throughout, so verdicts lean on draws, triangles and JS time.

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 0 | Baseline | ~1,070 draws, 2.81 M tris, JS 8–16 ms | |
| 1 | Pool and spa share one planar mirror (4 cm apart) instead of two | draws 1,067 → 796, tris 2.81 M → 2.08 M | **Kept**: one whole scene render fewer, no visible change |
| 2 | Far trees split into 50 m, then 150 m, frustum-culled chunks | tris −1.0 M but draws +210 to +1,300, JS +4 to +60 ms | **Reverted**: CPU is the tighter limit on slower machines |
| 3 | Far canopies as 80-triangle icospheres instead of 120-triangle blobs | tris 2.08 M → 1.49 M | **Reverted**: they looked like smooth lollipops (`review/round6/i3_trees_AB.png`) |
| 4 | Far canopies left out of the pool mirror (camera layer); the canal mirror keeps them | tris 2.08 M → 1.49 M, draws −4 | **Kept**: identical pool reflections (`review/round6/i4_poolmirror_AB.png`) |
| 5 | Canal mirror skips our own lot while the camera is in it (it can only reflect the far bank from there) | draws −45 to −60, JS alfresco ~25 → ~15 ms, pool edge 9 → 7 ms | **Kept**: identical (`review/round6/i5_canal_AB.png`) |
| 6 | Static meshes merged by material and visibility key, in coarse regions (`src/merge.ts`) | meshes 825 → 444, draws ~750 → ~490, JS lounge 8 → 6 ms, pool edge 11 → 6.5 ms, tris +30 k | **Kept**: same pictures (`review/round6/i6_merge_AB.png`); collisions, steps and gates pass |
| 7 | **Dusk hitch**: the night lights, the sun and the flames stay in the scene all the time, and only intensity or emission changes | scrubbing 17:00 ↔ 21:00 three times: longest frame **1.7 to 22 s** on every crossing → **19 to 21 ms**, none over 50 ms (Medium, High and Low); daytime Medium unchanged (60 fps, JS alfresco ~20 → ~7.5 ms) | **Kept**: same day and night pictures (`review/round6/dusk_AB.png`) |

| 8 | Sun-only lighting for materials used only more than 30 m from the yard (to claw back the constant lights' compile cost) | warm compile ~0.8 s → ~0.8 s | **Reverted**: the shader count is set by unique shader shapes, so this only added sun-only variants |
| 9 | Boot with the day light set (small shaders, fast first frame), then compile the night set in the background on a cloned camera and switch for good | first frame back to ~0.8 s, but the switch still rebuilt 43 to 143 shaders (a 0.5 to 1.3 s stall) | **Reverted**: three's light-set cache key is cached per render call and shared across cameras, so the night set can't be compiled out of sight; it also risked filing night shaders under day keys |
| 10 | Pair up the 4 boundary uplights and the 4 skillion downlights (13 → 9 real lights, each pair at its midpoint with the combined power) | warm compile ~0.78 → ~0.63 s, warm first frame ~1.2 → ~1.1 s, settled ~3.3 → ~3.0 s | **Kept**: night pictures nearly identical (`review/round6/i10_lights_AB.png`) |

| 11 | **Sun shadows in the yard were missing**: the shadow map was being drawn inside the canal-mirror pass, which hides our lot (iteration 5), so it held only the neighbours and the far bank. The two shadow-casting night lights had the same problem. Shadow updates are now held until the main pass. | shadow map before: 55 objects, no yard; after: the whole lot. Frame cost unchanged (maps re-render only when the sun moves) | **Kept**: the biggest realism gain of the round (`review/round6/cmp/shadowfix_vs_cycles.png`). Older builds (Round 4/5) also lost the yard's shadows when the sun was high, so this was older than iteration 5 |
| 12 | Hazier sky (turbidity 6 → 9) toward Cycles' pale horizon | no cost | **Reverted**: no visible gain (`review/round6/sky_AB.png`) |
| 13 | Deeper pool water: more absorption and body colour | no cost | **Kept**: reads more like the Mondo blue in the renders and less like clear glass (`review/round6/i13_pool_AB.png`) |

**Stopping point:** the targets were met. 11 and 13 were visible gains and 12 wasn't, but the Blender batch finished, so I took the clean final measurements below rather than carry on the loop.

Iteration 7 is the dusk hitch Mike reported. Which lights are visible is part of every material's shader key in three, so switching the scheme on at dusk by making 14 lights visible (and hiding the sun at night) rebuilt and recompiled every shader in the scene. It also never stayed cached, so it happened on every crossing. Now the light set never changes, and the two shadow-casting night lights (fire pit and one downlight) render their maps once when the lights come up. The scrub check is `scripts/scrub-test.mjs`, and the logs are `review/round6/scrub_before.txt`, `scrub_after1.txt` and `scrub_final.txt`.

**Cost of the fix:**
- Every shader now carries the night lights, which lengthened the load-time compile: warm first frame 0.8 s → 1.25 s, and on a 4× slowed CPU 2.9 s → 5.9 s.
- Iteration 10 won part of it back: warm first frame ~1.1 s, and on a 4× slowed CPU 3.7 s warm / 4.6 s cold.
- Both stay well inside the 8 s target.
- Daytime frame time at Medium is unchanged (60 fps, JS 5 to 7 ms).

**In the final scrub runs**, one set of three round trips had no frame over 18 to 19 ms. A second set had some 50 to 134 ms frames, but spread evenly from 17:08 to 20:57 rather than at sunset (~19:20), so that's the Blender batch competing for the GPU, not shader work.

### Round 6: what else changed
- **New options** (`src/choices.ts`, `model.ts`, `main.ts`, `gallery.ts`):
  - **Pool roller:** new low-profile option, new deep-end and in-ground-box copy, and every roller card now flies to `05_pool_north_end`.
  - **Pier:** "Across the deck" option added.
  - **New groups:** North pool fence (`nfence_*`, flies to `20_pool_north_seating`) and Side passage surface (`passage_*`, flies to `19_play_area`).
  - **Combined keys:** keys like `nfence_as_drawn+passage_pavers` show only when both parts are chosen. The defaults follow `render.py`.
  - **URL params:** `?nfence=moved&passage=aggregate` (prefix optional) and `?pier=`.
  - **Renders page:** a new "fence by the pavilion pier" section and a "Side passage" section with the four combinations from cameras 20, 19 and 17. View 20 is added, and low-profile is added to the roller section.
- **Missing renders:** `make-cards.mjs` skips any render that isn't there yet, and the pages show a quiet "Render to come" instead of a broken image.
  - Mike's sync at 16:07 brought the new renders in, so `check-images` is **162 checked, 0 missing**, and all 18 cards are made.
- **Settings:** the first visit is Medium with the fps counter on (no auto-detect).
  - **What's remembered:** in `localStorage` (try/catch) under `pool-settings`: quality, fps counter, people, scenario, every option, date, and the time of day once you've moved it yourself.
  - **Deep links** override the saved values.
  - **Checked** by `scripts/settings-test.mjs`.
- **New scripts:**
  - `scripts/perf.mjs`: fps, GPU ms, JS ms, draws, triangles
  - `scripts/scrub-test.mjs`: the dusk check
  - `scripts/compare.mjs`: the walkthrough from a Cycles camera next to its render
  - `?gpu=1`: turns on timestamp queries

### Final numbers (GPU free, the Blender batch had finished)

| | Before (Round 5 build) | After |
|---|---|---|
| Load, warm: first frame / settled | 0.87 to 0.89 s / 2.25 to 2.39 s | 1.05 to 1.19 s / 2.85 to 3.13 s |
| Load, cold: first frame / settled | 1.33 to 1.34 s / 2.83 to 2.86 s | 1.56 to 2.09 s / 3.54 to 4.07 s |
| Load, 4× slower CPU, warm first frame | 2.9 s (Round 6 start) | 3.7 s |
| Dusk scrub, longest frame | 1.7 to 22 s at every crossing | 19 to 24 ms, none over 50 ms |
| Medium (alfresco / lounge / pool edge) | 60 fps, ~1,070 draws, 2.8 M tris, JS 8 to 16 ms | **60 fps**, 440 to 510 draws, 1.4 to 1.5 M tris, JS 5 to 6 ms |
| High | 24 to 54 fps (GPU busy), ~1,100 draws, 3.4 M tris | **60 fps**, 460 to 530 draws, 1.9 to 2.0 M tris, JS ~6 ms |
| Low | ~290 draws, JS ~2 ms | **60 fps**, 170 to 200 draws, 0.1 to 0.16 M tris, JS ~2.4 ms |

**Notes on these numbers:**
- **Load:** got a little slower. That's the price of the dusk fix, since every shader now carries the night lights all day. It's well inside the 8 s target everywhere I can measure, including a 4× slowed CPU.
- **The ~20 s Mike sees:** I couldn't reproduce it in headless Chromium on this Mac. Pipeline compile time is driver- and display-dependent, so please time it once in his browser.
- **Frame rate:** fps is capped at 60 by vsync, so the draw-call, triangle and JS-time drops are the real headroom gained.
- **GPU timestamps:** the GPU-ms readings (45 to 90 ms at a steady 60 fps) aren't credible. three resolves timestamps across passes in a way I couldn't line up per frame, so I didn't base any verdict on them.

### What I couldn't do, or left
- **Absolute fps during the loop:** it was noisy while Blender held the GPU, so verdicts used draw calls, triangles and JS time. Only the final table is clean.
- **Load still pays for the constant light set:** about +0.2 to 0.3 s warm compared with the old dusk-stalling build. Precompiling both light sets wasn't possible (iteration 9).
- **Realism gaps still left vs Cycles:**
  - the sky is bluer and less hazy at the horizon
  - shadows are a bit softer and less contrasty
  - no tile or paver joints on the concourse in the 3D model
  - no caustic patterns as strong as the new Cycles pool water

  These are export or texture work rather than cheap viewer changes.
- **The walk test's step check** now stops on the spa deck rather than walking off its unfenced south edge onto the canal path, which the re-exported model allows.

### Screenshots (`review/round6/`)
- **Comparisons with Cycles:** `cmp/base_vs_cycles.png` (start of the round), `cmp/shadowfix_vs_cycles.png`, `cmp/final_vs_cycles.png`
- **Iteration A/Bs:**
  - `i3_trees_AB.png`
  - `i4_poolmirror_AB.png`
  - `i5_canal_AB.png`
  - `i6_merge_AB.png`
  - `dusk_AB.png`
  - `i10_lights_AB.png`
  - `sky_AB.png`
  - `i13_pool_AB.png`
- **Review set:** `final/` (sheet `sheet_final.png`)
- **New cards and gate:** `sheet_cards.png`; pages in `pages/`
- **Shadow diagnosis:** `shtest/`, including the shadow-map dumps `shtest/smap.png` (before) and `smap_fixed.png`
- **Logs:** `perf_final.txt`, `load_final_before.txt`, `load_final_after.txt`, `scrub_final.txt`, `walk-test.txt`, `settings-test.txt`, `image-check.txt`, `perf.log` (every A/B run)

## Round 7

**Goal:** fix the independent reviewer's P0 and P1 findings (`review/r4/review.md`), then close the biggest realism gaps against Cycles, using the same loop: measure → one change → re-measure → screenshot compare → keep or revert.

**Targets**
- **Quality switching:** changing quality at any time keeps sun shadows, with zero WebGPU errors.
- **Frame rate:** Medium holds 60 fps at the alfresco, sunken lounge, pool edge and play area at DPR 1 and DPR 2. High holds 60 at DPR 2. Ultra is capped or labelled honestly.
- **Dusk scrub:** no frame over 50 ms.
- **Load:** warm load under 8 s.
- **Console:** no errors or warnings, including the "uv" warning.
- **Options:** every option combination is clean, including `gate_south+pier_across`.
- **Realism:** pool, spa and canal water, sky horizon haze, paving joints, dusk and night all move visibly closer to the Cycles stills.

### Round 7 iteration log

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 1 | **Quality switch (P0).** First tried swapping in a new sun light on a resize: errors dropped from hundreds to 10–148 but didn't go away. Then fixed the shadow-map size: Medium now uses 4096 like High and Ultra, the map is never resized once it exists, and only the shadow box changes | reviewer's `shadowerr.mjs`: 216 / 422 errors → **0 / 0 / 0 / 0**; shadows survive every switch (`review/round7/qswitch_sheet.png`) | **Kept** (the light-swap attempt was reverted) |
| 2 | Mirrors are always built and only drawn when the quality wants them, so Low → High now gets reflections | mirrors after Low → High: 0 → 2 | **Kept** |
| 3 | UVs for textured meshes that had none (`ensure_uvs()` in `export_web.py`: world-metre box projection; the lawns are world-XY planar) | "uv not found" warning gone; the lawn shows its grass texture and normal map (`lawn_close.png`) | **Kept** |
| 4 | Small fixes: shallow-roller card (13 render, flies to 13), view 21 added, phones default to Low, the quality chip shows the selection on load, Ultra capped at 1.5× pixel ratio and labelled "Ultra (slow)", URL values validated and never remembered, phone help without E/Space, grass cells frustum-culled | all checked (`console.txt`, settings script, phone probe) | **Kept** |
| 5 | Water: deeper Mondo teal absorption, a sharper caustic net, a calmer spa; the canal gets long low swell in three directions with no sun glitter | canal reads as a calm mirror of the far bank instead of navy glitter (`water_AB.png`) | **Kept** |
| 6 | Sky horizon haze: desaturate and lighten the lowest band in the sky node (and so in the env map), plus distance fog from 25 m | pale hazy horizon close to Cycles; no fps cost (`haze_AB.png`, `haze2.png`) | **Kept** (first, gentler try kept as the base and strengthened) |
| 7 | Tile joints on the coping and pavers, an anti-aliased TSL grid in UV metres with per-tile tone | joints visible on the coping and the canal path (`joints_zoom2.png`). The concourse is aggregate in the model, so it has no joints there; Cycles shows it the same way | **Kept** |
| 8 | Dusk: a civil-twilight sky term (deep blue overhead, warm band towards the sun), windows glow 8× brighter, no stars in the water reflections | 19:40 is now a blue twilight with lit windows instead of black (`cmp/dusk1_vs_cycles.png`) | **Kept** |
| 9 | Bench LED area lights: export each rectangle's long axis (`xaxis` in lights.json) so they're oriented along their benches, and use 4× three's LTC intensity | the floor wash now runs along both benches, as in Cycles (`led_variants.png`, `cmp/dusk2_vs_cycles.png`) | **Kept** |
| 10 | Fire pit flames: orange, normal-blended, stretched 2× taller | no longer a white blob; still thinner than Cycles' flames (`flame_zoom3.png`) | **Kept**, partial |

**Final numbers** (GPU free, 1600×900):

| | Before | After |
|---|---|---|
| Medium, alfresco / lounge / pool edge / play area, DPR 1 | 60 fps | 60 fps |
| Medium, same four, DPR 2 | 60 fps | 60 fps |
| High, DPR 2 | 60 fps | 60 fps |
| Ultra, DPR 2 | 43–48 fps (reviewer: 30, 20 at the play area) | 38–48 fps, labelled "Ultra (slow)" |
| Dusk scrub, longest frame | 16.8–24 ms | 19–23 ms, none over 50 ms |
| Warm load, first frame / settled | 0.95 / 2.7 s (reviewer) | 1.0 / 2.8–2.9 s |
| Console during a full session (4 quality switches, times, cameras, bad URL values) | hundreds of errors plus the "uv" warning | **0** messages |
| Images | — | 165 checked, 0 missing |
| Walk test (steps, gates, jump, fence) | — | all pass |

**Option combinations:** all 24 pier × kitchen × north-fence combinations are clean. With `pier_across` and the continuous kitchen, the gate now hinges at z 4.30 (south end of the leg) instead of 3.25 (`review/round7/across_gate.png`). The reviewer's `options.mjs` lists that combination as "sk02/across|south/across", but that's only names: the south gate's meshes are named `fence_pool_east_sk02_across_a_gate0_1/_2` in the export, and only one gate is visible.

**Still behind Cycles, and why:**
- **Pool body:** ours is still brighter and more see-through than Cycles' Mondo blue at mid-day, and our caustics are a soft net rather than Cycles' sharp one. Our water is a screen-space approximation; Cycles traces real refraction and caustics.
- **Flames:** better, but still thin. A proper fire needs a particle or volume effect.
- **Timber:** the pier deck still reads purple-grey in shade (reviewer P2). The shade is too blue from the sky IBL; untouched this round.
- **Shadows:** a little softer and lower in contrast than Cycles.
- **Not done:** the reviewer's other P2s (perforated-fence opacity at grazing angles, spa screen tint, the fire bowl's contact shadow, seated eye height, immutable cache headers).

**Screenshots (`review/round7/`):**
- **Against Cycles:** `cmp/final_vs_cycles.png`, `cmp/dusk2_vs_cycles.png`
- **A/Bs:**
  - `water_AB.png`
  - `haze_AB.png`, `haze2.png`
  - `joints_zoom2.png`
  - `led_variants.png`
  - `flame_zoom3.png`
  - `lawn_close.png`
  - `qswitch_sheet.png`
  - `across_gate.png`
- **Pages:** `pages/`
- **Logs:**
  - `shadowerr_before.txt` / `shadowerr_after.txt`
  - `perf_dpr_base.txt` / `perf_dpr_final.txt`
  - `scrub.txt`
  - `load.txt`
  - `console.txt`
  - `options.txt`
  - `walk-test.txt`
  - `image-check.txt`
  - `pages-check.txt`

## Round 8

**Goal:** work through the reviewer's r5 realism list (`review/r5/review.md`) in their ranked order, using the same loop: measure → one change → re-measure → compare against the Cycles stills → keep or revert.

**Targets**
- **Frame rate:** Medium and High hold 60 fps at DPR 1 and DPR 2.
- **Dusk scrub:** no frame over 50 ms.
- **Console:** stays clean.
- **Load:** warm load under 8 s.
- **Realism, in ranked order:**
  1. night: solid flames, no shadows on glass, calmer bench LEDs, fire light below the rim
  2. pool water opaque and reflective
  3. timber albedo
  4. haze limited to the horizon band
  5. canal reflecting the far bank
  6. darker paver joints
  7. the first-frame stall, dusk windows and GLB caching

### Round 8 iteration log

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 1 | Glass stops receiving shadows | Shadow-acne stripes on the balustrade glass → clean glass | Kept |
| 2 | Opaque flames (no transparency), tapered and 1.15× taller, core→body→tip gradient | Dithered, see-through stripes under TRAA → solid orange-yellow flame with a hot core (`cmp/night*`, `flame_zoom*.png`) | Kept |
| 3 | Bench LEDs ×2 area normalisation and warm colour (1.0, 0.66, 0.36) | White strip glare → warm, softer strip | Kept |
| 4 | Fire light 12 cm lower and warmer | Lit the people's faces from above the rim → glow from inside the bowl | Kept |
| 5 | Fire light no longer casts a 512 cube shadow | Square bright patch on the lounge floor → clean floor | Kept |
| 6 | Pool: water-body veil (deep teal, rises with depth), paler absorption | Floor seen as if through clear glass → body colour hides part of the shell (`bis_vm.png`) | Kept |
| 7 | Caustics only on up-facing surfaces | Caustic net on the pool walls → floor only | Kept, after a regression: `normalWorld` in the colorNode broke the sun's shadow pass for those materials and darkened the whole scene. A vertex-stage normal fixed it |
| 8 | Flames hidden by day | Black cones in the bowl at noon → no flames by day | Kept |
| 9 | Timber grade (`TIMBER` map in model.ts, `?timber0=1` for before): composite and lounge steps ×0.4 and desaturated, bench slats ×0.56, pavilion hardwood with a 0.8 roughness floor, table set toward honey | Orange-tan steps, blue-lilac pavilion deck (a sky sheen over a near-black red texture) → dark brown steps, dark red-brown deck, as Cycles shows them (`timber_AB.png`, `timber_deck.png`) | Kept |
| 10 | Haze band `pow(1−y, 6)` instead of 2.5 (`?hazepow=2.5` for before) | Haze up to ~30° → blue above ~20° (`haze_AB.png`) | Kept: a small gain. Our sky is still a deeper, greyer blue than the Cycles sky |
| 11 | No fog in mirror passes (`inMirror` uniform, `?mirrorfog=1` for before) | No visible difference: the grey wasn't fog | Kept (harmless, and correct) |
| 12 | Canal reflection: ripple distortion 0.35 → 0.15, reflected light ×0.8 (`?wobble=`, `?creflect=`) | Cloud-white blotches → calm water where the far-bank trees read (`canal_AB.png`) | Kept |
| 13 | Joints: 0.35× the stone's own colour (pulled 20% toward the grout), full strength, a minimum coverage of 0.55, ~20% wider (`?jointsold=1` for before) | Faint grey lines → clear recessed joints on the coping and pavers (`joints_zoom.png`) | Kept |
| 14 | The loading cover stays up until the full post chain is committed | 467 ms freeze in the first second you can move → hidden behind the cover. The cover lifts at 1.6 s warm (was 0.95 s), interactive is unchanged at 2.6 s | Kept |
| 15 | Dusk windows: emissive 0.018 → 0.28 | Windows nearly black at dusk → warm lit windows | Kept. The lit alfresco ceiling wasn't done |
| 16 | Model files get `?v=<content hash>` from vite.config.ts. `public/_headers` gives `/model/assets/*` a one-year immutable cache and `/model/web/*` one week | Revalidated every visit → served from the browser cache on repeat visits. Cloudflare Workers static assets honour `_headers` | Kept |

**Final numbers (local build, headless on Apple Metal):**

| | Round 7 | Round 8 |
|---|---|---|
| Medium, DPR 1 and 2 (alfresco, lounge, pool edge, play) | 60 fps | 60 fps everywhere |
| High, DPR 1 and 2 | 60 fps | 60 fps everywhere |
| Ultra, DPR 2 | 38–48 fps | 44–50 fps (labelled "Ultra (slow)") |
| Dusk scrub, 17:00↔21:00 ×6 | max 25 ms | max 23 ms, 0 frames over 50 ms |
| Warm load: cover lifts / interactive | 0.95 s / 2.6 s, with a 467 ms freeze after the cover | 1.6 s / 2.6 s, no freeze after the cover |
| Cold load: cover lifts / interactive | 1.4 s / 3.1 s | 2.1 s / 3.1 s |
| Console (quality changes, dawn to night, camera jumps) | clean | clean |

**Other checks:**
- **Walk test:** gates, jump and the fence all pass.
- **Images:** 165 checked, 0 missing.
- **Settings:** they survive a reload. I fixed the test script: "Ultra (slow)" also matched "Low".
- **Page checks:** only the walk page loads three.js and the GLB. I fixed the GLB detection in the script for the `?v=` query.

**Still short of Cycles:**
- **Pool caustics:** Cycles has a sharp caustic net on a paler floor.
- **Dusk pool:** ours is a brighter blue than Cycles' dark pool.
- **Night lounge light:** a touch cooler and whiter than Cycles.
- **Daytime sky:** a deeper, greyer blue than Cycles' pale sky.

## Summary

**Round 8:** the reviewer's realism list is done:
- solid flames
- glass without shadows
- calmer warm bench LEDs
- an opaque pool body
- graded timber
- a tighter haze band
- a calm canal that reflects the far bank
- clear paver joints
- no freeze after the loading cover
- brighter dusk windows
- cached model files

Medium and High still hold 60 fps at DPR 1 and 2, and the dusk scrub stays under 25 ms.

**Round 7:**
- **Fixes:** changing quality now keeps shadows with zero errors, the lawn and benchtops have UVs, phones start on Low, and Ultra is capped and labelled "Ultra (slow)".
- **Looks:** the water, sky haze, tile joints, dusk, bench lighting and flames are all closer to Cycles.
- **Performance:** Medium and High hold 60 fps at DPR 1 and 2, the console is clean, and every option combination works.

**Round 6:**
- **Dusk hitch fixed:** scrubbing through dusk never takes more than 24 ms a frame (it was 1.7 to 22 s).
- **Sun shadows** work again in the yard.
- **Medium, High and Low** all hold 60 fps with about half the draw calls and triangles.
- **New options** for the roller, pier, north fence and side passage, on both pages.
- **Settings** are remembered between visits (Medium with the fps counter by default).
- **Load** is 1.1 to 2.1 s to first frame here.

**Round 4:**
- `/model/` is a chooser between the renders (no three.js) and Live 3D.
- The 3D panel holds only 3D controls and design-choice cards that change the world and move the camera, including a glass fence.
- Gates open with E, close themselves and block you when shut.
- Space hops 0.45 m but can't clear the pool fence.
- First frame: cold 2.7 → 1.3 s, warm 2.2 → 0.75 s, with honest progress text.

**Round 3:** the far trees look leafy, there's a one-time how-to-walk card, the phone layout fits in two rows, and the sky and distance are softened. Everything checks out at 60 fps.

**Round 2:** people start on, the lawn has real-looking turf up close (texture-only on Low and Medium), the pool reflects calmly with no stripes, the canal brick lights no longer glare, the roller copy is updated, and the synced renders all load (112/112). The fresh contact sheets are in `review/round2/`.

**Round 1:**

- **Viewer:** `/model/` is now a WebGPU walkthrough that starts in first person on the alfresco. It has the real sun and sky for any date and time, soft shadows, AO, TRAA and bloom, refractive water that reflects its surroundings, with caustics in the pool, and a lighting scheme that comes on at dusk. Collisions and steps work.
- **Old page:** its renders and notes are in the side panel, and each render can fly you to that view.
- **Export:** carries every option, the light fittings, real plants and `lights.json` in 14.65 MB.
- **Main compromises:** my own planar mirror instead of `ReflectorNode`, SSGI held to AO plus a little daytime bounce, and window glow in place of interior lights.

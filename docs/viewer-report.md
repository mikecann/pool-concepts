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

## Round 9

**Goal:** close the biggest gap left, the pool (and the spa), against the Cycles materials in the-pool's `mats.py`. Then, if there's time, the day sky and the night lounge light. Same loop: measure, make one change, compare with Cycles at 05, 13 and 14 by day and at dusk/night (`node scripts/compare.mjs --set pool`), then keep or revert.

**Targets:**
- Medium and High hold 60 fps at DPR 1 and 2.
- The dusk scrub never has a frame over 50 ms.
- The console stays clean.

**What Cycles actually does (mats.py, read only):**
- **Water:** a clear surface (IOR 1.333, roughness 0.015) over a volume with absorption density 0.32 in #6FCFD6. That's about (0.27, 0.12, 0.105) per metre, with no scattering and no body colour.
- **Shell:** #99AFC9, roughness 0.18. That's already what our GLB has.
- **Caustics:** shadow rays pass through the surface tinted by a warped Voronoi distance-to-edge at scale 4.2, so the floor gets 1.0 of the sun on the lines and 0.75 in the cells.

**Why ours read so differently:** the material wasn't the problem, the lighting was.
- **Specular:** our shell kept its open-air specular (F0 0.04 at roughness 0.2), so under water it mirrored the bright sky, and that sheen is what made the walls pale.
- **Lighting:** every surface was lit as if no water sat above it, where walls under water only catch light at a grazing angle.
- **Water:** on top of that, the water added a teal "veil" body colour, a scatter term and a constant night ambient term.
- **Night:** the pool light wasn't absorbed by the water, so it lit the basin grey-white rather than teal.

### Round 9 iteration log

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 1 | Underwater lighting on the shell: walls 0.3× (light only reaches them at a grazing angle through the surface), with Cycles' absorption on the way down by depth. `?uw0=1` turns it off | Cyan glass box → slate-blue basin | Kept |
| 2 | Pool water as Cycles has it: absorption (0.27, 0.12, 0.105), no veil body colour, near-zero scatter, absorption only along the view ray (the way down is in #1). `?water8=1` for Round 8 | Blue veil over everything → clear water over a pale floor | Kept |
| 3 | Caustic net built Cycles' way: warped Worley distance-to-edge at scale 4.2, 1.15 on the lines and 0.75 in the cells, drifting slowly. `?net0=1` for Round 8's | Soft blobs → the same crisp net as Cycles | Kept |
| 4 | Underwater mask widened 15 cm past the water's box | No visible change: the walls stand on the box edge, but this wasn't why they stayed pale | Kept (needed for #5) |
| 5 | Specular under water cut to 10% (the shell's `setupSpecular` scaled by the underwater mask). Diagnosed by zeroing the shell's environment light, which turned the walls navy | Pale sky-mirroring walls → dark navy walls and steps, like Cycles | Kept: the biggest single gain |
| 6 | Day sky mixed toward a pale blue (`?skypale=`, `?skylift=`) | The tone mapper turned it into a grey, overcast sky, not Cycles' pale blue | Reverted (default 0) |
| 7 | Spa water the same as #2: 0.4 × (1 − #7FD3DA) = (0.315, 0.14, 0.12) | Close already (the spa is in shade); now slightly bluer | Kept |
| 8 | No night ambient term in the pool and spa water | Removed the constant glow | Kept |
| 9 | Pool and spa lights coloured by the water they shine through (pool 13.5 m, spa 3.6 m of absorption), ×3 brightness to compensate. `?wet0=1`, `?wetpath=`, `?wetgain=` | Grey-white pool at night → teal-blue | Kept |
| 10 | The basin's bounce glow: an emissive on underwater surfaces = albedo × the pool light colour after 7 m of water × 0.1 × the light's own night level. It's 0 by day, in the existing scenario, or whenever that light is hidden. `?glow=` | Only the lamp's corner lit, the rest grey → the whole basin glows teal at dusk, as in Cycles | Kept at 0.1 (0.12 was brighter than Cycles at the deep end) |
| 11 | Lounge at night: bench strips (1.0, 0.56, 0.26) and fire light (1.0, 0.46, 0.15), both 0.7× (`?warm0=1` for Round 8, `?lounge=` for the brightness) | Floor burned to white → a little warmer and less white | Kept (a small gain; Cycles is still more amber) |

**Numbers (headless, Apple Metal):**

| | Round 8 | Round 9 |
|---|---|---|
| Medium, DPR 1 and 2 (alfresco, lounge, pool edge, play) | 60 fps | 60 fps everywhere |
| High, DPR 1 and 2 | 60 fps | 60 fps everywhere |
| Dusk scrub, 17:00↔21:00 ×6 | max 23 ms, 0 over 50 ms | max 20 ms, 0 over 50 ms |
| Console (qualities, dawn to night, pool cameras, both scenarios) | clean | clean |

The settings test and walk test pass.

**Screenshots (`review/round9/`):**
- `pool_before_after_cycles.jpg`: Round 8 | Round 9 | Cycles, for 05, 13 and 14 by day, 13, 14 and 17 at dusk, and the lounge at 21:00
- `cmp/*_vs_cycles.png`: each iteration
- `cmp/refl_diag.png`, `diag/diag.png`: the reflection and specular diagnostics
- `cmp/glow_AB.png`, `cmp/wet_AB.png`, `cmp/warm_AB.png`: the night A/Bs

**Still short of Cycles:**
- **Far half of the pool by day:** Cycles' looks lighter and glassier. It's the Fresnel reflection of Cycles' pale sky, while ours reflects a deep-blue zenith. It's tied to the day sky, which I couldn't brighten without it going grey.
- **Night lounge:** less amber than Cycles.
- **Flames:** look paler in the dusk views than Cycles' orange.

## Round 10

**Goal:**
- The day sky: match Cycles' pale blue as displayed, not just its radiance, and keep the sky's light on the scene sensible.
- Then, if there's time: the dusk horizon glow, the flames and the spa.

**Rules and targets:**
- **Loop:** measure, make one change, compare against the Cycles stills, then keep or revert.
- **Frame rate:** Medium and High hold 60 fps at DPR 1 and 2.
- **Dusk scrub:** never over 50 ms.
- **Console:** stays clean.

**Cycles world (build.py / build_time.py, read only):**
- **Sky:** Nishita multiple scattering at strength 0.12–0.18.
- **Sun:** 6.5 × min(1, 3 sin el).
- **Tone mapping:** AgX with the 'Medium High Contrast' look.

**Measuring:** two new scripts.
- `scripts/sky-sample.mjs` takes the median sky pixel at set heights.
- `scripts/patch-sample.mjs` takes the mean of named rectangles.

Both compare our frame with the Cycles still from the same camera.

**What the measurements showed:**
- **Sky:** our displayed zenith was ~(100, 130, 160) against Cycles' (202, 217, 233).
- **The rest of the scene:** our soffit, sunlit coping, shaded bench and shaded wall were all darker and less blue than Cycles'.

So our sky was too dim as light, not only as a backdrop, and raising its radiance is the physically right fix.

### Round 10 iteration log

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 1 | Day sky radiance ×2–5 (sky dome and environment light together) | Sky top at 05: 99,129,158 → 176,199,219 at ×5 (Cycles 202,217,233); shade and sunlit patches move toward Cycles together; but the picture goes flat | Kept at ×4 with #2 |
| 2 | Blender's 'AgX - Medium High Contrast' look: contrast 1.2 in log space around mid grey, i.e. 0.18·(x·e/0.18)^1.2 / e before AgX (`?look=1` for plain AgX) | With ×4: sky top 175,202,226; soffit 186,201,213 (Cycles 183,195,205); sunlit coping 131,146,162 (Cycles 130,148,163). No longer flat | Kept |
| 3 | The ×4 fades out as the sun goes down (full above 12°, none at the horizon) (`?skyx=1` for Round 9) | Dusk and night keep their level; 07:30 shade turns blue like Cycles | Kept |
| 4 | Underwater wall factor 0.3 → 0.15 | The brighter sky lifted the pool and spa walls; back toward navy | Kept (small) |
| 5 | No clouds in the sky (Cycles has none; `?clouds=1` keeps them) and canal reflection 0.8 → 0.6 | Canal a little less white; the pale smears turned out to be the far trees' reflection, not clouds | Kept (small) |
| 6 | Dusk: Preetham's forward (Mie) scattering fades to 30% once the sun is down; dusk fog colour 0.55 → 0.2 | Glowing halo where the sun set → gone, leaving a band | Kept |
| 7 | Dusk: the environment light at 0.4 between 3° and −11° | Far bank's white houses and the house walls lit like late afternoon at 19:40 → darker, closer to Cycles' silhouettes | Kept |
| 8 | Flames dimmer (0.4 / 0.2) | Dimmer turned them brown, not orange | Reverted |
| 9 | Flames: the exported geometry without the Round 8 taper, white-yellow → orange gradient | The flame mesh is crossed flat cards (Cycles cuts tongue shapes out of them), so opaque they looked like paper; the new gradient went grey-blue at the base | Reverted (flames are exactly Round 9) |

**Numbers (headless, Apple Metal):**

| | Round 9 | Round 10 |
|---|---|---|
| Medium, DPR 1 and 2 (alfresco, lounge, pool edge, play) | 60 fps | 60 fps everywhere |
| High, DPR 1 and 2 | 60 fps | 60 fps everywhere |
| Dusk scrub, 17:00↔21:00 ×6 | max 20 ms | max 22 ms, 0 over 50 ms |
| Console (qualities, dawn to night, pool cameras, both scenarios) | clean | clean |

**Other checks:**
- The page checks pass: only the walk page loads three.js and the GLB, every card moves the camera, and the phone gate button works.
- The settings and walk tests pass.
- 165 images checked, 0 missing.

**Screenshots (`review/round10/`):**
- `round10_before_after_cycles.jpg`: Round 9 (rendered with every Round 10 change switched off by its flag) | Round 10 | Cycles. Covers 05, 13 and 14 by day, the lounge at 07:30 and 18:30, 13, 14 and 17 at 19:40, and the lounge at 21:00.
- `cmp/`: every step. The ones worth a look:
  - `skyx_AB.png`
  - `L4_sheet.png`
  - `times_sheet.png`
  - `dusk_sheet.png`
  - `duskenv_sheet.png`
  - `flame_sheet*.png`
- `pages/`: the page-check screenshots

**Still short of Cycles:**
- **Flames:** they need tongue-shaped cut-outs on their cards (an alpha-tested procedural mask, so TRAA doesn't dither them) to look like Cycles' separate orange tongues.
- **Spa by day:** a little lighter than Cycles. Its interior is in shade in both, and the white rim band is the same geometry; Cycles' water just reads darker.
- **Canal:** the far trees reflect as pale smears rather than dark streaks.
- **Dusk sky:** our upper sky at 19:40 is a little browner than Cycles' blue-purple.
- **19:40 overview and deep end:** a touch darker than Cycles, since the dimmed environment light also pulls down roofs and the basin.

## Round 11

**Goal:** the reviewer's top 8 from `review/r6/review.md`, in their order, plus loading in hidden pages. Same loop and targets as before. The comparison set is `node scripts/compare.mjs --set r11`.

### Round 11 iteration log

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 1 | Canal: the reviewer's murky tint (0.55, 0.65, 0.72) and distance haze from 60 m instead of 25 m (`?fog25=1` for before) | No measurable change: the canal stayed (212, 220, 225) against Cycles' (167, 183, 195) | Kept the haze. The tint turned out not to be applied, see #2 |
| 2 | **Root cause:** a red-canal debug test showed the canal shader output was reaching the screen, yet changing the mirror term did nothing. The water had no `envMap` of its own, so three ignored the per-frame `envMapIntensity` fade and used the scene's environment intensity. The water reflected the sky twice, once from the environment map and once from the mirror. Fix: the water gets `envMap = scene.environment` (`?doubleenv=1` for before) | Milky near-white canal → the far bank's trees reflect dark and crisp. The pool gets slightly deeper too, and still matches Cycles | Kept: the biggest gain this round |
| 3 | Canal retuned for #2: tint (0.9, 0.97, 1.0) on a 35%-desaturated reflection, plus a lit grey-green body (`?murk=`, `?canaltint0=1`) | Canal band (138→146, 155, 158) against Cycles (167, 183, 195); a little darker than Cycles but no longer white | Kept |
| 4 | Canal reflection smeared along the view: anisotropic ripple offset (0.3× across, 3× along) and a 5-tap vertical blur (`?streak0=1`, `?streaklen=`) | Lit windows and wall lights now reflect as vertical streaks at night; day tree reflections slightly softer | Kept |
| 5 | Camera 01 (from a boat on the canal) is now placed in drone mode. In walk mode it fell to the canal bed and showed the underside of the model | The night canal view works | Kept (a bug fix) |
| 6 | Flames: the mesh had no UVs, so UVs are generated per card, and each card gets an alpha-tested tongue mask with a noise edge that licks upward. The Round 8 taper is gone, and the colour runs from a hot core to orange edges. The flames are excluded from SSGI AO, which made the stipple, via a material MRT that's only used in MRT passes (otherwise Low threw a WGSL error). `?flame10=1` for before; `?flamegain=` sets brightness | Pleated paper cone → separate tongues, no stipple. Still paler and more yellow-white than Cycles' orange at the 21:00 exposure | Kept |
| 7 | Sky visibility (`src/skyvis.ts`): a 0.35 m height map of the lot, ray-cast against the walk collider. A horizon search in 16 directions bakes the share of sky each cell sees, and surfaces under a roof count as covered (0.3). Only the environment light is scaled; the sun and its shadows are untouched. The bake takes ~170 ms in chunks after the far trees load (`?skyvis0=1` for before) | Shaded passage wall 77 → 49 (Cycles 50); the play area and side passage read enclosed; the pavilion deck loses its violet cast | Kept |
| 8 | Phone landscape: the phone layout now also applies at `max-height: 500px`, and in landscape the drawer stops below the HUD rows | 844×390: Walk/Drone/Go to/Options all present, the panel starts closed, no overflow (`review/round11/phone/`) | Kept |
| 9 | Bark: procedural chips (world-space cells about 2.5 cm, colours between Cycles' #3E2B1E and #9C7552, plus 30 cm patches) (`?bark0=1` for before) | Flat brown matting → chips. The first try at 3.5 cm was too coarse and contrasty | Kept |
| 10 | Alfresco ceiling at dusk and night: an emissive pool of light round each downlight plus a faint wash, warm-tinted, × night (`?ceil=`) | Dark grey → a warm lit soffit. 0.5 was flat white; kept at 0.2 | Kept |
| 11 | Coping and aggregate normal maps at 0.25. The blue "stars" were each grain's normal-map facet reflecting the night sky. The stars were never in the environment map, and the pool light wasn't the cause either (tested with it off) (`?glitter=1` for before) | Glitter gone | Kept |
| 12 | Spa light wet gain ×2 (`?spagain=`) | No visible change in 14 at dusk: the bright cyan in Cycles' frame is the pool; the spa is dark in both | Kept (harmless) |
| 13 | Roller cards cut from the 17_pool_overview roller renders, cropped to the end that changes (`crop` in `src/choices.ts`, applied by `scripts/make-cards.mjs`) | Five near-identical thumbnails → none / shallow / deep / pit / low-profile tell apart at a glance (`review/round11/roller_cards.png`) | Kept |
| 14 | Loading in hidden pages: CPU steps yield through a MessageChannel while `document.hidden`. While visible they wait a frame, falling back to a 100 ms timeout so a throttled rAF can't stall them. Added a `painted` mark | Simulated hidden load (`scripts/hidden-load.mjs`): compiled at 1.4 s while hidden, first frame 47 ms after being shown. Before, it stalled at `glb` until shown | Kept |

**Your Electron 'model' step (3.1 s):** in headless Chromium `glb` → `model` is 35–40 ms (`painted` → `model` is about 35 ms of real work). So that gap was the requestAnimationFrame wait: rAF was throttled or paused in that pane, which #14 fixes. Not reproduced in Electron itself (headless only).

**Not done:**
- **Passage pavers warm cream (item 5b):** ran out of time.
- **Night canal window reflections:** still weaker than Cycles' (we get the wall lights, not the house windows).
- **Doubled jetty reflection:** not investigated.

**Numbers (headless, Apple Metal):**

| | Round 10 | Round 11 |
|---|---|---|
| Medium, DPR 1 and 2 (alfresco, lounge, pool edge, play) | 60 fps | 60 fps everywhere |
| High, DPR 1 and 2 | 60 fps | 60 fps everywhere |
| Dusk scrub, 17:00↔21:00 ×6 | max 22 ms | max 21 ms, 0 over 50 ms |
| Warm load: cover lifts / settled | 1.57 s / 2.5 s | 1.63 s / 2.8 s (the sky bake adds ~0.2 s after the cover) |
| Console (qualities incl. Low at night, dawn to night, 7 cameras, both scenarios) | clean | clean |

**Other checks:**
- Page checks pass.
- Settings and walk tests pass.
- 165 images, 0 missing.
- Phone portrait and landscape: no overflow, no errors.

**Screenshots (`review/round11/`):**
- `round11_before_after_cycles.jpg`: Round 10 | Round 11 | Cycles across 9 views. The before for 01 is the old underground camera.
- `cmp/`: every step. The ones worth a look:
  - `env_sheet.png`
  - `streak2.png`
  - `skyvis_sheet.png`
  - `bark_sheet.png`
  - `ceil_sheet2.png`
  - `flame11*.png`
  - `glitter*.png`
- `phone/`, `roller_cards.png`, `pages/`

## Round 12

**Goal:** sweep every camera (20 in cameras.json, 01–21 with no 11), Today and Proposed, at the Cycles render time. The stills are 16 Jan 14:45 (build.py and render.py), not 13:00. Rank the biggest differences across all 40 pairs, fix them in order, and make every camera land correctly.

**Sweep tool:** `node scripts/sweep.mjs --label X` (walk | Cycles sheet, plus where each camera really landed against Cycles).
- Before: `review/round12/sweep_before.jpg`
- After: `review/round12/sweep_after.jpg` (walk before | walk after | Cycles)

**Ranked from the before sweep:**
1. The old pavers: tan-brown with dark joints against Cycles' cream (in every Today view, and the promenade, terrace and passage in Proposed).
2. The lawn: pale grey-olive against rich green.
3. Camera placement: 06 +0.98 m, 13 Today −1.25 m, 01 +0.78 m, 10 +0.75 m, 20 Today −0.59 m.
4. The canal: pale grey-blue from above against deep navy.
5. The house sliders: dark panels against a lit room.
6. Smaller: the pavilion deck violet, and the flames white-yellow.

### Round 12 iteration log

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 1 | export_web.py's bake desaturated about each pixel's minimum; Blender's Hue/Saturation keeps the maximum (desaturating lightens). Fixed, then re-exported with export.sh (.blend not saved). `scripts/web/inspect_mats.py` (new, read-only) confirmed the .blend's nodes match mats.py | Paver albedo a little lighter (sunlit 143→156) | Kept (correct, small) |
| 2 | **Root cause of the pavers:** setupWater's caustics pass rebuilt the colour node from `materialColor` for any mesh whose box overlaps the pool. `paving_upper` (and the Today lawn) were caught, so their grade and joints were replaced. Now it chains on the existing node | The paver grade and joints actually apply | Kept |
| 3 | Pavers graded like the timber (`TIMBER.pavers_existing`: sat 0.5, ×1.9) | Sunlit pavers (156,138,118) → (177,169,162), Cycles (185,177,169) | Kept |
| 4 | The caustics/underwater pass skips Today-only meshes (`set: existing`): the pool isn't there yet | Pale, caustic-netted squares on Today's lawn and pavers over the future pool's footprint → gone | Kept |
| 5 | Lawn and context grass: roughness ≥ 0.95 (the 4× sky was sheening over it at grazing angles) and a grade (0.51, 0.54, 0.22) (`?lawn11=1` for before) | 15 Today (133,135,85) → (99,108,60), Cycles (98,107,43); 03 (151,158,142) → (108,121,91), Cycles (95,105,62) | Kept |
| 6 | Walker view height: "go to" puts the eye at the render camera's height (seated, or over Today's lower ground), easing back to standing height once you walk | Every walk camera within 0.06 m of Cycles | Kept |
| 7 | Drone may look slightly above level (max polar 0.52π instead of 0.49π) | Camera 01 was lifted 0.78 m to avoid looking up → exact | Kept |
| 8 | Canal body colour much darker, toward Cycles' dense #17463F (`?murkcol=`) | Aerials, 14 and 15 show deep blue water like Cycles instead of pale grey-blue | Kept |
| 9 | House sliders: glass opacity 0.82 → 0.4, and interior walls and floor glow with the daylight that would bounce into the room (warm, 0.6 at night) (`?rooms0=1` for before) | Black panels → a lit cream room behind the glass at 16 by day and at dusk | Kept. 18's slider is still dark (its room doesn't show through) |
| 10 | Pavilion deck grade: less red (sat 0.55, ×(0.92, 0.9, 0.72)) | Violet in shade → dark blue-grey like Cycles at 12 | Kept |
| 11 | Flames: more saturated gradient | White-yellow → orange with a light core | Kept |

**Not done:**
- **Night canal:** the house windows are still too faint in the reflection (Cycles' streaks are much brighter).
- **Doubled jetty:** not investigated.
- **18 slider room:** still dark.
- **Paver joints:** still finer and lighter than Cycles'.

**Checks:**
- **Start view:** stands at the alfresco (feet 2.37, eye 4.02).
- **'Go to':** all 20 entries load, with no camera underground or inside geometry. Only 10 has a fence rail 0.5 m overhead, the same as the Cycles camera.
- **Frame rate:** Medium and High hold 60 fps at DPR 1 and 2 on all four views.
- **Dusk scrub:** max 19 ms, 0 frames over 50 ms.
- **Console:** clean, across qualities including Low at night, dawn to night, both scenarios and the camera jumps.
- **Pages, settings, walk test, images and phone:** pages, settings and the walk test pass, 165 images with 0 missing, and phone portrait and landscape are fine.

**Model:** the GLB is re-exported. To deploy, copy public/model/web from the-pool, which I've already done here. The `?v=` hash changes on build.

## Round 13

**Goal:** the reviewer's r7 regressions first (`review/r7/review.md`), then the Low and night items. Plus a regression test for the shadow bug class.

**New test:** `node scripts/switch-test.mjs` starts from a Today load, switches the scenario both ways and the quality both ways (Low ↔ High, Low → Medium), by day and by night. It fails on any WebGPU error or console error. It also fails if the sun's shadows are missing, measured as the share of dark pixels at camera 13 at 14:45 against a fresh load of the same scenario.

| # | Change | Before → after | Verdict |
|---|---|---|---|
| 1 | **Root cause of Today → Proposed:** three's `AnalyticLightNode.setup` disposes a light's shared shadow node when a material is set up while the light set differs. Proposed-only lights (including the two shadow-casting downlights) were hidden in Today, so pressing Proposed changed the light set, every material recompiled, and the shadow map still bound elsewhere was destroyed. Now no light's visibility ever depends on the scenario or options; those only set its intensity to 0. The light set and the shadow maps are fixed from load, like the dusk fix in Round 6 (`?lightswap=1` for before) | switch-test: 24–284 'Destroyed ShadowDepthTexture' errors per switch → 0 | Kept |
| 2 | **Found by the new test:** a quality switch built the full post chain (`post.upgrade()`) but never committed it, ever since the quality chips existed. Every frame drew the full chain, then the boot chain over it: no SSGI AO or TRAA, and twice the render cost. Now it commits after 20 frames, as loading does. Rebuilds (quality, scenario, options) also keep the sun's shadow map refreshing for 60 frames | Dark share after a switch 24% → 30.9% (a fresh High load is 30.4%) | Kept |
| 3 | Drone → Walk lands at the drone's look point only if you can stand there (ground ≥ 1.0 m, not water). Otherwise it goes back to where you last stood, or the start spot (`Walker.walkableAt`, `lastStood`) | After 'go to' 06 or 14: feet y −20 (in the void) → (0.6, 2.18, 6.0) and (3.45, 2.21, 7.9) | Kept |
| 4 | The sky-visibility bake re-runs on every scenario switch (coalesced while one is running) | Alfresco floor at 16 after Today → Proposed: 87.8 luma, the same as a fresh Proposed load | Kept |
| 5 | Bench strip lights ×0.55 on Low (`?benchlow=`) | The white flare on the lounge floor at night on Low → gone (`review/round13/low_bench.png`) | Kept |
| 6 | Low: far trees on (`far: true`). Without a planar mirror the canal reflects the sky env at 0.45 (`?canalenv=`) | White canal and bare far bank → blue canal with the tree line (`low_canal.png`). Low holds 60 fps at DPR 1 and 2 | Kept |
| 7 | Far tree line: canopies 1.3×, albedo 0.75×, plus a second, offset ring of instanced canopies (one more draw call per batch) (`?farring=0`, `?farscale=1`, `?fardark=1` for before) | Scattered trees → a continuous dense band (`far_trees.png`). Still a little hazier than Cycles at that distance | Kept |
| 8 | Flame brightness 0.65 → 0.32 (orange edges keep their saturation); alfresco ceiling glow 0.2 → 0.35 | Flames a touch more orange. Cycles' own flames are white-hot with orange edges, which ours now resemble. Soffit visibly lit at dusk (`flames_ceiling.png`, `flames_gain.png`) | Kept |

**Numbers:**
- **Frame rate:** Low, Medium and High hold 60 fps at DPR 1 and 2 on all four views.
- **Dusk scrub:** max 20 ms, 0 frames over 50 ms.
- **Load:** warm, the cover lifts at 1.63 s and it's interactive at 2.55 s.
- **switch-test:** PASS.
- **Console:** clean.
- **Other checks:** the page checks, settings, walk test, images (165, 0 missing) and phone portrait and landscape all pass.

**Screenshots (`review/round13/`):**
- `switch_before/`, `switch_after/`, `switch_final/`
- `q_check.png`, `iso.png`: the quality-switch AO loss
- `low_bench.png`, `low_canal.png`, `far_trees.png`, `flames_ceiling.png`, `flames_gain.png`
- `pages/`, `phone/`

## Round 14

| # | Change | Result | Verdict |
|---|---|---|---|
| 1 | Moonlight: after dusk the sun light (no new light, so the light set stays fixed) becomes a dim, cool moon (0.1, from high in the north-east) with soft moon shadows; the shadow camera follows `atm.lightDir` (`?moon=0` for none) | Today at 21:00 reads as a dim moonlit yard instead of black; Proposed is barely changed, as its own lights carry it (`review/round14/moon_AB.jpg`: moon 0 / 0.06 / 0.12, plus the Cycles 21:00 still) | Kept |
| 2 | A one-line note under the time bar in Today after dusk: "Today's yard has no garden lighting." | Shows on desktop and phone (`review/round14/phone/portrait.png`) | Kept |
| 3 | Drone → Walk landing (`landingAt` in main.ts): inside the lot (x −9.2…16.8, z −33.2…10.9, floor ≥ 1.5 m) and on a floor material (paving, deck, lawn, steps, bark, sand…) as the first visible surface down. Anything else falls back to where you last stood, or the start spot | Start → back at the start spot (was the canal path). 21 → the passage floor at 2.38 (not the climbing frame). The aerials and 01 → the last spot stood | Kept |
| 4 | Low canal sky reflection 0.45 → 0.35 | Low canal (172,184,192) → about Medium's (156,166,172) | Kept |

**Checks:**
- **switch-test:** PASS.
- **Frame rate:** Low, Medium and High hold 60 fps at DPR 1 and 2.
- **Dusk scrub:** max 21 ms.
- **Other checks:** the walk test, settings, images (165, 0 missing), page checks and phone layouts all pass.

## Round 15

**Scope:** Mike's requests, viewer only. The-pool was untouched and not synced; a model agent is working in parallel.

| # | Change | Result |
|---|---|---|
| 1 | **Sidebar in categories:** Pool / Alfresco / Fences / Side passage / Under the spa. A two-column grid of category buttons, each showing its current choice(s), and only the open category's cards below. Arrow keys move between them; the open one is remembered (`pool-cat`). In the phone drawer the grid sits at the top | The whole design reads at a glance; much less scrolling. Walk page loads 6 card images instead of 15 (`review/round15/sidebar.png`) |
| 2 | **Tape measure** (`src/measure.ts`; the ↔ Measure button or `M`): click or tap two points. Raycast with snapping to the face's corner (≤ 6 cm) or edge (≤ 3.5 cm). A yellow line and end dots drawn over everything (overlay layer, not reflected), with a label of 3D, horizontal (↔) and vertical (↕) distances. Several at once; Clear or `Esc` removes them, Done or `M` puts the tape away. With the mouse locked it measures at the crosshair | Works in walk, fly and drone, and by touch (`review/round15/tools/measure_*.png`) |
| 3 | **Fly mode** (Walk / Fly / Drone): a 0.3 m sphere against the collider, sliding in 3D, no gravity, sub-stepped so it can't tunnel. WASD and mouse look, `Space`/`E` up, `C`/`Q` down, `Shift` fast; touch gets ▲/▼ buttons. E only opens gates in walk mode, so no clash. All six mode switches are safe: fly starts where you are and where you look; fly → walk lands below you if that's a floor in the lot, otherwise where you last stood | `review/round15/tools/fly.png` |
| 4 | **Into the pool:** walls collide, and the floor, bench and steps are walkable. You wade at 0.45× speed, and falls sink gently. `C`/`Q` ducks your head under; `Space` at the wall climbs out onto the coping (0.3–1.9 m up); the steps work too. The spa too. The canal is still a no-go (it's now a separate collider). Under the surface: a teal tint, depth fog toward the lit water (day or pool-light colour), a caustic shimmer, and the surface seen from below (the water is now double-sided, with a bright Snell's-window tone) | `review/round15/tools/underwater.png` |
| 5 | **Hot tub.** **Root cause:** the spa cabinet is a capped cylinder whose top cap sat 7 cm above the water, so the "flat grey disc" was the cabinet lid and the water was never seen. The viewer drops the cap's 62 triangles (`?spacap=1` for before; the export should build an uncapped tube). Then the water: four jets boiling up foam that swirls and breaks up, a fine bubble fizz, a churned surface rougher near the jets, a hot tub's aqua (absorption 0.95, 0.24, 0.2), and a soft cyan glow at night. The spa light is halved, as it was blown out | `review/round15/hottub.jpg`: before, then day, dusk and night, close up, from the deck and from the lounge. Steam not done |
| 6 | **No outdoor kitchen:** `kitchen_none` card. All kitchen geometry is hidden and the SK02 gate stays. The card shows "Render to come" until `options_16_outdoor_kitchen_kitchen_none.jpg` exists; check-images now lists such cards as awaiting a render, not missing | `review/round15/kitchen_none.jpg` |
| 7 | **Hinges** (`src/hinges.ts`), ready for the next export: parts tagged `interact: lid/door`, `group`, `pivot`, `axis`, `open_deg` swing about their pivot on `E` (or the phone button), with "Press E to open the lid/door". `blanket_from`/`pit_roll` are carried through for the roller pits | Tested with a stand-in lid: opens to 100°, closes again |
| 8 | **Moonlight reworked:** Round 14's moon (the sun light turned to a fixed moon direction) cost 50–100 ms frames in the dusk scrub, traced by bisecting with `?moon=0` and then a direction-only switch. It's now a fill: the night sky's environment light ×(1 + 10·moon). No light, direction or shadow changes | Today at night still reads as dim shapes (`review/round15/moonfill.jpg`: off, 8, 20); no moon shadows any more |
| 9 | **Detail pass** at eye height (`review/round15/detail_sheet.jpg`) | The spa cap (#5) was the real find; nothing else clipped or floated at eye height |

**Tests:**
- **New `scripts/tools-test.mjs` (PASS):**
  - Tape measure by real clicks: 3 m apart on the deck reads 2.98 m. It also covers the label, Esc, the drone and Done.
  - Fly: Space and E up, C down to the ground, stopped by the alfresco ceiling and the house wall, and all six mode switches.
  - Pool: in off the coping, slower wading, ducking under turns the underwater look on, Space climbs out, and no walking into the canal.
  - Hinge open and close, and a clean console.
- **Updated for the tabs:** settings-test and pages-check.

**Numbers:**
- **Frame rate:** Low, Medium and High hold 60 fps at DPR 1 and 2 on all four views.
- **Dusk scrub:** 24 passes; 23 max out at 18–23 ms, and one frame hit 51 ms.
- **Other checks:** switch-test, walk test, settings, images (165 plus 1 awaiting its render), page checks and phone layouts all pass.

## Round 15b

**Change:** the pool fence is decided: perforated.
- **Removed from the walkthrough:**
  - the perforated-vs-glass cards (`FENCE_CHOICES`, `CARD_IMAGES`, the `card_fence_*` thumbnails)
  - the fence from the Fences category summary, which now shows only pier and north fence
  - the saved setting and the `?fence=` link parameter: old `glass` values are ignored silently
- **Removed from the renders page:** the fence comparison section and its glass renders. The assumptions now say the perforated fence was chosen over SK02's glass.
- **The model:** the fence stays perforated.

**Checks:**
- **Old values:** a saved `fence: glass` plus `?fence=glass` both load perforated, with no console messages.
- **Tests:** settings, switch-test and tools-test pass. The page checks pass, as does the image check (160 images, 1 awaiting its render).
- **Frame rate:** Medium and High hold 60 fps at DPR 2.

## Round 15c

**Fly mode mouse buttons:**
- Hold the left button to fly forward along the view, the right to go straight up; both together do both.
- Shift still makes it fast, and the keys still work.
- They're read from the pointer's buttons bitmask, because a second button pressed while one is held only fires pointermove, not pointerdown. This also works under pointer lock.
- The context menu is suppressed on the view while flying.
- Clicks still go to the tape measure while it's out.
- The help card is updated.

**Tests:** tools-test has 7 new checks and passes; the walk test passes.

## Round 16

The model agent's first batch, wired up (viewer only; the-pool untouched, no sync run).

| # | Change | Result |
|---|---|---|
| 1 | **Alfresco posts** (`post_as_drawn` default, `post_corner`, `post_west`, `post_two`): a new option group in the model, cards under Alfresco (summary shows kitchen and posts), saved and `?post=` links, and a renders-page section with the 10, 04 and 15 renders. Copy from the model README | Exactly one post layout shows; the post collides (`review/round16/test/post_*.png`) |
| 2 | **Blanket boxes:** `roller_pit_shallow` card and renders section. `hide_option` cavity paving: inherited, kept through the merge, and hidden when its box is chosen | Box and fill swap correctly |
| 3 | **Hinges fixed for the real tags:** every part has its own pivot and axis (two lid panels, a door pair opening opposite ways). Doors leave the static collider and become moving obstacles like the gates | Lids 105°, doors 100°, as tagged |
| 4 | **Blanket animation** (`src/blanket.ts`): E at a box opens the lids, then unrolls a translucent blue bubble blanket (22 mm hex bubbles) from the box across the pool. The sheet is cut from the pool water's own top surface, so it follows the shape. The roll in the box shrinks to its core about its own axis, then the lids close. E again reverses it. The prompt reads "unroll the blanket" or "roll the blanket in". Switching the option away resets it | `blanket_half.png`, `blanket_out*.png`, `blanket_shallow_out.png` |
| 5 | **Pump room:** cards (slatted doors or open bay) under "Under the spa", the 22_pump_room view and a renders-page section. E opens or closes the doors. **Crouch:** C toggles it on land (eye 0.75 m). Walking under anything lower than 1.85 m crouches you by itself: it looks 0.2–0.45 m ahead so you're down before the wall above the 0.88 m opening stops you. The capsule shortens and you move at 55% speed. A note reads "Low headroom: 0.96 m"; you stand again once there's room | `pump_doors_open.png`, `pump_inside.png` |
| 6 | Kitchen-none card now has its render | — |
| 7 | **Product link** on the low-profile roller card (Daisy SQ Pool Roller, new tab) | — |
| 8 | Category renamed **Pool cover** | — |

**Not built yet, as asked:** roll-on covers, the hot tub cover, play_moved, pier_inset, the side gate and the clothesline.

**Tests:**
- **New `scripts/r16-test.mjs` (PASS):**
  - Posts: each of the four layouts shows only its own post.
  - Blanket boxes: the cavity paving hides; then, for the deep box, the prompt, lids opening first, the unroll with the shrinking roll, the lids closing, the reverse, and the shallow box too.
  - Pump room: the door prompt, E opens both doors, walking in auto-crouches you under 0.88 m headroom with the note, walking out stands you up, shut doors stop you, C crouches by hand, and the open bay.
  - A clean console.
- **Other checks:** tools-test, switch-test, walk test, settings, images (192, 0 missing), page checks and phone layouts all pass. The new post and pump choices survive a reload, and the `?post=`/`?pump=` links work.
- **Frame rate:** Low, Medium and High hold 60 fps at DPR 1 and 2.
- **Dusk scrub:** max 48 ms, 0 over 50 ms.

**Fixed along the way:** a card with a product link lost its click handler, which the page check caught.

## Round 16b

**Interacting while flying:**
- E works in fly mode as it does walking: gates, blanket-box lids and pump doors. The prompt and the phone button come up from where you're flying, and only within reach up and down (nothing from high above). Drone mode is unchanged.
- E is no longer "fly up": up is Space, the right mouse button or the touch ▲.
- New: a short fly-mode hint, and the help card says E works while flying.
- On phones the gate button sits beside the fly pad while flying.

**Tests:**
- r16-test: 5 new fly-mode checks (door prompt, doors open, blanket unrolls, gate prompt, no prompt from high above). PASS.
- tools-test: "E doesn't fly". PASS.
- Walk test: passes.

## Round 17

| # | Change | Result |
|---|---|---|
| 1 | **The mode is kept:** cards, 'go to', the view list and the scenario keep walk, fly or drone. In fly, a card glides through the air to the view's camera (`Walker.flyTo`), at its own height; in drone it orbits the view; walking safe-lands as before. Only the aerial and from-the-canal views take a walker up in the drone (there's nowhere to stand there). The mode is saved in the settings and restored on load, before any deep-linked view | r17-test: fly and drone survive four card, 'go to' and scenario changes; fly 'go to' 06 lands at the seated 2.85 m; a reload comes back flying |
| 2 | **Play area:** a `play` group (`play_as_is` default, `play_moved`) with cards under Side passage (the summary shows both) and a renders-page section (19, 21) | The trampoline moves 1.75 m north (`play_moved.png`) |
| 3 | **`pier_inset`:** a card in Fences from the README's notes (the kitchen ends up outside the pool area; the walkway is pinched). It picks up the `+gate` combinations like the other pier options, and the renders page lists it | `pier_inset.png` |
| 4 | **Side gate:** the leaves' interact/pivot/axis tags go straight into the hinge system. E opens it in both scenarios, walking or flying. It's a moving obstacle like the pump doors. Camera 23_side_gate added to the views list | `side_gate_open.png` |
| 5 | **Roll-on covers** (`src/covers.ts`): Pool cover gets "Roll-on cover, shallow end" and "…, deep end"; a new Hot tub cover category (no cover, rolled up, on). Both link Australian Spa Covers Roll-On; the spa note says a round spa is custom made. E near the pool or spa (within 1.4 m, walking or flying) rolls the cover on or off piece by piece: the parked roll travels along `unroll_dir`, shrinking and dropping to the cover's level, and the flat cover appears one segment at a time behind it (17 pool, 8 spa). The prompts say "roll the pool cover on/off" or "roll the hot tub cover on/off". The bathers hide only once a cover is fully on; switching the option away puts the pool cover back | `pool_cover_half/on.png`, `spa_cover_half/on.png` |
| 6 | **`hide_option` everywhere:** any chosen option key (covers count when fully on). INHERIT carries `pool_cover`/`spa_cover`; merged people keep the tag | Bathers hide and come back |
| 7 | **Alfresco table removed:** nothing in the viewer depended on it. The post copy no longer mentions the table or chairs | — |
| 8 | **Renders still on their way** show "render to come", on cards and now on the renders page too. check-images counts anything not yet synced as awaiting a render (17 now), and the tests ignore those 404s | — |

**Fixed along the way:** both covers share one vinyl material, and the converted material was shared, so the pool cover took the spa's reveal and vanished. Each cover now has its own material.

**Tests:**
- **New `scripts/r17-test.mjs` (PASS):**
  - mode kept and remembered
  - play_moved and pier_inset
  - the side gate in Today and Proposed, walking and flying
  - the pool cover on (walking) and off (flying), and the deep end
  - the spa cover on (walking) and off (flying)
  - the bathers, and the no-cover state
- **Other checks:** r16-test, tools-test, switch-test, the walk test, settings, the page checks and phone layouts all pass. The image check: 213 images, 0 missing, 17 awaiting a render.

**Performance: not measurable this round.** Blender was rendering the model agent's images throughout (about 200% CPU plus the GPU). Frame rates swung between 28 and 60 fps on any quality and view, run to run, and two of six scrub passes stalled (111–140 ms). The Round 16 build, measured in the same minutes, did the same (38 fps at the pool edge, a 117 ms scrub pass), so it's the load, not this round. To re-run once the renders finish.

## Round 17b

**Options no longer move you.**
- Clicking an option card only switches the option: no camera move, no mode change, no fly-to.
- Each option section has a small 👁 View button for its suggested viewpoint, which keeps your mode. The pool cover's picks the right end for the chosen cover.
- Today/Proposed doesn't move you either.

**'Go to' never changes the mode.** In fly or drone it goes anywhere, at the render camera's height. Walking to an aerial or canal view stands you at the nearest safe floor between where that camera looks and the camera, facing the view, with a hint: "… is from the air. Switch to Fly or Drone for the full view".

**Tests:**
- **r17-test:** new checks that cards and Today/Proposed leave the camera and mode unchanged in walk, fly and drone; that View goes there and keeps the mode; and the aerial 'go to' while walking and flying. PASS.
- **pages-check:** now checks that each card stays put and View moves.
- **Other tests:** r16, tools, switch, walk and settings pass.

## Round 17c

**Top bar and sidebar:**
- Removed the 'Go to…' dropdown and the sidebar's 'Go to a view' grid. The cards' 👁 View buttons and the renders page's Open in 3D links (`?cam=`) still use the camera code.
- The title block is now one back-arrow button (`../`, aria-label and tooltip), on desktop and phone.
- The panel button reads "Options".
- On phones the measure tool sits beside the modes and Options sits on the right.

**Renders:** after the re-sync, make-cards made all 32 thumbnails. The play-area renders are named with the passage surface (`options_<view>_play_<as_is|moved>_<pavers|aggregate>`), so the cards and the renders page now use those, with four combinations at 19, 21 and 20. The image check: 223 images, 0 missing, 0 awaiting.

**Tests:** r17-test uses `__viewer.goToCam` instead of the dropdown, and ui-shots.mjs looks for the back button.
- Pass: the page checks, settings, tools, r16, r17 and the phone checks.
- A `?cam=05…&roller=roller_pit` deep link lands correctly.

## Round 17d

**Time of day:**
- Every load opens at the current date and time in Perth (AWST, UTC+8, from the clock, so the viewer's timezone doesn't matter).
- The time and date are no longer remembered; old saved values are ignored and removed.
- The slider, date and timelapse work as before for the visit, and `?t=`/`?date=` still win.
- A night-time load opens dark, with the garden lights, flames and the moonlight fill on.

**Kitchen default:** 'No outdoor kitchen' (`kitchen_none`). Returning visitors keep their saved choice.

**`pier_inset` card:** the note says it's meant to go with 'No outdoor kitchen'. While a kitchen is chosen, the card shows a warning: "With a kitchen, the benches would sit 45 mm outside the fence (climbable)". The kitchen isn't changed.

**Tests:** settings-test is rewritten with a mocked clock. It covers a 21:40 Perth load from a London-timezone browser (night: lights and flames), a 10:30 load from New York, old saved times ignored and removed, options remembered while the time goes back to now on reload, `?t=`/`?date=` overriding, and the pier_inset warning. PASS. r16, r17, tools, switch, walk, the page checks and the image check (223, 0 missing) pass.

**Performance:** not measured; Blender was running.

## Round 17e

**A simpler sidebar.**
- **Settings:** people, frame rate, picture quality and "How to walk around" moved behind a gear at the top of the panel. It opens a native modal `<dialog>`: Esc, the × or a click outside closes it, focus stays inside while it's open and returns to the gear after. The sidebar's duplicate Today/Proposed is gone; the top bar keeps it, on phone too.
- **Removed:** the "Design choices / Try the options / Pick a part…" intro. The panel starts with "Design options" and the gear.
- **Categories:** plain names (Pool cover, Hot tub cover, Alfresco, Fences, Side path, Pump room) with a short current choice.
- **Cards:** every one has a short title (2–4 words) and one plain line of about 8 words (`short` in choices.ts). The full explanation is behind a small "More" under the card. Section notes (the WA pool rules, the pump room's headroom, the roof posts, the spa cover) are behind a small ⓘ in the section heading. The product links stay, smaller.
- **View buttons:** icon-only (an eye), with a tooltip and aria-label.
- **Renders page:** unchanged, except that it shares the choices' titles, so its option chips show the shorter titles; its notes are the full text as before.

**Tests:** the page check, settings-test (opens the gear first) and r17-test now pick cards by exact title. The page checks, settings, r16, r17, tools, phone and image checks (223, 0 missing) pass.

**Screenshots (`review/round17e/`):**
- `before_after_desktop.png`, `before_after_phone.png`
- `after_desktop_fences.png`
- `cmp_info_settings.png` (ⓘ and More open, and the settings dialog)

## Round 18

Batch 4 from the model agent.

**`kitchen_lounge`:** an Alfresco card, "Facing the lounge" ("A bench facing the lounge from the alfresco."), with the full description behind More. Its picture is `options_16_…_kitchen_lounge_post_as_drawn.jpg`. With `post_two` chosen too, both cards show an inline warning: "With two roof posts, one post stands in this bench" and "With the lounge kitchen, the east post stands in its bench". Neither choice is changed. The warnings share one helper (`warnOn`) with Round 17d's pier_inset warning.

**`pier_straight`:** a Fences card, "Straight past the pier" ("One straight line just past the pier."). Its `gate_sk02+` / `gate_south+` parts follow the gate like the other pier options, and the renders page lists it with its 18 and 12 renders.

**Default kitchen on the renders page:** the main images haven't been re-rendered without a kitchen; the outdoor-kitchen view, dusk and the post renders still show the split layout. So the copy says what the pictures show:
- The main-views hint says the kitchen isn't decided and these views show the split layout, one of the options.
- The kitchen section ("Outdoor kitchen", was "BBQ and pizza oven") opens with "Not decided yet".
- The Open in 3D links still open with the split kitchen, so 3D matches the picture.
- The renders page lists the lounge kitchen (with SK02's post); its from-the-pavilion render doesn't exist yet and shows "render to come".

**Tests:** r17-test adds:
- no kitchen on a fresh visit
- the lounge bench showing
- no clash warning with one post, and both warnings with two posts, with nothing changed
- pier_straight's fence showing and the as-drawn one hidden

r17-test passes, as do settings, r16, tools, switch, walk, the page checks, phone and images (230, 0 missing, 1 awaiting a render).

**Performance:** not measured; Blender was running.

## Round 18b

- **post_corner_steps**: new Alfresco post card, "Corner post, steps moved". The kitchen_lounge interaction (kitchen's west end at the head of the moved steps, 0.77 m of the flight open) is in its More text, with no warning. Renders page lists it at 10, 04, 15 and 06.
- **Renders page**: main views say no kitchen is shown; round 18's split-layout note is gone and Open in 3D uses kitchen_none again. "The lounge through the day" and "After dark" still show the old split kitchen, so they carry a note and open with kitchen_split until fresh images land: flip `OLD_KITCHEN` in src/gallery.ts to false then.
- **3D checks** (review/round18b): ribbed Smart Span roof reads from above and below; the house rear wall stops under the roof; straight pier fence kink and height look right.
- **Ribbed roof cost**: Medium alfresco 537 draws / 2685k tris vs 539 / 2683k in round 17, so no measurable change. Fps skipped (Blender running).
- r17-test title filters made exact ("Corner post" now has a sibling). Full suite passes; check-images 234, 0 missing, 1 awaiting (pavilion kitchen_lounge).

## Round 18c: perf re-run (Blender idle)

| | Round 14 | Now (84451c2) |
|---|---|---|
| Low / Medium / High, DPR 1 and 2, alfresco, lounge, pool edge, play | 60 fps everywhere | 60 fps everywhere |
| Pump room (new view: doors opened, walked in, crouched), all qualities, DPR 1 and 2 | n/a | 60 fps |
| Medium alfresco draws / tris / CPU ms | 495 / 2,684k / 4.3 | 537 / 2,685k / 5.8 |
| High pool edge draws / tris / CPU ms | 529 / 2,912k / 4.9 | 579 / 2,905k / 6.8 |
| Dusk scrub 17:00↔21:00 ×6, Medium and High | max 21 ms | max 20 ms, 0 over 50 ms |
| Shaders compiled at load | 178 | 195 |
| Local warm load: cover lifts / interactive (same script, round 14 build served side by side) | 1.65 / 2.6 s | 2.0 / 3.1 s |
| Local cold load | 2.1 / 3.1 s | 2.4 / 3.5 s |
| Live warm load | n/a | 2.6 / 3.7 s |
| Live cold load | n/a | 3.2 / 4.3 s |

- No fps or scrub regression, so nothing changed. The ribbed roof costs nothing measurable; the pump room's two lights hold 60 fps from inside it.
- **Load is ~0.35 s slower to the cover and ~0.5 s to interactive than round 14**, from 17 more shaders (pump room 8: treated_pine, batten, pump_grey, valve_red, strainer_lid, pvc, pump_blue, door_backing; plus the Smart Span skin, clothesline 2, obscure glass, spa back, side gate). Each compile stage grows by about the same share. Still well inside the 8 s target.
- CPU per frame is up ~1.5 ms (more draw calls: noMerge hinge parts, covers, pump room), comfortably inside the 16.7 ms frame.
- `scripts/perf.mjs` gained a `pump` view and `--shots <dir>`. Logs and DPR 1 screenshots in `review/round18c/`.

## Round 19: Layout B

| # | Change | Result |
|---|---|---|
| 1 | **Sync:** `sync-model.sh` also copies `pool-model-b.glb`, `cameras-b.json` and `lights-b.json`, and turns `renders/model/layout_b/*_layoutb.png` into `img/layoutb_<cam>.jpg` (1600 x 900, as web_images.py does). B's files get their own `?v=` hash (`__MODEL_V_B__` in vite.config.ts), and deploy.sh warms them too | Run: 8 Layout B images, both models copied |
| 2 | **Layout choice:** a new first category, "Layout", with two cards, "As drawn (SK02)" and "Lounge wall in line, pool moved" (details behind More; pictures cropped from the 07 aerials). Picking one hands everything over through sessionStorage (where you are and where you're looking, mode, time and date, Today/Proposed, people, every option) and reloads the page with the other model behind the loading cover. Remembered in settings; `?layout=a/b` is a one-off, like the other link params. Walking, if your spot is now part of a moved wall or the moved pool, `walker.nearestStand` finds the nearest floor at about the same level with room for the body, and a hint says how far you moved. Fly gets pushed out of anything it's in; the drone keeps its exact camera. An option this model doesn't build would go back to its default with a note (none do today: both models have the same 35 option keys) | Swap, warm: cover lifts in 2.2 to 2.3 s, settled 3.5 to 3.8 s |
| 3 | **Posts in B:** all five post layouts show. Warnings in B only: SK02's post ("stands 0.5 m in front of the lounge steps") and the lounge kitchen ("overlaps the top of the lounge steps by 0.25 m"). The corner-post-with-steps card gets a quiet note that in B the steps are already in the corner | `review/round19/b_warnings.png` |
| 4 | **Renders page:** a "Layout B" section after the posts: SK02 beside B from the same camera for all 8 B views. SK02's side uses its corner-post render where one exists (10, 06, 15), otherwise its main render, and its tag says which. Both images open in 3D in their own layout. Every other "Open in 3D" now passes `layout=a`, since those pictures are SK02's | `renders_layoutb*.png` (desktop, phone) |
| 5 | **Load:** each layout fetches only its own GLB, lights and cameras | Checked in r19-test from request logs |

**Checks:**
- **New `scripts/r19-test.mjs`:** covers the swap in walk (nudged 0.8 m out of B's lounge coping, which reaches x −1.25 at 0.72 m above the floor), fly and drone, with options and time kept. Also checks only one GLB per load, remembering, the one-off `?layout=`, the B warnings and every post layout in B. PASS.
- **Test fixes:** r17-test now ignores hidden warnings (the kitchen card has two now).
- **Other checks:** settings, r16, r17, tools, switch, walk, pages and phone all pass. check-images: 245 checked, 0 missing, 1 awaiting (pavilion kitchen_lounge).
- **B, Medium, view 15 with the lounge kitchen:** 550 draw calls and 2,687k triangles, the same as A. Fps not measured (Blender running).
- **Found, not from this round:** view 10's camera is in the play area, so with the play area moved north, the View button for posts lands you on the climbing frame, crouched. This happens in both layouts.

## Round 20

| # | Change | Result |
|---|---|---|
| 1 | **Sync:** batch 7, both layouts (252 images, incl. Layout B option renders `layoutb_<cam>_<option>.jpg`, not used yet) | Done |
| 2 | **`roller_channel` card** ("Open channel, deep end"): a Daisy SQ in an open 0.42 m trench, no lid; Daisy SQ link; More covers why not a standard roller (0.6 m stands, 0.75 m trench) and the trip hazard, leaves and water, the drain, and a possible grate or rail. Renders page too. **Lidless blankets** (blanket.ts): a `pit_roll` with `blanket_from` and no lid hinge is a box of its own; E within 1.6 m of the roll (walking or flying) unrolls it straight away with the same animation, and rolls it back | `review/round20/channel_a.png`, `test/*_channel_*.png` |
| 3 | **`pier_straight_edge` card** ("Deck edge, then past the pier"). The gate keys work as for the others: SK02's gate on the deck edge, the duck's gate with the one long bench | `test/pier_straight_edge_18.png` |
| 4 | **`hide_option: "a|b"`:** split on `|`, hidden when any is chosen (the deep end's fill now goes for the blanket box and the channel) | |
| 5 | **View 10:** the camera is over the boundary wall and its steel rail (every play option, not only play_moved as I said in round 19), so walking there landed on the rail. Walking "go to" now checks the surface under a standing camera: if it isn't a floor, you stand on the nearest real floor within 3 m (0.4 m in, on the aggregate) looking at the same target. Seated views are untouched | `test/view10_play_moved.png` |

**Checks:**
- **New `scripts/r20-test.mjs`:** channel card, link and More text; the fill is cut away for the channel and the box and back for none; E unrolls and rolls back, walking and flying, in both layouts; the deck-edge fence with both gates; view 10 on the floor; seated view 06 unchanged. PASS.
- **Test fixes:** r16-test uses the fill's new mesh name.
- **Other checks:** settings, r16, r17, r19, tools, switch, walk, pages and phone all pass. check-images: 252 checked, 0 missing, 1 awaiting.
- **Fps, both layouts, Low/Medium/High at DPR 1 and 2, five places:** 60 everywhere except A High in the pump room at DPR 2 (55). All of it was measured while a model-agent Blender job was running, so it isn't a clean number.

## Round 21

| # | Change | Result |
|---|---|---|
| 1 | **Sync:** batch 8, both layouts (328 images incl. 54 Layout B). `sync-model.sh` copies `dims.json` / `dims-b.json`; they're in each layout's `?v=` hash, and deploy.sh warms them | Done |
| 2 | **Dimensions overlay** (`src/dims.ts`): a Settings switch plus **L** (not D: D is strafe right), off by default and remembered. Fetched on first use for the current layout. Each dim shows by the same `set` / `option` / `hide_option` rules as the model's parts, so it follows Today/Proposed and every option. Thin dashed orange lines with a small cross at each end (two draw calls, overlay layer, not in the mirrors). The colour is pushed above 1 so AgX doesn't dull it. HTML labels ("4.00 m", plus the dim's name within 6 m) fade from 12 to 45 m, and the nearer of two overlapping labels wins. Chips in Settings: Pool, Lounge, Spa, Alfresco (incl. the two alignment lines), Fences, Side passage, Levels. The tape measure is unchanged | 56 by default in both layouts. All 55 option-specific dims checked: each shows when its option is chosen and goes with another, and the 3 `hide_option` ones hide. `dimensions_above_pool_lounge*.png` |
| 3 | **Boundary fence:** a new category with six cards (Perforated default, Colorbond, Slat screen, Raised wall, Taller tubular, Keep existing). Keep existing always carries a warning (1.81 m down to 0.83 m). The i gives the WA rules (1.8 m from our side, nothing to climb in the top 900 mm on our side, the neighbour must agree). Today shows the existing fence. `?bfence=` works. A renders-page section covers views 13, 05, 17 and 07 | `test/bfence_*.png`, `renders_bfence.png` |
| 4 | **Layout B (wall 0.88 m east):** the card and renders-page text are updated (2.99 m lounge, post and roof edge in line with the house wall, 0.50 m paving strip, 0.57 m to the boundary). SK02's post still warns, now "0.35 m in front of the lounge steps". The lounge kitchen no longer overlaps: measured, it starts at x 0.27, about 0.36 m east of the steps. Its warning became a note ("1.85 m long") | r19 and r21 tests |
| 5 | **Pump room crawl:** a path is planned on a 10 cm grid (capsule clear, at least 0.75 m headroom), then walked with the keys from the promenade, through the doors and round the spa to its far side, kneeling the whole way. A: 6.1 m, B: 6.1 m | `test/pump_*_far_end.png` |
| 6 | **Layout B option renders on the renders page:** every option picker shows B's render beside SK02's when B has that option and view (boundary fence, channel, posts, lounge kitchen, deck-edge fence, pump room), each opening in 3D in its own layout | `renders_posts_ab.png`, `renders_roller.png` |

**Checks:**
- **New `scripts/r21-test.mjs`:** PASS. r19-test was updated for the new B warnings.
- **Other checks:** settings, r16, r17, r19, r20, tools, switch, walk, pages and phone all pass. check-images: 328 checked, 0 missing, 1 awaiting.
- **Fps, Blender idle (clean):** both layouts, Low/Medium/High at DPR 1 and 2, five places: 60 everywhere. Dimensions on (High, DPR 2): still 60, +2 draw calls.
- **Dusk scrub:** max 20 ms.
- **Load, local:** warm 1.95 / 3.07 s, cold 2.66 / 3.82 s.

## Round 22

| # | Change | Result |
|---|---|---|
| 1 | **Sync:** Layout B's lounge runs east to the garden bed (75 B images) | Done |
| 2 | **Layout B copy:** the card's short line is "A wider lounge in line with the house; pool moved". More and the renders-page text cover the 3.75 m lounge, the east walkway gone (reach the spa deck along the pool side, 0.90 m, or through the lounge), the 2.72 m north bench, and pier_inset not possible | r22-test |
| 3 | **pier_inset in B:** the card is greyed out and disabled, with "Not possible in Layout B: it would run through the lounge's new corner." If it's chosen when B loads (setting, swap or link), B shows the drawn fence and a short message says so. Your choice is held (remembered, and handed over on a swap) until you pick another pier fence, so SK02's layout gets it back | r22-test |
| 4 | **kitchen_lounge in B:** its More text says the 1.05 m gap at its east end now leads nowhere. No warning | r22-test |
| 5 | **Checks after the sync:** B's dims show 56 by default (lounge width 3.75 m). The pump room crawl in B is 6.2 m, still round the spa. New B kitchen renders (views 10 and 16) sit beside A's in the kitchen picker, and the Layout B section gains the pump room view | `review/round22/test/` |

**Checks:**
- **New `scripts/r22-test.mjs`:** PASS.
- **Other checks:** settings, r16, r17, r19, r20, r21, tools, switch, walk, pages and phone all pass. check-images: 339 checked, 0 missing, 1 awaiting.

## Round 23: "pier" is now "pillar"

- **What changed:** every user-facing "pier", "Pier" and "piers" is now pillar. That covers card titles, short lines and More text, the section heading ("Fence by the pillar") and its i, the Fences summary ("Pillar: …"), warnings and the Layout B fallback hint, the renders page (headings, notes, view names, aria labels), and the view name "Pavilion pillar and fence".
- **Dimension labels:** these come from the export ("Pavilion pier to the pool fence"), so the viewer renames them when it loads them.
- **Unchanged:** the home pages don't mention it. The option keys (`pier_*`), `?pier=`, the `cards-pier` and `pier-h` ids, and the image names stay. `?pillar=` is an alias: `straight`, `pier_straight` and `pillar_straight` all work.
- **Two other uses changed too:** the boundary wall's "pier caps" are now "pillar caps", and the wall pier under the corner post's footing is now a pillar. These follow "everywhere"; say if they should go back.
- **New `scripts/r23-test.mjs`:** scans everything readable on both layouts' walkthrough, the renders page and the home pages (text including hidden More and i notes, plus alt, aria-label and title) for the word, and checks the aliases and the dims labels. PASS.
- **Other checks:** pages, settings and r17 to r22 all pass. Test card titles were updated.

## Round 24

| # | Change | Result |
|---|---|---|
| 1 | **Sync:** batch 11, both layouts (287 images plus 124 Layout B; dims now 107 in A and 116 in B) | Done |
| 2 | **`pier_straight_deck`** ("Straight past the pillar, deck under the roof") in Fence by the pillar. While it and any kitchen are both chosen, that kitchen's card and the deck card warn. Renders page: it's in the pillar picker (views 18 and 12), plus its own section with 10, 04, 15, 16, 18 and the south-east aerial, Layout B beside | `review/round24/test/*_deck_10.png` |
| 3 | **Along the boundary wall:** a new category (Planter bed default, Pots, Nothing). The i covers the 0.9 m limit (NCZ 5). Renders section with 13, 05, 17 and 07, with B beside. `?bplant=` works | r24-test |
| 4 | **Tags on instanced models:** option tags survive on the InstancedMeshes (the bed's shrubs and grasses), and the potted plant's `hide_option: pier_straight_deck` hides it when the deck is chosen. Both checked in both layouts | r24-test |
| 5 | **Light slots:** a fixed pool allocated at load (6 spot, 6 area, 4 point = 16; raised at load if any one scheme needs more of a type, and the shadow-casting slots sized the same way). Each exported light becomes a spec (place, aim, colour, size or angle, power, the per-light tuning from rounds 9 to 13). Whichever specs are active for the scheme, scenario and options take slots, keeping theirs while they stay on. Switching only reassigns, so the set of lights (and every shader key) never changes. The "Lighting" category has "As specced" (`lights_specced`). Any `lights_*` scheme in lights.json gets a card automatically until it has a proper one; untagged lights are in every scheme | 11 of 16 slots used by default. A synthetic second scheme switched three times at night: same set of lights, worst frame 31 ms. Night views match the old per-light code (mean difference about 1/255; `night_*_before/after.png`) |

**Checks:**
- **New `scripts/r24-test.mjs`:** PASS.
- **Test fixes:** settings-test now ignores hidden warnings (the pillar cards have two). The r21 and r22 dim-count ranges are widened (A 59, B 65 by default now). r20 polls for the channel prompt instead of a fixed wait, which ran short under Blender load.
- **Other checks:** all pass. check-images: 384 checked, 0 missing, 1 awaiting.
- **Perf: Blender busy (a model-agent job), so not clean.**
  - Medium held 60 in most places, with dips to 47 and 53. High swung from 17 to 60.
  - The dusk scrub was still clean (max 19 ms).
  - Side by side under the same load, the old per-light build and the slot build were indistinguishable: 14 vs 17 lights in the scene, median GPU 30.7 vs 28.5 ms.

## Round 25: lighting schemes

| # | Change | Result |
|---|---|---|
| 1 | **Sync:** batch 12, both layouts (lights.json now 80 lights in A, 72 in B; 323 images plus 148 Layout B) | Done |
| 2 | **Cards:** six schemes in Lighting (As specced, Resort, Festoon, Architectural, Colour, Garden), one line each, with the README's description behind More. Card pictures come from the 19:40 renders over the lounge. The i lists what every scheme keeps and what the electrician needs. View goes to the lounge at 20:30 in your mode. Picked by day, a hint under the time bar says "Lighting shows after dusk" with a "Show it at 20:30" button. `?lighting=festoon` works, and the choice is remembered | r25-test |
| 3 | **Slots:** sized once at load by counting each scheme, with every combination of the options its lights depend on (the corner post's bench strips in A): 20 slots (6 spot, 6 area, 8 point; festoon needs the points). One shadow-casting spot, which goes to each scheme's main downlight pair. The per-light tuning is generalised to the scheme variants: `pool_light_*` and `led_spa_light_*` get the underwater colour, and only the specced bench strips keep round 9's 2700 K override, so the colour scheme's cyan stays cyan | 24 switches at night per layout: the same set of lights, worst frame 29 to 30 ms |
| 4 | **Look:** the pool and spa glow now take the scheme's light colour and level (teal and violet in Colour, amber in Resort, almost nothing in Garden). The hot tub's own night glow follows the spa light, so it's off in Garden. The alfresco ceiling's warm wash follows the scheme's downlights (none in Festoon or Garden). Festoon bulbs, the cove, the bollards and the terrace washers are the export's glowing fittings plus their lights | `review/round25/<scheme>_{15,17,01}_2100.png`, `schemes_3d_vs_render.jpg` (3D beside Cycles, views 15, 17 and 01), `closeups.jpg` |
| 5 | **Renders page:** a "Lighting at night" section: six schemes, at dusk and 9 pm, from 17, 15 and 01, with Layout B beside where it was rendered (17 and 15) | `test/renders_lighting.png` |

**Checks:**
- **New `scripts/r25-test.mjs`:** PASS.
- **r24-test:** its synthetic scheme now lives inside the real specced scheme. A made-up scheme name turns on every scheme's shared bench strips at once, which only a test can do.
- **Other checks:** the full suite passes. check-images: 449 checked, 0 missing, 1 awaiting.
- **Perf: not clean.** Blender was idle, but Backblaze was at 100% CPU and a visible Chrome was busy on the GPU (load average about 7).
  - Low and Medium held 60. High at DPR 2 fell to 30 to 45, and the dusk scrub had five frames over 50 ms.
  - Load: warm 3.6 / 5.7 s, cold 4.0 / 5.6 s (cover lifts / interactive).
  - Side by side under that same load, the live round 24 site (17 lights) and this build (21 lights) both ran at 32 fps, with median GPU 57.0 vs 49.8 ms. So the slowdown is the machine, not the bigger pool.
- **Known, not from this round:** at night from the canal, two bright blobs in the canal under the terrace where Cycles shows thin streaks. Round 24's build has them too.

## Summary

**Round 17:**
- **Mode:** kept through cards and views, and remembered across visits.
- **New options:** play area moved, the inset pier fence, and the side gate (E opens it).
- **Roll-on covers:** pool and hot tub, which roll on and off piece by piece with E.
- **hide_option:** respected everywhere.
- **Performance:** to re-measure once the renders finish.

**Round 16:**
- **New options wired up:** alfresco posts and the shallow-end blanket box, plus the cavity paving that fills a box's spot when it isn't chosen.
- **Blanket animation:** E unrolls the blanket across the pool and rolls it back.
- **Pump room:** doors that open with E, and crouching to get in.
- **Product link:** on the low-profile roller card.
- **Rename:** 'Pool cover'.

**Round 15:**
- **Sidebar:** choices in categories.
- **New tools:** tape measure and fly mode.
- **Pool and spa:** you can walk into them, with an underwater look.
- **Hot tub:** it was hidden under the cabinet's lid; now it's water with jets and foam.
- **Kitchen:** a 'No outdoor kitchen' option.
- **Hinges:** a system ready for lids and doors.
- **Moonlight:** now a fill, which fixed dusk-scrub hitches.

**Round 14:**
- **Night:** moonlight via the sun light, plus a Today-at-night note.
- **Drone → Walk:** lands only on real floors inside the lot.
- **Low:** the canal is closer to Medium.

**Round 13:**
- **Today → Proposed shadows:** fixed at the root: the light set is now constant across scenarios.
- **Quality switches:** now actually commit the full post chain. This was a long-standing bug: no AO or TRAA after a switch, at double the cost.
- **Drone → Walk:** never drops you into the void.
- **Sky bake:** follows the scenario.
- **Low:** the bench glare is gone, and the canal is blue with the far trees back.
- **Far trees:** a denser tree line.
- **New `scripts/switch-test.mjs`:** guards scenario and quality switches.

**Round 12:** an all-camera sweep, Today and Proposed.
- **Pavers:** cream like Cycles. Their grade was being wiped by the pool's caustics pass, which also lit Today's lawn as if under water.
- **Lawn:** green.
- **Canal:** deep blue.
- **Cameras:** every one lands at its Cycles position, seated views included.
- **Sliders:** show a lit room.
- **Smaller:** the deck lost its violet and the flames are orange.

All targets hold.

**Round 11:**
- **Canal:** the milky look was the water reflecting the sky twice (environment map plus mirror). It now shows dark, crisp tree reflections, and at night vertical light streaks.
- **Flames:** cut-out tongues.
- **Enclosed shade:** a sky-visibility bake darkens it.
- **Phone landscape:** uses the phone layout.
- **Small fixes:** bark texture, lit alfresco ceiling, no glitter on the coping, readable roller cards.
- **Loading:** no longer stalls in hidden pages.

All targets hold.

**Round 10:** the day sky is Cycles' pale blue, and the scene in shade matches Cycles within a few levels. The fix was the sky at Cycles' radiance plus Blender's Medium High Contrast look. Dusk lost its halo and its lit-up far bank. The flame and dimmer-flame experiments were reverted. 60 fps and the scrub targets hold.

**Round 9:** the pool now reads like Cycles':
- a pale floor with Cycles' caustic net
- dark navy walls and steps by day
- a teal glow from the pool light at dusk

The causes were the shell mirroring the sky under water, lighting that ignored the water above, and a veil and night ambient term in the water. The spa matches too. 60 fps and the scrub targets hold.

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

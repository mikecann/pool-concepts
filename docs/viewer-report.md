# Viewer report: the 3D walkthrough at /model/

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

## Summary

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

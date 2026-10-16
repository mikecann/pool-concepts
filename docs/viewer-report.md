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

## Summary

**Round 3:** the far trees look leafy, there's a one-time how-to-walk card, the phone layout fits in two rows, and the sky and distance are softened. Everything checks out at 60 fps.

**Round 2:** people start on, the lawn has real-looking turf up close (texture-only on Low and Medium), the pool reflects calmly with no stripes, the canal brick lights no longer glare, the roller copy is updated, and the synced renders all load (112/112). The fresh contact sheets are in `review/round2/`.

**Round 1:**

- **Viewer:** `/model/` is now a WebGPU walkthrough that starts in first person on the alfresco. It has the real sun and sky for any date and time, soft shadows, AO, TRAA and bloom, refractive water that reflects its surroundings, with caustics in the pool, and a lighting scheme that comes on at dusk. Collisions and steps work.
- **Old page:** its renders and notes are in the side panel, and each render can fly you to that view.
- **Export:** carries every option, the light fittings, real plants and `lights.json` in 14.65 MB.
- **Main compromises:** my own planar mirror instead of `ReflectorNode`, SSGI held to AO plus a little daytime bounce, and window glow in place of interior lights.

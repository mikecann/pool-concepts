# Brief: a realistic 3D walkthrough at pool.mikecann.app/model/

Mike and Kelsie are planning a pool, spa, sunken lounge and alfresco at their house. The page at `/model/` currently shows Blender renders (before/after, options, times of day, dusk) with a small orbit-only three.js viewer underneath. They want the opposite: **a realistic, first-person 3D walkthrough is the first thing you see**, full screen, so they can walk around the backyard at human eye height and get a real sense of the space, the light and the sun through the day. The renders move into a sidebar.

The bar is "feels like being there": convincing daylight and shadows, soft indirect light, good materials, believable water, a proper day/night cycle with the lighting scheme coming on at dusk. Not a game-engine demo look.

## Repos and boundaries

- **Site (you build the viewer here):** `~/dev/me/pool-concepts` (public GitHub repo). Static site; Cloudflare serves everything in `public/` (see `wrangler.jsonc`). `public/model/img/` holds the renders, `public/model/web/` the model files.
- **Model pipeline (private):** `~/dev/me/the-pool/model`. Blender 5.2 at `/Applications/Blender.app/Contents/MacOS/Blender`, scene `pool-model.blend`, scripts in `scripts/blender/`. Read `model/README.md` first.
  - You may edit **only** `scripts/blender/export_web.py` and add new files under `scripts/web/`. Do not edit `build.py`, `compile_site.py`, `mats.py`, `extras.py`, `ctxbuild.py` or `render.py`.
  - **Do not rebuild or save `pool-model.blend`.** A long Cycles render batch is using it. Open it read-only: `Blender -b pool-model.blend -P scripts/blender/export_web.py -- --out web/pool-model.glb` (the script never saves the .blend).
- **Do not commit, push or deploy** in either repo. Leave changes in the working tree; I review and ship.
- `scripts/sync-model.sh ../the-pool` in pool-concepts copies renders and model files into `public/model/` and wraps the old page. You will replace the page; keep the sync of `img/` and `web/` working (and add any new files such as `lights.json`).

## Coordinates and site facts

- Blender world: X east, Y north, Z up, metres, Z is AHD. glTF/three.js: Y up, **-Z is north** (`three = (x, z, -y)`).
- Site: latitude -33.6344, longitude 115.3959, AWST (UTC+8, no daylight saving). `scripts/blender/build_time.py` has the NOAA sun-position function the renders use (azimuth from north clockwise, elevation); port it so the browser sun matches the renders exactly.
- Levels (AHD): house floor 2.47, pool concourse/alfresco 2.37, sunken lounge floor 1.67, lawn 1.78, canal path 1.08, water 0.21. Pool 8 x 4 m, water 0.15 below the coping.
- Collections: `Existing`, `Proposed` (children `People`, `FirePit`, `Lighting`, `Opt_*`), `Site`, `House`, `Context` (child `Treeline`), `Vegetation`, `Furniture_existing`, `Furniture_proposed`, `Lights`, `Cameras`, `_templates`. The current export tags each object with extras `set` = existing | proposed | both.
- Design options are collections `Opt_roller_shallow`, `Opt_roller_deep`, `Opt_roller_pit`, `Opt_kitchen_split`, `Opt_kitchen_continuous`, `Opt_kitchen_freestanding`, `Opt_gate_sk02`, `Opt_gate_south` (the continuous kitchen uses `gate_south`, the others `gate_sk02`).
- Night lighting (see `render.py` `set_lights` and `extras.py build_lighting`): LED strips and markers are meshes whose materials have the custom property `led`; lights named `pool_light` (90 W), `led_spa_light` (25), `alfresco_downlight*` (30), `led_uplight*` (18 spots), `led_firepit_light` (160), `led_bench_light*` (35, area), plus interior `int_light*` (day value x1.6 at night). The fire pit flames are `firepit_flames`.

## Part A: a richer export (`export_web.py`)

1. Keep **all** design options (today it deletes the non-default ones) and tag their objects with extras `option` = the collection name without `Opt_`. Keep the `set` extras.
2. Keep the lighting fixtures as emissive materials (colour from their emission node) with extras `night: true`, instead of deleting them.
3. Write `web/lights.json` next to the GLB: every light except `Sun`, with name, type, position and direction in three.js coordinates, colour, night power in watts (table above), spot angle/blend, area size.
4. Better materials: base colour at 1024 px (keep the existing `bake_texture` tint and tile/plank overlay logic), plus normal (`textures/<id>/nor_gl.jpg`) and roughness (`rough.jpg`) maps for the `pbr` recipe materials. The aerial ground drape stays.
5. Real plants near the house instead of blob stand-ins: the Poly Haven plant meshes (decimate to roughly 3k triangles per variant, keep alpha leaves) as linked duplicates exported with `EXT_mesh_gpu_instancing`. Distant context trees and the `Treeline` can stay simple canopy meshes, but instanced, and tagged extras `lod: "far"` so the viewer can drop them on low quality.
6. Extras `collide: false` on plants, people, water, glass, light fixtures, flags; everything else is walk-collidable.
7. Optimise with `@gltf-transform/cli` (meshopt geometry, WebP or KTX2 textures). Aim for under ~35 MB total. Output stays at `the-pool/model/web/pool-model.glb` (+ `lights.json`, `cameras.json`).

## Part B: the viewer (pool-concepts)

- **Build:** Vite + TypeScript, output to `public/model/` (the page at `/model/`) without wiping `public/model/img/` or `public/model/web/`. Use current **three.js from npm** with `WebGPURenderer` (it falls back to WebGL 2) and its TSL post-processing pipeline. three's API has moved recently (for example `PostProcessing` was renamed `RenderPipeline` around r183), so check the installed package source rather than memory. If WebGPU-only effects aren't stable, a WebGL path with pmndrs `postprocessing` + N8AO is acceptable; pick whatever gives the best real result and say why.
- **Light and atmosphere:**
  - The sun position comes from the date and time at the site.
  - A physical sky drives the sun's colour and intensity.
  - The environment map comes from that sky through PMREM, and updates (throttled) as the time changes.
  - Soft sun shadows cover the whole yard: cascaded shadow maps, or a tight shadow frustum that follows the viewer.
  - Ambient occlusion: GTAO or SSAO.
  - Indirect bounce: SSGI or equivalent where available.
  - Temporal anti-aliasing.
  - Bloom, for the night lights.
  - AgX or Neutral tone mapping, with exposure that adapts from day to dusk to night.
- **Water:**
  - **Pool:** refraction and reflection, animated ripples, caustics on the pool floor in sun, and a blue tint that deepens with depth.
  - **Spa:** the same water treatment.
  - **Canal:** reflective, with small waves.
- **Day and night:**
  - **Controls:** a time slider covering 24 h, with 05:00 to 22:00 being where people will spend their time.
  - **Date:** presets for 16 Jan (summer) and 21 Jun (winter), plus a custom date.
  - **Timelapse:** a play button.
  - **At dusk:** the `lights.json` lights fade in, with shadows only on a couple of key lights. The LED strips glow, the fire pit flickers (an animated light plus a flame effect) and the house windows glow.
- **Walking:**
  - **First person by default:** 1.65 m eye height, starting on the alfresco looking towards the pool and canal.
  - **Desktop controls:** WASD or the arrow keys, mouse look with pointer lock on click, Shift to run.
  - **Collisions:** a capsule against walls, fences and furniture, using three-mesh-bvh.
  - **Ground:** gravity follows floors and steps (step height up to about 0.25 m), so you can walk down into the sunken lounge. No walking on water.
  - **Mobile:** a virtual joystick plus drag to look.
  - **Other modes:** an orbit/drone mode, and "go to" for the named viewpoints in `cameras.json`.
- **Controls:**
  - **Scenario:** Today vs Proposed.
  - **Options:** the pool roller (shallow, deep, in-ground box, or none) and the kitchen layout (which also switches the gate).
  - **People:** an on/off toggle.
  - **Quality:** Low, Medium, High or Ultra, auto-detected at first.
- **Layout:**
  - **The canvas is the page:** a full-viewport canvas as the first thing you see, with a loading screen and progress bar.
  - **Desktop sidebar:** collapsible, about 380 px, on the right. It holds everything from the current page:
    - the before/after views with the wipe slider
    - the pool roller and kitchen options
    - the lounge through the day
    - after dark
    - the fence comparison
    - the sun plan
    - the notes and assumptions
  - **Mobile:** the same content in a bottom drawer.
  - **Copy:** the existing content and data arrays (`VIEWS`, `ROLLER`, `KITCHEN`, `DAY`, `SUN` and so on) live in `public/model/index.html`. Reuse them.
  - **Design language:** keep it: Barlow Condensed for display, IBM Plex Sans and Mono, and the "drawing sheet" tokens, in light and dark.
  - **Nice to have:** clicking a render in the sidebar flies the 3D view to that viewpoint and time.
- **Performance:** 60 fps on an Apple M-series laptop at High; usable on a recent iPhone at Low.

## How to check your own work

Run `npm run build`, serve `public/` locally, and use Playwright to screenshot. **Never open a visible browser window:** Mike is working on this Mac and windows popping up steal his focus. Launch headless with the GPU (`headless: true`, `channel: 'chromium'` for the new headless mode, args `--enable-unsafe-webgpu --enable-gpu --use-angle=metal --ignore-gpu-blocklist`), and check that you got a real GPU adapter rather than SwiftShader before trusting a screenshot. Don't use `open` or anything else that brings up an app window. Screenshot:

- **Times:** 07:30, 13:00, 17:30, 19:40 and 21:00 on 16 Jan.
- **Viewpoints:** the alfresco, standing in the sunken lounge and at the pool's edge.

Save them under `pool-concepts/review/` (gitignored). Compare them against the Blender renders in `public/model/img/` (for example `05_pool_north_end__proposed.jpg`, `times_15_lounge_from_alfresco_summer_1940.jpg`) and keep iterating until the walkthrough looks photographic rather than "WebGL demo".

When you stop, report:

- what you built and the libraries and versions
- what the export changed
- anything you couldn't do, and why
- the screenshot paths.

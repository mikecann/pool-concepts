// The renders, options and notes from the old /model/ page, rebuilt for a 380 px panel.
// Copy and data arrays (VIEWS, SUN, ROLLER, KITCHEN, DAY ...) are unchanged from that page.
// Every picture can "fly" the 3D view to the same camera, time and options.

export type Fly = { cam: string; scenario?: 'existing' | 'proposed'; date?: string; minutes?: number; roller?: string; kitchen?: string };

const VIEWS = [
  ["01_canal_view", "From the canal", "From a boat about 20 m off the jetty, looking north at the house."],
  ["02_jetty_to_pool", "From the jetty", "End of the jetty, looking back at the new 1.2 m limestone wall and the pump-shed doors."],
  ["03_lawn_to_terrace", "From the lawn steps", "On the lawn steps looking west at the raised terrace, the spa deck and the pool fence."],
  ["04_from_kitchen_door", "Out the kitchen door", "Stepping out of the breakfast-nook slider, under the new skillion."],
  ["16_outdoor_kitchen", "Outdoor kitchen", "From the alfresco table, looking east at the BBQ and pizza oven along the fence."],
  ["05_pool_north_end", "Pool, shallow end", "At the north fence by the gate, looking down the pool to the canal."],
  ["06_sunken_lounge", "In the sunken lounge", "Seated in the lounge, 0.7 m below the deck, looking at the spa steps."],
  ["15_lounge_from_alfresco", "Over the lounge", "Standing at the edge of the alfresco, looking down into the lounge and the fire pit."],
  ["14_spa_to_canal", "Spa deck", "Beside the spa, looking across the pool to the canal."],
  ["13_deep_end_to_house", "Deep end, looking back", "From the canal end of the pool back at the alfresco and the house."],
  ["10_alfresco_corner", "North-west corner", "From the north fence across the pool to the alfresco and lounge."],
  ["12_from_pavilion", "From the pavilion", "On the existing timber deck under the pavilion, looking west."],
  ["09_promenade_west", "Along the canal path", "Walking west on the canal-side paving beside the new wall."],
  ["17_pool_overview", "Pool from above", "Drone height above the house, looking down the length of the pool."],
  ["07_aerial_southwest", "Aerial, south-west", "Drone height over the canal, looking north-east."],
  ["08_aerial_southeast", "Aerial, south-east", "Drone height over the canal, looking north-west."],
];
export const VIEW_NAMES = Object.fromEntries(VIEWS.map(([id, name]) => [id, name]));
const SUN = {
  summer: [["0900", "9:00 am", "Sun 88° (east), 43° up", "The alfresco roof and the house shade the north half of the pool. The south half and the spa are in sun."],
           ["1200", "12:00 pm", "Sun 28° (north-north-east), 76° up", "Nearly overhead. Only the alfresco floor is shaded. The pool, spa and lounge are in full sun."],
           ["1500", "3:00 pm", "Sun 281° (west), 54° up", "From the west. The boundary wall and fence throw a strip of shade along the west edge, and most of the pool is still in sun."],
           ["1800", "6:00 pm", "Sun 256° (west-south-west), 17° up", "Low from the west-south-west. The neighbour's two-storey house shades the whole pool, the alfresco and the lounge."]],
  winter: [["0900", "9:00 am", "Sun 47° (north-east), 16° up", "Low from the north-east. The house and the alfresco roof put the whole pool in shade."],
           ["1200", "12:00 pm", "Sun 6° (north), 33° up", "Midwinter noon. Most of the pool is in sun, with shade across the north end by the fence."],
           ["1500", "3:00 pm", "Sun 321° (north-west), 21° up", "From the north-west. The neighbour's house and the boundary wall shade the whole pool."]],
};
const ROLLER = [
  ["roller_shallow", "Shallow end", `<b>Shallow end, by the north fence</b>
    <p>The easy fit. There's 1.66 m between the coping and the north fence, so the roller takes about 0.7 m and leaves about 1 m to walk past. It's in full view from the alfresco, and the east stand sits about 1 m in front of the north gate, so you step around it.</p>`],
  ["roller_deep", "Deep end", `<b>Deep end, by the canal</b>
    <p>Out of sight from the house, but it doesn't really fit. The new terrace wall runs at an angle behind the deep end, so the strip between the coping and the wall narrows from about 1.4 m at the east corner to about 0.5 m at the west corner. A stand needs about 0.6 m, so the west stand ends up on the edge of the 1.3 m drop to the canal path.</p>
    <p>It would need wall-mounted brackets, a smaller roller, or the pool moved north a little.</p>`],
  ["roller_pit", "In-ground box", `<b>Blanket box under the concourse</b>
    <p>A 4.5 m by 0.5 m box set into the concourse at the shallow end, with a flush lid you walk over (shown here with a stainless edge). Nothing to see or step around, but it has to be designed in before the concourse is poured: it needs depth, a drain, and a crank or a motor. Usually the dearest of the three, so worth asking Bob for a price.</p>`],
];
const KITCHEN = [
  ["kitchen_split", "Split by the gate", `<b>Either side of SK02's gate</b>
    <p>Keeps the gate where Bob drew it. North of the gate, a 2.4 m bench with the pizza oven at the house end and room to prep. South of the gate, a 0.9 m cabinet with the BBQ built in, close to the lounge steps.</p>`],
  ["kitchen_continuous", "One long bench", `<b>One long bench, gate moved south</b>
    <p>Moves the gate about 1 m south, next to the lounge, so the cabinets run unbroken for 3.3 m: oven at the house end, BBQ towards the gate, bench space in between. The most workspace and the tidiest look. The gate then opens beside the lounge steps.</p>`],
  ["kitchen_freestanding", "Freestanding", `<b>Freestanding, no cabinetry</b>
    <p>A BBQ on its own trolley south of the gate and the oven on a small stainless table by the house wall. The cheapest, and you can move things around before committing to built-ins. The least bench space.</p>`],
];
const DAY = {
  summer: [["0730", "7:30 am", "Sun 100° (east), 24° up", "Early sun comes in over the east boundary and lights both benches and most of the lounge floor. The steps and the pool side are still in shade."],
           ["1000", "10:00 am", "Sun 78° (east-north-east), 55° up", "The lounge and both benches are in full sun. The alfresco table is in the shade of the skillion."],
           ["1300", "1:00 pm", "Sun 329° (north-north-west), 75° up", "Nearly overhead. The whole lounge is in sun; the only shade is under the alfresco roof."],
           ["1600", "4:00 pm", "Sun 271° (west), 42° up", "Sun from the west. The pool-side wall shades the steps and about the western third of the floor, and both benches stay in sun."],
           ["1830", "6:30 pm", "Sun 252° (west-south-west), 11° up", "Low sun from the west-south-west. The neighbour's house and the walls put the whole lounge in shade, while the canal and the far bank still catch the light."],
           ["1940", "7:40 pm", "Sun just set, 2° below the horizon", "Twenty minutes after sunset with the lights on. The strips under the bench seats wash the floor, and the step lights and the fire pit do the rest."],
           ["2100", "9:00 pm", "Night, lights on", "Full dark with the same lights. The pool and spa lights show from the lounge."]],
  winter: [["1000", "10:00 am", "Sun 35° (north-east), 24° up", "Low sun from the north-east. The house and the alfresco roof keep the lounge in shade."],
           ["1300", "1:00 pm", "Sun 349° (north), 32° up", "Around midday the sun clears the alfresco roof and lights most of the lounge. This is the warm window for sitting out in winter."],
           ["1530", "3:30 pm", "Sun 315° (north-west), 17° up", "Low in the north-west. The neighbour's house and the boundary wall put the lounge back in shade."]],
};
const DAYV = [["15_lounge_from_alfresco", "Over the lounge"], ["06_sunken_lounge", "In the lounge"], ["04_from_kitchen_door", "Kitchen door"]];
const FV = [["03_lawn_to_terrace", "Lawn steps"], ["12_from_pavilion", "Pavilion"], ["04_from_kitchen_door", "Kitchen door"], ["13_deep_end_to_house", "Deep end"]];
const NIGHTV = [["13_deep_end_to_house", "Deep end"], ["14_spa_to_canal", "Spa deck"], ["16_outdoor_kitchen", "Outdoor kitchen"], ["17_pool_overview", "From above"], ["01_canal_view", "From the canal"]];
// the main renders are 16 Jan at 2:45 pm with the split kitchen and no roller
const RENDER_TIME = { date: "2027-01-16", minutes: 14 * 60 + 45 };
const SEASON_DATE = { summer: "2027-01-16", winter: "2027-06-21" } as const;
const hhmm = (k: string) => Number(k.slice(0, 2)) * 60 + Number(k.slice(2));

const ROLLER_VIEWS = [['17_pool_overview', 'From above'], ['13_deep_end_to_house', 'From the deep end'], ['05_pool_north_end', 'From the north fence']];
const KITCHEN_VIEWS = [['16_outdoor_kitchen', 'Kitchen'], ['10_alfresco_corner', 'North-west corner'], ['12_from_pavilion', 'From the pavilion']];

/** Every image the panel can show (used to check nothing 404s after a sync). */
export function allImageUrls() {
  return [
    ...VIEWS.flatMap(([id]) => [`img/${id}__existing.jpg`, `img/${id}__proposed.jpg`, `img/thumb_${id}.jpg`]),
    ...ROLLER.flatMap(([o]) => ROLLER_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...KITCHEN.flatMap(([o]) => KITCHEN_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...NIGHTV.map(([v]) => `img/night_${v}_dusk.jpg`),
    ...Object.entries(DAY).flatMap(([season, list]) => list.flatMap(([key]) => DAYV.map(([v]) => `img/times_${v}_${season}_${key}.jpg`))),
    ...FV.flatMap(([id]) => [`img/${id}__proposed.jpg`, `img/${id}__glass.jpg`]),
    ...Object.entries(SUN).flatMap(([season, list]) => list.map(([key]) => `img/sun_${season}_${key}.jpg`)),
    'img/15_lounge_from_alfresco__proposed.jpg',
  ];
}

const HTML = /* html */ `
<section class="block" aria-label="Views">
  <div class="vhead">
    <div class="vtitle">
      <span class="label" id="vnum">View 01</span>
      <span class="name" id="vname">From the canal</span>
    </div>
    <div class="modes" role="group" aria-label="What to show">
      <button id="m-today" aria-pressed="false">Today</button>
      <button id="m-compare" aria-pressed="true">Both</button>
      <button id="m-proposed" aria-pressed="false">New</button>
    </div>
  </div>
  <div class="stage" id="stage">
    <img id="img-today" alt="">
    <img id="img-proposed" class="top" alt="">
    <div class="handle" id="handle" aria-hidden="true"></div>
    <span class="tag l" id="tag-l">Today</span>
    <span class="tag r" id="tag-r">Proposed</span>
    <button class="fly" id="v-fly" type="button">Stand here</button>
  </div>
  <span class="desc hint" id="vdesc"></span>
  <p class="hint">Drag across the picture to wipe between today and the proposed design. Renders are 16 Jan at 2:45 pm.</p>
  <div class="strip" id="strip" role="list"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>Where the pool roller goes</h2>
  <p>A stand-mounted roller sized for this pool: 4.6 m long, the blanket rolls up to about 0.42 m across, and the tube sits about 0.5 m up, so the roll clears the coping by about a hand's width.</p>
</div>
<section class="block" aria-label="Pool roller options">
  <div class="fstage"><img id="r-img" alt=""><span class="tag l" id="r-tag"></span><button class="fly" id="r-fly" type="button">Stand here</button></div>
  <div class="chips" role="group" aria-label="Roller position" id="r-opts"></div>
  <div class="chips" id="r-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="r-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>BBQ and pizza oven</h2>
  <p>Along the alfresco's east fence, between the house wall and the lounge. Charcoal cabinets 900 mm high with a pale concrete top, a 900 mm built-in BBQ and a dome oven about 0.73 m wide.</p>
</div>
<section class="block" aria-label="Kitchen options">
  <div class="fstage"><img id="k-img" alt=""><span class="tag l" id="k-tag"></span><button class="fly" id="k-fly" type="button">Stand here</button></div>
  <div class="chips" role="group" aria-label="Kitchen layout" id="k-opts"></div>
  <div class="chips" id="k-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="k-note"></div>
</section>

<div class="section-head">
  <span class="label">Where we sit</span>
  <h2>The lounge through the day</h2>
  <p>The same three views at different times, with the sun calculated for Geographe. After sunset the lighting is switched on.</p>
</div>
<section class="block" aria-label="Time of day">
  <div class="fstage"><img id="d-img" alt=""><span class="tag l" id="d-tag"></span><button class="fly" id="d-fly" type="button">Stand here</button></div>
  <div class="chips" role="group" aria-label="Season">
    <button id="d-summer" aria-pressed="true">Summer · 16 Jan</button>
    <button id="d-winter" aria-pressed="false">Winter · 21 Jun</button>
  </div>
  <div class="chips mono" id="d-times" role="group" aria-label="Time of day"></div>
  <div class="chips" id="d-views" role="group" aria-label="Viewpoint"></div>
  <div class="sunread">
    <span class="big" id="d-time"></span>
    <span class="mono" id="d-pos"></span>
    <p id="d-note" class="hint"></p>
  </div>
</section>

<div class="section-head">
  <span class="label">Lighting</span>
  <h2>After dark</h2>
  <p>Mid-January, twenty minutes after sunset, with every light on. Warm white (about 2700 K) everywhere except the pool and spa. The lounge itself is in the day series above at 7:40 pm and 9:00 pm.</p>
</div>
<section class="block" aria-label="After dark">
  <div class="fstage"><img id="n-img" alt=""><span class="tag l" id="n-tag">Dusk, 7:40 pm</span><button class="fly" id="n-fly" type="button">Stand here</button></div>
  <div class="chips" id="n-views" role="group" aria-label="Viewpoint"></div>
  <ul class="legend">
    <li>LED strip tucked under the front of every bench seat, washing the lounge floor</li>
    <li>LED strip under each step nosing, down into the lounge and up to the spa deck</li>
    <li>Gas fire pit in a corten bowl, about 0.94 m across</li>
    <li>Five flush marker lights in the concourse between the pool and the lounge</li>
    <li>Small brick lights in the new limestone wall, facing the canal path</li>
    <li>Four uplights washing the west boundary wall beside the pool</li>
    <li>One light in the pool and one in the spa, and downlights in the skillion</li>
  </ul>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>Pool fence: perforated or glass</h2>
  <p>The 7 Oct estimate prices charcoal perforated aluminium, 1.2 m high with two gates. SK02 and the scope notes still say frameless glass, which the 21 Sep estimate had at about $630 more.</p>
</div>
<section class="block" aria-label="Pool fence">
  <div class="fstage"><img id="f-img" alt=""><span class="tag l" id="f-tag">Perforated aluminium</span></div>
  <p class="hint">From the lawn and the pavilion, glass keeps the pool and spa in view. Perforated panels read as a dark screen with the shapes behind just showing through. The walkthrough shows the perforated fence.</p>
  <div class="chips" role="group" aria-label="Fence type">
    <button id="f-perf" aria-pressed="true">Perforated</button>
    <button id="f-glass" aria-pressed="false">Glass</button>
  </div>
  <div class="chips" id="f-views" role="group" aria-label="Viewpoint"></div>
</section>

<div class="section-head">
  <span class="label">Sun study</span>
  <h2>Where the sun lands</h2>
  <p>Plan view of the proposed design, north up, with shadows from the house, the neighbours, the new skillion and the fences. The neighbour's house is a simplified shape, so treat the late-afternoon shade edge as approximate.</p>
</div>
<section class="block" aria-label="Sun plan">
  <div class="plan"><img id="plan-img" alt="Plan view of the backyard showing shadows"><span class="north">N ↑</span></div>
  <div class="chips" role="group" aria-label="Season">
    <button id="s-summer" aria-pressed="true">Summer · 16 Jan</button>
    <button id="s-winter" aria-pressed="false">Winter · 21 Jun</button>
  </div>
  <div class="chips mono" id="times" role="group" aria-label="Time of day"></div>
  <div class="sunread">
    <span class="big" id="sun-time">3:00 pm</span>
    <span class="mono" id="sun-pos"></span>
    <p id="sun-note" class="hint"></p>
  </div>
  <button class="linkbtn" id="sun-sync" type="button">Set the walkthrough to this time</button>
</section>

<div class="section-head">
  <span class="label">Notes</span>
  <h2>How accurate it is</h2>
  <p>The backyard as it is today, and with Bob Bruce's SK02 pool, spa, sunken lounge and alfresco built in. Levels come from the Denada feature survey, the design from SK02, finishes from Naturaliste's estimate QU-597.</p>
</div>
<section class="block" aria-label="Accuracy">
  <dl class="facts mono">
    <dt>Survey</dt><dd>Denada 25475, 20 Jul 2026</dd>
    <dt>Design</dt><dd>Bob Bruce SK02, 30 Jul 2026</dd>
    <dt>Finishes</dt><dd>Estimate QU-597, 7 Oct 2026</dd>
  </dl>
  <table>
    <thead><tr><th>Part</th><th>From</th><th>Accuracy</th></tr></thead>
    <tbody>
      <tr><td>Boundaries, walls, steps, paving, jetty, canal wall, levels</td><td>Denada survey DWG, 3D lines and spot heights</td><td>A few cm</td></tr>
      <tr><td>Pool, spa, lounge, deck, new walls, fence, skillion outline</td><td>SK02, lined up on the survey using the 99 survey points still in Bob's drawing</td><td>0 mm offset, as good as SK02</td></tr>
      <tr><td>House walls, doors, eaves, roof</td><td>Plunkett Homes plans, 2005</td><td>Within 2 cm of the surveyed pavilion piers</td></tr>
      <tr><td>Boundary walls and fences, planters</td><td>Survey wall tops plus the Dec 2025 LiDAR scan</td><td>Scan fits the survey to 4 cm</td></tr>
      <tr><td>Neighbours</td><td>Drone photo matched to the survey, simple shapes</td><td>Placed to about 0.3 m</td></tr>
      <tr><td>The canal, the far bank and the houses around it</td><td>Overture building outlines lined up on the Landgate cadastre, the canal edge traced from 2025 aerial imagery, colours and roof types from your photos</td><td>Outlines to about 0.5 m, heights estimated from storeys</td></tr>
    </tbody>
  </table>
  <div class="levels">
    <span class="mono">2.47</span><span>House floor (AHD)</span>
    <span class="mono">2.37</span><span>Pool deck, alfresco, spa deck: Bob's RL 0.00</span>
    <span class="mono">1.78</span><span>Lawn today</span>
    <span class="mono">1.67</span><span>Sunken lounge floor (RL −0.70)</span>
    <span class="mono">1.27</span><span>Pump-shed floor (RL −1.10)</span>
    <span class="mono">1.08</span><span>Canal-side paving</span>
    <span class="mono">0.21</span><span>Water level on survey day</span>
  </div>
</section>

<section class="block" aria-label="Assumptions">
  <h2>Assumed where the documents are silent</h2>
  <ul class="assume">
    <li>Bob's RL 0.00 is taken as AHD 2.37, the current rear paving. No drawing states the conversion.</li>
    <li>The spa rim sits flush with the deck, as Mike asked Bob on 30 Jul. The estimate's wording (a −1100 platform versus a solid deck) still conflicts.</li>
    <li>The shallow end is at the north, by the alfresco. The corner steps go on the bench side, along the boundary.</li>
    <li>The pool fence is charcoal perforated aluminium, per the 7 Oct estimate. SK02 and the scope notes still say glass.</li>
    <li>The skillion matches the existing roof's pale grey and has a flat white ceiling. The concept renders showed charcoal.</li>
    <li>Finishes: <span class="swatch" style="background:#EFEDE8"></span>light exposed aggregate, <span class="swatch" style="background:#99AFC9"></span>Mondo Grey Sparkle shell, <span class="swatch" style="background:#C99A70"></span>warm composite decking, <span class="swatch" style="background:#EEE3CC"></span>cream limestone facebrick, white crushed limestone in the lounge.</li>
    <li>The only new planting is a raised planter in the lawn corner beside the spa deck: limestone to match the walls, 450 mm high and about 1 m wide, with low grasses and shrubs. There's no planting plan yet.</li>
    <li>The east fence gate sits where SK02 has it, beside the pavilion column. The "one long bench" kitchen moves it about 1 m south.</li>
    <li>Bench backs lean back about 20° with a deeper seat (900 mm overall) and cushions. SK02 doesn't detail them.</li>
    <li>The figures are 1.73 m adults and a 1.2 m child, so you can judge the sizes.</li>
  </ul>
</section>

<footer>
  <span>Model files and the scripts that rebuild it are in the-pool repo under <span class="mono">model/</span>. Change a level or a dimension in <span class="mono">compile_site.py</span>, rebuild, and every view renders again.</span>
  <span>The houses around the canal are in the right places with the right roof colours, but they are simple shapes. The tree line behind the far bank is generic. Aerial imagery: Esri, Vantor, Earthstar Geographics.</span>
  <span class="theme-row"><span>Sheet colours</span><span class="chips" id="theme" role="group" aria-label="Panel colours">
    <button data-theme="auto">Auto</button><button data-theme="light">Light</button><button data-theme="dark">Dark</button></span></span>
</footer>`;

export function buildGallery(root: HTMLElement, fly: (f: Fly) => void) {
  root.innerHTML = HTML;
  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id)!;
  const img = (id: string) => $(id) as HTMLImageElement;

  // ---------- load images before they're clicked ----------
  const warmed = new Set<string>();
  const warm = (urls: string[]) => urls.forEach(u => { if (warmed.has(u)) return; warmed.add(u); const i = new Image(); i.decoding = 'async'; i.src = u; });
  const scroller = root.closest('.panel-scroll') as HTMLElement | null;
  const warmNear = (el: HTMLElement, urls: string[]) => {
    const ob = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { warm(urls); ob.disconnect(); } }, { root: scroller, rootMargin: '700px 0px' });
    ob.observe(el);
  };
  const chips = (box: HTMLElement, items: string[][], sel: number, onPick: (i: number) => void) => {
    box.innerHTML = '';
    items.forEach((it, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = it[1];
      b.setAttribute('aria-pressed', String(i === sel)); b.onclick = () => onPick(i); box.appendChild(b);
    });
  };

  // ---------- before / after ----------
  let current = 0, mode = 'compare', split = 50;
  const setSplit = (v: number, remember = true) => { $('stage').style.setProperty('--split', v + '%'); if (remember) split = v; };
  const applyMode = () => {
    ['today', 'compare', 'proposed'].forEach(m => $('m-' + m).setAttribute('aria-pressed', String(m === mode)));
    const top = $('img-proposed');
    top.hidden = mode === 'today';
    $('handle').hidden = mode !== 'compare';
    $('tag-l').hidden = mode === 'proposed';
    $('tag-r').hidden = mode === 'today';
    setSplit(mode === 'proposed' ? 0 : split, false);
  };
  const show = (i: number) => {
    current = i;
    const [id, name, desc] = VIEWS[i];
    img('img-today').src = `img/${id}__existing.jpg`; img('img-today').alt = `${name}, today`;
    img('img-proposed').src = `img/${id}__proposed.jpg`; img('img-proposed').alt = `${name}, with the proposed pool and alfresco`;
    $('vnum').textContent = 'View ' + id.slice(0, 2);
    $('vname').textContent = name;
    $('vdesc').textContent = desc;
    root.querySelectorAll('.thumb').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };
  VIEWS.forEach(([id, name], i) => {
    const b = document.createElement('button');
    b.className = 'thumb'; b.type = 'button'; b.setAttribute('role', 'listitem');
    b.innerHTML = `<img src="img/thumb_${id}.jpg" alt="" loading="lazy"><span><b>${id.slice(0, 2)}</b>${name}</span>`;
    b.onclick = () => show(i);
    $('strip').appendChild(b);
  });
  const stage = $('stage');
  let dragging = false;
  const at = (e: PointerEvent) => { const r = stage.getBoundingClientRect(); return Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); };
  stage.addEventListener('pointerdown', e => { if (mode !== 'compare' || (e.target as HTMLElement).closest('.fly')) return; dragging = true; stage.setPointerCapture(e.pointerId); setSplit(at(e)); });
  stage.addEventListener('pointermove', e => { if (dragging) setSplit(at(e)); });
  ['pointerup', 'pointercancel'].forEach(t => stage.addEventListener(t, () => (dragging = false)));
  $('m-today').onclick = () => { mode = 'today'; applyMode(); };
  $('m-compare').onclick = () => { mode = 'compare'; applyMode(); };
  $('m-proposed').onclick = () => { mode = 'proposed'; applyMode(); };
  $('v-fly').onclick = () => fly({ cam: VIEWS[current][0], scenario: mode === 'today' ? 'existing' : 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_split' });

  // ---------- option pickers ----------
  type Picker = { opts: string[][]; optBox?: HTMLElement; viewBox: HTMLElement; img: string; tag: string; note?: string; views: string[][];
    src: (o: string, v: string) => string; onFly: (o: string, v: string) => void; flyBtn: string };
  const picker = (cfg: Picker) => {
    const st = { o: 0, v: 0 };
    const render = () => {
      if (cfg.optBox) chips(cfg.optBox, cfg.opts, st.o, i => { st.o = i; render(); });
      chips(cfg.viewBox, cfg.views, st.v, i => { st.v = i; render(); });
      const o = cfg.opts[st.o], v = cfg.views[st.v];
      img(cfg.img).src = cfg.src(o[0], v[0]);
      img(cfg.img).alt = `${v[1]}: ${o[1]}`;
      $(cfg.tag).textContent = o[1];
      if (cfg.note) $(cfg.note).innerHTML = o[2];
    };
    $(cfg.flyBtn).onclick = () => cfg.onFly(cfg.opts[st.o][0], cfg.views[st.v][0]);
    render();
    warmNear($(cfg.img), cfg.opts.flatMap(o => cfg.views.map(v => cfg.src(o[0], v[0]))));
  };
  picker({ opts: ROLLER, optBox: $('r-opts'), viewBox: $('r-views'), img: 'r-img', tag: 'r-tag', note: 'r-note', flyBtn: 'r-fly',
    views: ROLLER_VIEWS,
    src: (o, v) => `img/options_${v}_${o}.jpg`,
    onFly: (o, v) => fly({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: o, kitchen: 'kitchen_split' }) });
  picker({ opts: KITCHEN, optBox: $('k-opts'), viewBox: $('k-views'), img: 'k-img', tag: 'k-tag', note: 'k-note', flyBtn: 'k-fly',
    views: KITCHEN_VIEWS,
    src: (o, v) => `img/options_${v}_${o}.jpg`,
    onFly: (o, v) => fly({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: o }) });
  picker({ opts: [['dusk', 'Dusk, 7:40 pm']], viewBox: $('n-views'), img: 'n-img', tag: 'n-tag', flyBtn: 'n-fly', views: NIGHTV,
    src: (o, v) => `img/night_${v}_${o}.jpg`,
    onFly: (_o, v) => fly({ cam: v, scenario: 'proposed', date: '2027-01-16', minutes: 19 * 60 + 40, roller: 'none', kitchen: 'kitchen_split' }) });

  // ---------- the lounge through the day ----------
  const D = { season: 'summer' as keyof typeof DAY, t: 2, v: 0 };
  const renderDay = () => {
    (['summer', 'winter'] as const).forEach(k => $('d-' + k).setAttribute('aria-pressed', String(k === D.season)));
    const list = DAY[D.season]; if (D.t >= list.length) D.t = list.length - 1;
    chips($('d-times'), list, D.t, i => { D.t = i; renderDay(); });
    chips($('d-views'), DAYV, D.v, i => { D.v = i; renderDay(); });
    const [key, label, pos, note] = list[D.t];
    img('d-img').src = `img/times_${DAYV[D.v][0]}_${D.season}_${key}.jpg`;
    img('d-img').alt = `${DAYV[D.v][1]}, ${D.season} at ${label}`;
    $('d-tag').textContent = (D.season === 'summer' ? '16 Jan, ' : '21 Jun, ') + label;
    $('d-time').textContent = label; $('d-pos').textContent = pos; $('d-note').textContent = note;
  };
  $('d-summer').onclick = () => { D.season = 'summer'; renderDay(); };
  $('d-winter').onclick = () => { D.season = 'winter'; renderDay(); };
  $('d-fly').onclick = () => fly({ cam: DAYV[D.v][0], scenario: 'proposed', date: SEASON_DATE[D.season], minutes: hhmm(DAY[D.season][D.t][0]), roller: 'none', kitchen: 'kitchen_split' });
  renderDay();
  warmNear($('d-img'), Object.entries(DAY).flatMap(([season, list]) => list.flatMap(([key]) => DAYV.map(([v]) => `img/times_${v}_${season}_${key}.jpg`))));

  // ---------- fence ----------
  let fType = 'perf', fView = 0;
  const renderFence = () => {
    $('f-perf').setAttribute('aria-pressed', String(fType === 'perf'));
    $('f-glass').setAttribute('aria-pressed', String(fType === 'glass'));
    chips($('f-views'), FV, fView, i => { fView = i; renderFence(); });
    const id = FV[fView][0];
    img('f-img').src = `img/${id}__${fType === 'perf' ? 'proposed' : 'glass'}.jpg`;
    img('f-img').alt = `${FV[fView][1]} view with a ${fType === 'perf' ? 'perforated aluminium' : 'frameless glass'} pool fence`;
    $('f-tag').textContent = fType === 'perf' ? 'Perforated aluminium' : 'Frameless glass';
  };
  $('f-perf').onclick = () => { fType = 'perf'; renderFence(); };
  $('f-glass').onclick = () => { fType = 'glass'; renderFence(); };
  renderFence();
  warmNear($('f-img'), FV.flatMap(([id]) => [`img/${id}__proposed.jpg`, `img/${id}__glass.jpg`]));

  // ---------- sun plan ----------
  let season: keyof typeof SUN = 'summer', tIdx = 2;
  const renderSun = () => {
    (['summer', 'winter'] as const).forEach(s => $('s-' + s).setAttribute('aria-pressed', String(s === season)));
    const list = SUN[season]; if (tIdx >= list.length) tIdx = list.length - 1;
    chips($('times'), list, tIdx, i => { tIdx = i; renderSun(); });
    const [key, label, pos, note] = list[tIdx];
    img('plan-img').src = `img/sun_${season}_${key}.jpg`;
    img('plan-img').alt = `Plan view, ${season} at ${label}`;
    $('sun-time').textContent = label; $('sun-pos').textContent = pos; $('sun-note').textContent = note;
  };
  $('s-summer').onclick = () => { season = 'summer'; renderSun(); };
  $('s-winter').onclick = () => { season = 'winter'; renderSun(); };
  $('sun-sync').onclick = () => fly({ cam: '', date: SEASON_DATE[season], minutes: hhmm(SUN[season][tIdx][0]) });
  renderSun();
  warmNear($('plan-img'), Object.entries(SUN).flatMap(([s, list]) => list.map(([key]) => `img/sun_${s}_${key}.jpg`)));

  // ---------- sheet colours ----------
  const themeBtns = [...root.querySelectorAll<HTMLButtonElement>('#theme button')];
  const setTheme = (t: string) => {
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    themeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === t)));
    try { localStorage.setItem('pool-theme', t); } catch { /* private mode */ }
  };
  themeBtns.forEach(b => (b.onclick = () => setTheme(b.dataset.theme!)));
  let theme = 'auto';
  try { theme = localStorage.getItem('pool-theme') || 'auto'; } catch { /* private mode */ }
  setTheme(theme);

  show(0); applyMode();
  const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 2500));
  idle(() => warm(VIEWS.flatMap(([id]) => [`img/${id}__proposed.jpg`, `img/${id}__existing.jpg`])));
}

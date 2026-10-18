// The renders, options and notes from the old /model/ page, rebuilt for a 380 px panel.
// Copy and data arrays (VIEWS, SUN, ROLLER, KITCHEN, DAY ...) are unchanged from that page.
// Every picture can "fly" the 3D view to the same camera, time and options.

import { VIEWS } from './views';
import { BFENCE_CHOICES, NFENCE_CHOICES, PASSAGE_CHOICES, PIER_CHOICES, PLAY_CHOICES } from './choices';

export type Fly = { cam: string; scenario?: 'existing' | 'proposed'; date?: string; minutes?: number; roller?: string; kitchen?: string;
  post?: string; pump?: string; play?: string; pier?: string; nfence?: string; passage?: string; bfence?: string;
  /** Round 19: which model the picture shows; SK02's ('a') unless it's a Layout B render. */ layout?: 'a' | 'b' };


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
    <p>Standard roller at the deep end. At the west corner there's only 0.5 m from the coping to the drop to the lawn (0.24 m of paving plus the wall cap), so the stands sit half on the coping and half on the wall cap. It fits, just.</p>`],
  ["roller_pit", "In-ground box", `<b>Blanket box at the deep end</b>
    <p>In-ground box at the deep end, between the pool wall and the terrace wall, under a lid flush with the coping. Nothing to step around, but Bob has to build it in, and it only just fits at the west corner.</p>`],
  ["roller_pit_shallow", "In-ground box, shallow end", `<b>Blanket box at the shallow end</b>
    <p>The same in-ground box behind the shallow-end wall, lids flush with the coping. 1.44 m clear to the north fence as drawn (2.94 m with the fence moved), so there's room to walk behind it with the lids up.</p>`],
  ["roller_rollon_shallow", "Roll-on cover, shallow end", `<b>Roll-on cover, rolled at the shallow end</b>
    <p>Australian Spa Covers' Roll-On: a soft, padded, segmented cover with no frame or roller. It rolls off piece by piece and sits as a 0.8 m roll on the coping, its pool side at the water's edge. In the walkthrough, press E by the pool to roll it on or off.</p>`],
  ["roller_rollon_deep", "Roll-on cover, deep end", `<b>Roll-on cover, rolled at the deep end</b>
    <p>The same roll-on cover parked at the canal end.</p>`],
  ["roller_lowpro", "Low-profile, deep end", `<b>Low-profile roller at the deep end</b>
    <p>A low-profile roller: short stands with the roll just above the coping, so it fits the narrow strip at the deep end and stays below the view to the canal.</p>`],
  ["roller_channel", "Open channel, deep end", `<b>Open channel at the deep end</b>
    <p>An open, concrete-lined trench 0.42 m deep behind the deep-end coping, with a <a href="https://daisypoolcovers.com.au/pool-rollers/stationary/sq-pool-roller" target="_blank" rel="noopener">Daisy SQ</a> roller standing in it and no lid. A standard roller doesn't fit: its stands need 0.6 m of floor and it would need a 0.75 m trench. The open trench is a trip hazard beside the coping and collects leaves and water, so it needs a drain; a grate or a short rail may come later.</p>`],
];
const KITCHEN = [
  ["kitchen_split", "Split by the gate", `<b>Either side of SK02's gate</b>
    <p>Keeps the gate where Bob drew it. North of the gate, a 2.4 m bench with the pizza oven at the house end and room to prep. South of the gate, a 0.9 m cabinet with the BBQ built in, close to the lounge steps.</p>`],
  ["kitchen_continuous", "One long bench", `<b>One long bench, gate moved south</b>
    <p>Moves the gate about 1 m south, next to the lounge, so the cabinets run unbroken for 3.3 m: oven at the house end, BBQ towards the gate, bench space in between. The most workspace and the tidiest look. The gate then opens beside the lounge steps.</p>`],
  ["kitchen_freestanding", "Freestanding", `<b>Freestanding, no cabinetry</b>
    <p>A BBQ on its own trolley south of the gate and the oven on a small stainless table by the house wall. The cheapest, and you can move things around before committing to built-ins. The least bench space.</p>`],
  ["kitchen_none", "No outdoor kitchen", `<b>No outdoor kitchen</b>
    <p>No kitchen at all: the alfresco stays open, and the gate stays where SK02 has it.</p>`],
  ["kitchen_lounge", "Facing the lounge", `<b>A bench facing the lounge</b>
    <p>Mike and Kelsie's idea: a 2.5 m bench along the sunken lounge's north edge, at alfresco level, its back to the lounge. You cook in the alfresco looking over the lounge to the canal, BBQ in the middle and the dome oven at the east end. The walk from the kitchen door to the pool and spa stays open. It clashes with the two-post roof, whose east post stands in the bench. (Shown with SK02's single post; there's no render from the pavilion yet.)</p>`],
];
const POSTS = [
  ["post_as_drawn", "As drawn (SK02)", `<b>SK02's single post</b>
    <p>One 100 mm post in the middle of the alfresco with a beam along it. 1.35 m to the pool coping and 0.27 m to the lounge coping.</p>`],
  ["post_corner", "Corner post", `<b>One post at the south-west corner</b>
    <p>A beam along the west edge to the house, and a 310 mm beam along the south side to a short post on the pavilion's pier. The most open alfresco, with the longest beam; an engineer has to say whether the pier can take a second post.</p>`],
  ["post_west", "West edge, cantilevered", `<b>One post on the west edge</b>
    <p>The west beam runs over the post and cantilevers 1.65 m to the south edge, so nothing stands on the side facing the pool and lounge. The post sits about where you'd step from the alfresco onto the coping, and the cantilevered corner is the part most exposed to wind uplift.</p>`],
  ["post_two", "Two posts", `<b>Two posts on the south side</b>
    <p>Shorter spans than the corner post, with nothing on the pier. Two posts along the lounge's edge, though: the west one 0.11 m from the lounge coping, the east one 1.0 m from the benchtops.</p>`],
  ["post_corner_steps", "Corner post, steps moved", `<b>A corner post, with the lounge steps moved</b>
    <p>One post right at the roof's south-west corner, standing on the lounge's north wall, with only the west-edge beam. The lounge's north-west steps move 0.45 m east so the flight is clear of the post, and the north bench gets about 0.5 m shorter. The post is 0.5 m from the pool coping. With the lounge kitchen, its west end sits at the head of the moved steps, leaving 0.77 m of the flight open.</p>`],
];
const PUMP = [
  ["pump_doors", "Slatted doors", `<b>Slatted doors</b>
    <p>A pair of slatted doors in a charcoal frame, opening out onto the promenade. Inside: 1.94 x 1.04 m with 0.96 m headroom (you kneel), the sand filter, pool and spa pumps, the blower and the chlorinator. The filter's valve is only 0.18 m under the joists, so the deck needs an access hatch over it.</p>`],
  ["pump_open", "Open bay", `<b>Open bay</b>
    <p>The same 1.7 m wide, 0.88 m high opening with no doors, under a galvanised angle lintel.</p>`],
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
const NIGHTV = [["13_deep_end_to_house", "Deep end"], ["14_spa_to_canal", "Spa deck"], ["16_outdoor_kitchen", "Outdoor kitchen"], ["17_pool_overview", "From above"], ["01_canal_view", "From the canal"]];
// the main renders are 16 Jan at 2:45 pm with no kitchen and no roller
const RENDER_TIME = { date: "2027-01-16", minutes: 14 * 60 + 45 };
const SEASON_DATE = { summer: "2027-01-16", winter: "2027-06-21" } as const;
const hhmm = (k: string) => Number(k.slice(0, 2)) * 60 + Number(k.slice(2));

const ROLLER_VIEWS = [['17_pool_overview', 'From above'], ['13_deep_end_to_house', 'From the deep end'], ['05_pool_north_end', 'From the north fence']];
const PIER = PIER_CHOICES.map(c => [c.value, c.title, `<b>${c.title}</b><p>${c.note}</p>`]);
// the play area renders come with the passage surface too: options_<view>_<play>_<pavers|aggregate>
const PLAY = PLAY_CHOICES.flatMap(c => PASSAGE_CHOICES.map(ps => [`${c.value}_${ps.value.replace('passage_', '')}`, `${c.title.replace('Play area ', '')}, ${ps.title.toLowerCase()}`,
  `<b>${c.title}</b><p>${c.note}</p><b>${ps.title}</b><p>${ps.note}</p>`, c.value, ps.value]));
const PLAY_VIEWS = [['19_play_area', 'Up the side passage'], ['21_play_area_north', 'From the play area'], ['20_pool_north_seating', 'From the spa deck']];
const playSrc = (o: string, v: string) => `img/options_${v}_${o}.jpg`;
const PIER_VIEWS = [['18_pier_fence', 'At the pier'], ['12_from_pavilion', 'From the pavilion']];
// the side passage: north fence position x passage surface, as render.py names them (side_<fence>_<surface>)
const SIDE = NFENCE_CHOICES.flatMap(f => PASSAGE_CHOICES.map(p => [
  `side_${f.value.replace('nfence_', '')}_${p.value.replace('passage_', '')}`, `${f.title}, ${p.title.toLowerCase()}`,
  `<b>North fence ${f.title.toLowerCase()}</b><p>${f.note}</p><b>${p.title}</b><p>${p.note}</p>`, f.value, p.value]));
const SIDE_VIEWS = [['20_pool_north_seating', 'From the spa deck'], ['19_play_area', 'Up the side passage'], ['17_pool_overview', 'From above']];
const POST_VIEWS = [['10_alfresco_corner', 'North-west corner'], ['04_from_kitchen_door', 'Kitchen door'], ['15_lounge_from_alfresco', 'Over the lounge']];
const PUMP_VIEWS = [['22_pump_room', 'Inside'], ['09_promenade_west', 'From the promenade']];
// the lounge kitchen's renders come with the post layout: show it with SK02's post
const kitchenSrc = (o: string, v: string) => `img/options_${v}_${o === 'kitchen_lounge' ? 'kitchen_lounge_post_as_drawn' : o}.jpg`;
// Round 18b: the dusk and times-of-day images are being re-rendered without the kitchen; until they're synced they
// show the old split kitchen, so they say so and open in 3D with it. Set these to false once the new images are in.
const OLD_KITCHEN = { day: false, dusk: false };
const oldKitchenNote = '<p class="hint stale">The kitchen in these pictures is the old split-by-the-gate layout; new ones without it are on the way.</p>';
const KITCHEN_VIEWS = [['16_outdoor_kitchen', 'Kitchen'], ['10_alfresco_corner', 'North-west corner'], ['12_from_pavilion', 'From the pavilion']];

// Round 19: Layout B's renders (all with the corner post), each beside SK02's layout from the same camera: with the
// corner post too where that render exists (10, 06, 15), otherwise SK02's own post
const LAYOUTB_VIEWS = [['10_alfresco_corner', 'North-west corner'], ['06_sunken_lounge', 'In the lounge'], ['15_lounge_from_alfresco', 'Over the lounge'],
  ['05_pool_north_end', 'Pool, north end'], ['20_pool_north_seating', 'From the spa deck'], ['13_deep_end_to_house', 'Deep end to the house'],
  ['17_pool_overview', 'Pool from above'], ['07_aerial_southwest', 'From the air'], ['22_pump_room', 'Pump room']];
const A_CORNER = new Set(['10_alfresco_corner', '06_sunken_lounge', '15_lounge_from_alfresco']);
const layoutASrc = (v: string) => (A_CORNER.has(v) ? `img/options_${v}_post_corner_steps.jpg` : `img/${v}__proposed.jpg`);

// Round 21: Layout B's option renders (layoutb_<cam>_<option>.jpg). Each sits beside SK02's render of the same option
// and camera (options_<cam>_<option>.jpg) in that option's section; this is the list of the ones that exist.
const LAYOUTB_OPTION_RENDERS = new Set([
  ...['05_pool_north_end', '07_aerial_southwest', '13_deep_end_to_house', '17_pool_overview'].flatMap(v => BFENCE_CHOICES.map(c => `${v}_${c.value}`)),
  ...['05_pool_north_end', '13_deep_end_to_house', '17_pool_overview'].map(v => `${v}_roller_channel`),
  ...['10_alfresco_corner', '15_lounge_from_alfresco'].flatMap(v => ['post_as_drawn', 'post_corner', 'post_corner_steps', 'post_two', 'post_west'].map(o => `${v}_${o}`)),
  ...['15_lounge_from_alfresco', '16_outdoor_kitchen'].flatMap(v => ['post_as_drawn', 'post_corner_steps'].map(o => `${v}_kitchen_lounge_${o}`)),
  ...['12_from_pavilion', '16_outdoor_kitchen', '18_pier_fence'].map(v => `${v}_pier_straight_edge`),
  '22_pump_room_pump_doors', '22_pump_room_pump_open',
  // Round 22: the kitchens (the lounge kitchen's plain name is with SK02's post, as A's pictures are)
  ...['10_alfresco_corner', '16_outdoor_kitchen'].flatMap(v => ['kitchen_split', 'kitchen_continuous', 'kitchen_freestanding', 'kitchen_none', 'kitchen_lounge'].map(o => `${v}_${o}`)),
].map(k => `layoutb_${k}.jpg`));
/** Layout B's file for an SK02 option render's URL, or '' if B has no render of it. */
const layoutBName = (aUrl: string) => {
  const n = aUrl.split('/').pop()!, b = n.startsWith('options_') ? 'layoutb_' + n.slice(8) : '';
  // A's lounge-kitchen pictures are named with their post; B's may not be
  for (const c of [b, b.replace('_post_as_drawn.jpg', '.jpg')]) if (LAYOUTB_OPTION_RENDERS.has(c)) return c;
  return '';
};
const BFENCE = BFENCE_CHOICES.map(c => [c.value, c.title, `<b>${c.title}</b><p>${c.note}</p>`]);
const BFENCE_VIEWS = [['13_deep_end_to_house', 'From the deep end'], ['05_pool_north_end', 'From the north fence'], ['17_pool_overview', 'From above'], ['07_aerial_southwest', 'From the air']];

/** Every image the panel can show (used to check nothing 404s after a sync). */
export function allImageUrls() {
  return [
    ...VIEWS.flatMap(([id]) => [`img/${id}__existing.jpg`, `img/${id}__proposed.jpg`, `img/thumb_${id}.jpg`]),
    ...ROLLER.flatMap(([o]) => ROLLER_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...KITCHEN.flatMap(([o]) => KITCHEN_VIEWS.map(([v]) => kitchenSrc(o, v))),
    ...POSTS.flatMap(([o]) => POST_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...PUMP.flatMap(([o]) => PUMP_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...PIER.flatMap(([o]) => PIER_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...PLAY.flatMap(([o]) => PLAY_VIEWS.map(([v]) => playSrc(o, v))),
    ...SIDE.flatMap(([o]) => SIDE_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...LAYOUTB_VIEWS.flatMap(([v]) => [layoutASrc(v), `img/layoutb_${v}.jpg`]),
    ...BFENCE.flatMap(([o]) => BFENCE_VIEWS.map(([v]) => `img/options_${v}_${o}.jpg`)),
    ...[...LAYOUTB_OPTION_RENDERS].map(n => `img/${n}`),
    ...NIGHTV.map(([v]) => `img/night_${v}_dusk.jpg`),
    ...Object.entries(DAY).flatMap(([season, list]) => list.flatMap(([key]) => DAYV.map(([v]) => `img/times_${v}_${season}_${key}.jpg`))),
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
    <button class="fly" id="v-fly" type="button">Open in 3D</button>
  </div>
  <span class="desc hint" id="vdesc"></span>
  <p class="hint">Drag across the picture to wipe between today and the proposed design. Renders are 16 Jan at 2:45 pm. No outdoor kitchen is shown: it isn't decided yet (see the options below).</p>
  <div class="strip" id="strip" role="list"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>Where the pool roller goes</h2>
  <p>A stand-mounted roller sized for this pool: 4.6 m long, the blanket rolls up to about 0.42 m across, and the tube sits about 0.5 m up, so the roll clears the coping by about a hand's width.</p>
</div>
<section class="block" aria-label="Pool roller options">
  <div class="fstage"><img id="r-img" alt=""><span class="tag l" id="r-tag"></span><button class="fly" id="r-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="Roller position" id="r-opts"></div>
  <div class="chips" id="r-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="r-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>Outdoor kitchen</h2>
  <p>Not decided yet: no kitchen, one of three layouts along the alfresco's east fence, or a bench facing the lounge. The built-in ones are charcoal cabinets 900 mm high with a pale concrete top, a 900 mm BBQ and a dome oven about 0.73 m wide.</p>
</div>
<section class="block" aria-label="Kitchen options">
  <div class="fstage"><img id="k-img" alt=""><span class="tag l" id="k-tag"></span><button class="fly" id="k-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="Kitchen layout" id="k-opts"></div>
  <div class="chips" id="k-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="k-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>Alfresco posts and beams</h2>
  <p>What holds up the new roof's west edge. Every layout flies the beams over the house gutter, with a bracket back to the house framing.</p>
</div>
<section class="block" aria-label="Post options">
  <div class="fstage"><img id="po-img" alt=""><span class="tag l" id="po-tag"></span><button class="fly" id="po-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="Post layout" id="po-opts"></div>
  <div class="chips" id="po-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="po-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>Layout B: lounge wall in line, pool moved</h2>
  <p>A second build of the whole yard: the sunken lounge lines up with the house's west wall and runs east to the garden bed, and the pool moves 0.5 m east. Left: SK02's layout. Right: Layout B, both from the same camera.</p>
</div>
<section class="block" aria-label="SK02's layout beside Layout B">
  <div class="pair">
    <div class="fstage"><img id="la-img" alt=""><span class="tag l" id="la-tag"></span><button class="fly" id="la-fly" type="button">Open in 3D</button></div>
    <div class="fstage"><img id="lb-img" alt=""><span class="tag l" id="lb-tag">Layout B, corner post</span><button class="fly" id="lb-fly" type="button">Open in 3D</button></div>
  </div>
  <div class="chips" id="lb-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="lb-note">
    <p>The lounge's pool-side wall moves 0.88 m east, onto the house's west wall line, and its east wall moves out to the garden bed: the lounge is 3.75 m wide inside (3.87 m in SK02). The house wall, the lounge wall, the corner post and the roof's west edge all line up. The north bench is 2.72 m long and the fire pit is re-centred.</p>
    <p>The walkway down the lounge's east side is gone. You reach the spa deck along the pool side (0.90 m from the water to the lounge wall) or through the lounge, down the north-west steps and up the south steps (1.36 m wide).</p>
    <p>The pool moves 0.5 m east with its coping, water, lights and covers: 0.50 m of paving between the coping and the lounge wall, 0.57 m from the coping to the boundary wall at its closest.</p>
    <p><b>Watch for</b> SK02's own post: it stands 0.35 m in front of the west half of the north-west steps. The lounge kitchen starts clear of the steps, so it's 1.85 m long, and the gap at its east end now leads nowhere. The fence pulled into the alfresco can't be built in this layout: it would run through the lounge's new corner.</p>
  </div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>The kids' play area</h2>
  <p>The bark, sandpit, climbing frame and trampoline where they are, or all moved 1.75 m north along the boundary wall.</p>
</div>
<section class="block" aria-label="Play area options">
  <div class="fstage"><img id="pl-img" alt=""><span class="tag l" id="pl-tag"></span><button class="fly" id="pl-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="Play area" id="pl-opts"></div>
  <div class="chips" id="pl-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="pl-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>The pump room under the spa deck</h2>
  <p>SK02 puts the pump shed under the deck's west end, its floor 1.1 m below the deck. It opens onto the promenade through the terrace wall.</p>
</div>
<section class="block" aria-label="Pump room options">
  <div class="fstage"><img id="pu-img" alt=""><span class="tag l" id="pu-tag"></span><button class="fly" id="pu-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="Pump room front" id="pu-opts"></div>
  <div class="chips" id="pu-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="pu-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>The fence by the pavilion pier</h2>
  <p>WA pool rules: the fence must be 1.2 m high on the outside, with nothing to climb on within its 900 mm non-climbable zones unless it's 1.8 m high. The pavilion's concrete pier sits 0.4 m outside the east fence.</p>
</div>
<section class="block" aria-label="Pier fence options">
  <div class="fstage"><img id="p-img" alt=""><span class="tag l" id="p-tag"></span><button class="fly" id="p-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="Pier fence" id="p-opts"></div>
  <div class="chips" id="p-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="p-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>West boundary fence</h2>
  <p>The boundary along the pool is part of the pool barrier. WA's pool rules: at least 1.8 m high measured from our side, and nothing to climb in its top 900 mm on our side, the fence's own face included. It's the dividing fence, so the neighbour has to agree to any change. Today's wall and tube fence are too low for most of the pool.</p>
</div>
<section class="block" aria-label="Boundary fence options">
  <div class="fstage"><img id="bf-img" alt=""><span class="tag l" id="bf-tag"></span><button class="fly" id="bf-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="Boundary fence" id="bf-opts"></div>
  <div class="chips" id="bf-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="bf-note"></div>
</section>

<div class="section-head">
  <span class="label">Options to decide</span>
  <h2>Side passage</h2>
  <p>Where the north pool fence crosses the side passage, and what the passage is paved with up to the play area.</p>
</div>
<section class="block" aria-label="Side passage options">
  <div class="fstage"><img id="s-img" alt=""><span class="tag l" id="s-tag"></span><button class="fly" id="s-fly" type="button">Open in 3D</button></div>
  <div class="chips" role="group" aria-label="North fence and passage surface" id="s-opts"></div>
  <div class="chips" id="s-views" role="group" aria-label="Viewpoint"></div>
  <div class="optnote" id="s-note"></div>
</section>

<div class="section-head">
  <span class="label">Where we sit</span>
  <h2>The lounge through the day</h2>
  <p>The same three views at different times, with the sun calculated for Geographe. After sunset the lighting is switched on.</p>
  ${OLD_KITCHEN.day ? oldKitchenNote : ''}
</div>
<section class="block" aria-label="Time of day">
  <div class="fstage"><img id="d-img" alt=""><span class="tag l" id="d-tag"></span><button class="fly" id="d-fly" type="button">Open in 3D</button></div>
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
  ${OLD_KITCHEN.dusk ? oldKitchenNote : ''}
</div>
<section class="block" aria-label="After dark">
  <div class="fstage"><img id="n-img" alt=""><span class="tag l" id="n-tag">Dusk, 7:40 pm</span><button class="fly" id="n-fly" type="button">Open in 3D</button></div>
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
  <button class="linkbtn" id="sun-sync" type="button">Open in 3D at this time</button>
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
    <li>The pool fence is charcoal perforated aluminium, per the 7 Oct estimate, chosen over SK02's frameless glass.</li>
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

export function buildGallery(root: HTMLElement, fly: (f: Fly) => void, imgBase = 'img/') {
  const I = imgBase;
  root.innerHTML = HTML;
  // option renders arrive in batches: a picture that isn't there yet shows a quiet placeholder, not a broken image
  root.addEventListener('error', e => { const t = e.target as HTMLElement; if (t.tagName === 'IMG') t.classList.add('missing'); }, true);
  root.addEventListener('load', e => { const t = e.target as HTMLElement; if (t.tagName === 'IMG') t.classList.remove('missing'); }, true);
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
    img('img-today').src = `${I}${id}__existing.jpg`; img('img-today').alt = `${name}, today`;
    img('img-proposed').src = `${I}${id}__proposed.jpg`; img('img-proposed').alt = `${name}, with the proposed pool and alfresco`;
    $('vnum').textContent = 'View ' + id.slice(0, 2);
    $('vname').textContent = name;
    $('vdesc').textContent = desc;
    root.querySelectorAll('.thumb').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };
  VIEWS.forEach(([id, name], i) => {
    const b = document.createElement('button');
    b.className = 'thumb'; b.type = 'button'; b.setAttribute('role', 'listitem');
    b.innerHTML = `<img src="${I}thumb_${id}.jpg" alt="" loading="lazy"><span><b>${id.slice(0, 2)}</b>${name}</span>`;
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
  $('v-fly').onclick = () => fly({ cam: VIEWS[current][0], scenario: mode === 'today' ? 'existing' : 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none' });

  // ---------- option pickers ----------
  type Picker = { opts: string[][]; optBox?: HTMLElement; viewBox: HTMLElement; img: string; tag: string; note?: string; views: string[][];
    src: (o: string, v: string) => string; onFly: (o: string, v: string, go?: (f: Fly) => void) => void; flyBtn: string };
  const picker = (cfg: Picker) => {
    const st = { o: 0, v: 0 };
    // Round 21: Layout B's render of the same option from the same camera, beside SK02's, when there is one
    const aStage = img(cfg.img).closest('.fstage') as HTMLElement, pair = document.createElement('div');
    pair.className = 'pair single';
    aStage.replaceWith(pair); pair.appendChild(aStage);
    const bStage = document.createElement('div');
    bStage.className = 'fstage'; bStage.hidden = true;
    bStage.innerHTML = '<img alt=""><span class="tag l"></span><button class="fly" type="button">Open in 3D</button>';
    pair.appendChild(bStage);
    const bImg = bStage.querySelector('img')!, bTag = bStage.querySelector('span')!;
    bStage.querySelector('button')!.onclick = () => cfg.onFly(cfg.opts[st.o][0], cfg.views[st.v][0], f => fly({ ...f, layout: 'b' }));
    const render = () => {
      if (cfg.optBox) chips(cfg.optBox, cfg.opts, st.o, i => { st.o = i; render(); });
      chips(cfg.viewBox, cfg.views, st.v, i => { st.v = i; render(); });
      const o = cfg.opts[st.o], v = cfg.views[st.v];
      // an option render that hasn't been made yet: say so instead of a broken image (Round 17)
      const im = img(cfg.img);
      im.classList.remove('missing');
      im.onerror = () => { im.classList.add('missing'); $(cfg.tag).textContent = `${o[1]}: render to come`; };
      im.src = cfg.src(o[0], v[0]);
      img(cfg.img).alt = `${v[1]}: ${o[1]}`;
      $(cfg.tag).textContent = o[1];
      if (cfg.note) $(cfg.note).innerHTML = o[2];
      const bName = layoutBName(cfg.src(o[0], v[0]));
      bStage.hidden = !bName; pair.classList.toggle('single', !bName);
      if (bName) { bImg.src = I + bName; bImg.alt = `${v[1]}: ${o[1]}, Layout B`; bTag.textContent = `${o[1]}, Layout B`; $(cfg.tag).textContent = `${o[1]}, SK02`; }
    };
    $(cfg.flyBtn).onclick = () => cfg.onFly(cfg.opts[st.o][0], cfg.views[st.v][0]);
    render();
    warmNear($(cfg.img), cfg.opts.flatMap(o => cfg.views.map(v => cfg.src(o[0], v[0]))));
  };
  picker({ opts: ROLLER, optBox: $('r-opts'), viewBox: $('r-views'), img: 'r-img', tag: 'r-tag', note: 'r-note', flyBtn: 'r-fly',
    views: ROLLER_VIEWS,
    src: (o, v) => `${I}options_${v}_${o}.jpg`,
    onFly: (o, v, go = fly) => go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: o, kitchen: 'kitchen_none' }) });
  picker({ opts: PLAY, optBox: $('pl-opts'), viewBox: $('pl-views'), img: 'pl-img', tag: 'pl-tag', note: 'pl-note', flyBtn: 'pl-fly',
    views: PLAY_VIEWS, src: (o, v) => I + playSrc(o, v).replace(/^img\//, ''),
    onFly: (o, v, go = fly) => { const c = PLAY.find(x => x[0] === o)!; go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', play: c[3], passage: c[4] }); } });
  picker({ opts: PIER, optBox: $('p-opts'), viewBox: $('p-views'), img: 'p-img', tag: 'p-tag', note: 'p-note', flyBtn: 'p-fly',
    views: PIER_VIEWS, src: (o, v) => `${I}options_${v}_${o}.jpg`,
    onFly: (o, v, go = fly) => go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', pier: o }) });
  picker({ opts: BFENCE, optBox: $('bf-opts'), viewBox: $('bf-views'), img: 'bf-img', tag: 'bf-tag', note: 'bf-note', flyBtn: 'bf-fly',
    views: BFENCE_VIEWS, src: (o, v) => `${I}options_${v}_${o}.jpg`,
    onFly: (o, v, go = fly) => go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', bfence: o }) });
  picker({ opts: SIDE, optBox: $('s-opts'), viewBox: $('s-views'), img: 's-img', tag: 's-tag', note: 's-note', flyBtn: 's-fly',
    views: SIDE_VIEWS, src: (o, v) => `${I}options_${v}_${o}.jpg`,
    onFly: (o, v, go = fly) => { const c = SIDE.find(x => x[0] === o)!; go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', nfence: c[3], passage: c[4] }); } });
  picker({ opts: KITCHEN, optBox: $('k-opts'), viewBox: $('k-views'), img: 'k-img', tag: 'k-tag', note: 'k-note', flyBtn: 'k-fly',
    views: KITCHEN_VIEWS,
    src: (o, v) => I + kitchenSrc(o, v).replace(/^img\//, ''),
    onFly: (o, v, go = fly) => go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: o }) });
  picker({ opts: POSTS, optBox: $('po-opts'), viewBox: $('po-views'), img: 'po-img', tag: 'po-tag', note: 'po-note', flyBtn: 'po-fly',
    views: POST_VIEWS, src: (o, v) => `${I}options_${v}_${o}.jpg`,
    onFly: (o, v, go = fly) => go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', post: o }) });
  // ---------- Layout B beside SK02's layout ----------
  const LB = { v: 0 };
  const renderLayoutB = () => {
    chips($('lb-views'), LAYOUTB_VIEWS, LB.v, i => { LB.v = i; renderLayoutB(); });
    const [v, name] = LAYOUTB_VIEWS[LB.v];
    img('la-img').src = I + layoutASrc(v).replace(/^img\//, ''); img('la-img').alt = `${name}: SK02's layout`;
    $('la-tag').textContent = A_CORNER.has(v) ? 'As drawn (SK02), corner post' : "As drawn (SK02), SK02's post";
    img('lb-img').src = `${I}layoutb_${v}.jpg`; img('lb-img').alt = `${name}: Layout B, with the corner post`;
  };
  $('la-fly').onclick = () => { const v = LAYOUTB_VIEWS[LB.v][0]; fly({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', post: A_CORNER.has(v) ? 'post_corner_steps' : 'post_as_drawn', layout: 'a' }); };
  $('lb-fly').onclick = () => fly({ cam: LAYOUTB_VIEWS[LB.v][0], scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', post: 'post_corner_steps', layout: 'b' });
  renderLayoutB();
  warmNear($('lb-img'), LAYOUTB_VIEWS.flatMap(([v]) => [I + layoutASrc(v).replace(/^img\//, ''), `${I}layoutb_${v}.jpg`]));
  picker({ opts: PUMP, optBox: $('pu-opts'), viewBox: $('pu-views'), img: 'pu-img', tag: 'pu-tag', note: 'pu-note', flyBtn: 'pu-fly',
    views: PUMP_VIEWS, src: (o, v) => `${I}options_${v}_${o}.jpg`,
    onFly: (o, v, go = fly) => go({ cam: v, scenario: 'proposed', ...RENDER_TIME, roller: 'none', kitchen: 'kitchen_none', pump: o }) });
  picker({ opts: [['dusk', 'Dusk, 7:40 pm']], viewBox: $('n-views'), img: 'n-img', tag: 'n-tag', flyBtn: 'n-fly', views: NIGHTV,
    src: (o, v) => `${I}night_${v}_${o}.jpg`,
    onFly: (_o, v) => fly({ cam: v, scenario: 'proposed', date: '2027-01-16', minutes: 19 * 60 + 40, roller: 'none', kitchen: OLD_KITCHEN.dusk ? 'kitchen_split' : 'kitchen_none' }) });

  // ---------- the lounge through the day ----------
  const D = { season: 'summer' as keyof typeof DAY, t: 2, v: 0 };
  const renderDay = () => {
    (['summer', 'winter'] as const).forEach(k => $('d-' + k).setAttribute('aria-pressed', String(k === D.season)));
    const list = DAY[D.season]; if (D.t >= list.length) D.t = list.length - 1;
    chips($('d-times'), list, D.t, i => { D.t = i; renderDay(); });
    chips($('d-views'), DAYV, D.v, i => { D.v = i; renderDay(); });
    const [key, label, pos, note] = list[D.t];
    img('d-img').src = `${I}times_${DAYV[D.v][0]}_${D.season}_${key}.jpg`;
    img('d-img').alt = `${DAYV[D.v][1]}, ${D.season} at ${label}`;
    $('d-tag').textContent = (D.season === 'summer' ? '16 Jan, ' : '21 Jun, ') + label;
    $('d-time').textContent = label; $('d-pos').textContent = pos; $('d-note').textContent = note;
  };
  $('d-summer').onclick = () => { D.season = 'summer'; renderDay(); };
  $('d-winter').onclick = () => { D.season = 'winter'; renderDay(); };
  $('d-fly').onclick = () => fly({ cam: DAYV[D.v][0], scenario: 'proposed', date: SEASON_DATE[D.season], minutes: hhmm(DAY[D.season][D.t][0]), roller: 'none', kitchen: OLD_KITCHEN.day ? 'kitchen_split' : 'kitchen_none' });
  renderDay();
  warmNear($('d-img'), Object.entries(DAY).flatMap(([season, list]) => list.flatMap(([key]) => DAYV.map(([v]) => `${I}times_${v}_${season}_${key}.jpg`))));

  // ---------- sun plan ----------
  let season: keyof typeof SUN = 'summer', tIdx = 2;
  const renderSun = () => {
    (['summer', 'winter'] as const).forEach(s => $('s-' + s).setAttribute('aria-pressed', String(s === season)));
    const list = SUN[season]; if (tIdx >= list.length) tIdx = list.length - 1;
    chips($('times'), list, tIdx, i => { tIdx = i; renderSun(); });
    const [key, label, pos, note] = list[tIdx];
    img('plan-img').src = `${I}sun_${season}_${key}.jpg`;
    img('plan-img').alt = `Plan view, ${season} at ${label}`;
    $('sun-time').textContent = label; $('sun-pos').textContent = pos; $('sun-note').textContent = note;
  };
  $('s-summer').onclick = () => { season = 'summer'; renderSun(); };
  $('s-winter').onclick = () => { season = 'winter'; renderSun(); };
  $('sun-sync').onclick = () => fly({ cam: '', date: SEASON_DATE[season], minutes: hhmm(SUN[season][tIdx][0]) });
  renderSun();
  warmNear($('plan-img'), Object.entries(SUN).flatMap(([s, list]) => list.map(([key]) => `${I}sun_${s}_${key}.jpg`)));

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
  idle(() => warm(VIEWS.flatMap(([id]) => [`${I}${id}__proposed.jpg`, `${I}${id}__existing.jpg`])));
}

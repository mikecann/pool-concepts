// Side-by-side: the walkthrough from a Cycles camera (same position, lens and time) next to its render.
//   node scripts/compare.mjs [--q Medium] [--out review/round6/cmp] [--extra "x=1"] [--label now]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const EVAL = arg('eval', '');
const Q = arg('q', 'Medium'), OUT = arg('out', 'review/round12/cmp'), EXTRA = arg('extra', ''), LABEL = arg('label', 'now');
mkdirSync(OUT, { recursive: true });
// [camera, minutes, the Cycles render it should look like]
const ONLY = arg('only', '');
// --set pool: the Round 9 pool views, by day and at dusk/night
const POOL = [
  ['05_pool_north_end', 14 * 60 + 45, '05_pool_north_end__proposed.jpg'],
  ['13_deep_end_to_house', 14 * 60 + 45, '13_deep_end_to_house__proposed.jpg'],
  ['14_spa_to_canal', 14 * 60 + 45, '14_spa_to_canal__proposed.jpg'],
  ['13_deep_end_to_house', 19 * 60 + 40, 'night_13_deep_end_to_house_dusk.jpg'],
  ['14_spa_to_canal', 19 * 60 + 40, 'night_14_spa_to_canal_dusk.jpg'],
  ['17_pool_overview', 19 * 60 + 40, 'night_17_pool_overview_dusk.jpg'],
  ['15_lounge_from_alfresco', 21 * 60, 'times_15_lounge_from_alfresco_summer_2100.jpg'],
];
// --set r11: Round 11's items (canal by day, enclosed shade, alfresco at dusk, night canal, spa light)
const R11 = [
  ['15_lounge_from_alfresco', 14 * 60 + 45, '15_lounge_from_alfresco__proposed.jpg'],
  ['14_spa_to_canal', 14 * 60 + 45, '14_spa_to_canal__proposed.jpg'],
  ['21_play_area_north', 14 * 60 + 45, '21_play_area_north__proposed.jpg'],
  ['19_play_area', 14 * 60 + 45, '19_play_area__proposed.jpg'],
  ['12_from_pavilion', 14 * 60 + 45, '12_from_pavilion__proposed.jpg'],
  ['16_outdoor_kitchen', 19 * 60 + 40, 'night_16_outdoor_kitchen_dusk.jpg'],
  ['01_canal_view', 19 * 60 + 40, 'night_01_canal_view_dusk.jpg'],
  ['14_spa_to_canal', 19 * 60 + 40, 'night_14_spa_to_canal_dusk.jpg'],
  ['15_lounge_from_alfresco', 21 * 60, 'times_15_lounge_from_alfresco_summer_2100.jpg'],
];
const ALL = arg('set', '') === 'r11' ? R11 : arg('set', '') === 'pool' ? POOL : [
  ['05_pool_north_end', 14 * 60 + 45, '05_pool_north_end__proposed.jpg'],
  ['15_lounge_from_alfresco', 14 * 60 + 45, '15_lounge_from_alfresco__proposed.jpg'],
  ['15_lounge_from_alfresco', 7 * 60 + 30, 'times_15_lounge_from_alfresco_summer_0730.jpg'],
  ['15_lounge_from_alfresco', 18 * 60 + 30, 'times_15_lounge_from_alfresco_summer_1830.jpg'],
  ['15_lounge_from_alfresco', 19 * 60 + 40, 'times_15_lounge_from_alfresco_summer_1940.jpg'],
  ['13_deep_end_to_house', 19 * 60 + 40, 'night_13_deep_end_to_house_dusk.jpg'],
  ['15_lounge_from_alfresco', 21 * 60, 'times_15_lounge_from_alfresco_summer_2100.jpg'],
];
const SHOTS = ONLY ? ALL.filter((_, i) => ONLY.split(',').map(Number).includes(i)) : ALL;
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(`http://localhost:4173/model/walk/?q=${Q}&panel=0&nohelp&date=2027-01-16${EXTRA ? '&' + EXTRA : ''}`);
await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
await p.addStyleTag({ content: '.hud,.hint-pill,.welcome,.status-pill,.gate-tip,.fps,.crosshair{display:none!important}' });
const tiles = [];
for (const [cam, t, ref] of SHOTS) {
  await p.evaluate(([cam, t, ev]) => { __viewer.setTime(t); __viewer.goToCam(cam, true); if (ev) (0, eval)(ev); }, [cam, t, EVAL]);
  await p.waitForTimeout(2200);   // fov ease + TRAA settle
  const file = `${OUT}/${LABEL}_${cam}_${t}.png`;
  await p.locator('#canvas').screenshot({ path: file });
  const a = await sharp(file).resize(800, 450).toBuffer(), r = await sharp(`public/model/img/${ref}`).resize(800, 450).toBuffer();
  tiles.push(a, r);
}
await sharp({ create: { width: 1600, height: 450 * SHOTS.length, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % 2) * 800, top: Math.floor(i / 2) * 450 }))).png().toFile(`${OUT}/${LABEL}_vs_cycles.png`);
console.log('saved', `${OUT}/${LABEL}_vs_cycles.png`);
await b.close();

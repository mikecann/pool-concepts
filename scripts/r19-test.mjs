// Round 19 tests: the Layout choice (SK02's model or Layout B's). Only the chosen layout's model loads; switching keeps
// the options, the time and the view in walk and fly (nudging a walker standing where B has its moved wall),
// is remembered, and ?layout= is a one-off. Every post layout works in B, and B's two warnings show only in B.
// Headless on the real GPU; exits 1 on failure or a console error.
//   node scripts/r19-test.mjs [--out review/round19/test]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round19/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = []; // renders still on their way from the model agent show as 'render to come': their 404s are expected
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
let reqs = [];
p.on('request', r => { const m = r.url().match(/\/web\/([^?]+)/); if (m) reqs.push(m[1]); });
const settled = () => p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
const load = async (q = '') => { reqs = []; await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp${q}`); await settled(); await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' }); };
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(56)} ${info}`); if (!ok) fail++; };
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });
const opt = (k, v) => p.evaluate(([k, v]) => __viewer.setOption(k, v), [k, v]);
const state = () => p.evaluate(() => { const V = __viewer, m = V.model; return {
  layout: V.layout, mode: V.walker.mode, minutes: V.state().minutes, feet: V.walker.feet.toArray(), cam: V.camera.position.toArray(),
  options: { roller: m.roller, kitchen: m.kitchen, post: m.post, pump: m.pump, play: m.play, spaCover: m.spaCover, pier: m.pier, nfence: m.nfence, passage: m.passage } }; });
const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
const glbs = () => reqs.filter(r => r.endsWith('.glb'));
/** Pick a layout card the way a visitor does, and wait for the other model to load. */
const pickLayout = async title => {
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('layout'); });
  reqs = [];
  const card = p.locator('#cards-layout .card').filter({ has: p.locator('b', { hasText: new RegExp(`^${title}$`) }) });
  await Promise.all([p.waitForEvent('load', { timeout: 60000 }), card.click()]);
  await settled(); await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' });
};
const warnShown = (box, title) => p.evaluate(([box, t]) => {
  const card = [...document.querySelectorAll(`#${box} .card`)].find(c => c.querySelector('b')?.textContent === t);
  const w = card?.querySelector('.card-warn:not([hidden])'); return w ? w.textContent : null;
}, [box, title]);

// --- a first visit: SK02's layout, and only its model
await load();
let s = await state();
check('first visit opens SK02\'s layout', s.layout === 'a', s.layout);
check('  and loads only its model', glbs().join() === 'pool-model.glb', glbs().join());
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('layout'); });
const cardTitles = await p.locator('#cards-layout .card b').allTextContents();
check('two layout cards', cardTitles.join(' | ') === 'As drawn (SK02) | Lounge wall in line, pool moved', cardTitles.join(' | '));
check('the Layout category says which', (await p.locator('#tab-layout span').innerText()) === 'As drawn (SK02)');
await shot('layout_cards_a');
check('no Layout B warnings in SK02\'s layout', !(await warnShown('cards-post', 'One post (as drawn)')) && !(await warnShown('cards-kitchen', 'Facing the lounge')));

// --- options, time and a walker standing in A's lounge strip, which is B's moved wall
const OPTS = { kitchen: 'kitchen_lounge', post: 'post_corner_steps', roller: 'roller_pit', pier: 'pier_straight', spaCover: 'spa_cover_on', play: 'play_moved' };
for (const [k, v] of Object.entries(OPTS)) await opt(k, v);
await p.evaluate(() => { __viewer.setTime(1000); __viewer.place(-1.75, 1.6, 7.5, 200, -6); });
await wait(800);
const before = await state();
check('standing in the lounge\'s west strip (SK02)', Math.abs(before.feet[0] + 1.75) < 0.05 && before.feet[1] < 1.8, before.feet.map(v => v.toFixed(2)).join(','));
await shot('swap_walk_before_a');

// --- switch to B
await pickLayout('Lounge wall in line, pool moved');
s = await state();
check('switched to Layout B', s.layout === 'b');
check('  loading only B\'s model', glbs().join() === 'pool-model-b.glb', glbs().join());
check('  the URL says so', new URL(p.url()).searchParams.get('layout') === 'b');
check('  every option kept', JSON.stringify(s.options) === JSON.stringify(before.options), JSON.stringify(s.options));
check('  the time kept', Math.abs(s.minutes - 1000) < 1, String(s.minutes));
check('  still walking', s.mode === 'walk');
const moved = Math.hypot(s.feet[0] - before.feet[0], s.feet[2] - before.feet[2]);
check('  nudged out of the moved wall to a floor', moved > 0.05 && moved < 1.5 && Math.abs(s.feet[1] - before.feet[1]) < 0.6, `moved ${moved.toFixed(2)} m to ${s.feet.map(v => v.toFixed(2)).join(',')}`);
const room = await p.evaluate(() => { const w = __viewer.walker, f = w.feet; return { head: w.headroomAt(f.x, f.z, f.y), floor: w.walkableAt(f.x, f.z, f.y + 0.6) }; });
check('  where there\'s room to stand', room.head > 1.5 && room.floor !== null, `headroom ${room.head.toFixed(2)}`);
const hint = await p.locator('#hint').innerText().catch(() => '');
check('  and it says so', /Lounge wall in line/i.test(hint) && /Moved you/i.test(hint), hint.replace(/\n/g, ' / '));
check('  looking the same way', Math.abs((await p.evaluate(() => __viewer.walker.yaw)) - (200 * Math.PI) / 180) < 0.01);
await shot('swap_walk_after_b');
check('the layout is remembered', (await p.evaluate(() => JSON.parse(localStorage.getItem('pool-settings')).layout)) === 'b');

// --- B's warnings and post layouts
await opt('post', 'post_as_drawn');
await p.evaluate(() => window.__openCategory('alfresco'));
const w1 = await warnShown('cards-post', 'One post (as drawn)'), w2 = await warnShown('cards-kitchen', 'Facing the lounge');
check('B: SK02\'s post warns about the steps', /0\.35 m in front of the lounge steps/.test(w1 ?? ''), w1 ?? 'none');
// Round 21: with the wall 0.88 m east, the lounge kitchen starts clear of the steps: a note, not a warning
const n2 = await p.evaluate(() => { const c = [...document.querySelectorAll('#cards-kitchen .card')].find(c => c.querySelector('b')?.textContent === 'Facing the lounge'); return c?.querySelector('.card-note:not([hidden])')?.textContent ?? null; });
check('B: the lounge kitchen no longer warns, it notes', !w2 && /1\.85 m long/.test(n2 ?? ''), n2 ?? 'none');
await p.evaluate(() => __viewer.goToCam('10_alfresco_corner', true)); await wait(1500);
await shot('b_post_as_drawn_kitchen_lounge');
for (const post of ['post_as_drawn', 'post_corner', 'post_corner_steps', 'post_west', 'post_two']) {
  await opt('post', post); await wait(400);
  const parts = await p.evaluate(k => { let n = 0; __viewer.model.root.traverse(o => { if (o.isMesh && String(o.userData.option ?? '').split('+').includes(k)) { let v = o, ok = true; while (v) { if (!v.visible) ok = false; v = v.parent; } if (ok) n++; } }); return n; }, post);
  check(`B: ${post} shows`, parts > 0, `${parts} parts`);
}
await opt('kitchen', 'kitchen_none'); await opt('post', 'post_corner_steps'); await wait(800);
await shot('b_post_corner_steps');

// --- fly: switch back to A from the air
await p.evaluate(() => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(-3.5, 4.2, 4.0), 2.6, -0.35); });
await wait(600);
const flyBefore = await state();
await pickLayout('As drawn \\(SK02\\)');
s = await state();
check('fly: switched back to SK02\'s layout', s.layout === 'a' && glbs().join() === 'pool-model.glb', glbs().join());
check('fly: still flying, in the same place', s.mode === 'fly' && dist(s.cam, flyBefore.cam) < 0.35, `${dist(s.cam, flyBefore.cam).toFixed(3)} m`);
check('fly: options kept', JSON.stringify(s.options) === JSON.stringify(flyBefore.options));
await shot('swap_fly_after_a');

// --- flying high (setMode('drone') is an old alias for fly): to B again
await p.evaluate(() => { __viewer.setMode('drone'); __viewer.goToCam('17_pool_overview', true); }); await wait(800);
const highBefore = await state();
await pickLayout('Lounge wall in line, pool moved');
s = await state();
check('flying high: in B, still flying, same camera', s.layout === 'b' && s.mode === 'fly' && dist(s.cam, highBefore.cam) < 0.35, `${s.mode} ${dist(s.cam, highBefore.cam).toFixed(3)} m`);
await shot('swap_fly_high_after_b');

// --- remembered; a ?layout= link is a one-off
await load();
check('a plain visit opens the remembered layout (B)', (await state()).layout === 'b' && glbs().join() === 'pool-model-b.glb', glbs().join());
await load('&layout=a');
check('?layout=a opens SK02\'s', (await state()).layout === 'a');
await load();
check('  without changing what\'s remembered', (await state()).layout === 'b');

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

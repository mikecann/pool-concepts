import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
// Bob's page (/bob/) and the walkthrough's locked profile mode (/model/walk/?profile=bob). The profile wins over the
// visitor's saved design and over URL options; it opens flying; no option UI shows, just the settings in the side
// panel (Show dimensions, Quality, Walk/Fly, Measure, a help line); the visitor's own 'pool-settings' is never written (the profile's per-viewer preferences go to 'pool-settings-profile'), and the
// normal walkthrough still opens with their own design afterwards. Then the page: the 3D tile from profile.json, the
// drawings and renders, the "to come" states, the questions' ticks (counted, remembered), print (no jump bar, empty boxes).
// Screenshots and a PDF in review/bob/. Headless on the real GPU; needs `npm run serve` (public/ on :4173).
//   node scripts/bob-test.mjs [--out review/bob]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/bob';
const SITE = 'http://localhost:4173';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(62)} ${info}`); if (!ok) fail++; };
const errs = [];
const watch = (p, tag) => {
  // a missing drawings.json / renders.json is a 404 the page expects (its "to come" state)
  p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(`${tag}: ${m.text().slice(0, 200)}`); });
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 200)}`));
};
const settled = p => p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
const own = p => p.evaluate(() => localStorage.getItem('pool-settings'));

// ---------------- the walkthrough's profile mode ----------------
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const profile = JSON.parse(readFileSync('public/bob/profile.json', 'utf8'));
let p = await ctx.newPage(); watch(p, 'walk');
// the visitor's own design: something else entirely
await p.goto(`${SITE}/robots.txt`);
const OWN = JSON.stringify({ layout: 'a', quality: 'Medium', fps: true, options: { kitchen: 'kitchen_split', roller: 'roller_deep', wallcap: 'wallcap_none' } });
await p.evaluate(s => localStorage.setItem('pool-settings', s), OWN);
await p.goto(`${SITE}/model/walk/?profile=bob&kitchen=kitchen_split&layout=a&scenario=existing&nohelp`);
await settled(p);
await p.addStyleTag({ content: '.fps,.joystick,.hint-pill{display:none!important}' });

const got = await p.evaluate(() => { const V = __viewer, m = V.model; return { layout: V.layout, scenario: V.state().scenario, modelScenario: m.scenario, lighting: m.lighting, profile: V.profile,
  options: Object.fromEntries(['roller', 'kitchen', 'post', 'pump', 'play', 'spaCover', 'pier', 'nfence', 'passage', 'bfence', 'bplant', 'wallcap', 'deck'].map(k => [k, m[k]])) }; });
check('layout comes from the profile, not ?layout= or saved', got.layout === profile.layout, got.layout);
const wrong = Object.entries(profile.options).filter(([k, v]) => got.options[k] !== v);
check('every option is the profile\'s (not ?kitchen= or saved)', wrong.length === 0, wrong.map(([k, v]) => `${k}: ${got.options[k]} != ${v}`).join(', '));
check('scenario is proposed (not ?scenario=existing)', got.scenario === 'proposed' && got.modelScenario === 'proposed', `${got.scenario}/${got.modelScenario}`);
check('lighting is the profile\'s', got.lighting === profile.lights.scheme, got.lighting);
check('__viewer.profile is the loaded profile', got.profile?.name === 'bob' && got.profile.layout === profile.layout);
check('the visitor\'s pool-settings is untouched after load', (await own(p)) === OWN);

// ---- it opens flying, at the walk's start spot (eye height on the alfresco)
const start = await p.evaluate(() => ({ mode: __viewer.walker.mode, cam: __viewer.camera.position.toArray(), fly: document.getElementById('mode-fly').getAttribute('aria-pressed') }));
check('opens in fly', start.mode === 'fly' && start.fly === 'true', JSON.stringify(start));
check('  from the walk\'s start spot, at eye height', Math.hypot(start.cam[0] - 1.3, start.cam[2] - 2.6) < 0.3 && start.cam[1] > 3.3 && start.cam[1] < 4.6, start.cam.map(v => v.toFixed(2)).join(','));

// ---- no option UI, just the settings
await p.evaluate(() => __viewer.setPanel(true)); await p.waitForTimeout(300);
check('no visible cards in the panel', (await p.locator('#panel .card:visible').count()) === 0, String(await p.locator('#panel .card:visible').count()));
check('category tabs hidden', !(await p.locator('#cat-tabs').isVisible()));
check('every category panel hidden', (await p.locator('.cat-panel:visible').count()) === 0);
check('Today/Proposed switch hidden', !(await p.locator('#sc-existing').isVisible()) && !(await p.locator('#sc-proposed').isVisible()));
check('panel heading reads "Design for construction"', (await p.locator('#panel-title').textContent()) === 'Design for construction');
check('the back arrow goes to /bob/', (await p.locator('#back-btn').getAttribute('href')) === '/bob/');
check('no views list', (await p.locator('#views-list, #profile-views, [data-view]').count()) === 0);
check('no design cards anywhere in the panel', (await p.locator('#panel .card:visible, #panel .cat-tab:visible').count()) === 0);
check('the panel button reads "Settings"', (await p.locator('#panel-toggle .open-label').textContent()) === 'Settings');
check('side panel: the settings show', await p.locator('#profile-settings').isVisible());
check('  Show dimensions', await p.locator('#ps-dims').isVisible() && /Show dimensions/.test(await p.locator('#profile-settings label.check').first().textContent()));
const qchips = (await p.locator('#ps-quality button').allTextContents()).join();
check('  Quality: Low, Medium, High, Ultra', /^Low,Medium,High,Ultra/.test(qchips), qchips);
check('  Walk and Fly', await p.locator('#ps-walk').isVisible() && await p.locator('#ps-fly').isVisible() && (await p.locator('#ps-fly').getAttribute('aria-pressed')) === 'true');
check('  Measure', await p.locator('#ps-measure').isVisible());
const help = await p.locator('#ps-help').innerText();
check('  a help line for the keys', /W A S D/.test(help) && /M measure/.test(help) && /L dimensions/.test(help) && /E opens/.test(help), help);
// Show dimensions, the L key and the Settings checkbox are one setting
await p.locator('#ps-dims').check(); await p.waitForTimeout(800);
let dd = await p.evaluate(() => ({ on: __viewer.dims.enabled, dlg: document.getElementById('opt-dims').checked }));
check('Show dimensions turns the overlay on (and ticks Settings\' box)', dd.on && dd.dlg, JSON.stringify(dd));
await p.evaluate(() => document.activeElement?.blur());
await p.keyboard.press('KeyL'); await p.waitForTimeout(300);
dd = await p.evaluate(() => ({ on: __viewer.dims.enabled, ps: document.getElementById('ps-dims').checked, dlg: document.getElementById('opt-dims').checked }));
check('  L turns it off, and both boxes follow', !dd.on && !dd.ps && !dd.dlg, JSON.stringify(dd));
await p.locator('#ps-measure').click(); await p.waitForTimeout(200);
check('Measure gets the tape out (the top button too)', await p.evaluate(() => __viewer.tape().active) && (await p.locator('#measure-btn').getAttribute('aria-pressed')) === 'true');
await p.locator('#ps-measure').click(); await p.waitForTimeout(200);
check('  and puts it away', !(await p.evaluate(() => __viewer.tape().active)) && (await p.locator('#ps-measure').getAttribute('aria-pressed')) === 'false');
await p.locator('#ps-quality button', { hasText: /^Low$/ }).click(); await p.waitForTimeout(500);
check('Quality chips switch the quality (the dialog\'s chips follow)', await p.evaluate(() => __viewer.state().quality) === 'Low' && (await p.locator('#opt-quality button[aria-pressed="true"]').textContent()) === 'Low');
await p.screenshot({ path: `${OUT}/walk-profile-1440.png` });
// walking still works: Walk lands you on a floor, and W walks
await p.locator('#ps-walk').click(); await p.waitForTimeout(600);
const w0 = await p.evaluate(() => ({ mode: __viewer.walker.mode, feet: __viewer.walker.feet.toArray(), top: document.getElementById('mode-walk').getAttribute('aria-pressed') }));
await p.focus('#canvas'); await p.keyboard.down('KeyW'); await p.waitForTimeout(800); await p.keyboard.up('KeyW'); await p.waitForTimeout(300);
const w1 = await p.evaluate(() => __viewer.walker.feet.toArray());
check('Walk: walking, on a floor, top button follows', w0.mode === 'walk' && w0.feet[1] >= 1 && w0.top === 'true', JSON.stringify(w0));
check('  W walks', Math.hypot(w1[0] - w0.feet[0], w1[2] - w0.feet[2]) > 0.5, `${Math.hypot(w1[0] - w0.feet[0], w1[2] - w0.feet[2]).toFixed(2)} m`);

// ---- per-viewer preferences: quality and dims are remembered apart; pool-settings never changes
await p.locator('#settings-btn').click();
await p.locator('#opt-quality button', { hasText: /^High$/ }).click();
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
await p.keyboard.press('KeyL');
await p.waitForTimeout(500);
const mine = await p.evaluate(() => JSON.parse(localStorage.getItem('pool-settings-profile') ?? '{}'));
check('quality, dims and mode saved under pool-settings-profile', mine.quality === 'High' && mine.dims === true && mine.mode === 'walk', JSON.stringify(mine));
check('  and none of the design is', !['options', 'layout', 'scenario', 'lightAdjust', 'pierChosen'].some(k => k in mine));
check('pool-settings byte-identical after changing quality and dims', (await own(p)) === OWN);
await p.reload(); await settled(p);
const re = await p.evaluate(() => ({ q: __viewer.state().quality, dims: __viewer.dims.enabled, psDims: document.getElementById('ps-dims').checked, mode: __viewer.walker.mode, layout: __viewer.layout, kitchen: __viewer.model.kitchen }));
check('after a reload: quality and dims kept (the side panel\'s box too)', re.q === 'High' && re.dims === true && re.psDims, JSON.stringify(re));
check('after a reload: walking, as the viewer chose', re.mode === 'walk', re.mode);
check('after a reload: still the profile\'s design', re.layout === profile.layout && re.kitchen === profile.options.kitchen);
check('pool-settings byte-identical after the reload', (await own(p)) === OWN);
await p.close();

// ---- the normal walkthrough still has the visitor's own design
p = await ctx.newPage(); watch(p, 'walk normal');
await p.goto(`${SITE}/model/walk/?nohelp`); await settled(p);
const norm = await p.evaluate(() => ({ layout: __viewer.layout, profile: __viewer.profile, kitchen: __viewer.model.kitchen, roller: __viewer.model.roller, wallcap: __viewer.model.wallcap }));
check('normal walkthrough: the visitor\'s own layout and options', norm.layout === 'a' && norm.kitchen === 'kitchen_split' && norm.roller === 'roller_deep' && norm.wallcap === 'wallcap_none', JSON.stringify(norm));
check('normal walkthrough: no profile, options UI back', norm.profile === null && await p.evaluate(() => { __viewer.setPanel(true); return true; }) && await p.locator('#cat-tabs').isVisible() && await p.locator('#sc-existing').isVisible());
await p.close();

// ---- Round 29: a profile.json with a stale bench corner (no longer an option) loads quietly, without it
p = await ctx.newPage(); watch(p, 'walk stale corner');
const stale = [];
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') stale.push(m.text().slice(0, 200)); });
await p.route('**/bob/profile.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...profile, options: { ...profile.options, corner: 'corner_aggregate' } }) }));
await p.goto(`${SITE}/model/walk/?profile=bob&nohelp`); await settled(p);
const sc = await p.evaluate(() => ({ corner: __viewer.model.corner, options: __viewer.profile?.options }));
check('a stale "corner" in profile.json: no warning, not loaded', !stale.some(t => /corner/i.test(t)) && sc.corner === undefined && sc.options && !('corner' in sc.options), stale.filter(t => /corner/i.test(t)).join(' | ') || JSON.stringify(sc.corner));
check('  and the rest of the profile still applies', !!sc.options && Object.entries(profile.options).every(([k, v]) => sc.options[k] === v));
await p.close(); await ctx.close();

// ---------------- the /bob/ page ----------------
const pctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
p = await pctx.newPage(); watch(p, 'bob');
const ready = () => p.waitForFunction(() => document.getElementById('tile3d-img').getAttribute('src') && document.getElementById('q-count').textContent
  && (document.querySelector('[data-list="drawings"] .entry') || !document.querySelector('[data-empty="drawings"]').hidden)
  && (document.querySelector('[data-list="renders"] .entry') || !document.querySelector('[data-empty="renders"]').hidden), null, { timeout: 20000 });
await p.goto(`${SITE}/bob/`); await ready();
await p.evaluate(() => document.fonts.ready);
check('no "design in words" section, nor a jump link to it', (await p.locator('#spec, #spec-table, .jump a[href="#spec"]').count()) === 0);
check('robots: noindex meta', (await p.locator('meta[name=robots]').getAttribute('content')) === 'noindex, nofollow');
check('3D tile opens the profile walkthrough with the chosen layout\'s aerial', (await p.locator('#tile3d').getAttribute('href')) === '/model/walk/?profile=bob'
  && (await p.locator('#tile3d-img').getAttribute('src')).includes(profile.layout === 'b' ? 'layoutb_07_aerial_southwest' : '07_aerial_southwest__proposed'));
check('revised date shown', await p.locator('#revised-row').isVisible() && (await p.locator('#revised').getAttribute('datetime')) === profile.revised);
// drawings and renders: one entry per item in their JSON, or the "to come" state when there's none
for (const kind of ['drawings', 'renders']) {
  let n = 0; try { n = JSON.parse(readFileSync(`public/bob/${kind}/${kind}.json`, 'utf8')).length; } catch { /* none yet */ }
  const shown = await p.locator(`[data-list="${kind}"] .entry`).count(), empty = await p.locator(`[data-empty="${kind}"]`).isVisible();
  check(n ? `${kind}: ${n} shown` : `"${kind[0].toUpperCase() + kind.slice(1)} to come"`, n ? shown === n && !empty : shown === 0 && empty, `${shown} shown`);
}
const count = () => p.locator('#q-count').textContent();
// however many questions public/bob/questions.json has
const NQ = JSON.parse((await import('node:fs')).readFileSync('public/bob/questions.json', 'utf8')).reduce((n, s) => n + s.items.length, 0);
check(`questions: 0 of ${NQ} done`, (await count()) === `0 of ${NQ} done`, await count());
await p.locator('#q-list input[type=checkbox]').first().check();
check(`ticking one: 1 of ${NQ} done`, (await count()) === `1 of ${NQ} done`, await count());
await p.reload(); await ready();
check('the tick survives a reload', (await count()) === `1 of ${NQ} done` && await p.locator('#q-list input[type=checkbox]').first().isChecked(), await count());
// ---- the layout: at 1440 the questions sit in a right-hand column level with the 3D section; at 390 straight after it
const rect = sel => p.locator(sel).evaluate(e => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right }; });
let qr = await rect('#questions'), tr = await rect('#tile3d'), mr = await rect('#model');
check('1440: questions to the right of the 3D tile', qr.left >= tr.right, `q.left ${qr.left.toFixed(0)}, tile.right ${tr.right.toFixed(0)}`);
check('1440: questions start level with the 3D section', Math.abs(qr.top - mr.top) <= 40, `q.top ${qr.top.toFixed(0)}, 3D top ${mr.top.toFixed(0)}`);
await p.screenshot({ path: `${OUT}/bob-1440-light.png`, fullPage: true });
await p.emulateMedia({ colorScheme: 'dark' });
await p.screenshot({ path: `${OUT}/bob-1440-dark.png`, fullPage: true });
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(200);
check('390 wide: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 390), String(await p.evaluate(() => document.documentElement.scrollWidth)));
qr = await rect('#questions'); mr = await rect('#model');
const sr = await rect('#drawings');
check('390 wide: questions come straight after the 3D section', qr.top >= mr.bottom && qr.top - mr.bottom <= 80 && sr.top >= qr.bottom, `3D bottom ${mr.bottom.toFixed(0)}, q ${qr.top.toFixed(0)}-${qr.bottom.toFixed(0)}, drawings top ${sr.top.toFixed(0)}`);
await p.screenshot({ path: `${OUT}/bob-390-dark.png`, fullPage: true });
await p.emulateMedia({ colorScheme: 'light' });
await p.screenshot({ path: `${OUT}/bob-390-light.png`, fullPage: true });

// ---- print: no jump bar, no buttons, the boxes empty even when ticked
await p.setViewportSize({ width: 1440, height: 900 });
await p.emulateMedia({ media: 'print', colorScheme: 'light' });
check('print: jump bar hidden', !(await p.locator('.jump').isVisible()));
check('print: the "Open the 3D model" button hidden', !(await p.locator('#tile3d .btn').isVisible()));
check('print: the 3D tile shows its URL', (await p.locator('#tile3d-url').isVisible()) && /\/model\/walk\/\?profile=bob$/.test(await p.locator('#tile3d-url').textContent()));
const box = await p.locator('#q-list input[type=checkbox]').first().evaluate(i => ({ checked: i.checked, appearance: getComputedStyle(i).appearance, bg: getComputedStyle(i).backgroundColor }));
check('print: a ticked box prints as an empty box', box.checked && box.appearance === 'none' && box.bg === 'rgb(255, 255, 255)', JSON.stringify(box));
await p.screenshot({ path: `${OUT}/bob-print.png`, fullPage: true });
await p.pdf({ path: `${OUT}/bob.pdf`, format: 'A4', printBackground: true });
await p.close(); await pctx.close();

check('no "Invalid Date" anywhere on the page', !(await (async () => { const q = await b.newPage(); await q.goto(`${SITE}/bob/`); await q.waitForTimeout(1500); const t = await q.locator('body').innerText(); await q.close(); return /Invalid Date/.test(t); })()));
// ---- an item's pictures (images: [{src, caption}]): a test copy of questions.json with one extra item, served in
// place of the real one (which isn't touched)
{
  const ictx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const ip = await ictx.newPage(); watch(ip, 'bob pics');
  const real = JSON.parse(readFileSync('public/bob/questions.json', 'utf8'));
  const IMGS = [{ src: 'renders/01_canal_view__proposed.jpg', caption: 'From across the canal' }, { src: '../model/img/layoutb_07_aerial_southwest.jpg', caption: 'From the air' }];
  const test = [...real, { section: 'Test pictures', items: [{ id: 'test-pics', title: 'An item with pictures', detail: 'Two of them.', images: IMGS }] }];
  await ip.route('**/bob/questions.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(test) }));
  await ip.goto(`${SITE}/bob/`);
  await ip.waitForFunction(() => document.querySelector('input[data-id="test-pics"]'), null, { timeout: 15000 });
  const li = ip.locator('li', { has: ip.locator('input[data-id="test-pics"]') });
  await li.scrollIntoViewIfNeeded();
  await ip.waitForFunction(() => [...document.querySelectorAll('.qpics img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  const th = await li.locator('.qpics img').evaluateAll(is => is.map(i => ({ h: Math.round(i.getBoundingClientRect().height), w: i.naturalWidth, src: i.getAttribute('src') })));
  check('pictures: two thumbnails under the item, loaded, ~96-120 px high', th.length === 2 && th.every(t => t.w > 0 && t.h >= 96 && t.h <= 120), JSON.stringify(th));
  check('  paths relative to /bob/', th[0]?.src.endsWith('/bob/renders/01_canal_view__proposed.jpg') && th[1]?.src.endsWith('/model/img/layoutb_07_aerial_southwest.jpg'));
  check('  captions under them', (await li.locator('.qpics span').allTextContents()).join('|') === 'From across the canal|From the air');
  const qbox = await ip.locator('#questions').boundingBox(), pbox = await li.locator('.qpics').boundingBox();
  check('  inside the right-hand column', pbox.x >= qbox.x && pbox.x + pbox.width <= qbox.x + qbox.width + 1, `${Math.round(pbox.x)}-${Math.round(pbox.x + pbox.width)} in ${Math.round(qbox.x)}-${Math.round(qbox.x + qbox.width)}`);
  const withPics = 1 + JSON.parse(require('node:fs').readFileSync('public/bob/questions.json', 'utf8')).flatMap(s => s.items).filter(i => i.images?.length).length;
  check('  only items with pictures show them', (await ip.locator('.qpics').count()) === withPics, `${await ip.locator('.qpics').count()} vs ${withPics}`);
  await ip.screenshot({ path: `${OUT}/bob-pics-1440.png` });
  await li.locator('.qpics a').nth(1).click(); await ip.waitForTimeout(400);
  const z = await ip.evaluate(() => ({ open: document.getElementById('zoom').open, src: document.getElementById('zoom-img').getAttribute('src'), cap: document.getElementById('zoom-cap').textContent }));
  check('  clicking one opens it in the lightbox, with its caption', z.open && z.src.endsWith('/model/img/layoutb_07_aerial_southwest.jpg') && z.cap === 'From the air', JSON.stringify(z));
  check('  and doesn\'t tick the item', !(await ip.locator('input[data-id="test-pics"]').isChecked()));
  await ip.screenshot({ path: `${OUT}/bob-pics-lightbox.png` });
  await ip.keyboard.press('Escape');
  await ip.setViewportSize({ width: 390, height: 844 }); await ip.waitForTimeout(300);
  await li.scrollIntoViewIfNeeded();
  check('pictures at 390: no sideways scroll', await ip.evaluate(() => document.documentElement.scrollWidth <= 390));
  await li.screenshot({ path: `${OUT}/bob-pics-390.png` });
  await ip.setViewportSize({ width: 1440, height: 900 });
  await ip.emulateMedia({ media: 'print' });
  const ph = await li.locator('.qpics img').first().evaluate(i => Math.round(i.getBoundingClientRect().height));
  check('pictures in print: small', ph > 0 && ph <= 70, `${ph} px`);
  await ictx.close();
}

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

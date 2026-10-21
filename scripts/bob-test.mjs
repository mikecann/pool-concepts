// Bob's page (/bob/) and the walkthrough's locked profile mode (/model/walk/?profile=bob). The profile wins over the
// visitor's saved design and over URL options; no option UI shows, just the Views list; the visitor's own
// 'pool-settings' is never written (the profile's per-viewer preferences go to 'pool-settings-profile'), and the
// normal walkthrough still opens with their own design afterwards. Then the page: the spec table from profile.json +
// choices.json, the "to come" states, the questions' ticks (counted, remembered), print (no jump bar, empty boxes).
// Screenshots and a PDF in review/bob/. Headless on the real GPU; needs `npm run serve` (public/ on :4173).
//   node scripts/bob-test.mjs [--out review/bob]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/bob';
const SITE = 'http://localhost:4173';
mkdirSync(OUT, { recursive: true });
const VIEW_COUNT = readFileSync('src/views.ts', 'utf8').split('\n').filter(l => /^\s*\["\d\d_/.test(l)).length;
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
  options: Object.fromEntries(['roller', 'kitchen', 'post', 'pump', 'play', 'spaCover', 'pier', 'nfence', 'passage', 'bfence', 'bplant', 'wallcap', 'deck', 'corner'].map(k => [k, m[k]])) }; });
check('layout comes from the profile, not ?layout= or saved', got.layout === profile.layout, got.layout);
const wrong = Object.entries(profile.options).filter(([k, v]) => got.options[k] !== v);
check('every option is the profile\'s (not ?kitchen= or saved)', wrong.length === 0, wrong.map(([k, v]) => `${k}: ${got.options[k]} != ${v}`).join(', '));
check('scenario is proposed (not ?scenario=existing)', got.scenario === 'proposed' && got.modelScenario === 'proposed', `${got.scenario}/${got.modelScenario}`);
check('lighting is the profile\'s', got.lighting === profile.lights.scheme, got.lighting);
check('__viewer.profile is the loaded profile', got.profile?.name === 'bob' && got.profile.layout === profile.layout);
check('the visitor\'s pool-settings is untouched after load', (await own(p)) === OWN);

// ---- no option UI, just the views
await p.evaluate(() => __viewer.setPanel(true)); await p.waitForTimeout(300);
check('no visible cards in the panel', (await p.locator('#panel .card:visible').count()) === 0, String(await p.locator('#panel .card:visible').count()));
check('category tabs hidden', !(await p.locator('#cat-tabs').isVisible()));
check('every category panel hidden', (await p.locator('.cat-panel:visible').count()) === 0);
check('Today/Proposed switch hidden', !(await p.locator('#sc-existing').isVisible()) && !(await p.locator('#sc-proposed').isVisible()));
check('panel heading reads "Design for construction"', (await p.locator('#panel-title').textContent()) === 'Design for construction');
check('the back arrow goes to /bob/', (await p.locator('#back-btn').getAttribute('href')) === '/bob/');
const views = p.locator('#views-list button');
check(`Views list: one button per view (${VIEW_COUNT})`, (await views.count()) === VIEW_COUNT && VIEW_COUNT > 0, String(await views.count()));
const before = await p.evaluate(() => __viewer.camera.position.toArray());
await p.locator('#views-list button[data-view="14_spa_to_canal"]').click();
await p.waitForTimeout(2200);
const after = await p.evaluate(() => __viewer.camera.position.toArray());
const moved = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
check('a view button moves the camera', moved > 1, `${moved.toFixed(2)} m`);
await p.screenshot({ path: `${OUT}/walk-profile-1440.png` });

// ---- per-viewer preferences: quality and dims are remembered apart; pool-settings never changes
await p.locator('#settings-btn').click();
await p.locator('#opt-quality button', { hasText: /^High$/ }).click();
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
await p.keyboard.press('KeyL');
await p.waitForTimeout(500);
const mine = await p.evaluate(() => JSON.parse(localStorage.getItem('pool-settings-profile') ?? '{}'));
check('quality and dims saved under pool-settings-profile', mine.quality === 'High' && mine.dims === true, JSON.stringify(mine));
check('  and none of the design is', !['options', 'layout', 'scenario', 'lightAdjust', 'pierChosen'].some(k => k in mine));
check('pool-settings byte-identical after changing quality and dims', (await own(p)) === OWN);
await p.reload(); await settled(p);
const re = await p.evaluate(() => ({ q: __viewer.state().quality, dims: __viewer.dims.enabled, layout: __viewer.layout, kitchen: __viewer.model.kitchen }));
check('after a reload: quality and dims kept', re.q === 'High' && re.dims === true, JSON.stringify(re));
check('after a reload: still the profile\'s design', re.layout === profile.layout && re.kitchen === profile.options.kitchen);
check('pool-settings byte-identical after the reload', (await own(p)) === OWN);
await p.close();

// ---- the normal walkthrough still has the visitor's own design
p = await ctx.newPage(); watch(p, 'walk normal');
await p.goto(`${SITE}/model/walk/?nohelp`); await settled(p);
const norm = await p.evaluate(() => ({ layout: __viewer.layout, profile: __viewer.profile, kitchen: __viewer.model.kitchen, roller: __viewer.model.roller, wallcap: __viewer.model.wallcap }));
check('normal walkthrough: the visitor\'s own layout and options', norm.layout === 'a' && norm.kitchen === 'kitchen_split' && norm.roller === 'roller_deep' && norm.wallcap === 'wallcap_none', JSON.stringify(norm));
check('normal walkthrough: no profile, options UI back', norm.profile === null && await p.evaluate(() => { __viewer.setPanel(true); return true; }) && await p.locator('#cat-tabs').isVisible() && await p.locator('#sc-existing').isVisible());
await p.close(); await ctx.close();

// ---------------- the /bob/ page ----------------
const pctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
p = await pctx.newPage(); watch(p, 'bob');
const ready = () => p.waitForFunction(() => document.querySelectorAll('#spec-table tr').length > 0 && document.getElementById('q-count').textContent
  && !document.querySelector('[data-empty="drawings"]').hidden && !document.querySelector('[data-empty="renders"]').hidden, null, { timeout: 20000 });
await p.goto(`${SITE}/bob/`); await ready();
await p.evaluate(() => document.fonts.ready);
const choices = JSON.parse(readFileSync('public/bob/choices.json', 'utf8'));
const rows = await p.$$eval('#spec-table tr', trs => trs.map(t => ({ g: t.dataset.group, name: t.querySelector('th').textContent, title: t.querySelector('.opt-title').textContent })));
check('spec table: a row per group plus lighting', rows.length === choices.groups.length + 1, `${rows.length} rows`);
const bad = choices.groups.filter(g => {
  const r = rows.find(x => x.g === g.key), v = g.key === 'layout' ? profile.layout : profile.options[g.key];
  return !r || r.name !== g.name || r.title !== g.options[v]?.title;
});
check('spec table: every group shows the chosen option\'s title', bad.length === 0, bad.map(g => g.key).join(', '));
check('spec table: lighting row', rows.find(r => r.g === 'lighting')?.title === choices.lighting[profile.lights.scheme].title);
check('robots: noindex meta', (await p.locator('meta[name=robots]').getAttribute('content')) === 'noindex, nofollow');
check('3D tile opens the profile walkthrough with the chosen layout\'s aerial', (await p.locator('#tile3d').getAttribute('href')) === '/model/walk/?profile=bob'
  && (await p.locator('#tile3d-img').getAttribute('src')).includes(profile.layout === 'b' ? 'layoutb_07_aerial_southwest' : '07_aerial_southwest__proposed'));
check('revised date shown', await p.locator('#revised-row').isVisible() && (await p.locator('#revised').getAttribute('datetime')) === profile.revised);
check('"Drawings to come"', await p.locator('[data-empty="drawings"]').isVisible() && (await p.locator('[data-list="drawings"] .entry').count()) === 0);
check('"Renders to come"', await p.locator('[data-empty="renders"]').isVisible() && (await p.locator('[data-list="renders"] .entry').count()) === 0);
const count = () => p.locator('#q-count').textContent();
// however many questions public/bob/questions.json has
const NQ = JSON.parse((await import('node:fs')).readFileSync('public/bob/questions.json', 'utf8')).reduce((n, s) => n + s.items.length, 0);
check(`questions: 0 of ${NQ} done`, (await count()) === `0 of ${NQ} done`, await count());
await p.locator('#q-list input[type=checkbox]').first().check();
check(`ticking one: 1 of ${NQ} done`, (await count()) === `1 of ${NQ} done`, await count());
await p.reload(); await ready();
check('the tick survives a reload', (await count()) === `1 of ${NQ} done` && await p.locator('#q-list input[type=checkbox]').first().isChecked(), await count());
await p.screenshot({ path: `${OUT}/bob-1440-light.png`, fullPage: true });
await p.emulateMedia({ colorScheme: 'dark' });
await p.screenshot({ path: `${OUT}/bob-1440-dark.png`, fullPage: true });
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(200);
check('390 wide: no sideways scroll', await p.evaluate(() => document.documentElement.scrollWidth <= 390), String(await p.evaluate(() => document.documentElement.scrollWidth)));
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

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

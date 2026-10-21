// Round 26 tests: the lighting Adjust panel (master dimmer, per-group brightness and on/off, colour temperature, the
// Colour scheme's colour pickers; live with no stalls and the same set of lights; remembered per scheme; reset; phone),
// Layout B's default pillar fence (a saved choice wins), and the pump room's battens no longer lighting the canal.
//   node scripts/r26-test.mjs [--out review/round26]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round26';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(62)} ${info}`); if (!ok) fail++; };
const errs = [];
const open = async (ctx, q, vp = { width: 1440, height: 900 }) => {
  const p = await ctx.newPage(); await p.setViewportSize(vp);
  p.on('console', m => { if ((m.type() === 'error' && !/404/.test(m.text())) || /no free .* slot/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp${q}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' });
  return p;
};
const slot = (p, name) => p.evaluate(n => { const s = __viewer.model.nightLights.find(sl => sl.def?.name === n); return s && { i: s.light.intensity, base: s.base, c: s.light.color.toArray().map(v => +v.toFixed(3)) }; }, name);
const lightSet = p => p.evaluate(() => { const ids = []; __viewer.scene.traverse(o => { if (o.isLight) ids.push(o.uuid); }); return ids.sort().join(); });
const level = (p, name) => p.evaluate(n => __viewer.model.nightLights.find(sl => sl.def?.name === n).light.intensity, name);
const openAdjust = async p => { await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('lighting'); }); await p.locator('#cards-lighting .adjust-btn:not([hidden])').click(); await p.waitForTimeout(200); };

// ---------------- the Adjust panel (SK02's layout, 21:00)
let ctx = await b.newContext();
let p = await open(ctx, '&layout=a&date=2027-01-16&t=1260');
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('lighting'); });
const adjustBtns = await p.locator('#cards-lighting .adjust-btn:not([hidden])').count();
check('one Adjust button, on the selected scheme', adjustBtns === 1);
await openAdjust(p);
const rows = await p.locator('#light-adjust .adj-row').evaluateAll(rs => rs.map(r => r.dataset.group));
check('As specced: its groups', ['pool', 'spa', 'bench', 'steps', 'uplights', 'downlights', 'inground', 'firepit'].every(g => rows.includes(g)) && !rows.includes('festoon'), rows.join(', '));
await p.locator('#light-adjust').screenshot({ path: `${OUT}/adjust_specced.png` });
await p.evaluate(() => __viewer.goToCam('15_lounge_from_alfresco', true)); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/adjust_specced_full.png` });
const set0 = await lightSet(p);
// bench strips to 30%
const bench0 = await level(p, 'led_bench_light_0');
await p.locator('#adj-bench').fill('0.3'); await p.waitForTimeout(250);
const bench1 = await level(p, 'led_bench_light_0');
const fit = await p.evaluate(() => __viewer.model.groupLevel('bench'));
check('bench strips to 30%: the lights and the strips dim together', Math.abs(bench1 / bench0 - 0.3) < 0.03 && Math.abs(fit - 0.3) < 1e-6, `${(bench1 / bench0).toFixed(2)}, fittings ${fit}`);
// pool off
await p.locator('#light-adjust .adj-row[data-group="pool"] .adj-on input').uncheck(); await p.waitForTimeout(250);
const pool = await p.evaluate(() => ({ i: __viewer.model.nightLights.find(sl => sl.def?.name === 'pool_light').light.intensity, glow: __viewer.model.glowLevel.pool }));
check('pool light off: the light and its glow in the water', pool.i === 0 && pool.glow === 0, JSON.stringify(pool));
// downlights cool
const dl0 = await slot(p, 'alfresco_downlight_0+1');
await p.locator('#light-adjust .adj-row[data-group="downlights"] .adj-temp button', { hasText: '4000K' }).click(); await p.waitForTimeout(200);
const dl1 = await slot(p, 'alfresco_downlight_0+1');
await p.locator('#light-adjust .adj-row[data-group="downlights"] .adj-temp button', { hasText: '2700K' }).click(); await p.waitForTimeout(200);
const dl2 = await slot(p, 'alfresco_downlight_0+1');
await p.locator('#light-adjust .adj-row[data-group="downlights"] .adj-temp button', { hasText: '4000K' }).click(); await p.waitForTimeout(200);
check('downlights: 2700K warmer, 4000K cooler (bluer) than designed', dl1.c[2] / dl1.c[0] > dl0.c[2] / dl0.c[0] + 0.02 && dl2.c[2] / dl2.c[0] < dl0.c[2] / dl0.c[0] - 0.1, `${dl0.c} -> 4000K ${dl1.c}, 2700K ${dl2.c}`);
// master
const fire0 = await level(p, 'led_firepit_light');
await p.locator('#adj-master').fill('0.5'); await p.waitForTimeout(250);
const fireRatio = (await level(p, 'led_firepit_light')) / fire0;
check('master 50%: everything halves', fireRatio > 0.3 && fireRatio < 0.7, fireRatio.toFixed(2) + ' (fire flickers)');
await p.locator('#adj-master').dispatchEvent('change');
// dragging at night: no stalls, the same lights
// (three runs, judged on the median: with Blender rendering on the same machine, one run in three can catch an outside
// stall; nothing compiles, so a stall from the panel itself would show in every run)
const worsts = [], pipes = [await p.evaluate(() => __viewer.renderer._pipelines.caches.size)];
for (let run = 0; run < 3; run++) {
  const frames = await p.evaluate(() => new Promise(res => {
    const r = document.getElementById('adj-bench'), m = document.getElementById('adj-master'); const ft = []; let last = performance.now(), n = 0;
    const f = () => { const now = performance.now(); ft.push(now - last); last = now; n++;
      r.value = String(0.2 + 1.6 * Math.abs(Math.sin(n / 9))); r.dispatchEvent(new Event('input', { bubbles: true }));
      m.value = String(0.4 + 0.8 * Math.abs(Math.cos(n / 13))); m.dispatchEvent(new Event('input', { bubbles: true }));
      if (n < 150) requestAnimationFrame(f); else res(ft.slice(3)); };
    requestAnimationFrame(f);
  }));
  worsts.push(Math.max(...frames));
  pipes.push(await p.evaluate(() => __viewer.renderer._pipelines.caches.size));
}
const median = worsts.slice().sort((a, b) => a - b)[1];
check('dragging two sliders, 3 x 150 frames: median worst frame under 50 ms', median < 50, `worst per run ${worsts.map(v => v.toFixed(0)).join(', ')} ms`);
check('  no shaders compiled while dragging', pipes.every(n => n === pipes[0]), `pipelines ${pipes.join(' -> ')}`);
check('  and the set of lights never changed', (await lightSet(p)) === set0);
await p.locator('#adj-bench').fill('0.3'); await p.locator('#adj-bench').dispatchEvent('change');
await p.locator('#adj-master').fill('0.5'); await p.locator('#adj-master').dispatchEvent('change');
await p.evaluate(() => __viewer.goToCam('15_lounge_from_alfresco', true)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/adjust_specced_changed.png` });
// remembered, per scheme
await p.reload(); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
const after = await p.evaluate(() => ({ bench: __viewer.model.groupLevel('bench'), pool: __viewer.model.groupLevel('pool') }));
check('after a reload: still bench 30% x master 50%, pool off', Math.abs(after.bench - 0.15) < 1e-6 && after.pool === 0, JSON.stringify(after));
await openAdjust(p);
check('  and the panel shows it', (await p.locator('#adj-bench').inputValue()) === '0.3' && !(await p.locator('#light-adjust .adj-row[data-group="pool"] .adj-on input').isChecked()));
await p.evaluate(() => __viewer.setOption('lighting', 'lights_resort')); await p.waitForTimeout(200);
check('another scheme (Resort) is as designed', await p.evaluate(() => __viewer.model.groupLevel('bench') === 1 && __viewer.model.groupLevel('pool') === 1));
check('  the open panel follows the scheme', /Resort/.test(await p.locator('#light-adjust .adj-head b').textContent()) && (await p.locator('#adj-bench').inputValue()) === '1');
// the Colour scheme's pickers
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('lighting'); });
await p.locator('#cards-lighting .card').filter({ has: p.locator('b', { hasText: /^Colour$/ }) }).click(); await p.waitForTimeout(200);
check('Colour: colour pickers on pool, spa, bench strips and uplights', await p.locator('#light-adjust input[type=color]').count() === 4);
await p.locator('#light-adjust .adj-row[data-group="pool"] input[type=color]').fill('#ff2000'); await p.waitForTimeout(200);
const red = await slot(p, 'pool_light_rgb');
const glowRed = await p.evaluate(() => __viewer.model.poolGlowColor.value.toArray());
check('  pool to red: the light is red, and so is its glow', red.c[0] > red.c[1] * 3 && glowRed[0] > glowRed[1], `${red.c} glow ${glowRed.map(v => v.toFixed(3))}`);
await p.evaluate(() => __viewer.goToCam('17_pool_overview', true)); await p.evaluate(() => __viewer.setMode('fly')); await p.evaluate(() => __viewer.goToCam('17_pool_overview', true)); await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/adjust_colour_red_pool.png` });
await p.locator('#light-adjust').screenshot({ path: `${OUT}/adjust_colour.png` });
// reset
await p.locator('#adj-reset').click(); await p.waitForTimeout(200);
const reset = await p.evaluate(() => ({ stored: JSON.parse(localStorage.getItem('pool-settings')).lightAdjust?.lights_colour ?? null, c: __viewer.model.nightLights.find(sl => sl.def?.name === 'pool_light_rgb').light.color.toArray() }));
check('Reset to designed: the stored settings go, the pool is teal again', reset.stored === null && reset.c[1] > reset.c[0], JSON.stringify(reset.c.map(v => +v.toFixed(3))));
await p.close(); await ctx.close();

// ---------------- first visit to each scheme on a fresh page: precompiled at load, so no compiles and no stall
for (const L of ['a', 'b']) {
  ctx = await b.newContext();
  p = await open(ctx, `&layout=${L}&date=2027-01-16&t=1260&panel=0`);
  const n0 = await p.evaluate(() => __viewer.renderer._pipelines.caches.size);
  const worst = await p.evaluate(() => new Promise(res => { const ks = ['resort', 'festoon', 'architectural', 'colour', 'garden', 'specced']; const ft = []; let last = performance.now(), n = 0;
    const f = () => { const now = performance.now(); ft.push(now - last); last = now; n++; if (n % 10 === 0 && n <= 60) __viewer.setOption('lighting', 'lights_' + ks[n / 10 - 1]); if (n < 80) requestAnimationFrame(f); else res(Math.max(...ft.slice(3))); }; requestAnimationFrame(f); }));
  const n1 = await p.evaluate(() => __viewer.renderer._pipelines.caches.size);
  check(`${L}: first visit to each scheme: (almost) nothing compiles, no stall`, n1 - n0 <= 2 && worst < 50, `pipelines +${n1 - n0}, worst ${worst.toFixed(0)} ms`);
  await p.close(); await ctx.close();
}

// ---------------- phone
ctx = await b.newContext({ deviceScaleFactor: 2, isMobile: true, hasTouch: true });
p = await open(ctx, '&layout=a&date=2027-01-16&t=1260', { width: 390, height: 844 });
await openAdjust(p);
await p.locator('#light-adjust').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${OUT}/adjust_phone.png` });
const ph = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, w: document.getElementById('light-adjust').getBoundingClientRect().width }));
check('phone: the panel fits the drawer, no sideways scroll', !ph.overflow && ph.w <= 390, JSON.stringify(ph));
await p.locator('#adj-master').fill('0.7'); await p.locator('#adj-master').dispatchEvent('change');
check('  and its sliders work', await p.evaluate(() => Math.abs(__viewer.model.groupLevel('pool') - 0.7) < 1e-6));
await p.close(); await ctx.close();

// ---------------- Layout B's default pillar fence
ctx = await b.newContext();
p = await open(ctx, '&layout=b');
check('B, first visit: "Deck edge, then past the pillar"', (await p.evaluate(() => __viewer.model.pier)) === 'pier_straight_edge');
await p.close();
p = await open(ctx, '&layout=a');
check('A: still as drawn', (await p.evaluate(() => __viewer.model.pier)) === 'pier_as_drawn');
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('fences'); });
await p.locator('#cards-pier .card').filter({ has: p.locator('b', { hasText: /^As drawn$/ }) }).click();
await p.close();
p = await open(ctx, '&layout=b');
check('B after picking "As drawn" yourself: your choice wins', (await p.evaluate(() => __viewer.model.pier)) === 'pier_as_drawn');
await p.close(); await ctx.close();

// ---------------- the pump room's battens: on inside, off from the canal
ctx = await b.newContext();
p = await open(ctx, '&layout=a&date=2027-01-16&t=1260&panel=0');
await p.evaluate(() => { __viewer.setMode('fly'); __viewer.goToCam('01_canal_view', true); }); await p.waitForTimeout(800);
const far = await level(p, 'pump_room_light');
await p.evaluate(() => { const h = __viewer.hinges.list.find(h => h.group === 'pump_doors'); __viewer.hinges.toggle(h, true); __viewer.place(h.centre.x, 1.6, h.centre.z - 1.2, 0, -5); }); await p.waitForTimeout(800);
const near = await level(p, 'pump_room_light');
check('pump room battens: off from the canal, on at the doors', far === 0 && near > 0, `${far} / ${near.toFixed(2)}`);
await p.evaluate(() => { __viewer.setMode('fly'); __viewer.goToCam('01_canal_view', true); }); await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/canal_01_night_fixed.png` });
await p.close(); await ctx.close();

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

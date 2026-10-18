// Round 25 tests: the six lighting schemes. The cards (titles, one line, More, the View going to 20:30 in your mode,
// the daytime hint and its button), ?lighting= and remembering, each scheme's own lights in the slots, switching at
// night over and over with the same set of lights and no frame over 50 ms, the pool/spa glow and the hot tub following
// the scheme, and the renders page's Lighting at night section. Both layouts. Headless on the real GPU.
//   node scripts/r25-test.mjs [--out review/round25/test]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round25/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(62)} ${info}`); if (!ok) fail++; };
const errs = [];
const SCHEMES = { lights_specced: 'As specced', lights_resort: 'Resort', lights_festoon: 'Festoon', lights_architectural: 'Architectural', lights_colour: 'Colour', lights_garden: 'Garden' };
// a light from each scheme that only that scheme has
const OWN = { lights_specced: 'pool_light', lights_resort: 'pool_light_resort', lights_festoon: 'festoon_light_0', lights_architectural: 'cove_light_south', lights_colour: 'pool_light_rgb', lights_garden: 'bollard_light_0' };
const open = async (q, ctx) => {
  const p = await (ctx ?? b).newPage({ viewport: { width: 1440, height: 900 } });
  p.on('console', m => { if ((m.type() === 'error' && !/404/.test(m.text())) || /no free .* slot/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp${q}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' });
  return p;
};
const lightSet = p => p.evaluate(() => { const ids = []; __viewer.scene.traverse(o => { if (o.isLight) ids.push(o.uuid); }); return ids.sort().join(); });
const onNow = p => p.evaluate(() => __viewer.model.lightSlots().filter(s => s.light).map(s => s.light));

for (const L of ['a', 'b']) {
  const ctx = await b.newContext();
  let p = await open(`&layout=${L}&date=2027-01-16&t=840`, ctx);
  // ---- the cards
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('lighting'); });
  const cards = await p.evaluate(() => [...document.querySelectorAll('#cards-lighting .card-wrap')].map(w => ({ t: w.querySelector('.card b').textContent, s: w.querySelector('.card span').textContent, more: w.querySelector('.card-more p')?.textContent ?? '', img: w.querySelector('img').getAttribute('src') })));
  check(`${L}: six lighting cards`, cards.map(c => c.t).join() === Object.values(SCHEMES).join(), cards.map(c => c.t).join(' | '));
  check(`${L}:   one short line each, the description behind More`, cards.every(c => c.s.length < 60 && c.more.length > 120), '');
  check(`${L}:   As specced by default`, (await p.evaluate(() => __viewer.model.lighting)) === 'lights_specced');
  // ---- picked by day: the hint and its button
  await p.locator('#cards-lighting .card').filter({ has: p.locator('b', { hasText: /^Festoon$/ }) }).click();
  const hintShown = await p.locator('#light-hint').isVisible();
  const hintText = hintShown ? await p.locator('#light-hint').innerText() : '';
  check(`${L}: picked by day: "Lighting shows after dusk" with a button`, hintShown && /after dusk/i.test(hintText), hintText.replace(/\n/g, ' '));
  await p.screenshot({ path: `${OUT}/${L}_day_hint.png` });
  await p.locator('#light-hint-go').click();
  check(`${L}:   the button jumps to 20:30`, Math.round(await p.evaluate(() => __viewer.state().minutes)) === 20 * 60 + 30 && !(await p.locator('#light-hint').isVisible()));
  check(`${L}:   and it's remembered`, await p.evaluate(() => JSON.parse(localStorage.getItem('pool-settings')).options.lighting === 'lights_festoon'));
  // ---- the View: the lounge at 20:30, keeping the mode
  await p.evaluate(() => { __viewer.setTime(12 * 60); __viewer.setMode('fly'); });
  await p.locator('#cards-lighting').locator('..').locator('.view-btn').click(); await p.waitForTimeout(1800);
  const v = await p.evaluate(() => ({ t: Math.round(__viewer.state().minutes), mode: __viewer.walker.mode }));
  check(`${L}: View: 20:30, still flying`, v.t === 20 * 60 + 30 && v.mode === 'fly', JSON.stringify(v));
  await p.evaluate(() => __viewer.setMode('walk'));
  await p.close();

  // ---- every scheme at 21:00: its own lights, glows and tub
  p = await open(`&layout=${L}&date=2027-01-16&t=1260&panel=0`, ctx);
  const set0 = await lightSet(p), slots = await p.evaluate(() => __viewer.model.lightSlots().length);
  for (const [k, title] of Object.entries(SCHEMES)) {
    await p.evaluate(k => __viewer.setOption('lighting', k), k); await p.waitForTimeout(150);
    const on = await onNow(p);
    const others = Object.entries(OWN).filter(([s]) => s !== k).map(([, n]) => n);
    check(`${L}: ${title}: its own lights on, others' off`, on.includes(OWN[k]) && !others.some(n => on.includes(n)) && on.includes('led_firepit_light'), `${on.length} lights`);
  }
  const g = await p.evaluate(() => { const m = __viewer.model; m.update(1, 0, 0); return { garden: { pool: m.glowLevel.pool, tub: m.tubGlow.value.toArray().map(v => +v.toFixed(3)) } }; });
  await p.evaluate(() => __viewer.setOption('lighting', 'lights_colour'));
  const c = await p.evaluate(() => { const m = __viewer.model; return { tub: m.tubGlow.value.toArray().map(v => +v.toFixed(3)), pool: m.poolGlowColor.value.toArray().map(v => +v.toFixed(3)) }; });
  check(`${L}: Garden: no spa light, so the hot tub doesn't glow; pool almost off`, g.garden.tub.every(v => v === 0) && g.garden.pool < 0.15, JSON.stringify(g.garden));
  check(`${L}: Colour: the tub glows violet, the pool teal`, c.tub[2] > c.tub[1] && c.tub[0] > 0.02 && c.pool[1] > c.pool[0], JSON.stringify(c));
  // ---- switching at night, over and over: the same lights, no stalls
  const ks = Object.keys(SCHEMES);
  const frames = await p.evaluate(ks => new Promise(res => {
    const ft = []; let last = performance.now(), n = 0;
    const f = () => { const now = performance.now(); ft.push(now - last); last = now; n++;
      if (n % 12 === 0 && n < 12 * 25) __viewer.setOption('lighting', ks[(n / 12) % ks.length]);
      if (n < 12 * 25 + 20) requestAnimationFrame(f); else res(ft.slice(3)); };
    requestAnimationFrame(f);
  }), ks);
  const worst = Math.max(...frames);
  check(`${L}: 24 switches at night: worst frame under 50 ms`, worst < 50, `worst ${worst.toFixed(0)} ms over ${frames.length} frames`);
  check(`${L}:   the set of lights never changed (${slots} slots)`, (await lightSet(p)) === set0);
  // with the corner post too (SK02's layout swaps the bench strips): still no change
  await p.evaluate(() => __viewer.setOption('post', 'post_corner_steps'));
  for (const k of ks) await p.evaluate(k => __viewer.setOption('lighting', k), k);
  check(`${L}:   nor with the corner post's bench strips`, (await lightSet(p)) === set0);
  await p.evaluate(() => __viewer.setOption('post', 'post_as_drawn'));
  await p.close();
  // ---- ?lighting=
  p = await open(`&layout=${L}&lighting=garden`, ctx);
  check(`${L}: ?lighting=garden`, (await p.evaluate(() => __viewer.model.lighting)) === 'lights_garden');
  await p.close();
  await ctx.close();
}

// ---- the renders page
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4173/model/renders/');
await p.evaluate(() => document.querySelector('#li-img').closest('section').previousElementSibling.scrollIntoView());
const opts = await p.locator('#li-opts button').allTextContents(), views = await p.locator('#li-views button').allTextContents();
check('renders page: Lighting at night, six schemes', opts.join() === Object.values(SCHEMES).join(), opts.join(' | '));
check('  dusk and 9 pm from 17, 15 and 01', views.length === 6, views.join(' | '));
await p.waitForTimeout(1200);
const bShown = await p.evaluate(() => { const s = document.querySelector('#li-img').closest('.pair').querySelectorAll('.fstage'); return !s[1].hidden; });
check('  Layout B beside (17 and 15)', bShown);
await p.locator('#li-views button').last().click(); await p.waitForTimeout(400);
check('  and not from the canal (no B render there)', await p.evaluate(() => document.querySelector('#li-img').closest('.pair').querySelectorAll('.fstage')[1].hidden));
await p.locator('#li-views button').first().click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/renders_lighting.png` });

check('console clean (and no "no free slot")', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

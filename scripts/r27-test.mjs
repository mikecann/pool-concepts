// Round 27 tests: Wall tops (wallcap_*, both layouts) and Layout B's Spa deck (deck_*). Cards and defaults (greyed
// in SK02's layout; no cap is Layout B's default), each option's parts (instanced ones too, and the wall tops the wide deck covers), the dims
// following the deck, no camera jump when switching (walking on the deck, flying), the spa cover's E-roll on the wide
// deck, ?wallcap= / ?deck= and remembered choices. Screenshots of each option. Headless on the real GPU.
//   node scripts/r27-test.mjs [--out review/round16opts]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round17framed';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(62)} ${info}`); if (!ok) fail++; };
const errs = [];
const open = async (ctx, q) => {
  const p = await ctx.newPage(); await p.setViewportSize({ width: 1440, height: 900 });
  p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp&date=2027-01-16&t=840${q}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  await p.addStyleTag({ content: '.fps,.joystick,.hint{display:none!important}' });
  return p;
};
const opt = (p, k, v) => p.evaluate(([k, v]) => __viewer.setOption(k, v), [k, v]);
/** Meshes (instanced too) whose option includes key, split by whether they're also hidden by deck_wide: visible/total. */
const parts = (p, key) => p.evaluate(k => {
  const r = { plain: [0, 0], underDeck: [0, 0], inst: [0, 0] };
  __viewer.model.root.traverse(o => {
    // (combined border pieces, "wallcap_x+deck_wide_framed", are checked on their own)
    if (!o.isMesh || !String(o.userData.option ?? '').split('+').includes(k) || String(o.userData.option).includes('+')) return;
    let q = o, vis = true; while (q) { if (!q.visible) vis = false; q = q.parent; }
    const bucket = String(o.userData.hide_option ?? '').includes('deck_wide') ? r.underDeck : r.plain;
    bucket[1]++; if (vis) bucket[0]++;
    if (o.isInstancedMesh) { r.inst[1]++; if (vis) r.inst[0]++; }
  });
  return r;
}, key);
const shot = async (p, name, cam) => { await p.evaluate(c => { __viewer.setMode('fly'); __viewer.goToCam(c, true); }, cam); await p.waitForTimeout(1600); await p.locator('#canvas').screenshot({ path: `${OUT}/${name}.png` }); };
const WALLCAPS = ['wallcap_aggregate', 'wallcap_limestone', 'wallcap_none'];

for (const L of ['a', 'b']) {
  const ctx = await b.newContext();
  let p = await open(ctx, `&layout=${L}`);
  // ---- cards and defaults
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('finishes'); });
  const wt = await p.locator('#cards-wallcap .card b').allTextContents();
  // (Round 30: Layout B's default is no cap, the final design; SK02's stays the aggregate cap)
  const wdef = L === 'b' ? 'wallcap_none' : 'wallcap_aggregate', wnow = await p.evaluate(() => __viewer.model.wallcap);
  check(`${L}: Finishes > Wall tops: three cards, ${wdef} by default`, wt.join(' | ') === 'Aggregate cap | Limestone cap | No cap' && wnow === wdef, `${wt.join(' | ')}; ${wnow}`);
  await p.evaluate(() => window.__openCategory('spa'));
  const dk = await p.evaluate(() => [...document.querySelectorAll('#cards-deck .card')].map(c => ({ t: c.querySelector('b').textContent, off: c.disabled })));
  if (L === 'a') check('a: Spa deck: all three cards greyed (Layout B only)', dk.length === 3 && dk.every(c => c.off), JSON.stringify(dk));
  else check('b: Spa deck: three cards, "Timber to the edges" by default', dk.map(c => c.t).join(' | ') === 'Timber to the edges | Timber with a cap border | Squared deck' && !dk.some(c => c.off) && (await p.evaluate(() => __viewer.model.deck)) === 'deck_wide');
  await p.screenshot({ path: `${OUT}/${L}_panel_spa_deck.png` });
  // ---- wall tops: only the chosen cap shows (in B, not under the wide deck)
  for (const deck of L === 'b' ? ['deck_wide', 'deck_as_is'] : ['deck_wide']) {
    if (L === 'b') await opt(p, 'deck', deck);
    for (const k of WALLCAPS) {
      await opt(p, 'wallcap', k); await p.waitForTimeout(150);
      const res = Object.fromEntries(await Promise.all(WALLCAPS.map(async w => [w, await parts(p, w)])));
      const mine = res[k], others = WALLCAPS.filter(w => w !== k).map(w => res[w]);
      const underOk = L === 'a' || (deck === 'deck_wide' ? mine.underDeck[0] === 0 : mine.underDeck[0] === mine.underDeck[1]);
      check(`${L}${L === 'b' ? ` (${deck})` : ''}: ${k} shows, the others don't`, mine.plain[0] === mine.plain[1] && mine.plain[1] > 0 && underOk && others.every(o => o.plain[0] + o.underDeck[0] === 0),
        `plain ${mine.plain[0]}/${mine.plain[1]}, under the deck ${mine.underDeck[0]}/${mine.underDeck[1]}`);
      if (deck === 'deck_wide') await shot(p, `${L}_${k}`, '13_deep_end_to_house');
    }
    await opt(p, 'wallcap', 'wallcap_aggregate');
  }
  // ---- the spa deck (B): its parts, instanced too, and the dims
  if (L === 'b') {
    for (const d of ['deck_wide', 'deck_as_is']) {
      await opt(p, 'deck', d); await p.waitForTimeout(150);
      const mine = await parts(p, d), other = await parts(p, d === 'deck_wide' ? 'deck_as_is' : 'deck_wide');
      const strip = await p.evaluate(() => { let n = 0, v = 0; __viewer.model.root.traverse(o => { if (o.isMesh && /deck_wide/.test(o.userData.hide_option ?? '') && !o.userData.option) { n++; let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) v++; } }); return [v, n]; });
      check(`b: ${d}: its parts show (instanced too), the other deck's don't`, mine.plain[0] === mine.plain[1] && mine.plain[1] > 0 && mine.inst[0] === mine.inst[1] && mine.inst[1] > 0 && other.plain[0] === 0,
        `${mine.plain[0]}/${mine.plain[1]}, instanced ${mine.inst[0]}/${mine.inst[1]}; the strip under the wide deck ${strip[0]}/${strip[1]}`);
      check(`b: ${d}: the paving strip the wide deck covers`, d === 'deck_wide' ? strip[0] === 0 : strip[0] === strip[1] && strip[1] > 0);
      await p.evaluate(() => __viewer.setDims(true)); await p.waitForTimeout(300);
      const ids = await p.evaluate(() => __viewer.dims.current().map(x => x.id));
      const want = d === 'deck_wide' ? ['deck_wide_ew', 'deck_wide_ns', 'deck_wide_strip'] : ['spa_deck_ew', 'spa_deck_ns', 'strip_east_width'];
      const notWant = d === 'deck_wide' ? ['spa_deck_ew', 'spa_deck_ns', 'strip_east_width'] : ['deck_wide_ew', 'deck_wide_ns'];
      check(`b: ${d}: the dims follow`, want.every(i => ids.includes(i)) && !notWant.some(i => ids.includes(i)), want.filter(i => !ids.includes(i)).concat(notWant.filter(i => ids.includes(i))).join(', '));
      await p.evaluate(() => __viewer.setDims(false));
      await shot(p, `b_${d}_14`, '14_spa_to_canal'); await shot(p, `b_${d}_17`, '17_pool_overview');
    }
    // ---- Round 28: the framed deck. Its own parts, the border in the chosen wall top (combined keys), the lounge's
    // caps back on (they're only hidden by the plain wide deck), the strip still covered, and the dims
    await opt(p, 'deck', 'deck_wide_framed'); await p.waitForTimeout(150);
    for (const k of WALLCAPS) {
      await opt(p, 'wallcap', k); await p.waitForTimeout(150);
      const border = await p.evaluate(k => { const r = {}; __viewer.model.root.traverse(o => { const opt = String(o.userData.option ?? ''); if (!o.isMesh || !opt.endsWith('+deck_wide_framed')) return; let q = o, vis = true; while (q) { if (!q.visible) vis = false; q = q.parent; } const w = opt.split('+')[0]; r[w] ??= [0, 0]; r[w][1]++; if (vis) r[w][0]++; }); return r; }, k);
      const capsUnder = (await parts(p, k)).underDeck;
      const ok = border[k] && border[k][0] === border[k][1] && Object.entries(border).every(([w, [v]]) => w === k || v === 0) && capsUnder[0] === capsUnder[1];
      check(`b (deck_wide_framed): ${k}: its border shows, no other`, ok, `${JSON.stringify(border)}; the lounge's caps ${capsUnder[0]}/${capsUnder[1]}`);
      await shot(p, `b_framed_${k}_14`, '14_spa_to_canal');
    }
    await opt(p, 'wallcap', 'wallcap_aggregate');
    const fr = await parts(p, 'deck_wide_framed'), wide = await parts(p, 'deck_wide');
    const strip = await p.evaluate(() => { let n = 0, v = 0; __viewer.model.root.traverse(o => { if (o.isMesh && /deck_wide_framed/.test(o.userData.hide_option ?? '') && !o.userData.option) { n++; let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) v++; } }); return [v, n]; });
    check('b: deck_wide_framed: its parts (instanced too), not the plain wide deck\'s; the strip covered', fr.plain[0] === fr.plain[1] && fr.plain[1] > 0 && fr.inst[0] === fr.inst[1] && fr.inst[1] > 0 && wide.plain[0] === 0 && strip[0] === 0, `${fr.plain[0]}/${fr.plain[1]}, instanced ${fr.inst[0]}/${fr.inst[1]}, strip ${strip[0]}/${strip[1]}`);
    await p.evaluate(() => __viewer.setDims(true)); await p.waitForTimeout(300);
    const fids = await p.evaluate(() => __viewer.dims.current().map(x => x.id));
    check('b: deck_wide_framed: its dims, not the other decks\'', ['deck_framed_ew', 'deck_framed_strip'].every(i => fids.includes(i)) && !['deck_wide_ew', 'spa_deck_ew'].some(i => fids.includes(i)), fids.filter(i => /deck|strip/.test(i)).join(', '));
    await p.evaluate(() => __viewer.setDims(false));
    await shot(p, 'b_deck_wide_framed_17', '17_pool_overview'); await shot(p, 'b_deck_wide_framed_06', '06_sunken_lounge');
    await opt(p, 'spaCover', 'spa_cover_rolled'); await p.waitForTimeout(300);
    const fpark = await p.evaluate(() => __viewer.covers().list.find(c => c.kind === 'spa').rolls[0].group.position.toArray());
    await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(2.9, 2.6, 10.9, 60, -25); }); await p.waitForTimeout(700);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(3800);
    const fon = await p.evaluate(() => __viewer.model.spaCover);
    await shot(p, 'b_framed_spa_cover_on', '14_spa_to_canal');
    await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(2.9, 2.6, 10.9, 60, -25); }); await p.waitForTimeout(700);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(3800);
    const fback = await p.evaluate(() => ({ s: __viewer.model.spaCover, at: __viewer.covers().list.find(c => c.kind === 'spa').rolls[0].group.position.toArray() }));
    check('b, framed deck: E rolls the spa cover on and back to its spot', fon === 'spa_cover_on' && fback.s === 'spa_cover_rolled' && Math.hypot(fback.at[0] - fpark[0], fback.at[2] - fpark[2]) < 0.01, `${fon} -> ${fback.s}`);
    await opt(p, 'spaCover', 'spa_cover_none');
    // ---- no camera jump: walking on the deck's east strip, and flying
    await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(3.0, 2.6, 10.6, 180, -10); }); await p.waitForTimeout(800);
    for (const d of ['deck_wide', 'deck_as_is', 'deck_wide_framed', 'deck_wide']) {
      const a = await p.evaluate(() => __viewer.camera.position.toArray());
      await opt(p, 'deck', d); await p.waitForTimeout(500);
      const c = await p.evaluate(() => __viewer.camera.position.toArray());
      const dxz = Math.hypot(c[0] - a[0], c[2] - a[2]), dy = c[1] - a[1];
      check(`b, walking on the east strip: to ${d}, no jump`, dxz < 0.01 && Math.abs(dy) < 0.15, `moved ${dxz.toFixed(3)} m, up/down ${dy.toFixed(3)} m`);
    }
    await p.evaluate(() => __viewer.walker.startFly(new __viewer.THREE.Vector3(2.0, 4.5, 12.5), 0.3, -0.5)); await p.waitForTimeout(500);
    const f0 = await p.evaluate(() => __viewer.camera.position.toArray());
    for (const d of ['deck_as_is', 'deck_wide_framed', 'deck_wide']) await opt(p, 'deck', d);
    for (const k of WALLCAPS) await opt(p, 'wallcap', k);
    await p.waitForTimeout(400);
    const f1 = await p.evaluate(() => __viewer.camera.position.toArray());
    check('b, flying: switching both groups, the camera stays put', Math.hypot(f1[0] - f0[0], f1[1] - f0[1], f1[2] - f0[2]) < 0.01);
    await opt(p, 'wallcap', 'wallcap_aggregate');
    // ---- the spa cover's E-roll on the wide deck
    await opt(p, 'deck', 'deck_wide'); await opt(p, 'spaCover', 'spa_cover_rolled'); await p.waitForTimeout(300);
    const park = await p.evaluate(() => __viewer.covers().list.find(c => c.kind === 'spa').rolls[0].group.position.toArray());
    await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(2.9, 2.6, 10.9, 60, -25); }); await p.waitForTimeout(700);
    const tip = (await p.locator('#gate-tip').innerText().catch(() => '')).toLowerCase();
    await p.keyboard.press('KeyE'); await p.waitForTimeout(3800);
    const on = await p.evaluate(() => __viewer.model.spaCover);
    await shot(p, 'b_deck_wide_spa_cover_on', '14_spa_to_canal');
    await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(2.9, 2.6, 10.9, 60, -25); }); await p.waitForTimeout(700);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(3800);
    const back = await p.evaluate(() => ({ s: __viewer.model.spaCover, at: __viewer.covers().list.find(c => c.kind === 'spa').rolls[0].group.position.toArray() }));
    check('b, wide deck: E rolls the spa cover on and back to its spot', /roll the hot tub cover on/.test(tip) && on === 'spa_cover_on' && back.s === 'spa_cover_rolled' && Math.hypot(back.at[0] - park[0], back.at[2] - park[2]) < 0.01, `${tip} -> ${on} -> ${back.s}`);
    await opt(p, 'spaCover', 'spa_cover_none');
  }
  await p.close();
  // ---- URL params and remembered choices
  p = await open(ctx, `&layout=${L}&wallcap=limestone${L === 'b' ? '&deck=wide_framed' : ''}`);
  const u = await p.evaluate(() => ({ w: __viewer.model.wallcap, d: __viewer.model.deck }));
  check(`${L}: ?wallcap=limestone${L === 'b' ? '&deck=wide_framed' : ''}`, u.w === 'wallcap_limestone' && (L === 'a' || u.d === 'deck_wide_framed'), JSON.stringify(u));
  await p.close();
  p = await open(ctx, `&layout=${L}`);
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('finishes'); });
  await p.locator('#cards-wallcap .card').filter({ has: p.locator('b', { hasText: /^No cap$/ }) }).click();
  if (L === 'b') { await p.evaluate(() => window.__openCategory('spa')); await p.locator('#cards-deck .card').filter({ has: p.locator('b', { hasText: /^Squared deck$/ }) }).click(); }
  await p.reload(); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  const r = await p.evaluate(() => ({ w: __viewer.model.wallcap, d: __viewer.model.deck }));
  check(`${L}: picked cards are remembered`, r.w === 'wallcap_none' && (L === 'a' || r.d === 'deck_as_is'), JSON.stringify(r));
  await p.close(); await ctx.close();
}

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

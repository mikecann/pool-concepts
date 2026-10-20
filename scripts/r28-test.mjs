// Round 28 tests: the Bench corner (corner_*, both layouts). Cards and the default, each option's parts (in SK02's
// layout with the drawn post and with the corner post's moved steps, whose bench has its own post_corner_steps+corner_*
// pieces), the bench_corner dims following, no camera jump when switching (walking in the lounge, flying), ?corner=,
// remembered choices and goToCam('24_lounge_corner'). Then the pavilion deck's furniture (sofa set, egg chair, pots,
// wall baskets, BBQ; in both scenarios now): walking across the deck with key presses, you move, never end up inside
// a piece's footprint, and stay on the deck. Screenshots of each option and the deck. Headless on the real GPU.
//   node scripts/r28-test.mjs [--out review/round22corner]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round22corner';
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
/** Meshes tagged with exactly this option: visible/total. */
const parts = (p, key) => p.evaluate(k => {
  let v = 0, n = 0;
  __viewer.model.root.traverse(o => {
    if (!o.isMesh || o.userData.option !== k) return;
    let q = o, vis = true; while (q) { if (!q.visible) vis = false; q = q.parent; }
    n++; if (vis) v++;
  });
  return [v, n];
}, key);
const shot = async (p, name, cam) => { await p.evaluate(c => { __viewer.setMode('drone'); __viewer.goToCam(c, true); }, cam); await p.waitForTimeout(1600); await p.locator('#canvas').screenshot({ path: `${OUT}/${name}.png` }); };
const CORNERS = ['corner_timber', 'corner_aggregate'];
const pos = p => p.evaluate(() => __viewer.camera.position.toArray());

for (const L of ['a', 'b']) {
  const ctx = await b.newContext();
  let p = await open(ctx, `&layout=${L}`);
  // ---- cards and the default
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('alfresco'); });
  const cc = await p.evaluate(() => [...document.querySelectorAll('#cards-corner .card')].map(c => ({ t: c.querySelector('b').textContent, off: c.disabled })));
  check(`${L}: Alfresco > Bench corner: two cards, timber by default`, cc.map(c => c.t).join(' | ') === 'Timber corner | Aggregate corner' && !cc.some(c => c.off) && (await p.evaluate(() => __viewer.model.corner)) === 'corner_timber', cc.map(c => c.t).join(' | '));
  await p.screenshot({ path: `${OUT}/${L}_panel_alfresco.png` });
  // ---- each option's parts: in SK02's layout the plain pieces go with the drawn post, the steps' bench with post_corner_steps
  for (const post of ['post_as_drawn', 'post_corner_steps']) {
    await opt(p, 'post', post);
    for (const k of CORNERS) {
      await opt(p, 'corner', k); await p.waitForTimeout(150);
      const other = CORNERS.find(c => c !== k), steps = post === 'post_corner_steps' && L === 'a';
      const mine = await parts(p, k), mineSteps = await parts(p, `post_corner_steps+${k}`);
      const theirs = await parts(p, other), theirsSteps = await parts(p, `post_corner_steps+${other}`);
      const ok = mine[1] > 0 && theirs[0] === 0 && theirsSteps[0] === 0 &&
        (steps ? mine[0] === 0 && mineSteps[1] > 0 && mineSteps[0] === mineSteps[1] : mine[0] === mine[1] && mineSteps[0] === 0) &&
        (L === 'a' ? mineSteps[1] > 0 : mineSteps[1] === 0);
      check(`${L} (${post}): ${k} shows, the other doesn't`, ok, `plain ${mine[0]}/${mine[1]}, steps ${mineSteps[0]}/${mineSteps[1]}; other ${theirs[0]}/${theirs[1]}, ${theirsSteps[0]}/${theirsSteps[1]}`);
      // ---- the dims follow (the bench corner's height, and the steps' version with the corner post in A)
      await p.evaluate(() => __viewer.setDims(true)); await p.waitForTimeout(300);
      const ids = await p.evaluate(() => __viewer.dims.current().map(x => x.id));
      const pre = steps ? 'bench_steps_corner' : 'bench_corner';
      const want = [`${pre}_${k.slice(7)}_height`, pre], notWant = [`bench_corner_${other.slice(7)}_height`, `bench_steps_corner_${other.slice(7)}_height`, ...(L === 'a' ? [steps ? `bench_corner_${k.slice(7)}_height` : `bench_steps_corner_${k.slice(7)}_height`] : [])];
      check(`${L} (${post}): ${k}: the dims follow`, want.every(i => ids.includes(i)) && !notWant.some(i => ids.includes(i)), want.filter(i => !ids.includes(i)).concat(notWant.filter(i => ids.includes(i))).join(', '));
      await p.evaluate(() => __viewer.setDims(false));
      if (post === 'post_as_drawn') { await shot(p, `${L}_${k}_24`, '24_lounge_corner'); await shot(p, `${L}_${k}_15`, '15_lounge_from_alfresco'); }
    }
  }
  await opt(p, 'post', 'post_as_drawn'); await opt(p, 'corner', 'corner_timber');
  // ---- no camera jump: standing in the lounge just off the corner, and flying
  const dx = L === 'b' ? 0.76 : 0;
  await p.evaluate(x => { __viewer.setMode('walk'); __viewer.place(0.9 + x, 1.8, 6.45, 315, -10); }, dx); await p.waitForTimeout(800);
  for (const k of ['corner_aggregate', 'corner_timber', 'corner_aggregate']) {
    const a = await pos(p);
    await opt(p, 'corner', k); await p.waitForTimeout(500);
    const c = await pos(p);
    const dxz = Math.hypot(c[0] - a[0], c[2] - a[2]), dy = c[1] - a[1];
    check(`${L}, walking by the corner: to ${k}, no jump`, dxz < 0.01 && Math.abs(dy) < 0.15, `moved ${dxz.toFixed(3)} m, up/down ${dy.toFixed(3)} m`);
  }
  await p.evaluate(x => __viewer.walker.startFly(new __viewer.THREE.Vector3(0.9 + x, 3.4, 7.2), -0.8, -0.4), dx); await p.waitForTimeout(500);
  const f0 = await pos(p);
  for (const k of ['corner_timber', 'corner_aggregate', 'corner_timber']) { await opt(p, 'corner', k); await p.waitForTimeout(200); }
  await p.waitForTimeout(400);
  const f1 = await pos(p);
  check(`${L}, flying: switching the corner, the camera stays put`, Math.hypot(f1[0] - f0[0], f1[2] - f0[2]) < 0.01 && Math.abs(f1[1] - f0[1]) < 0.15, `moved ${Math.hypot(f1[0] - f0[0], f1[2] - f0[2]).toFixed(3)} m`);
  // ---- goToCam('24_lounge_corner'): the camera lands on the render's camera
  const cam = await p.evaluate(async L => (await (await fetch(`../web/cameras${L === 'b' ? '-b' : ''}.json`)).json()).find(c => c.name === '24_lounge_corner'), L);
  for (const mode of ['drone', 'walk']) {
    await p.evaluate(m => { __viewer.setMode(m); __viewer.goToCam('24_lounge_corner', true); }, mode); await p.waitForTimeout(900);
    const c = await pos(p), dh = Math.hypot(c[0] - cam.pos[0], c[2] - cam.pos[2]), dv = Math.abs(c[1] - cam.pos[1]);
    check(`${L}: goToCam('24_lounge_corner') (${mode})`, !!cam && dh < 0.35 && dv < 0.35, `${dh.toFixed(2)} m off, ${dv.toFixed(2)} m up/down`);
  }
  await p.close();
  // ---- URL param and remembered choice
  p = await open(ctx, `&layout=${L}&corner=aggregate`);
  const u = await p.evaluate(() => __viewer.model.corner);
  check(`${L}: ?corner=aggregate`, u === 'corner_aggregate', u);
  await p.close();
  p = await open(ctx, `&layout=${L}`);
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('alfresco'); });
  await p.locator('#cards-corner .card').filter({ has: p.locator('b', { hasText: /^Aggregate corner$/ }) }).click();
  await p.reload(); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  const r = await p.evaluate(() => __viewer.model.corner);
  check(`${L}: the picked card is remembered`, r === 'corner_aggregate', r);
  await p.close(); await ctx.close();
}

// ---- the pavilion deck's furniture: unmerged (?merge0) so the pieces keep their names
const FURN = /^(deck_pot_|deck_sofa_|egg_chair_|wall_basket_|bbq_covered)/;
for (const L of ['a', 'b']) for (const sc of ['existing', 'proposed']) {
  const ctx = await b.newContext();
  const p = await open(ctx, `&layout=${L}&scenario=${sc}&panel=0&merge0`);
  await p.evaluate(() => { __viewer.setPanel(false); __viewer.model.people = false; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
  await p.focus('#canvas');
  const found = await p.evaluate(src => {
    const re = new RegExp(src), V = __viewer, T = V.THREE, shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    const furn = [], deck = [];
    V.model.root.traverse(o => { if (!o.isMesh || !shown(o)) return; if (re.test(o.name)) furn.push(o); if (o.name === 'deck_pavilion') deck.push(o); });
    const box = o => new T.Box3().setFromObject(o);
    window.__deck = { furn, deck };
    const d = deck.length ? box(deck[0]) : null;
    return { furn: furn.map(o => { const bx = box(o), c = bx.getCenter(new T.Vector3()); return [o.name, +c.x.toFixed(2), +c.z.toFixed(2)]; }), deck: d && [d.min.x, d.min.z, d.max.x, d.max.z, d.max.y].map(v => +v.toFixed(2)) };
  }, FURN.source);
  const names = found.furn.map(f => f[0]);
  const wantAll = ['deck_sofa_frame', 'egg_chair_shell', 'deck_pot_geranium', 'deck_pot_charcoal', 'wall_basket_0', sc === 'existing' ? 'bbq_covered' : 'bbq_covered_moved'];
  check(`${L}, ${sc}: the deck and its furniture are there`, !!found.deck && wantAll.every(n => names.includes(n)), `deck ${JSON.stringify(found.deck)}; missing ${wantAll.filter(n => !names.includes(n)).join(', ') || 'none'}`);
  if (!found.deck) { await p.close(); await ctx.close(); continue; }
  // a start on the open deck, and a walk at each piece on it (x 3..9.6, z 0..6), plus straight across and back
  const [x0, z0, x1, z1] = found.deck, sx = 6.4, sz = 3.0;
  const targets = found.furn.filter(([, x, z]) => x > 3 && x < 9.6 && z > 0 && z < 6 && x > x0 - 0.5 && x < x1 + 0.5);
  const seen = new Set(), routes = [];
  for (const [n, x, z] of targets) { const k = n.replace(/_(cushions|frame|scatters|soil|flowers|stand|shell|cushion|small)+$/g, ''); if (seen.has(k)) continue; seen.add(k); routes.push([k, sx, sz, (Math.atan2(-(x - sx), -(z - sz)) * 180) / Math.PI, 2400]); }
  // the west walk starts at the first spot in from the deck's east end where the floor is the deck itself (not the
  // sofa or a side table, which stand along that end)
  const wx = await p.evaluate(([x1, sz, y]) => { for (let x = x1 - 0.4; x > x1 - 3; x -= 0.05) { const g = __viewer.walker.walkableAt(x, sz, y + 0.6); const ok = [-0.3, 0, 0.3].every(dz => Math.abs((__viewer.walker.walkableAt(x, sz + dz, y + 0.6) ?? 0) - y) < 0.02) && [0.3, 0.6].every(dx => Math.abs((__viewer.walker.walkableAt(x + dx, sz, y + 0.6) ?? 0) - y) < 0.02); if (g !== null && Math.abs(g - y) < 0.02 && ok) return +x.toFixed(2); } return x1 - 2; }, [x1, sz, found.deck[4]]);
  routes.push(['across, east', Math.max(x0 + 0.4, 3.4), sz, 270, 3200], ['across, west', wx, sz, 90, 3200]);
  for (const [name, x, z, yaw, ms] of routes) {
    await p.evaluate(([x, z, yaw, y]) => __viewer.place(x, y + 0.3, z, yaw, -8), [x, z, yaw, found.deck[4]]); await p.waitForTimeout(400);
    await p.evaluate(ms => { window.__samp = []; window.__until = performance.now() + ms + 600; const f = () => { const ft = __viewer.walker.feet; __samp.push([ft.x, ft.y, ft.z, __viewer.camera.position.y]); if (performance.now() < window.__until) requestAnimationFrame(f); }; requestAnimationFrame(f); }, ms);
    await p.keyboard.down('KeyW'); await p.waitForTimeout(ms); await p.keyboard.up('KeyW'); await p.waitForTimeout(700);
    const res = await p.evaluate(() => {
      const T = __viewer.THREE, ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0), s = window.__samp;
      let inside = null, offDeck = 0, onDeck = 0, worst = 0, path = 0;
      for (let i = 0; i < s.length; i++) {
        const [x, y, z, eye] = s[i];
        if (i) path += Math.hypot(x - s[i - 1][0], z - s[i - 1][2]);
        // the body from the eye down (the walker crouches under anything low, like the baskets hung on the house wall)
        ray.set(new T.Vector3(x, eye + 0.05, z), down); ray.far = eye - y + 0.05;
        const hit = ray.intersectObjects(__deck.furn, false)[0];
        if (hit && !inside) inside = `${hit.object.name} at ${x.toFixed(2)},${z.toFixed(2)}`;
        ray.set(new T.Vector3(x, y + 0.5, z), down); ray.far = 1.0;
        const d = ray.intersectObjects(__deck.deck, false)[0];
        if (d) { onDeck++; worst = Math.max(worst, Math.abs(d.point.y - y)); } else offDeck++;
      }
      const a = s[0], e = s[s.length - 1];
      return { inside, onDeck, offDeck, worst, path, from: [a[0], a[2]].map(v => +v.toFixed(2)), to: [e[0], e[2]].map(v => +v.toFixed(2)) };
    });
    check(`${L}, ${sc}: walk ${name}`, res.path > 0.4 && !res.inside && res.onDeck > 0 && res.worst < 0.06,
      `${res.from} -> ${res.to} (${res.path.toFixed(2)} m); ${res.inside ? `INSIDE ${res.inside}` : 'clear'}; on the deck ${res.onDeck}/${res.onDeck + res.offDeck}, floor off by ${res.worst.toFixed(3)} m`);
  }
  await p.evaluate(([x, z, y]) => __viewer.place(x, y + 0.3, z, 230, -12), [sx, sz, found.deck[4]]); await p.waitForTimeout(900);
  await p.locator('#canvas').screenshot({ path: `${OUT}/${L}_${sc}_deck_walk.png` });
  await shot(p, `${L}_${sc}_deck_12`, '12_from_pavilion'); await shot(p, `${L}_${sc}_deck_18`, '18_pier_fence');
  await p.close(); await ctx.close();
}

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

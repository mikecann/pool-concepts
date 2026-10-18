// Round 24 tests: the deck under the roof (card, its parts, the pot that makes way, the kitchen clash warnings), the
// planting along the boundary wall (incl. its instanced plants), and the light slot pool (16 slots, the same set of
// lights through dusk, options, Today and a scheme switch, with no frame hitch). Both layouts. Headless, real GPU.
//   node scripts/r24-test.mjs [--out review/round24/test]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round24/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(60)} ${info}`); if (!ok) fail++; };
const errs = [];
const open = async q => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('console', m => { if ((m.type() === 'error' && !/404/.test(m.text())) || /no free .* slot/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp&date=2027-01-16&t=885${q}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' });
  return p;
};
const opt = (p, k, v) => p.evaluate(([k, v]) => __viewer.setOption(k, v), [k, v]);
/** Meshes (instanced too) tagged with key in option or hide_option: [visible, total]. */
const tagged = (p, field, key) => p.evaluate(([f, k]) => { let n = 0, v = 0; __viewer.model.root.traverse(o => { if (o.isMesh && String(o.userData[f] ?? '').split(/[+|]/).includes(k)) { n++; let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) v++; } }); return [v, n]; }, [field, key]);
const instTagged = (p, key) => p.evaluate(k => { let n = 0, v = 0; __viewer.model.root.traverse(o => { if (o.isInstancedMesh && String(o.userData.option ?? '').split('+').includes(k)) { n++; let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) v++; } }); return [v, n]; }, key);
const warnOf = (p, box, t) => p.evaluate(([box, t]) => { const c = [...document.querySelectorAll(`#${box} .card`)].find(c => c.querySelector('b')?.textContent === t); return [...(c?.querySelectorAll('.card-warn:not([hidden])') ?? [])].map(w => w.textContent).join(' | '); }, [box, t]);

for (const L of ['a', 'b']) {
  const p = await open(`&layout=${L}`);
  // ---- the deck under the roof
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('fences'); });
  const deckTitle = 'Straight past the pillar, deck under the roof';
  check(`${L}: the deck card is in "Fence by the pillar"`, await p.locator('#cards-pier .card b', { hasText: new RegExp(`^${deckTitle}$`) }).count() === 1);
  const potBefore = await tagged(p, 'hide_option', 'pier_straight_deck');
  await opt(p, 'pier', 'pier_straight_deck'); await p.waitForTimeout(300);
  const deck = await tagged(p, 'option', 'pier_straight_deck'), pot = await tagged(p, 'hide_option', 'pier_straight_deck');
  check(`${L}: the deck and its fence show`, deck[1] > 0 && deck[0] > 0, `${deck[0]}/${deck[1]} parts (with the gate's)`);
  check(`${L}: the pot makes way for it (hide tag)`, potBefore[0] === potBefore[1] && potBefore[1] > 0 && pot[0] === 0, `before ${potBefore[0]}/${potBefore[1]}, with the deck ${pot[0]}`);
  check(`${L}: no clash warnings with no kitchen`, !(await warnOf(p, 'cards-pier', deckTitle)));
  for (const k of ['kitchen_split', 'kitchen_continuous', 'kitchen_freestanding', 'kitchen_lounge']) {
    await opt(p, 'kitchen', k);
    const kt = await p.evaluate(k => [...document.querySelectorAll('#cards-kitchen .card')].find(c => c.getAttribute('aria-pressed') === 'true')?.querySelector('b')?.textContent, k);
    const wk = await warnOf(p, 'cards-kitchen', kt), wd = await warnOf(p, 'cards-pier', deckTitle);
    check(`${L}: ${k} with the deck: both cards warn`, /where the deck goes/.test(wk) && /where the deck goes/.test(wd), wk);
  }
  await opt(p, 'kitchen', 'kitchen_none');
  check(`${L}:   and not once the kitchen goes`, !(await warnOf(p, 'cards-pier', deckTitle)));
  await opt(p, 'pier', 'pier_straight');
  await opt(p, 'kitchen', 'kitchen_split');
  check(`${L}:   nor with the straight fence alone`, !/deck/.test(await warnOf(p, 'cards-pier', 'Straight past the pillar')) && !/deck goes/.test(await warnOf(p, 'cards-kitchen', 'Split by the gate')));
  await opt(p, 'kitchen', 'kitchen_none'); await opt(p, 'pier', 'pier_straight_deck');
  await p.evaluate(() => __viewer.goToCam('10_alfresco_corner', true)); await p.waitForTimeout(1500);
  await p.locator('#canvas').screenshot({ path: `${OUT}/${L}_deck_10.png` });
  await opt(p, 'pier', 'pier_as_drawn');

  // ---- along the boundary wall
  await p.evaluate(() => window.__openCategory('bplant'));
  const titles = await p.locator('#cards-bplant .card b').allTextContents();
  check(`${L}: Along the boundary wall: three cards, bed by default`, titles.join(' | ') === 'Planter bed | Pots | Nothing' && (await p.evaluate(() => __viewer.model.bplant)) === 'bplant_bed', titles.join(' | '));
  await p.locator('#cat-bplant .info-btn').click();
  const ncz = await p.locator('#bplant-note').innerText();
  check(`${L}:   the i explains the 0.9 m limit (NCZ 5)`, /0\.9 m/.test(ncz) && /NCZ 5/.test(ncz) && /non-climbable/.test(ncz));
  for (const v of ['bplant_bed', 'bplant_pots', 'bplant_none']) {
    await opt(p, 'bplant', v); await p.waitForTimeout(200);
    const res = {};
    for (const k of ['bplant_bed', 'bplant_pots']) res[k] = await tagged(p, 'option', k);
    const ok = Object.entries(res).every(([k, [vis, n]]) => (k === v ? vis === n && n > 0 : vis === 0));
    check(`${L}:   ${v}: only its parts show`, ok, JSON.stringify(res));
  }
  // its instanced plants follow too
  await opt(p, 'bplant', 'bplant_bed');
  const ib = await instTagged(p, 'bplant_bed');
  await opt(p, 'bplant', 'bplant_none');
  const inone = await instTagged(p, 'bplant_bed');
  check(`${L}:   the instanced plants (option tag) follow`, ib[1] > 0 && ib[0] === ib[1] && inone[0] === 0, `bed ${ib[0]}/${ib[1]}, none ${inone[0]}`);
  await opt(p, 'bplant', 'bplant_bed');
  await p.evaluate(() => __viewer.goToCam('13_deep_end_to_house', true)); await p.waitForTimeout(1500);
  await p.locator('#canvas').screenshot({ path: `${OUT}/${L}_bplant_bed_13.png` });

  // ---- the light slots
  const lightSet = () => p.evaluate(() => { const ids = []; __viewer.scene.traverse(o => { if (o.isLight) ids.push(o.uuid); }); return ids.sort().join(); });
  const slots = await p.evaluate(() => __viewer.model.lightSlots());
  const used = slots.filter(s => s.light);
  check(`${L}: the light slots (16 or more), the current lights assigned`, slots.length >= 16 && used.length >= 10, `${used.length} of ${slots.length} in use: ${used.map(s => s.light).join(', ')}`);
  check(`${L}:   a downlight in the shadow-casting slot`, slots.some(s => s.shadow && /alfresco_downlight/.test(s.light ?? '')));
  await p.evaluate(() => { window.__openCategory('lighting'); });
  check(`${L}: Lighting: an "As specced" card, chosen`, (await p.locator('#cards-lighting .card[aria-pressed="true"] b').textContent()) === 'As specced');
  const set0 = await lightSet();
  await p.evaluate(() => __viewer.setTime(21 * 60)); await p.waitForTimeout(800);
  await opt(p, 'post', 'post_corner_steps'); await p.waitForTimeout(300);
  const withSteps = await p.evaluate(() => __viewer.model.lightSlots().filter(s => s.light).map(s => s.light));
  // (only SK02's layout has option-tagged lights: B's steps are already in the corner, so it has no step strips)
  if (L === 'a') check(`${L}:   an option's lights take free slots (corner post: step strips)`, withSteps.some(n => /steps/.test(n)), withSteps.filter(n => /bench/.test(n)).join(', '));
  await opt(p, 'post', 'post_as_drawn');
  await p.evaluate(() => __viewer.setScenario('existing')); await p.waitForTimeout(300);
  const today = await p.evaluate(() => __viewer.model.lightSlots().filter(s => s.light).length);
  await p.evaluate(() => __viewer.setScenario('proposed'));
  check(`${L}:   Today: the slots go dark (no garden lighting)`, today === 0, `${today} in use`);
  // (Round 25: the schemes are real now) two extra spots in the specced scheme, then switch to festoon and back
  await p.evaluate(() => {
    const m = __viewer.model;
    m.addLights([
      { name: 'test_spot_a', type: 'SPOT', position: [-1, 4.9, 1], direction: [0, -1, 0], color: [0.6, 0.8, 1], power: 60, spotAngle: 1.2, spotBlend: 0.3, set: 'proposed', option: 'lights_specced' },
      { name: 'test_spot_b', type: 'SPOT', position: [2, 4.9, 3], direction: [0, -1, 0], color: [0.6, 0.8, 1], power: 60, spotAngle: 1.2, spotBlend: 0.3, set: 'proposed', option: 'lights_specced' },
    ]);
  });
  const frames = await p.evaluate(() => new Promise(res => {
    const ft = []; let last = performance.now(), n = 0;
    const f = () => { const now = performance.now(); ft.push(now - last); last = now; n++;
      if (n === 10) __viewer.setOption('lighting', 'lights_festoon');
      if (n === 40) __viewer.setOption('lighting', 'lights_specced');
      if (n === 70) __viewer.setOption('lighting', 'lights_festoon');
      if (n < 100) requestAnimationFrame(f); else res(ft.slice(3)); };
    requestAnimationFrame(f);
  }));
  await opt(p, 'lighting', 'lights_specced');
  const onTest = await p.evaluate(() => __viewer.model.lightSlots().filter(s => s.light).map(s => s.light));
  check(`${L}: switching schemes reassigns slots`, onTest.includes('test_spot_a') && onTest.includes('test_spot_b'), `${onTest.length} in use`);
  check(`${L}:   the set of lights never changes`, (await lightSet()) === set0);
  const worst = Math.max(...frames);
  check(`${L}:   and no frame hitches (three switches at night)`, worst < 50, `worst ${worst.toFixed(0)} ms`);
  await p.locator('#canvas').screenshot({ path: `${OUT}/${L}_lights_test_scheme_night.png` });
  await opt(p, 'lighting', 'lights_festoon');
  check(`${L}:   in festoon, the specced test lights are off`, !(await p.evaluate(() => __viewer.model.lightSlots().some(s => /test_/.test(s.light ?? '')))));
  await p.close();
}
check('console clean (and no "no free slot")', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

// Round 17 tests: the mode is kept through cards, 'go to' and the scenario, and remembered; play_moved; pier_inset;
// the side gate (E, walking and flying); the roll-on covers for the pool and the hot tub (E, walking and flying),
// and the bathers hiding once a cover is on. Headless on the real GPU; exits 1 on failure or a console error.
//   node scripts/r17-test.mjs [--out review/round17/test]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round17/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = []; // renders still on their way from the model agent show as 'render to come': their 404s are expected
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
const load = async (q = '') => { await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp&date=2027-01-16&t=885${q}`); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 }); await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' }); };
await load();
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(52)} ${info}`); if (!ok) fail++; };
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.locator('#canvas').screenshot({ path: `${OUT}/${n}.png` });
const mode = () => p.evaluate(() => __viewer.walker.mode);
const vis = name => p.evaluate(n => { let o = __viewer.scene.getObjectByName(n); if (!o) return null; while (o) { if (!o.visible) return false; o = o.parent; } return true; }, name);
// by tag: the bathers' meshes may be merged with the other people, but keep their hide_option
const visTag = key => p.evaluate(k => { const out = []; __viewer.model.root.traverse(o => { if (o.isMesh && o.userData.hide_option === k) { let v = o, ok = true; while (v) { if (!v.visible) ok = false; v = v.parent; } out.push(ok); } }); return out.length ? out.every(Boolean) : null; }, key);
const tipText = async () => (await p.locator('#gate-tip').isVisible() ? (await p.locator('#gate-tip').innerText()).toLowerCase() : '');
const opt = (k, v) => p.evaluate(([k, v]) => __viewer.setOption(k, v), [k, v]);

// --- the mode is kept and remembered
await p.evaluate(() => __viewer.setPanel(true));
for (const m of ['fly', 'drone']) {
  await p.locator(`#mode-${m}`).click(); await wait(300);
  await p.locator('#tab-alfresco').click(); await p.locator('#cards-post .card').filter({ has: p.locator('b', { hasText: /^Corner post/ }) }).click(); await wait(2000);
  const after1 = await mode();
  await p.locator('#tab-fences').click(); await p.locator('#cards-nfence .card').filter({ has: p.locator('b', { hasText: /^Moved/ }) }).click(); await wait(2000);
  const after2 = await mode();
  await p.evaluate(() => __viewer.goToCam('06_sunken_lounge')); await wait(2000);
  const after3 = await mode();
  await p.locator('#sc-existing').click(); await wait(400); await p.locator('#sc-proposed').click(); await wait(400);
  const after4 = await mode();
  const y = await p.evaluate(() => __viewer.camera.position.y);
  check(`${m}: cards, 'go to' and the scenario keep ${m} mode`, [after1, after2, after3, after4].every(x => x === m), [after1, after2, after3, after4].join(','));
  if (m === 'fly') check('fly: "go to" 06 flies to the seated camera height, not walking height', Math.abs(y - 2.85) < 0.2, `y ${y.toFixed(2)}`);
}
// --- Round 17b: a card only switches the option: same place, same mode, in walk, fly and drone
const where = () => p.evaluate(() => ({ m: __viewer.walker.mode, c: __viewer.camera.position.toArray().map(v => +v.toFixed(3)) }));
for (const m of ['walk', 'fly', 'drone']) {
  await p.locator(`#mode-${m}`).click(); await wait(800);
  const a = await where();
  await p.locator('#tab-alfresco').click(); await p.locator('#cards-post .card').filter({ has: p.locator('b', { hasText: /^Two posts/ }) }).click(); await wait(1200);
  await p.locator('#tab-pool').click(); await p.locator('#cards-roller .card').filter({ has: p.locator('b', { hasText: /^Roller, deep end/ }) }).click(); await wait(1200);
  await p.locator('#sc-existing').click(); await wait(400); await p.locator('#sc-proposed').click(); await wait(800);
  const b2 = await where();
  check(`${m}: cards and Today/Proposed leave the camera and mode alone`, a.m === b2.m && a.c.join() === b2.c.join(), `${a.m} ${a.c.join(',')} -> ${b2.m} ${b2.c.join(',')}`);
  // the View button goes to the suggested viewpoint, keeping the mode
  await p.locator('#tab-alfresco').click(); await p.locator('#cards-post').locator('xpath=..').locator('.view-btn').click(); await wait(2200);
  const v2 = await where();
  check(`${m}: the View button goes there and keeps ${m}`, v2.m === m && v2.c.join() !== b2.c.join(), `${v2.m} ${v2.c.join(',')}`);
}
await p.evaluate(() => __viewer.setOption('roller', 'none'));
// 'go to' an aerial view while walking: still walking, at a safe spot, with a hint
await p.locator('#mode-walk').click(); await wait(300);
await p.evaluate(() => __viewer.goToCam('17_pool_overview')); await wait(2000);
const aw = await p.evaluate(() => ({ m: __viewer.walker.mode, feet: __viewer.walker.feet.y }));
const hint = (await p.locator('#hint').innerText().catch(() => '')).toLowerCase();
check("walking: 'go to' an aerial view keeps you walking, standing safely", aw.m === 'walk' && aw.feet >= 1.0, `${aw.m} feet ${aw.feet.toFixed(2)}`);
check('  with a hint that fly or drone gets the full view', hint.includes('fly or drone'), hint.slice(0, 60));
await p.locator('#mode-fly').click(); await wait(300);
await p.evaluate(() => __viewer.goToCam('17_pool_overview')); await wait(2200);
const af = await p.evaluate(() => ({ m: __viewer.walker.mode, y: __viewer.camera.position.y }));
check("flying: 'go to' an aerial view flies up there, still flying", af.m === 'fly' && af.y > 8, `${af.m} y ${af.y.toFixed(1)}`);

await p.locator('#mode-fly').click(); await wait(300);
await load();
check('the mode is remembered across a reload (fly)', (await mode()) === 'fly');
await p.locator('#mode-walk').click(); await wait(300);
await p.evaluate(() => __viewer.setPanel(false));

// --- play_moved: the play area moves 1.75 m north
await opt('play', 'play_as_is');
const tramp = () => p.evaluate(() => { const T = __viewer.THREE; let best = null; __viewer.model.root.traverse(o => { if (o.isMesh && /tramp/.test(o.name)) { let v = o, ok = true; while (v) { if (!v.visible) ok = false; v = v.parent; } if (ok) { const b = new T.Box3().setFromObject(o); const c = b.getCenter(new T.Vector3()); if (!best || c.z < best) best = c.z; } } }); return best; });
const z0 = await tramp();
await opt('play', 'play_moved');
const z1 = await tramp();
check('play_moved: the trampoline moves 1.75 m north', z0 !== null && z1 !== null && Math.abs((z0 - z1) - 1.75) < 0.15, `z ${z0?.toFixed(2)} -> ${z1?.toFixed(2)}`);
await p.evaluate(() => __viewer.goToCam('21_play_area_north', true)); await wait(1800); await shot('play_moved');
await opt('play', 'play_as_is');

// --- pier_inset: its fence shows and the as-drawn one doesn't
await opt('pier', 'pier_inset');
const inset = await p.evaluate(() => { const out = []; __viewer.model.root.traverse(o => { if (o.isMesh && /pier_inset|inset/.test(String(o.userData.option ?? ''))) { let v = o, ok = true; while (v) { if (!v.visible) ok = false; v = v.parent; } out.push(ok); } }); return out; });
check('pier_inset: its fence shows', inset.filter(Boolean).length > 0, `${inset.filter(Boolean).length} of ${inset.length} parts (the rest go with the continuous kitchen's gate)`);
check('pier_inset: the as-drawn east fence is hidden', (await vis('fence_pool_east_sk02_asdrawn_infill')) === false);
await p.evaluate(() => __viewer.goToCam('18_pier_fence', true)); await wait(1800); await shot('pier_inset');
await opt('pier', 'pier_as_drawn');

// --- the side gate: E opens it walking and flying, in both scenarios
const sg = await p.evaluate(() => { const h = __viewer.hinges.list.find(h => h.group === 'side_gate'); return h ? [h.centre.x, h.centre.y, h.centre.z] : null; });
check('the side gate is an openable door', !!sg);
for (const scen of ['existing', 'proposed']) {
  await p.evaluate(s => __viewer.setScenario(s), scen);
  await p.evaluate(([x, , z]) => { __viewer.place(x, 3, z + 1.3, 0, -5); }, sg); await wait(500);
  const t = await tipText();
  await p.keyboard.press('KeyE'); await wait(1300);
  const a = await p.evaluate(() => __viewer.hinges.list.find(h => h.group === 'side_gate').angle);
  check(`side gate (${scen === 'existing' ? 'Today' : 'Proposed'}): "open the door", E opens it`, t.includes('open') && a === 1, `${t} / ${a}`);
  await p.keyboard.press('KeyE'); await wait(1300);
}
await p.evaluate(([x, y, z]) => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(x, y + 1.3, z + 1.3), 0, -0.2); }, sg); await wait(500);
await p.keyboard.press('KeyE'); await wait(1300);
check('side gate: E opens it while flying', await p.evaluate(() => __viewer.hinges.list.find(h => h.group === 'side_gate').angle === 1));
await p.evaluate(() => __viewer.goToCam('23_side_gate', true)); await wait(1800); await shot('side_gate_open');
await p.keyboard.press('KeyE').catch(() => {});
await p.evaluate(() => { const h = __viewer.hinges.list.find(h => h.group === 'side_gate'); __viewer.hinges.toggle(h, false); __viewer.setMode('walk'); });

// --- the pool's roll-on cover, walking: E by the pool rolls it on, piece by piece, and off again
await opt('roller', 'roller_rollon_shallow');
const cov = () => p.evaluate(() => { const c = __viewer.covers().list.find(c => c.kind === 'pool'); return { p: +c.progress.toFixed(2), moving: c.moving, state: __viewer.model.poolCover, edge: +(+c.edgeU.value).toFixed(2), roll: c.active ? +c.active.group.scale.y.toFixed(2) : null }; });
const shallowRoll = await p.evaluate(() => __viewer.covers().list.find(c => c.kind === 'pool').rolls.find(r => r.end === 'shallow').centre.toArray());
await p.evaluate(([x, , z]) => { __viewer.place(x + 2.6, 3, z + 0.6, 90, -20); }, shallowRoll); await wait(500);
let t = await tipText();
check('pool: "roll the pool cover on" by the rolled cover', t.includes('roll the pool cover on'), t);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __viewer.covers().list.find(c => c.kind === 'pool').progress > 0.45, null, { timeout: 10000 }).catch(() => {});
let c = await cov();
check('pool: it unrolls across the pool, the roll shrinking', c.moving && c.p > 0.3 && c.p < 0.9 && c.roll < 0.9, JSON.stringify(c));
check('pool: the swimmer is still there while it moves', (await visTag('pool_cover_on')) === true);
await p.evaluate(() => __viewer.goToCam('17_pool_overview', true)); await shot('pool_cover_half');
await p.waitForFunction(() => __viewer.model.poolCover === 'on', null, { timeout: 12000 }).catch(() => {});
c = await cov();
check('pool: then it is fully on', c.state === 'on' && c.p === 1, JSON.stringify(c));
check('pool: and the swimmer is hidden', (await visTag('pool_cover_on')) === false);
await wait(1500); await shot('pool_cover_on');
// off again, flying this time
await p.evaluate(([x, , z]) => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(x, 4, z - 1), 0, -0.4); }, shallowRoll); await wait(500);
t = await tipText();
check('pool, flying: "roll the pool cover off"', t.includes('roll the pool cover off'), t);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __viewer.model.poolCover === 'off', null, { timeout: 12000 }).catch(() => {});
c = await cov();
check('pool, flying: E rolls it off again, the roll back at its end', c.state === 'off' && c.p === 0 && c.roll === 1, JSON.stringify(c));
check('pool: the swimmer is back', (await visTag('pool_cover_on')) === true);
// deep end too
await opt('roller', 'roller_rollon_deep');
const deepRoll = await p.evaluate(() => __viewer.covers().list.find(c => c.kind === 'pool').rolls.find(r => r.end === 'deep').centre.toArray());
await p.evaluate(([x, , z]) => { __viewer.setMode('walk'); __viewer.place(x + 2.6, 3, z - 0.6, 90, -20); }, deepRoll); await wait(500);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __viewer.model.poolCover === 'on', null, { timeout: 15000 }).catch(() => {});
check('pool, deep end: rolls on as well', (await p.evaluate(() => __viewer.model.poolCover)) === 'on');
await opt('roller', 'none');
check('switching the cover option away puts it back', (await p.evaluate(() => __viewer.model.poolCover)) === 'off');

// --- the hot tub's cover: rolled -> on -> rolled
await opt('spaCover', 'spa_cover_rolled');
await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(2.6, 3, 8.4, 140, -25); }); await wait(500);
t = await tipText();
check('spa: "roll the hot tub cover on"', t.includes('roll the hot tub cover on'), t);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __viewer.covers().list.find(c => c.kind === 'spa').progress > 0.4, null, { timeout: 8000 }).catch(() => {});
await shot('spa_cover_half');
await p.waitForFunction(() => __viewer.model.spaCover === 'spa_cover_on' && !__viewer.model.spaCoverMoving, null, { timeout: 8000 }).catch(() => {});
const sp1 = await p.evaluate(() => ({ s: __viewer.model.spaCover, m: __viewer.model.spaCoverMoving, p: __viewer.covers().list.find(c => c.kind === 'spa').progress })), pv1 = await visTag('spa_cover_on');
check('spa: it rolls on and the bather is hidden', sp1.s === 'spa_cover_on' && pv1 === false, JSON.stringify(sp1) + ' person ' + pv1);
await wait(800); await shot('spa_cover_on');
await p.evaluate(() => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(2.6, 3.6, 8.4), 140 * Math.PI / 180, -0.5); }); await wait(500);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __viewer.model.spaCover === 'spa_cover_rolled' && !__viewer.model.spaCoverMoving, null, { timeout: 8000 }).catch(() => {});
check('spa, flying: E rolls it off again', (await p.evaluate(() => __viewer.model.spaCover)) === 'spa_cover_rolled' && (await visTag('spa_cover_on')) === true);
await opt('spaCover', 'spa_cover_none');
await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(2.6, 3, 8.4, 140, -25); }); await wait(400);
check('spa: no cover chosen, no prompt', !(await tipText()).includes('cover'));
check('console clean', errs.length === 0, errs[0] ?? '');
console.log(fail ? `FAIL (${fail})` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

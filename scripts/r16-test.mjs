// Round 16 tests: alfresco post options, the blanket boxes (E unrolls and rolls back), the pump-room doors (E) and
// crouching into the pump room. Headless on the real GPU; exits 1 on any failure or console error.
//   node scripts/r16-test.mjs [--out review/round16/test]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round16/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:4173/model/walk/?q=Medium&panel=0&nohelp&date=2027-01-16&t=885');
await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(50)} ${info}`); if (!ok) fail++; };
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.locator('#canvas').screenshot({ path: `${OUT}/${n}.png` });
const visible = name => p.evaluate(n => { let o = __viewer.scene.getObjectByName(n); if (!o) return null; while (o) { if (!o.visible) return false; o = o.parent; } return true; }, name);

// --- posts: each option shows its own post and beams, and only that
for (const opt of ['post_as_drawn', 'post_corner', 'post_west', 'post_two']) {
  await p.evaluate(o => { __viewer.model.post = o; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); __viewer.goToCam('10_alfresco_corner', true); }, opt);
  await wait(1800);
  const vis = await Promise.all(['post_as_drawn', 'post_corner', 'post_west', 'post_two'].map(o => visible('alfresco_' + o)));
  check(`${opt}: its post shows, the others don't`, vis.filter(Boolean).length === 1 && vis[['post_as_drawn', 'post_corner', 'post_west', 'post_two'].indexOf(opt)] === true, vis.join(','));
  await shot(`post_${opt}`);
}
// the post is solid: walking into the as-drawn post stops you
await p.evaluate(() => { __viewer.model.post = 'post_as_drawn'; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
const post = await p.evaluate(() => { const b = new __viewer.THREE.Box3().setFromObject(__viewer.scene.getObjectByName('alfresco_post_as_drawn')); const c = b.getCenter(new __viewer.THREE.Vector3()); return [c.x, c.z, b.max.x - b.min.x]; });
check('the post exists', post[2] > 0.05, `x ${post[0].toFixed(2)} z ${post[1].toFixed(2)}`);

// --- blanket box at the deep end: E unrolls across the pool, E again rolls it back
await p.evaluate(() => { __viewer.model.roller = 'roller_pit'; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
check('the cavity paving hides when its box is chosen', (await visible('pitfill_roller_pit_concourse')) === false && (await visible('pitfill_roller_pit_shallow_concourse')) !== false);
const box = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit'); return [b.hinge.centre.x, b.hinge.centre.z]; });
await p.evaluate(([x, z]) => { __viewer.place(x, 3, z + 1.3, 0, -25); }, box);
await wait(600);
const tip = (await p.locator('#gate-tip').innerText().catch(() => '')).toLowerCase();
check('the box says "Press E to unroll the blanket"', tip.includes('unroll the blanket'), tip);
const phaseOf = g => p.evaluate(g => __viewer.blankets.boxes.find(b => b.group === g).phase, g);
const waitPhase = (g, ph, ms = 15000) => p.waitForFunction(([g, ph]) => __viewer.blankets.boxes.find(b => b.group === g).phase === ph, [g, ph], { timeout: ms }).then(() => true, () => false);
await p.keyboard.press('KeyE');
await p.waitForFunction(() => __viewer.blankets.boxes.find(b => b.group === 'roller_pit').hinge.angle > 0.6, null, { timeout: 5000 }).catch(() => {});
let st = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit'); return { phase: b.phase, lid: b.hinge.angle, prog: b.progress.value }; });
check('E opens the lids first', st.lid > 0.5 && st.prog === 0, JSON.stringify(st));
await p.evaluate(() => __viewer.goToCam('17_pool_overview', true));
await p.waitForFunction(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit'); return b.progress.value > 0.4; }, null, { timeout: 15000 }).catch(() => {});
st = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit'); return { phase: b.phase, prog: b.progress.value, roll: b.roll?.scale.y }; });
check('then the blanket unrolls, the roll shrinking', st.phase === 'unrolling' && st.prog > 0.2 && st.prog < 0.99 && st.roll < 0.95, JSON.stringify(st));
await shot('blanket_half');
await waitPhase('roller_pit', 'out');
st = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit'); return { phase: b.phase, prog: b.progress.value, lid: b.hinge.angle }; });
check('it covers the pool and the lids close', st.phase === 'out' && st.prog === 1 && st.lid === 0, JSON.stringify(st));
await shot('blanket_out');
await p.evaluate(() => __viewer.goToCam('05_pool_north_end', true)); await wait(2000); await shot('blanket_out_05');
// and back
await p.evaluate(([x, z]) => { __viewer.setMode('walk'); __viewer.place(x, 3, z + 1.3, 0, -25); }, box); await wait(500);
const tip2 = (await p.locator('#gate-tip').innerText().catch(() => '')).toLowerCase();
check('then it says "roll the blanket in"', tip2.includes('roll the blanket in'), tip2);
await p.keyboard.press('KeyE'); await wait(1500); await waitPhase('roller_pit', 'in');
st = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit'); return { phase: b.phase, prog: b.progress.value, lid: b.hinge.angle, roll: b.roll?.scale.y }; });
check('E rolls it back in and closes the box', st.phase === 'in' && st.prog === 0 && st.lid === 0 && st.roll === 1, JSON.stringify(st));
// the shallow box too
await p.evaluate(() => { __viewer.model.roller = 'roller_pit_shallow'; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
const box2 = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit_shallow'); return [b.hinge.centre.x, b.hinge.centre.z]; });
await p.evaluate(([x, z]) => { __viewer.place(x, 3, z - 1.3, 180, -25); }, box2); await wait(500);
await p.keyboard.press('KeyE'); await waitPhase('roller_pit_shallow', 'out');
st = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit_shallow'); return { phase: b.phase, prog: b.progress.value }; });
check('the shallow-end box unrolls too', st.phase === 'out' && st.prog === 1, JSON.stringify(st));
await p.evaluate(() => __viewer.goToCam('13_deep_end_to_house', true)); await wait(2000); await shot('blanket_shallow_out');
// switching the option away puts it back
await p.evaluate(() => { __viewer.model.roller = 'none'; }); await p.locator('#tab-pool').click({ trial: true }).catch(() => {});
await p.evaluate(() => { const o = __viewer.model; for (const b of __viewer.blankets.boxes) if (b.phase !== 'in') __viewer.blankets.reset(b, __viewer.hinges); o.apply(); });

// --- the pump room: doors open with E, and you crouch your way in
await p.evaluate(() => { __viewer.model.pump = 'pump_doors'; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
const door = await p.evaluate(() => { const h = __viewer.hinges.list.find(h => h.group === 'pump_doors'); return [h.centre.x, h.centre.y, h.centre.z]; });
// stand on the promenade facing the doors (they open outward, towards the canal)
await p.evaluate(([x, , z]) => { __viewer.place(x, 1.6, z + 1.05, 0, -10); }, door); await wait(600);
const tip3 = (await p.locator('#gate-tip').innerText().catch(() => '')).toLowerCase();
check('the pump doors say "Press E to open the door"', tip3.includes('open the door'), tip3);
await shot('pump_doors_shut');
await p.keyboard.press('KeyE'); await wait(1200);
const dang = await p.evaluate(() => __viewer.hinges.list.find(h => h.group === 'pump_doors').angle);
check('E opens both doors', dang === 1);
await shot('pump_doors_open');
// walk in: forward; you should crouch by yourself and end up inside under the deck
const z0 = await p.evaluate(() => __viewer.walker.feet.z);
await p.keyboard.down('KeyW'); await wait(3500); await p.keyboard.up('KeyW'); await wait(500);
let w = await p.evaluate(() => ({ z: __viewer.walker.feet.z, y: __viewer.walker.feet.y, eye: __viewer.camera.position.y - __viewer.walker.feet.y, crouch: __viewer.walker.crouching, room: __viewer.walker.headroomAt(__viewer.walker.feet.x, __viewer.walker.feet.z, __viewer.walker.feet.y) }));
check('walking in crouches you (eye about 0.8 m)', w.crouch && w.eye < 0.9, `eye ${w.eye.toFixed(2)}`);
check('and you get inside, under the deck', w.room < 1.1 && w.z < z0 - 1.0, `z ${z0.toFixed(2)} -> ${w.z.toFixed(2)}, headroom ${w.room.toFixed(2)}`);
const note = (await p.locator('#hint').innerText().catch(() => '')).toLowerCase();
check('with the low-headroom note', note.includes('low headroom'), note.slice(0, 40));
await shot('pump_inside');
// back out: stand up once there's room
await p.keyboard.down('KeyS');
await p.waitForFunction(() => { const w = __viewer.walker; return w.headroomAt(w.feet.x, w.feet.z, w.feet.y) > 2.5 && w.feet.z > 12.4; }, null, { timeout: 8000 }).catch(() => {});
await p.keyboard.up('KeyS'); await wait(800);
w = await p.evaluate(() => ({ eye: __viewer.camera.position.y - __viewer.walker.feet.y, crouch: __viewer.walker.crouching }));
check('walking back out stands you up', !w.crouch && w.eye > 1.5, `eye ${w.eye.toFixed(2)}`);
// with the doors shut you can't get in
await p.keyboard.press('KeyE'); await wait(1200);
await p.evaluate(([x, , z]) => { __viewer.place(x, 1.6, z + 1.2, 0, -10); }, door); await wait(300);
await p.keyboard.down('KeyW'); await wait(2500); await p.keyboard.up('KeyW');
const zs = await p.evaluate(() => __viewer.walker.feet.z);
check('shut doors stop you', zs > door[2] - 0.05, `z ${zs.toFixed(2)} door ${door[2].toFixed(2)}`);
// C crouches by hand on open ground, and again stands up
await p.evaluate(() => __viewer.place(1.3, 2.4, 2.6, 0, 0)); await wait(300);
await p.keyboard.press('KeyC'); await wait(600);
const ce = await p.evaluate(() => __viewer.camera.position.y - __viewer.walker.feet.y);
await p.keyboard.press('KeyC'); await wait(600);
const se = await p.evaluate(() => __viewer.camera.position.y - __viewer.walker.feet.y);
check('C crouches and stands', ce < 0.9 && se > 1.5, `${ce.toFixed(2)} / ${se.toFixed(2)}`);
// open bay: no doors
await p.evaluate(() => { __viewer.model.pump = 'pump_open'; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); __viewer.goToCam('22_pump_room', true); });
await wait(1800);
check('open bay: doors gone, lintel shown', (await visible('pump_door_l')) === false && (await visible('pump_lintel')) === true);
await shot('pump_open_inside');
// --- fly mode: E opens things just as walking does (Round 16b)
await p.evaluate(() => { __viewer.model.pump = 'pump_doors'; __viewer.model.roller = 'roller_pit'; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
for (const b of await p.evaluate(() => __viewer.blankets.boxes.map(b => b.group))) await p.evaluate(g => { const b = __viewer.blankets.boxes.find(b => b.group === g); __viewer.blankets.reset(b, __viewer.hinges); }, b);
await p.evaluate(([x, y, z]) => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(x, y + 0.6, z + 1.2), 0, -0.3); }, door);
await wait(500);
const ftip = (await p.locator('#gate-tip').innerText().catch(() => '')).toLowerCase();
check('flying: the pump doors offer E', ftip.includes('open the door'), ftip);
await p.keyboard.press('KeyE'); await wait(1300);
check('flying: E opens the doors', await p.evaluate(() => __viewer.hinges.list.find(h => h.group === 'pump_doors').angle === 1));
await p.keyboard.press('KeyE'); await wait(1300);
const bx = await p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_pit'); return [b.hinge.centre.x, b.hinge.centre.y, b.hinge.centre.z]; });
await p.evaluate(([x, y, z]) => { __viewer.walker.startFly(new __viewer.THREE.Vector3(x, y + 1.6, z + 1.3), 0, -0.6); }, bx);
await wait(500);
await p.keyboard.press('KeyE');
const ok = await p.waitForFunction(() => __viewer.blankets.boxes.find(b => b.group === 'roller_pit').phase === 'out', null, { timeout: 15000 }).then(() => true, () => false);
check('flying: E unrolls the blanket', ok);
// a pool gate too, and nothing from high above
const gate = await p.evaluate(() => { const g = __viewer.model.gates.find(g => g.leaf.name.startsWith('fence_pool_north') && __viewer.model.gateVisible(g)); const d = __viewer.model.gateDir(g); return [g.hinge.x + d.x * g.width / 2, g.hinge.y, g.hinge.z + d.z * g.width / 2]; });
await p.evaluate(([x, y, z]) => { __viewer.walker.startFly(new __viewer.THREE.Vector3(x - 0.6, y + 1.5, z - 1.3), Math.PI * 160 / 180, -0.2); }, gate);
await wait(500);
const gtip = (await p.locator('#gate-tip').innerText().catch(() => '')).toLowerCase();
check('flying: a pool gate offers E', gtip.includes('the gate'), gtip);
await p.evaluate(([x, y, z]) => { __viewer.walker.startFly(new __viewer.THREE.Vector3(x - 0.6, y + 6, z - 1.3), Math.PI * 160 / 180, -0.6); }, gate);
await wait(500);
check('flying high above it: no prompt', await p.locator('#gate-tip').isHidden());
await p.evaluate(() => __viewer.setMode('walk'));
check('console clean', errs.length === 0, errs[0] ?? '');
console.log(fail ? `FAIL (${fail})` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

// Round 15 tests: tape measure (real clicks), fly mode (keys, collisions, mode switching) and getting into and out
// of the pool. Headless on the real GPU. Exits 1 on any failure or console error.
//   node scripts/tools-test.mjs [--out review/round15/tools]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round15/tools';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:4173/model/walk/?q=Medium&panel=0&nohelp&date=2027-01-16&t=885');
await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} ${info}`); if (!ok) fail++; };
const wait = ms => p.waitForTimeout(ms);
const hold = async (key, ms) => { await p.keyboard.down(key); await wait(ms); await p.keyboard.up(key); };
const canvasBox = await p.locator('#canvas').boundingBox();
const cx = canvasBox.x + canvasBox.width / 2, cy = canvasBox.y + canvasBox.height / 2;

// --- tape measure: from above the alfresco deck looking straight down, measure the centre, move 3 m east, measure again
await p.evaluate(() => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(-1.5, 4.5, 3.5), 0, -1.5707); });
await wait(600);
await p.keyboard.press('KeyM');
check('M opens the tape measure', await p.evaluate(() => __viewer.tape().active));
await p.mouse.click(cx, cy);
await p.evaluate(() => { __viewer.walker.startFly(new __viewer.THREE.Vector3(1.5, 4.5, 3.5), 0, -1.5707); });
await wait(500);
await p.mouse.click(cx, cy);
await wait(300);
let m = await p.evaluate(() => __viewer.tape().list());
const d = m[0]?.distance ?? 0, dy = m[0] ? Math.abs(m[0].a[1] - m[0].b[1]) : 9;
check('two clicks make one measurement', m.length === 1, `n=${m.length}`);
check('3 m apart on the deck measures 3.00 m', Math.abs(d - 3) < 0.03 && dy < 0.03, `d=${d.toFixed(3)} dy=${dy.toFixed(3)}`);
check('a label is shown', await p.locator('.measure-label').count() === 1, await p.locator('.measure-label').first().innerText().catch(() => ''));
// a vertical one: from the deck to the alfresco ceiling, from the side
await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(0.5, 2.4, 3.5, 90, 0); });
await wait(500);
await p.screenshot({ path: `${OUT}/measure_walk.png` });
await p.keyboard.press('Escape');
await wait(200);
check('Esc clears the measurements', (await p.evaluate(() => __viewer.tape().list())).length === 0 && await p.locator('.measure-label').count() === 0);
// in the drone
await p.evaluate(() => __viewer.goToCam('17_pool_overview', true)); await wait(1800);
await p.mouse.click(cx - 60, cy + 40); await p.mouse.click(cx + 60, cy + 40); await wait(300);
m = await p.evaluate(() => __viewer.tape().list());
check('measuring works in the drone', m.length === 1 && m[0].distance > 0.5, `d=${m[0]?.distance.toFixed(2)}`);
await p.screenshot({ path: `${OUT}/measure_drone.png` });
await p.locator('#measure-done').click();
check('Done puts the tape away', !(await p.evaluate(() => __viewer.tape().active)));
await p.evaluate(() => __viewer.tape().clear());

// --- fly mode: keys, collisions, mode switches
// out in the open on the lawn west of the pool, then into the house wall north of the alfresco
await p.evaluate(() => { __viewer.setMode('walk'); __viewer.place(-10, 2.4, 6, 0, 0); });
await wait(400);
await p.locator('#mode-fly').click(); await wait(300);
const y0 = await p.evaluate(() => __viewer.camera.position.y);
await p.locator('#canvas').focus();
await hold('Space', 600);
const y1 = await p.evaluate(() => __viewer.camera.position.y);
check('Space flies up', y1 > y0 + 1.2, `${y0.toFixed(2)} -> ${y1.toFixed(2)}`);
await hold('KeyE', 400); await wait(100);
const y2 = await p.evaluate(() => __viewer.camera.position.y);
check('E flies up too (no gate in fly mode)', y2 > y1 + 0.8, `-> ${y2.toFixed(2)}`);
await hold('KeyC', 2500);
const y3 = await p.evaluate(() => __viewer.camera.position.y);
const gy = await p.evaluate(() => __viewer.walker.walkableAt(__viewer.camera.position.x, __viewer.camera.position.z, 8) ?? 0);
check('C flies down and stops at the ground', y3 > gy && y3 < gy + 0.6, `-> ${y3.toFixed(2)} (ground ${gy.toFixed(2)})`);
// fly up into the alfresco ceiling from below
await p.evaluate(() => { __viewer.walker.startFly(new __viewer.THREE.Vector3(1.3, 3.5, 2.6), 0, 0); }); await wait(200);
await hold('Space', 1800);
const yc = await p.evaluate(() => __viewer.camera.position.y);
check('the alfresco ceiling stops you', yc < 5.01, `-> ${yc.toFixed(2)}`);
// fly at the house wall (west of the start spot) and don't go through it
await p.evaluate(() => { __viewer.walker.startFly(new __viewer.THREE.Vector3(1.3, 3.5, 2.6), 0, 0); }); await wait(200);
await hold('KeyW', 2500);
const zw = await p.evaluate(() => __viewer.camera.position.z);
check('the house wall stops you', zw > 0.3, `z -> ${zw.toFixed(2)}`);
await p.screenshot({ path: `${OUT}/fly.png` });
// mode switches, all six
for (const [a, c] of [['fly', 'drone'], ['drone', 'fly'], ['fly', 'walk'], ['walk', 'drone'], ['drone', 'walk'], ['walk', 'fly']]) {
  await p.evaluate(m => __viewer.setMode(m), a); await wait(300);
  await p.evaluate(m => __viewer.setMode(m), c); await wait(500);
  const s = await p.evaluate(() => ({ mode: __viewer.walker.mode, y: __viewer.camera.position.y, feet: __viewer.walker.feet.y }));
  check(`${a} -> ${c}`, s.mode === c && s.y > 1 && (c !== 'walk' || s.feet >= 1.0), `cam y ${s.y.toFixed(2)}${c === 'walk' ? ` feet ${s.feet.toFixed(2)}` : ''}`);
}

// --- the pool: walk in off the coping at the deep end, wade, duck under, climb out
await p.evaluate(() => { __viewer.setMode('walk'); __viewer.goToCam('05_pool_north_end', true); });
await wait(1500);
// stand on the west coping, facing east across the pool
const pool = await p.evaluate(() => { const b = new __viewer.THREE.Box3(); __viewer.model.waters.filter(w => w.userData.water === 'pool').forEach(w => b.union(new __viewer.THREE.Box3().setFromObject(w))); return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, y: b.max.y }; });
const midZ = (pool.minZ + pool.maxZ) / 2 + 2;
await p.evaluate(([x, z]) => { __viewer.place(x, 3, z, -90, -10); }, [pool.minX - 0.35, midZ]);
await wait(400);
await hold('KeyW', 1300);
await wait(1500);
let s = await p.evaluate(() => ({ feet: __viewer.walker.feet.y, inWater: __viewer.walker.inWater, top: __viewer.walker.waterTop }));
check('walking off the coping steps down into the pool', s.inWater && s.feet < pool.y - 0.5, `feet ${s.feet.toFixed(2)} water ${s.top.toFixed(2)}`);
const x0 = await p.evaluate(() => __viewer.walker.feet.x);
await hold('KeyW', 1000);
const x1 = await p.evaluate(() => __viewer.walker.feet.x);
check('wading is slower than walking (< 1.2 m/s)', Math.abs(x1 - x0) < 1.2 && Math.abs(x1 - x0) > 0.2, `${Math.abs(x1 - x0).toFixed(2)} m in 1 s`);
await p.keyboard.down('KeyC'); await wait(1200);
s = await p.evaluate(() => ({ eye: __viewer.camera.position.y, top: __viewer.walker.waterTop, under: document.getElementById('world').classList.contains('underwater') || (__viewer.post?.underU?.value ?? 0) > 0.5 }));
check('C ducks the eye under the surface', s.eye < s.top - 0.05, `eye ${s.eye.toFixed(2)} surface ${s.top.toFixed(2)}`);
check('the underwater look is on', s.under);
await p.screenshot({ path: `${OUT}/underwater.png` });
await p.keyboard.up('KeyC'); await wait(1200);
// climb out: face the nearest long side and press Space
await p.evaluate(([x, z]) => { __viewer.place(x, 1.5, z, 90, 0); }, [pool.minX + 0.5, midZ]);
await wait(600);
await p.keyboard.press('Space'); await wait(1200);
s = await p.evaluate(() => ({ feet: __viewer.walker.feet.y, inWater: __viewer.walker.inWater }));
check('Space at the wall climbs out onto the coping', !s.inWater && s.feet > pool.y - 0.05, `feet ${s.feet.toFixed(2)}`);
// the canal stays a no-go: walk at it from the canal path
await p.evaluate(() => { __viewer.place(2.0, 3, 12.2, 180, 0); }); await wait(400);
await hold('KeyW', 2500);
s = await p.evaluate(() => ({ feet: __viewer.walker.feet.y, z: __viewer.walker.feet.z }));
check('you still can\'t walk into the canal', s.feet > 0.9, `feet ${s.feet.toFixed(2)} z ${s.z.toFixed(2)}`);

// --- hinged lids and doors: a stand-in lid on the alfresco (the real ones come with the next export)
const lid = await p.evaluate(() => {
  const T = __viewer.THREE, v = __viewer;
  const box = new T.Mesh(new T.BoxGeometry(1, 0.05, 0.6), new T.MeshStandardMaterial({ color: 0x888888 }));
  box.position.set(1.3, 2.4, 1.8); box.name = 'test_lid';
  box.userData = { interact: 'lid', group: 'test_pit', pivot: [1.3, 2.4, 1.5], axis: [1, 0, 0], open_deg: 100, blanket_from: 'deep' };
  v.model.root.add(box); box.updateMatrixWorld(true);
  const h = v.hinges.add('test_pit', [box]);
  v.place(1.3, 2.4, 2.9, 0, -20);
  return h.group;
});
await wait(500);
const tip = await p.locator('#gate-tip').innerText().catch(() => '');
check('a lid shows "Press E to open the lid"', /open the lid/i.test(tip), tip);
await p.keyboard.press('KeyE'); await wait(1200);
let ang = await p.evaluate(() => { const h = __viewer.hinges.list.find(h => h.group === 'test_pit'); return [h.angle, new __viewer.THREE.Euler().setFromQuaternion(h.pivot.quaternion).x * 180 / Math.PI]; });
check('E opens it 100 degrees about its hinge', ang[0] === 1 && Math.abs(ang[1] - 100) < 1, `angle ${ang[1].toFixed(1)}`);
await p.keyboard.press('KeyE'); await wait(1200);
ang = await p.evaluate(() => __viewer.hinges.list.find(h => h.group === 'test_pit').angle);
check('E again closes it', ang === 0);
check('console clean', errs.length === 0, errs[0] ?? '');
console.log(fail ? `FAIL (${fail})` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

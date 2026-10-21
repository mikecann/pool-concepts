// Walk with real key presses (headless) and print where the walker ends up: steps, pool edge, walls. First the modes:
// only Walk and Fly (no drone), and ?cam= an aerial view while flying lands on the render camera itself.
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto('http://localhost:4173/model/walk/?panel=0&q=Medium&nohelp' + (process.env.EXTRA ? '&' + process.env.EXTRA : ''));
await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
await p.focus('#canvas');
if (process.argv[2] === 'nopeople') await p.evaluate(() => { __viewer.model.people = false; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
const walk = async (name, pos, key, ms) => {
  await p.evaluate(pos => __viewer.place(...pos), pos);
  await p.waitForTimeout(300);
  const a = await p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(2)));
  await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key);
  await p.waitForTimeout(500);
  const z = await p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(2)));
  console.log(name.padEnd(28), 'start', a.join(','), '-> end', z.join(','));
};
await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 60000 });   // background compiles done

// ---------- modes: walk and fly only ----------
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(56)} ${info}`); if (!ok) fail++; };
check('no Drone button', (await p.locator('#mode-drone').count()) === 0);
const modeButtons = await p.locator('[aria-label="Camera mode"] button').allTextContents();
check('the top mode buttons are Walk and Fly', modeButtons.map(t => t.trim()).join() === 'Walk,Fly', modeButtons.join());
check('no drone class on the view', !(await p.evaluate(() => document.getElementById('world').classList.contains('drone'))));
{
  // a visitor who last flew opens a renders-page link to an aerial view: flying, exactly at the render camera
  const ctx = await b.newContext({ viewport: { width: 1200, height: 700 } });
  await ctx.addInitScript(() => { try { if (location.pathname.startsWith('/model/') && !sessionStorage.seeded) { sessionStorage.seeded = 1; localStorage.setItem('pool-settings', JSON.stringify({ mode: 'fly' })); } } catch {} });
  const q = await ctx.newPage(); const errs = []; q.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await q.goto('http://localhost:4173/model/walk/?panel=0&q=Medium&nohelp&cam=07_aerial_southwest');
  await q.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
  await q.waitForTimeout(500);
  const cam = await q.evaluate(async () => (await (await fetch('../web/cameras.json')).json()).find(c => c.name === '07_aerial_southwest'));
  const s = await q.evaluate(() => { const V = __viewer, d = new V.THREE.Vector3(); V.camera.getWorldDirection(d); return { mode: V.walker.mode, pos: V.camera.position.toArray(), dir: d.toArray() }; });
  const off = cam ? Math.hypot(s.pos[0] - cam.pos[0], s.pos[1] - cam.pos[1], s.pos[2] - cam.pos[2]) : 99;
  const want = cam ? cam.target.map((v, i) => v - cam.pos[i]) : [0, 0, 1], wl = Math.hypot(...want);
  const dot = s.dir.reduce((a, v, i) => a + v * want[i] / wl, 0);
  check('?cam=07_aerial_southwest in fly: at the render camera', s.mode === 'fly' && off < 0.05, `${s.mode} ${off.toFixed(3)} m off`);
  check('  looking where it looks', dot > 0.999, `dot ${dot.toFixed(4)}`);
  check('  console clean', errs.length === 0, errs[0] ?? '');
  await ctx.close();
}
await walk('spa deck -> down into lounge', [0.1, 3, 10.9, 0, 0], 'KeyW', 3500);
await walk('lounge -> up the steps', [0.5, 2.0, 6.5, 180, 0], 'KeyW', 1600);   // stops on the spa deck (it has no barrier at its south edge, so don't walk off it)
await walk('coping -> into pool (west)', [-2.1, 3, 4.5, 90, 0], 'KeyW', 3000);
await walk('alfresco -> house wall (N)', [1.3, 3, 2.6, 0, 0], 'KeyW', 4000);
await walk('run along concourse (S)', [-1.5, 3, 1.0, 180, 0], 'ShiftLeft', 10);

// ---------- gates ----------
const feet = () => p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(2)));
const gate = await p.evaluate(() => { const g = __viewer.model.gates.find(g => __viewer.model.gateVisible(g) && g.leaf.name.startsWith('fence_pool_north')); return g && { hinge: g.hinge.toArray(), dir: g.dir.toArray(), width: g.width, swing: g.swing }; });
if (!gate) { console.log('no visible north gate'); } else {
  // stand a metre north of the gate's middle (the house side), facing it (south)
  const mx = gate.hinge[0] + gate.dir[0] * gate.width / 2, mz = gate.hinge[2] + gate.dir[2] * gate.width / 2;
  await p.evaluate(([x, z]) => __viewer.place(x, 3, z - 1.0, 180, -5), [mx, mz]);
  await p.waitForTimeout(400);
  const tip = await p.evaluate(() => { const t = document.getElementById('gate-tip'); return t.hidden ? '(no tooltip)' : t.textContent; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW'); await p.waitForTimeout(300);
  const closedEnd = await feet();
  console.log('gate closed, walk into it      tooltip:', JSON.stringify(tip), ' end z', closedEnd[2], closedEnd[2] < mz ? '(blocked: good)' : '(WENT THROUGH: bad)');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(800);
  const angle = await p.evaluate(() => __viewer.model.gates.find(g => g.leaf.name.startsWith('fence_pool_north')).angle.toFixed(2));
  const tip2 = await p.evaluate(() => { const t = document.getElementById('gate-tip'); return t.hidden ? '(no tooltip)' : t.textContent; });
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2200); await p.keyboard.up('KeyW'); await p.waitForTimeout(300);
  const openEnd = await feet();
  console.log('E opens it, walk through       open', angle, ' tooltip:', JSON.stringify(tip2), ' end z', openEnd[2], openEnd[2] > mz + 0.3 ? '(through: good)' : '(STILL BLOCKED: bad)');
  // keep walking away, then wait: it should swing shut about 5 s after you're clear
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1200); await p.keyboard.up('KeyW');
  const t0 = Date.now();
  await p.waitForFunction(() => __viewer.model.gates.find(g => g.leaf.name.startsWith('fence_pool_north')).angle < 0.01, null, { timeout: 12000 }).catch(() => {});
  const shut = await p.evaluate(() => __viewer.model.gates.find(g => g.leaf.name.startsWith('fence_pool_north')).angle.toFixed(2));
  console.log('self-closing                   angle', shut, 'after', ((Date.now() - t0) / 1000).toFixed(1), 's', +shut <= 0.01 ? '(shut: good)' : '(STILL OPEN: bad)');
}

// ---------- jump ----------
await p.evaluate(() => __viewer.place(-1.5, 3, 2.0, 180, 0));
await p.waitForTimeout(400);
const y0 = (await feet())[1];
await p.evaluate(() => { window.__maxY = -1e9; const f = () => { window.__maxY = Math.max(window.__maxY, __viewer.state().feet[1]); if (performance.now() < window.__until) requestAnimationFrame(f); }; window.__until = performance.now() + 1500; requestAnimationFrame(f); });
await p.keyboard.press('Space');
await p.waitForTimeout(1600);
const peak = await p.evaluate(() => window.__maxY), y1 = (await feet())[1];
console.log('jump on the concourse          start y', y0, ' peak', peak.toFixed(2), `(+${(peak - y0).toFixed(2)} m)`, ' landed y', y1);
// try to hop the 1.2 m pool fence: run at the east fence from outside (lawn side), jumping all the way
const fence = await p.evaluate(() => { let b = null; __viewer.scene.traverse(o => { if (o.name === 'fence_pool_east_infill' && o.visible) { o.geometry.computeBoundingBox(); b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); } }); return b && [b.min.x, b.max.x, b.min.z, b.max.z]; });
{
  // the east pool fence beside the lawn (named meshes are merged now, so use the known spot if the name's gone)
  const fx = fence ? (fence[0] + fence[1]) / 2 : 3.44, fz = fence ? (fence[2] + fence[3]) / 2 + 1.6 : 7.37;
  await p.evaluate(([x, z]) => __viewer.place(x + 1.5, 3, z, 90, 0), [fx, fz]);   // east of the fence, facing west
  await p.waitForTimeout(400);
  const s0 = await feet();
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await p.waitForTimeout(2400);
  await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft'); await p.waitForTimeout(400);
  const walked = await feet();
  await p.evaluate(([x, z]) => __viewer.place(x + 1.5, 3, z, 90, 0), [fx, fz]);
  await p.waitForTimeout(400);
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW');
  for (let i = 0; i < 8; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(300); }
  await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft'); await p.waitForTimeout(600);
  const s1 = await feet();
  // the fence line at this z: where the floor ray suddenly hits something over 1 m higher (the fence top)
  const line = await p.evaluate(([x0, z]) => { const w = __viewer.walker; let prev = w.groundAt(x0, z, 6); for (let x = x0; x > x0 - 3; x -= 0.02) { const g = w.groundAt(x, z, 6); if (g - prev > 1) return x; prev = g; } return null; }, [s0[0], fz]);
  console.log('jump at the pool fence         start x', s0[0], ' walking stops at', walked[0], '(0.6 m terrace step), jumping stops at', s1[0], ' fence line x', line?.toFixed(2), s1[0] > line ? '(still outside the fence: good)' : '(CLEARED THE FENCE: bad)');
}
console.log(fail ? `modes: ${fail} FAILED` : 'modes: PASS');
await b.close();
process.exit(fail ? 1 : 0);

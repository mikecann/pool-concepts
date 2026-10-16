// Regression test (Round 13): scenario Today <-> Proposed and quality Low <-> High, by day and by night, starting
// from a Today load (the r7 P0 path). Fails if WebGPU logs any error, or if the sun's shadows are missing: the share
// of dark pixels in a sunny view must stay close to a fresh load of the same scenario, view and time.
//   node scripts/switch-test.mjs [--out review/round13/switch]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round13/switch';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const VIEW = '13_deep_end_to_house', DAY = 885, NIGHT = 1260;
const open = async scen => {
  const p = await b.newPage({ viewport: { width: 1200, height: 675 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error' || /GPUValidationError|Destroyed/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.goto(`http://localhost:4173/model/walk/?q=Medium&panel=0&nohelp&date=2027-01-16&scenario=${scen}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  await p.addStyleTag({ content: '.hud,.hint-pill,.welcome,.status-pill,.gate-tip,.fps,.crosshair,.joystick{display:none!important}' });
  return { p, errs };
};
// share of the frame darker than a threshold: sun shadows are most of the dark area in a sunny view
const darkShare = async file => { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); let n = 0; for (let i = 0; i < data.length; i += 3) if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] < 70) n++; return n / (info.width * info.height); };
const shot = async (p, name, scen, t) => { await p.evaluate(([s, t, v]) => { __viewer.setScenario(s); __viewer.setTime(t); __viewer.goToCam(v, true); }, [scen, t, VIEW]); await p.waitForTimeout(2200); const f = `${OUT}/${name}.png`; await p.locator('#canvas').screenshot({ path: f }); return f; };
// references from fresh loads
const ref = {};
for (const scen of ['existing', 'proposed']) { const { p } = await open(scen); ref[scen] = await darkShare(await shot(p, `ref_${scen}`, scen, DAY)); await p.close(); }
let fail = 0;
const { p, errs } = await open('existing');
const steps = [
  ['Today day', 'existing', DAY], ['Today->Proposed day', 'proposed', DAY], ['Proposed->Today day', 'existing', DAY], ['Today->Proposed again', 'proposed', DAY],
  ['night Proposed', 'proposed', NIGHT], ['night ->Today', 'existing', NIGHT], ['night ->Proposed', 'proposed', NIGHT], ['back to day Proposed', 'proposed', DAY],
];
for (const [name, scen, t] of steps) {
  const e0 = errs.length;
  const f = await shot(p, name.replace(/[^a-z0-9]+/gi, '_'), scen, t);
  let line = `${name.padEnd(24)} errors +${errs.length - e0}`;
  if (errs.length > e0) fail++;
  if (t === DAY) { const d = await darkShare(f); const ok = d > ref[scen] * 0.7; line += `  dark ${(d * 100).toFixed(1)}% (fresh ${(ref[scen] * 100).toFixed(1)}%) ${ok ? 'shadows ok' : 'SHADOWS MISSING'}`; if (!ok) fail++; }
  console.log(line);
}
for (const [q1, q2] of [['Low', 'High'], ['High', 'Low'], ['Low', 'Medium']]) for (const t of [DAY, NIGHT]) {
  const e0 = errs.length;
  await p.evaluate(([q, t]) => { __viewer.setTime(t); __viewer.setQuality(q); }, [q1, t]); await p.waitForTimeout(1500);
  await p.evaluate(s => __viewer.setScenario(s), 'existing'); await p.waitForTimeout(600);
  await p.evaluate(s => __viewer.setScenario(s), 'proposed'); await p.waitForTimeout(600);
  await p.evaluate(q => __viewer.setQuality(q), q2); await p.waitForTimeout(2000);
  const f = await shot(p, `q_${q1}_${q2}_${t}`, 'proposed', t);
  let line = `quality ${q1}->${q2} ${t === DAY ? 'day  ' : 'night'}  errors +${errs.length - e0}`;
  if (errs.length > e0) fail++;
  if (t === DAY && q2 !== 'Low') { const d = await darkShare(f); const ok = d > ref.proposed * 0.7; line += `  dark ${(d * 100).toFixed(1)}% ${ok ? 'shadows ok' : 'SHADOWS MISSING'}`; if (!ok) fail++; }
  console.log(line);
}
console.log(fail ? `FAIL (${fail})` : 'PASS', errs.length ? '\nfirst error: ' + errs[0] : '');
await b.close();
process.exit(fail ? 1 : 0);

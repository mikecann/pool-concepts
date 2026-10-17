// Frame-time benchmark: for each quality and view, wall-clock fps, GPU ms per frame (timestamp queries),
// draw calls and triangles. Headless, real GPU. Appends one JSON line per measurement to --log.
//   node scripts/perf.mjs [--qualities Medium,High,Low] [--views alfresco,lounge,pooledge] [--time 1300]
//                         [--extra "x=1"] [--label base] [--log review/round6/perf.log] [--secs 3]
import { chromium } from 'playwright';
import { appendFileSync, mkdirSync } from 'node:fs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const QS = arg('qualities', 'Medium').split(','), VIEWS_ = arg('views', 'alfresco,lounge,pooledge').split(',');
const DPR = Number(arg('dpr', '1')), SHOTS = arg('shots', '');
const TIME = Number(arg('time', '1300')), EXTRA = arg('extra', ''), LABEL = arg('label', 'run'), LOG = arg('log', 'review/round6/perf.log'), SECS = Number(arg('secs', '3'));
const VIEWS = { alfresco: [1.3, 3.0, 2.6, 156, -5], lounge: [0.35, 1.8, 5.5, 172, -6], pooledge: [-2.15, 3.0, 1.2, 178, -10], house: [-0.6, 3.0, 8.6, 10, 4], play: [-1.8, 3.0, 1.0, 0, -8], pump: [-0.82, 1.6, 12.6, 0, -5] };
// pump: the doors opened, then walk in from the promenade (you crouch by yourself) and stand inside under the deck
mkdirSync(LOG.replace(/\/[^/]+$/, ''), { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const blender = (await import('node:child_process')).execSync('pgrep -f "Blender.app" || true').toString().trim() ? 'blender-busy' : 'gpu-free';
for (const q of QS) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: DPR });
  await p.goto(`http://localhost:4173/model/walk/?q=${q}&panel=0&nohelp&gpu=1${EXTRA ? '&' + EXTRA : ''}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  for (const v of VIEWS_) {
    await p.evaluate(([pos, t, pump]) => {
      if (pump) { const h = __viewer.hinges.list.find(h => h.group === 'pump_doors'); if (h) __viewer.hinges.toggle(h, true); }
      __viewer.place(...pos); __viewer.setTime(t);
    }, [VIEWS[v], TIME, v === 'pump']);
    if (v === 'pump') { await p.waitForTimeout(1200); await p.keyboard.down('KeyW'); await p.waitForTimeout(3500); await p.keyboard.up('KeyW'); }
    await p.waitForTimeout(1500);
    const r = await p.evaluate(secs => new Promise(res => {
      const V = __viewer; let n = 0; const t0 = performance.now(); const g = [], d = [], c = [];
      const f = () => { n++; g.push(V.perf.gpu); d.push(V.perf.draws); c.push(V.perf.cpu); if (performance.now() - t0 < secs * 1000) requestAnimationFrame(f); else res({ fps: n / ((performance.now() - t0) / 1000), gpu: g.reduce((a, b) => a + b, 0) / g.length, draws: d.reduce((a, b) => a + b, 0) / d.length, cpu: c.reduce((a, b) => a + b, 0) / c.length, tris: V.perf.tris }); };
      requestAnimationFrame(f);
    }), SECS);
    const line = { label: LABEL, dpr: DPR, q, view: v, time: TIME, fps: +r.fps.toFixed(1), gpuMs: +r.gpu.toFixed(2), cpuMs: +r.cpu.toFixed(2), draws: Math.round(r.draws), triK: Math.round(r.tris / 1000), env: blender, at: new Date().toISOString().slice(11, 19) };
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${q}_${v}_dpr${DPR}.png` });
    appendFileSync(LOG, JSON.stringify(line) + '\n');
    console.log(`${LABEL.padEnd(14)} dpr${DPR} ${q.padEnd(6)} ${v.padEnd(9)} fps ${String(line.fps).padStart(5)}  gpu ${String(line.gpuMs).padStart(6)} ms  cpu ${String(line.cpuMs).padStart(5)} ms  draws ${String(line.draws).padStart(5)}  tris ${line.triK}k  (${blender})`);
  }
  await p.close();
}
await b.close();

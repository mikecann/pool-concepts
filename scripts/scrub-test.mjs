// Dusk hitch check: drag the time slider 17:00 -> 21:00 -> 17:00 (three round trips), one step per frame,
// as a hand on the slider would, and record every frame's duration. Headless, real GPU.
//   node scripts/scrub-test.mjs [--q Medium] [--extra "x=1"] [--trips 3] [--secs 4]
import { chromium } from 'playwright';
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const Q = arg('q', 'Medium'), EXTRA = arg('extra', ''), TRIPS = Number(arg('trips', '3')), SECS = Number(arg('secs', '4'));
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(`http://localhost:4173/model/walk/?q=${Q}&panel=0&nohelp${EXTRA ? '&' + EXTRA : ''}`);
await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
await p.evaluate(() => { __viewer.place(1.3, 3.0, 2.6, 156, -5); __viewer.setTime(17 * 60); });
await p.waitForTimeout(1500);
const legs = [];
for (let t = 0; t < TRIPS; t++) legs.push([17 * 60, 21 * 60], [21 * 60, 17 * 60]);
for (const [i, [a, z]] of legs.entries()) {
  const r = await p.evaluate(([a, z, secs]) => new Promise(res => {
    // move the real slider and fire 'input', exactly like a drag
    const input = document.getElementById('time'); const times = [], at = []; let last = performance.now(); const t0 = last;
    const step = () => {
      const now = performance.now(); times.push(now - last); at.push(Number(input.value)); last = now;
      const f = Math.min(1, (now - t0) / (secs * 1000));
      input.value = String(Math.round(a + (z - a) * f)); input.dispatchEvent(new Event('input', { bubbles: true }));
      if (f < 1) requestAnimationFrame(step); else res(times.slice(1).map((t, i) => [t, at[i]]));
    };
    requestAnimationFrame(step);
  }), [a, z, SECS]);
  const sorted = [...r].sort((x, y) => y[0] - x[0]);
  const hhmm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const long = r.filter(v => v[0] > 50);
  console.log(`${String(i + 1).padStart(2)} ${a / 60}:00 -> ${z / 60}:00  frames ${r.length}  longest ${sorted.slice(0, 3).map(v => v[0].toFixed(0)).join(', ')} ms  over 50 ms: ${long.length}${long.length ? '  at ' + long.slice(0, 8).map(v => hhmm(v[1])).join(' ') : ''}`);
}
await b.close();

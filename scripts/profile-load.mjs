// Time to first frame and time to interactive for the walkthrough, headless on the real GPU.
// Cold = a brand new browser (empty HTTP and shader caches). Warm = reload in the same browser.
//   node scripts/profile-load.mjs [url] [runs]
import { chromium } from 'playwright';
const URL = process.argv[2] ?? 'http://localhost:4173/model/walk/?panel=0&nohelp';
const RUNS = Number(process.argv[3] ?? 2);
// optional: THROTTLE_MBPS=50 node scripts/profile-load.mjs … emulates a home connection (cold runs only)
const MBPS = Number(process.env.THROTTLE_MBPS ?? 0);
// optional: CPU_SLOWDOWN=4 emulates a slower machine (Chrome's CPU throttling; the GPU isn't slowed)
const CPU = Number(process.env.CPU_SLOWDOWN ?? 0);
const ARGS = ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'];

// recorded in the page from navigation start: progress text changes, first frame (loading screen hidden),
// and interactive = the first moment after that with 10 frames in a row each under 50 ms
const probe = () => {
  const log = (window.__load = { steps: [], first: null, interactive: null, long: [] });
  const t0 = performance.timeOrigin;
  new MutationObserver(() => {
    const t = document.getElementById('load-text')?.textContent;
    if (t && log.steps.at(-1)?.[1] !== t) log.steps.push([Math.round(performance.now()), t]);
    if (log.first === null && document.getElementById('loading')?.classList.contains('done')) log.first = Math.round(performance.now());
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  let last = 0, run = 0;
  const tick = now => {
    if (log.first !== null && last && now - last > 50 && log.long.length < 40) log.long.push([Math.round(last), Math.round(now - last)]);
    if (log.first !== null && log.interactive === null) {
      if (last && now - last < 50) { if (++run >= 10) log.interactive = Math.round(now); } else run = 0;
    }
    last = now;
    if (log.interactive === null || now - log.interactive < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  void t0;
};

const measure = async page => {
  await page.waitForFunction(() => window.__load?.interactive !== null && window.__load?.interactive !== undefined, null, { timeout: 300000, polling: 100 });
  await page.waitForTimeout(4000);   // keep logging long frames while the background work finishes
  return page.evaluate(() => ({ ...window.__load, marks: window.__marks }));
};
const show = (label, r) => {
  console.log(`${label.padEnd(6)} first frame ${String(r.first).padStart(6)} ms   interactive ${String(r.interactive).padStart(6)} ms`);
  console.log('        ' + r.steps.filter(([, s]) => !/\d%$/.test(s)).map(([t, s]) => `${t}:${s}`).join(' | '));
  if (r.long?.length) console.log('        long frames after first ' + r.long.map(([t, d]) => `${t}+${d}`).join(' '));
  if (r.marks) console.log('        marks ' + r.marks.map(([n, t]) => `${n} ${t}`).join(' | '));
};
for (let i = 0; i < RUNS; i++) {
  const b = await chromium.launch({ headless: true, channel: 'chromium', args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(probe);
  const p = await ctx.newPage();
  if (CPU) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
  if (MBPS) { const cdp = await ctx.newCDPSession(p); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 25, downloadThroughput: MBPS * 125000, uploadThroughput: 10 * 125000 }); }
  await p.goto(URL);
  show('cold', await measure(p));
  await p.reload();
  show('warm', await measure(p));
  await b.close();
}

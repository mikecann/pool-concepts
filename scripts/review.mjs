// Screenshot the walkthrough at set times and viewpoints, in headed Chromium with a real GPU (WebGPU).
//   npm run build && npm run serve   (in another shell), then:
//   node scripts/review.mjs [--times 0730,1300] [--views alfresco,lounge] [--quality High] [--out review/run] [--size 1600x900] [--date 2027-01-16]
import { chromium } from 'playwright';
// refuse to judge pictures from a software renderer: headless must still get the real (Metal) GPU
const gpuCheck = async page => {
  const info = await page.evaluate(async () => {
    const a = await navigator.gpu?.requestAdapter();
    if (!a) return 'no WebGPU adapter';
    const i = a.info ?? {};
    return [i.vendor, i.architecture, i.device, i.description].filter(Boolean).join(' ') || 'unknown adapter';
  });
  console.log('GPU adapter:', info);
  if (/swiftshader|no webgpu|unknown|llvmpipe|software/i.test(info)) { console.error('Not a hardware GPU, stopping.'); process.exit(2); }
};

import { mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TIMES = arg('times', '0730,1300,1730,1940,2100').split(',');
const QUALITY = arg('quality', 'High');
const OUT = arg('out', 'review');
const DATE = arg('date', '2027-01-16');
const [W, H] = arg('size', '1600x900').split('x').map(Number);
const URL = arg('url', 'http://localhost:4173/model/');
const EXTRA = arg('extra', '');
const SCEN = arg('scenario', 'proposed');
const EVAL = arg('eval', '');

// feet position (x, y, z three.js), yaw and pitch in degrees (yaw 0 = north, 90 = west, 180 = south)
const VIEWS = {
  alfresco: [1.3, 3.0, 2.6, 156, -5],
  lounge: [0.35, 1.8, 5.5, 172, -6],
  pooledge: [-2.15, 3.0, 1.2, 178, -10],
  canal: [4.0, 2.0, 16.5, 0, 0],
  house: [-0.6, 3.0, 8.6, 10, 4],
  drone: null,
};
const views = arg('views', 'alfresco,lounge,pooledge').split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`.slice(0, 400)); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
await page.goto(`${URL}?q=${QUALITY}&panel=0&date=${DATE}${EXTRA ? '&' + EXTRA : ''}`, { waitUntil: 'load' });
await gpuCheck(page);
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('done') || /couldn't/.test(document.getElementById('load-text')?.textContent ?? ''), null, { timeout: 180000 });
const failed = await page.evaluate(() => /couldn't/.test(document.getElementById('load-text')?.textContent ?? ''));
if (failed) { console.log(await page.evaluate(() => document.getElementById('load-text').textContent)); }
await page.addStyleTag({ content: '.hint-pill,.welcome{display:none!important}' });
const frames = n => page.evaluate(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await frames(30);
for (const v of views) {
  for (const t of TIMES) {
    const minutes = Number(t.slice(0, 2)) * 60 + Number(t.slice(2));
    await page.evaluate(([v, pos, minutes, scen, ev]) => {
      const V = window.__viewer;
      V.setScenario(scen);
      if (pos) V.place(...pos); else V.goToCam('07_aerial_southwest');
      V.setTime(minutes);
      if (ev) (0, eval)(ev);
    }, [v, VIEWS[v] ?? null, minutes, SCEN, EVAL]);
    await frames(45);   // let TRAA and SSGI settle
    const file = `${OUT}/${v}_${t}.png`;
    await page.locator('#canvas').screenshot({ path: file });
    console.log('saved', file);
  }
}
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
console.log('fps', fps.toFixed(1), 'quality', QUALITY);
console.log(errors.slice(0, 25).join('\n'));
await browser.close();

// dev helper: load the viewer and print the result of an expression
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

const [expr, extra = ''] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto('http://localhost:4173/model/walk/?panel=0&' + extra);
await gpuCheck(p);
await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
await p.evaluate(() => new Promise(r => setTimeout(r, 1500)));
console.log(await p.evaluate(async e => { try { return JSON.stringify(await (0, eval)(e), null, 1); } catch (x) { return "ERR " + x.message; } }, expr));
console.log([...new Set(errs)].slice(0, 8).join('\n'));
await b.close();

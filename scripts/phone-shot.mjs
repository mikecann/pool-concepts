// Phone screenshots, portrait and landscape, headless on the real GPU (touch + mobile emulation).
//   node scripts/phone-shot.mjs [out dir, default review/round11/phone] [extra url params]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'review/round11/phone', EXTRA = process.argv[3] ?? '';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const [name, w, h] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });   // 404s: renders still to come
  await p.goto(`http://localhost:4173/model/walk/?nohelp${EXTRA ? '&' + EXTRA : ''}`);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const vis = await p.evaluate(() => ['panel-toggle', 'joystick'].map(id => { const e = document.getElementById(id) ?? document.querySelector('.' + id); if (!e) return id + ': none'; const r = e.getBoundingClientRect(); return `${id}: ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(e).display}`; }).join(' | ') + ' | drawer-open ' + document.querySelector('.app')?.classList.contains('drawer-open') + ' | overflowX ' + (document.documentElement.scrollWidth > innerWidth));
  console.log(name, vis, errs.length ? 'ERRORS ' + errs.join(' / ') : '');
  // open the drawer for a second shot
  await p.locator('#panel-toggle').click().catch(() => {});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${name}_drawer.png` });
  await ctx.close();
}
await b.close();

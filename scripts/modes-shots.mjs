// Screenshots for the "no drone" change: Bob's side panel (?profile=bob: Show dimensions, Quality, Walk/Fly, Measure,
// the help line) at 1440 and 390 (drawer open), and the main walkthrough's top mode buttons (Walk and Fly only) at
// 1440 and 390. Headless on the real GPU; needs `npm run serve` (public/ on :4173).
//   node scripts/modes-shots.mjs [--out review/modes]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/modes';
const SITE = 'http://localhost:4173';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errs = [];
const ready = p => p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
const frames = (p, n) => p.evaluate(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

for (const [tag, opts] of [['1440', DESK], ['390', PHONE]]) {
  const ctx = await b.newContext(opts);
  // Bob's view, with the side panel (the drawer on a phone) open
  let p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(`bob ${tag}: ${m.text().slice(0, 200)}`); });
  await p.goto(`${SITE}/model/walk/?profile=bob&nohelp`); await ready(p);
  await p.addStyleTag({ content: '.hint-pill,.status-pill{display:none!important}' });
  await p.evaluate(() => __viewer.setPanel(true)); await frames(p, 40);
  await p.screenshot({ path: `${OUT}/bob-sidebar-${tag}.png` });
  await p.locator('#panel').screenshot({ path: `${OUT}/bob-sidebar-panel-${tag}.png` });
  console.log('saved', `${OUT}/bob-sidebar-${tag}.png`, 'mode', await p.evaluate(() => __viewer.walker.mode));
  await p.close();
  // the main walkthrough: the top bar's mode buttons
  p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(`walk ${tag}: ${m.text().slice(0, 200)}`); });
  await p.goto(`${SITE}/model/walk/?nohelp&panel=0`); await ready(p);
  await p.addStyleTag({ content: '.hint-pill,.status-pill{display:none!important}' });
  await frames(p, 40);
  await p.screenshot({ path: `${OUT}/walk-${tag}.png` });
  await p.locator('.hud.top').screenshot({ path: `${OUT}/walk-modes-${tag}.png` });
  console.log('saved', `${OUT}/walk-modes-${tag}.png`, 'buttons', (await p.locator('[aria-label="Camera mode"] button').allTextContents()).join('/'));
  await p.close(); await ctx.close();
}
console.log(errs.length ? `console errors:\n${errs.join('\n')}` : 'console clean');
await b.close();

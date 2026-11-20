// Screenshots of the equipment-room viewer: each heat pump spot with each way in, from the one camera view.
// Needs `npm run serve` (public/ on :4173). Run under: taskpolicy -c utility node scripts/equipment-shots.mjs
//   node scripts/equipment-shots.mjs [--out /tmp/equipment-shots] [--site http://localhost:4173]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const OUT = arg('--out', '/tmp/equipment-shots');
const SITE = arg('--site', 'http://localhost:4173');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const watch = page => {
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/GL Driver/.test(m.text()))) errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  watch(page);
  await page.goto(`${SITE}/equipment/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__eq && window.__eq.ready, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/default.png` });
  for (const hp of ['kitchen', 'yard', 'corner']) for (const way of ['hatch', 'stairs', 'twoHatches']) {
    const fit = await page.evaluate(o => window.__eq.show(o), { hp, way, home: true });
    await page.screenshot({ path: `${OUT}/${hp}-${way}.png` });
    if (way === 'hatch') { const h = fit.find(f => f.id === 'pool_heat_pump'); console.log(hp, h.status + ':', h.notes.join('; ') || 'no notes'); }
  }
  // the folded workings, opened
  await page.evaluate(() => window.__eq.show({ hp: 'kitchen', way: 'hatch', home: true }));
  await page.click('#workings summary');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/workings-open.png` });
  const phone = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
  watch(phone);
  await phone.goto(`${SITE}/equipment/`, { waitUntil: 'load' });
  await phone.waitForFunction(() => window.__eq && window.__eq.ready, null, { timeout: 60000 });
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/phone.png` });
} finally {
  await browser.close();
}
console.log(errors.length ? errors.join('\n') : 'console clean');
process.exit(errors.length ? 1 : 0);

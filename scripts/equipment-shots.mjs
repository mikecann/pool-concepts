// Screenshots of the equipment-room viewer: every layout in the plan, canal, inside and cutaway views.
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
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/GL Driver/.test(m.text()))) errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(`${SITE}/equipment/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__eq && window.__eq.ready, null, { timeout: 60000 });
  const layouts = await page.evaluate(() => window.__eq.layouts);
  for (const layout of layouts) {
    for (const preset of ['plan', 'canal', 'cutaway']) {
      const fit = await page.evaluate(([layout, preset]) => window.__eq.show({ layout, preset, labels: false, sea: 'today' }), [layout, preset]);
      await page.screenshot({ path: `${OUT}/${layout}-${preset}.png` });
      if (preset === 'plan') console.log(layout, fit.map(f => `${f.id}:${f.status}`).join(' '));
    }
  }
  await page.evaluate(() => window.__eq.show({ layout: 'sideYard', preset: 'yard', sea: 'today' }));
  await page.screenshot({ path: `${OUT}/sideYard-yard.png` });
  await page.evaluate(() => window.__eq.show({ layout: 'terrace', preset: 'terrace', sea: 'today' }));
  await page.screenshot({ path: `${OUT}/terrace-terrace.png` });
  await page.evaluate(() => window.__eq.show({ layout: 'hatch', preset: 'inside', sea: 'today' }));
  await page.screenshot({ path: `${OUT}/hatch-inside.png` });
  await page.evaluate(() => window.__eq.show({ layout: 'sideYard', preset: 'plan', labels: true, sea: 'today' }));
  await page.screenshot({ path: `${OUT}/sideYard-plan-labels.png` });
  // sea levels
  for (const [layout, sea] of [['sideYard', '5'], ['sideYard', '100'], ['eastDoor', '5'], ['eastDoor', '100']]) {
    await page.evaluate(([layout, sea]) => window.__eq.show({ layout, preset: 'canal', sea, labels: false }), [layout, sea]);
    await page.screenshot({ path: `${OUT}/sea-${layout}-${sea}yr.png` });
  }
  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
  phone.on('pageerror', e => errors.push('phone pageerror: ' + e.message));
  phone.on('console', m => { if (m.type() === 'error') errors.push('phone: ' + m.text().slice(0, 300)); });
  await phone.goto(`${SITE}/equipment/?preset=canal`, { waitUntil: 'load' });
  await phone.waitForFunction(() => window.__eq && window.__eq.ready, null, { timeout: 60000 });
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/phone-collapsed.png` });
  await phone.click('#panel-toggle'); await phone.waitForTimeout(300);
  await phone.screenshot({ path: `${OUT}/phone-open.png` });
} finally {
  await browser.close();
}
console.log(errors.length ? 'CONSOLE PROBLEMS:\n' + errors.join('\n') : 'console clean');
process.exit(errors.length ? 1 : 0);

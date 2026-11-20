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
  const shot = async (name, opts) => {
    const fit = await page.evaluate(o => window.__eq.show(o), opts);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    return fit;
  };
  const hpNote = fit => { const h = fit.find(f => f.id === 'pool_heat_pump'); return `${h.status}: ${h.notes.join('; ') || 'no notes'}`; };
  for (const hp of ['kitchen', 'yard', 'corner']) {
    for (const way of ['hatch', 'stairs']) {
      for (const view of ['canal', 'plan']) {
        const fit = await shot(`${hp}-${way}-${view}`, { hp, way, view, drain: 'canal', sea: 'today', labels: false });
        if (view === 'plan' && way === 'hatch') console.log(hp, hpNote(fit));
      }
    }
    await shot(`${hp}-heatpump`, { hp, way: 'hatch', view: 'heatpump', drain: 'canal', sea: 'today' });
  }
  for (const way of ['hatch', 'stairs']) await shot(`cutaway-${way}`, { hp: 'kitchen', way, view: 'cutaway', drain: 'canal', sea: 'today' });
  for (const drain of ['canal', 'sump']) await shot(`sea5-${drain}`, { hp: 'kitchen', way: 'hatch', view: 'canal', drain, sea: '5' });
  await shot('kitchen-plan-labels', { hp: 'kitchen', way: 'hatch', view: 'plan', drain: 'canal', sea: 'today', labels: true });
  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
  phone.on('pageerror', e => errors.push('phone pageerror: ' + e.message));
  phone.on('console', m => { if (m.type() === 'error') errors.push('phone: ' + m.text().slice(0, 300)); });
  await phone.goto(`${SITE}/equipment/?hp=yard&way=stairs&view=canal`, { waitUntil: 'load' });
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

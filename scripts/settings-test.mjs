// Settings: first visit gets the defaults (Medium, fps on); changes are remembered across a reload.
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1400, height: 850 } });
const p = await ctx.newPage();
const ready = () => p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 120000 });
const state = () => p.evaluate(() => { const V = __viewer, m = V.model; return { quality: V.state().quality, fps: !document.getElementById('fps').hidden,
  people: m.people, scenario: V.state().scenario, roller: m.roller, pier: m.pier, nfence: m.nfence, passage: m.passage, date: V.state().date, minutes: Math.round(V.state().minutes) }; });
await p.goto('http://localhost:4173/model/walk/?nohelp'); await ready();
console.log('first visit ', JSON.stringify(await state()));
await p.evaluate(() => { __viewer.setPanel(true); });
await p.locator('#opt-quality button', { hasText: /^Low$/ }).click();
await p.locator('#opt-fps').uncheck();
await p.locator('#opt-people').uncheck();
await p.locator('#tab-pool').click();
await p.locator('#cards-roller .card', { hasText: 'Low-profile' }).click();
await p.locator('#tab-fences').click();
await p.locator('#cards-nfence .card', { hasText: 'Moved' }).click();
await p.locator('#tab-passage').click();
await p.locator('#cards-passage .card', { hasText: 'play area' }).click();
await p.locator('[data-date="2027-06-21"]').click();
await p.locator('#time').fill('1050'); await p.locator('#time').dispatchEvent('input');
await p.waitForTimeout(500);
await p.reload(); await ready();
console.log('after reload', JSON.stringify(await state()));
await b.close();

// The sidebar in full (its scroll area unrolled), desktop and phone drawer, with the Pool cover and Fences tabs open.
//   node scripts/sidebar-shots.mjs <out dir> <label>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [OUT = 'review/round17e', LABEL = 'now'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
for (const [name, opts] of [['desktop', { viewport: { width: 1400, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage();
  await p.goto('http://localhost:4173/model/walk/?nohelp&q=Low&t=780');
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 120000 });
  await p.evaluate(() => __viewer.setPanel(true)); await p.waitForTimeout(600);
  for (const tab of ['pool', 'fences']) {
    await p.locator(`#tab-${tab}`).click(); await p.waitForTimeout(300);
    // unroll the scroll area so the whole sidebar fits in one picture
    await p.addStyleTag({ content: '#panel-scroll{position:static!important;overflow:visible!important;height:auto!important;max-height:none!important} .panel{height:auto!important;max-height:none!important;transform:none!important;position:relative!important}' });
    await p.waitForTimeout(300);
    await p.locator('#panel').screenshot({ path: `${OUT}/${LABEL}_${name}_${tab}.png` });
  }
  await ctx.close();
}
await b.close();

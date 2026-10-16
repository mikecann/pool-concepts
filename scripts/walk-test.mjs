// Walk with real key presses (headless) and print where the walker ends up: steps, pool edge, walls.
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
await p.goto('http://localhost:4173/model/?panel=0&q=Medium');
await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
await p.focus('#canvas');
if (process.argv[2] === 'nopeople') await p.evaluate(() => { __viewer.model.people = false; __viewer.model.apply(); __viewer.walker.rebuild(__viewer.model.root); });
const walk = async (name, pos, key, ms) => {
  await p.evaluate(pos => __viewer.place(...pos), pos);
  await p.waitForTimeout(300);
  const a = await p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(2)));
  await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key);
  await p.waitForTimeout(500);
  const z = await p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(2)));
  console.log(name.padEnd(28), 'start', a.join(','), '-> end', z.join(','));
};
await p.waitForTimeout(3000);   // let first-use shader compiles finish before timing key presses
await walk('spa deck -> down into lounge', [0.1, 3, 10.9, 0, 0], 'KeyW', 3500);
await walk('lounge -> up the steps', [0.5, 2.0, 6.5, 180, 0], 'KeyW', 3500);
await walk('coping -> into pool (west)', [-2.1, 3, 4.5, 90, 0], 'KeyW', 3000);
await walk('alfresco -> house wall (N)', [1.3, 3, 2.6, 0, 0], 'KeyW', 4000);
await walk('run along concourse (S)', [-1.5, 3, 1.0, 180, 0], 'ShiftLeft', 10);
await b.close();

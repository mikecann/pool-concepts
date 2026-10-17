// Round 4 page checks, headless: the chooser, the renders page and the walkthrough, desktop and phone.
// Screenshots go to review/round4/pages/, and the network log proves each page only loads what it should.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'review/round4/pages';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173/model/';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const frames = (p, n) => p.evaluate(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const track = p => { const urls = []; p.on('request', r => urls.push(r.url().replace(BASE, ''))); return urls; };
const report = (name, urls) => {
  const three = urls.filter(u => /assets\/walk-|three/.test(u)), glb = urls.filter(u => /\.glb(\?|$)/.test(u)), imgs = urls.filter(u => /img\//.test(u));
  console.log(`${name.padEnd(9)} requests ${urls.length}, three.js bundle ${three.length ? 'YES' : 'no'}, GLB ${glb.length ? 'YES' : 'no'}, images ${imgs.length}: ${imgs.map(u => u.split('/').pop()).slice(0, 12).join(' ')}${imgs.length > 12 ? ' …' : ''}`);
};

// chooser
for (const [label, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const urls = track(p);
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/home_${label}.png`, fullPage: label === 'phone' });
  if (label === 'desktop') report('home', urls);
  await ctx.close();
}
// renders page
for (const [label, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const urls = track(p);
  await p.goto(BASE + 'renders/', { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${OUT}/renders_${label}_top.png` });
  await p.evaluate(() => document.querySelector('.section-head')?.scrollIntoView());
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/renders_${label}_options.png` });
  if (label === 'desktop') {
    await p.evaluate(() => [...document.querySelectorAll('h2')].find(h => /sun lands/i.test(h.textContent))?.scrollIntoView());
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/renders_desktop_sun.png` });
    report('renders', urls);
    const href = await p.evaluate(() => { let u = ''; const o = location.assign; return new Promise(r => { window.addEventListener('beforeunload', () => r(location.href)); document.getElementById('r-fly').click(); setTimeout(() => r('(no navigation)'), 3000); }); });
    await p.waitForURL(/walk/, { timeout: 5000 }).catch(() => {});
    console.log('renders "Open in 3D" ->', p.url().replace(BASE, ''));
  }
  await ctx.close();
}
// walkthrough with the panel open: cards, a card click moving the camera, the gate
{
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } }); const p = await ctx.newPage(); const urls = track(p);
  await p.goto(BASE + 'walk/?q=High&nohelp');
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 120000 });
  await p.addStyleTag({ content: '.hint-pill{display:none!important}' });
  report('walk', urls);
  await p.evaluate(() => { __viewer.setPanel(true); __viewer.setTime(15 * 60); });
  await frames(p, 30);
  await p.screenshot({ path: `${OUT}/walk_panel.png` });
  for (const [box, value] of [['cards-roller', 'Low roller, deep end'], ['cards-roller', 'Roller, shallow end'], ['cards-kitchen', 'One long bench'], ['cards-nfence', 'Moved 1.5 m north'], ['cards-passage', 'New paving all the way']]) {
    const before = await p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(1)));
    // Round 15: the cards live in category tabs; open the one that holds this group first
    await p.evaluate(b => document.getElementById(b).closest('.cat-panel') && document.getElementById('tab-' + document.getElementById(b).closest('.cat-panel').dataset.cat).click(), box);
    await p.locator(`#${box} .card`).filter({ has: p.locator('b', { hasText: new RegExp(`^${value.replace(/[.]/g, '\\.')}$`) }) }).click();
    await p.waitForTimeout(800); await frames(p, 10);
    const after = await p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(1)));
    const pressed = await p.locator(`#${box} .card[aria-pressed="true"] b`).textContent();
    // Round 17b: a card only switches the option; its section's View button goes to the suggested viewpoint
    await p.locator(`#${box}`).locator('xpath=..').locator('.view-btn').click();
    await p.waitForTimeout(2200); await frames(p, 30);
    const viewed = await p.evaluate(() => __viewer.state().feet.map(v => +v.toFixed(1)));
    console.log(`card ${value.padEnd(15)} pressed: ${pressed}  camera ${before.join(',')} -> ${after.join(',')} (${before.join() === after.join() ? 'stayed' : 'MOVED'}), View -> ${viewed.join(',')}`);
    await p.screenshot({ path: `${OUT}/walk_card_${value.toLowerCase().replace(/ /g, '_')}.png` });
  }
  // the north pool gate: tooltip, then open
  await p.locator('#tab-pool').click();
  await p.locator('#cards-roller .card', { hasText: 'No pool cover' }).click();
  await p.locator('#tab-fences').click();
  await p.locator('#cards-nfence .card', { hasText: 'As drawn' }).click();
  await p.waitForTimeout(1500);
  await p.evaluate(() => { __viewer.setPanel(false); const g = __viewer.model.gates.find(g => g.leaf.name.startsWith('fence_pool_north')); const d = g.dir; const mx = g.hinge.x + d.x * g.width / 2, mz = g.hinge.z + d.z * g.width / 2; __viewer.place(mx + 0.2, 3, mz - 1.35, 182, -14); });
  await frames(p, 40);
  await p.screenshot({ path: `${OUT}/walk_gate_tooltip.png` });
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(900); await frames(p, 20);
  await p.screenshot({ path: `${OUT}/walk_gate_open.png` });
  await ctx.close();
}
// phone walkthrough: the drawer with cards, and the gate button
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await p.goto(BASE + 'walk/?nohelp');
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('done'), null, { timeout: 120000 });
  await p.evaluate(() => { __viewer.setTime(15 * 60); __viewer.setPanel(true); });
  await frames(p, 20);
  await p.evaluate(() => document.getElementById('cat-tabs').scrollIntoView());
  await frames(p, 10);
  await p.screenshot({ path: `${OUT}/walk_phone_drawer.png` });
  await p.evaluate(() => { __viewer.setPanel(false); const g = __viewer.model.gates.find(g => g.leaf.name.startsWith('fence_pool_north')); const d = g.dir; const mx = g.hinge.x + d.x * g.width / 2, mz = g.hinge.z + d.z * g.width / 2; __viewer.place(mx - 0.6, 3, mz - 1.3, 160, -12); });
  await frames(p, 30);
  console.log('phone gate button:', await p.evaluate(() => { const g = document.getElementById('gate-btn'); return g.hidden ? '(hidden)' : g.textContent; }));
  await p.screenshot({ path: `${OUT}/walk_phone_gate.png` });
  await ctx.close();
}
await b.close();

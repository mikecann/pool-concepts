// Round 22 tests: Layout B's lounge out to the garden bed. pier_inset is unavailable in B (greyed, with a reason),
// falls back to the drawn fence when you switch to B with it chosen, and comes back in SK02's layout; the lounge
// kitchen's More text in B; the B card's copy; B's dims. Headless on the real GPU; exits 1 on failure.
//   node scripts/r22-test.mjs [--out review/round22/test]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round22/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(58)} ${info}`); if (!ok) fail++; };
const settled = () => p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
const load = async (q = '') => { await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp&date=2027-01-16&t=885${q}`); await settled(); };
const remembered = () => p.evaluate(() => JSON.parse(localStorage.getItem('pool-settings') ?? '{}').options?.pier);
const pickLayout = async title => {
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('layout'); });
  const card = p.locator('#cards-layout .card').filter({ has: p.locator('b', { hasText: new RegExp(`^${title}$`) }) });
  await Promise.all([p.waitForEvent('load', { timeout: 60000 }), card.click()]);
  await settled();
};
const pierCard = () => p.evaluate(() => { const c = [...document.querySelectorAll('#cards-pier .card')].find(c => c.querySelector('b')?.textContent === 'Pulled in (Kelsie)'); return c && { disabled: c.disabled, grey: c.classList.contains('unavailable'), why: c.querySelector('.card-note')?.textContent ?? '' }; });

// --- SK02's layout: pier_inset is a normal choice
await load('&layout=a');
check('SK02: the pulled-in fence is available', !(await pierCard()).disabled);
await p.evaluate(() => __viewer.setOption('pier', 'pier_inset'));
check('  chosen and remembered', (await remembered()) === 'pier_inset');

// --- to B: it falls back to the drawn fence, with a message, and the card is greyed
await pickLayout('Lounge wall in line, pool moved');
let s = await p.evaluate(() => ({ layout: __viewer.layout, pier: __viewer.model.pier }));
check('switched to B with it chosen: the fence as drawn instead', s.layout === 'b' && s.pier === 'pier_as_drawn', JSON.stringify(s));
const hint = (await p.locator('#hint').innerText().catch(() => '')).replace(/\n/g, ' / ');
check('  and a short message says so', /isn't possible in Layout B/i.test(hint), hint);
const pc = await pierCard();
check('  its card is greyed out with the reason', pc.disabled && pc.grey && /lounge's new corner/.test(pc.why), pc.why);
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('fences'); });
await p.locator('#cards-pier').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${OUT}/b_pier_card.png` });
check('  your choice is still held for SK02\'s layout', (await remembered()) === 'pier_inset');
await p.evaluate(() => __viewer.setOption('roller', 'roller_deep'));
check('  even after changing something else in B', (await remembered()) === 'pier_inset' && (await p.evaluate(() => __viewer.model.pier)) === 'pier_as_drawn');
// the kitchen's More text, and no warning
await p.evaluate(() => window.__openCategory('alfresco'));
const k = await p.evaluate(() => { const w = [...document.querySelectorAll('#cards-kitchen .card-wrap')].find(w => w.querySelector('.card b')?.textContent === 'Facing the lounge'); return { more: w.querySelector('.card-more p').textContent, warn: w.querySelector('.card-warn:not([hidden])')?.textContent ?? null }; });
check('B: the lounge kitchen\'s More says its east gap leads nowhere', /leads nowhere/.test(k.more), '');
check('  with no warning', k.warn === null, k.warn ?? '');
const lb = await p.evaluate(() => { const w = [...document.querySelectorAll('#cards-layout .card-wrap')].find(w => /Lounge wall in line/.test(w.textContent)); return { short: w.querySelector('.card span').textContent, more: w.querySelector('.card-more p').textContent }; });
check('B card: short line, details (3.75 m, the walkway, 0.90 m) behind More', lb.short.length < 60 && /3\.75 m/.test(lb.more) && /walkway/.test(lb.more) && /0\.90 m/.test(lb.more), lb.short);
// dims in B
await p.evaluate(() => __viewer.setOption('roller', 'none'));
await p.evaluate(() => __viewer.setDims(true)); await p.waitForTimeout(1500);
const dims = await p.evaluate(() => { const c = __viewer.dims.current(); return { n: c.length, inset: c.some(d => /inset/.test(d.id)), width: c.find(d => /lounge.*width|width.*lounge/i.test(d.id) || /lounge.*width/i.test(d.label))?.value_m }; });
check('B: dims show (default options)', dims.n >= 50 && dims.n <= 62 && !dims.inset, `${dims.n} dims, lounge width ${dims.width}`);
await p.evaluate(() => { __viewer.setMode('drone'); __viewer.goToCam('17_pool_overview', true); }); await p.waitForTimeout(2000);
await p.addStyleTag({ content: '.hint{display:none!important}' });
await p.locator('#canvas').screenshot({ path: `${OUT}/b_dims_above.png` });
await p.evaluate(() => { __viewer.setDims(false); __viewer.setMode('walk'); });

// --- back to SK02's layout: restored
await pickLayout('As drawn \\(SK02\\)');
check('back in SK02\'s layout the pulled-in fence is restored', (await p.evaluate(() => __viewer.model.pier)) === 'pier_inset');
check('  and available again', !(await pierCard()).disabled);

// --- picking another pier fence in B lets go of it
await pickLayout('Lounge wall in line, pool moved');
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('fences'); });
await p.locator('#cards-pier .card').filter({ has: p.locator('b', { hasText: /^Straight past the pier$/ }) }).click();
check('in B, picking "Straight past the pier" replaces it', (await remembered()) === 'pier_straight');
await pickLayout('As drawn \\(SK02\\)');
check('  and that is what SK02\'s layout gets', (await p.evaluate(() => __viewer.model.pier)) === 'pier_straight');

// --- a link straight into B with it
await load('&layout=b&pier=pier_inset');
check('?layout=b&pier=pier_inset: the drawn fence, not the pulled-in one', (await p.evaluate(() => __viewer.model.pier)) === 'pier_as_drawn');

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

// Round 23 tests: "pier" is "pillar" everywhere people read it (the walkthrough's panel, cards, More text, info
// notes, warnings, hints, alt text and labels; the renders page; the dimension labels), while the option keys and
// ?pier= stay, and ?pillar= works too. Headless on the real GPU; exits 1 on failure.
//   node scripts/r23-test.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(58)} ${info}`); if (!ok) fail++; };
const settled = () => p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
/** Every word a reader can meet: text (shown or behind More / i / tabs), alt, aria-label, title and placeholder. */
const readable = () => p.evaluate(() => {
  const parts = [document.title, document.body.textContent];
  for (const el of document.querySelectorAll('[alt],[aria-label],[title],[placeholder]')) for (const a of ['alt', 'aria-label', 'title', 'placeholder']) if (el.getAttribute(a)) parts.push(el.getAttribute(a));
  return parts.join(' \n ');
});
const piers = t => (t.match(/.{0,30}\bpiers?\b.{0,30}/gi) ?? []);

// --- the walkthrough, SK02's layout and B (whose texts differ)
for (const L of ['a', 'b']) {
  await p.goto(`http://localhost:4173/model/walk/?q=Low&nohelp&layout=${L}`); await settled();
  await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('fences'); });
  const found = piers(await readable());
  check(`walkthrough (${L}): no "pier" anywhere readable`, found.length === 0, found.slice(0, 3).join(' | '));
  const h = await p.locator('#pier-h').innerText();
  check(`  "Fence by the pillar"`, /^fence by the pillar\b/i.test(h), h);
  check('  the Fences summary says Pillar', /^Pillar: /.test(await p.locator('#tab-fences span').innerText()));
}
// the B fallback hint
await p.goto('http://localhost:4173/model/walk/?q=Low&nohelp&layout=b&pier=pier_inset'); await settled();
const hint = await p.locator('#hint').innerText().catch(() => '');
check('B fallback hint: no "pier"', piers(hint).length === 0 && /pillar/i.test(hint), hint.replace(/\n/g, ' / '));
// dims labels
await p.evaluate(() => __viewer.setDims(true)); await p.waitForTimeout(1000);
await p.evaluate(() => __viewer.setOption('pier', 'pier_straight'));
const labels = await p.evaluate(() => __viewer.dims.current().map(d => d.label + ' ' + (d.note ?? '')).join(' | '));
check('dimension labels: "pillar", not "pier"', piers(labels).length === 0 && /Pavilion pillar to the pool fence/.test(labels));
// the keys and ?pier= are unchanged, ?pillar= works too
for (const [q, want] of [['pier=pier_straight', 'pier_straight'], ['pillar=straight', 'pier_straight'], ['pillar=pier_around', 'pier_around'], ['pillar=pillar_tall', 'pier_tall']]) {
  await p.goto(`http://localhost:4173/model/walk/?q=Low&nohelp&layout=a&${q}`); await settled();
  const v = await p.evaluate(() => __viewer.model.pier);
  check(`?${q}`, v === want, v);
}

// --- the renders page and the home pages
for (const url of ['http://localhost:4173/model/renders/', 'http://localhost:4173/model/', 'http://localhost:4173/']) {
  await p.goto(url); await p.waitForTimeout(800);
  const found = piers(await readable());
  check(`${url.replace('http://localhost:4173', '')}: no "pier" anywhere readable`, found.length === 0, found.slice(0, 3).join(' | '));
}
const sec = await p.goto('http://localhost:4173/model/renders/').then(() => p.locator('h2', { hasText: /pillar/i }).allTextContents());
check('renders page: the pillar section heading', sec.some(t => /fence by the pavilion pillar/i.test(t)), sec.join(' | '));

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

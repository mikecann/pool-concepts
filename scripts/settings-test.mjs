// Settings (Round 17d): a first visit gets the defaults (Medium, fps on, no outdoor kitchen) and opens at the time it
// is now in Perth (AWST, UTC+8), whatever the browser's timezone; option changes are remembered across a reload, the
// time and date are not (a reload goes back to now), old saved times are ignored, and ?t= / ?date= still win.
// The clock is mocked: an init script shifts Date to a chosen moment (time keeps running from there).
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(56)} ${info}`); if (!ok) fail++; };
const mockAt = async (ctx, iso) => ctx.addInitScript(t => {
  const off = Date.parse(t) - Date.now(), RealDate = Date;
  class MockDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } }
  window.Date = MockDate;
}, iso);
const open = async (ctx, q = '') => { const p = await ctx.newPage(); const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://localhost:4173/model/walk/?nohelp${q}`); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 120000 }); return { p, errs }; };
const state = p => p.evaluate(() => { const V = __viewer, m = V.model; return { quality: V.state().quality, fps: !document.getElementById('fps').hidden,
  people: m.people, roller: m.roller, kitchen: m.kitchen, nfence: m.nfence, passage: m.passage, date: V.state().date, minutes: Math.round(V.state().minutes),
  night: +V.state().sun.night.toFixed(2), flames: !!V.model.flames?.visible, lit: V.model.nightLights.filter(l => l.light.intensity > 0).length }; });

// 1. a fresh visit at 21:40 in Perth (13:40 UTC), in a browser set to London time, with an old saved time
{
  const ctx = await b.newContext({ viewport: { width: 1400, height: 850 }, timezoneId: 'Europe/London' });
  await mockAt(ctx, '2026-10-17T13:40:00Z');
  await ctx.addInitScript(() => { if (!sessionStorage.seeded) { sessionStorage.seeded = 1; localStorage.setItem('pool-settings', JSON.stringify({ date: '2027-06-21', minutes: 300 })); } });
  const { p, errs } = await open(ctx);
  const s = await state(p);
  check('opens at the time it is now in Perth (21:40, 17 Oct)', s.date === '2026-10-17' && Math.abs(s.minutes - 1300) <= 1, `${s.date} ${s.minutes}`);
  check('old saved time and date are ignored', s.minutes !== 300 && s.date !== '2027-06-21');
  check('at night: dark, lights on, flames burning', s.night > 0.9 && s.lit > 4 && s.flames, `night ${s.night}, ${s.lit} lights, flames ${s.flames}`);
  check('defaults: Medium, fps on, no outdoor kitchen', s.quality === 'Medium' && s.fps && s.kitchen === 'kitchen_none', `${s.quality} ${s.fps} ${s.kitchen}`);
  check('the old saved time is gone from the saved settings', await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('pool-settings') ?? '{}'); return o.minutes === undefined && o.date === undefined; }));
  // change things: options are remembered, the time and date are not
  await p.evaluate(() => { __viewer.setPanel(true); });
  await p.locator('#opt-quality button', { hasText: /^Low$/ }).click();
  await p.locator('#opt-fps').uncheck();
  await p.locator('#opt-people').uncheck();
  await p.locator('#tab-pool').click(); await p.locator('#cards-roller .card', { hasText: 'Low-profile' }).click();
  await p.locator('#tab-fences').click(); await p.locator('#cards-nfence .card', { hasText: 'Moved' }).click();
  await p.locator('#tab-passage').click(); await p.locator('#cards-passage .card', { hasText: 'play area' }).click();
  // the inset fence card warns while a kitchen is chosen, not with none
  await p.locator('#tab-fences').click();
  const warnNone = await p.locator('#cards-pier .card-warn').isVisible();
  await p.evaluate(() => __viewer.setOption('kitchen', 'kitchen_split'));
  const warnSplit = await p.locator('#cards-pier .card-warn').isVisible();
  check('pier_inset warns with a kitchen, not without', !warnNone && warnSplit);
  await p.locator('[data-date="2027-06-21"]').click();
  await p.locator('#time').fill('600'); await p.locator('#time').dispatchEvent('input');
  const during = await state(p);
  check('the slider and date still work for the visit', during.minutes === 600 && during.date === '2027-06-21', `${during.date} ${during.minutes}`);
  await p.waitForTimeout(500);
  await p.reload(); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 120000 });
  const after = await state(p);
  console.log('after reload', JSON.stringify(after));
  check('options are remembered across a reload', after.quality === 'Low' && !after.fps && !after.people && after.roller === 'roller_lowpro' && after.nfence === 'nfence_moved' && after.passage === 'passage_aggregate' && after.kitchen === 'kitchen_split');
  check('the time and date go back to now in Perth', after.date === '2026-10-17' && Math.abs(after.minutes - 1300) <= 1, `${after.date} ${after.minutes}`);
  check('console clean', errs.length === 0, errs[0] ?? '');
  await ctx.close();
}
// 2. a morning visit (10:30 Perth = 02:30 UTC) from a browser in New York; and ?t= / ?date= still win
{
  const ctx = await b.newContext({ viewport: { width: 1200, height: 700 }, timezoneId: 'America/New_York' });
  await mockAt(ctx, '2026-10-17T02:30:00Z');
  let { p } = await open(ctx);
  let s = await state(p);
  check('a morning visit opens at 10:30 Perth time', s.date === '2026-10-17' && Math.abs(s.minutes - 630) <= 1 && s.night === 0 && !s.flames, `${s.date} ${s.minutes}`);
  await p.close();
  ({ p } = await open(ctx, '&t=885&date=2027-01-16'));
  s = await state(p);
  check('?t= and ?date= override the clock', s.minutes === 885 && s.date === '2027-01-16', `${s.date} ${s.minutes}`);
  await ctx.close();
}
console.log(fail ? `FAIL (${fail})` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

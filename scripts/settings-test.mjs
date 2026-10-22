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
  // Round 17e: these live behind the gear
  await p.locator('#settings-btn').click();
  await p.locator('#opt-quality button', { hasText: /^Low$/ }).click();
  await p.locator('#opt-fps').uncheck();
  await p.locator('#opt-people').uncheck();
  await p.keyboard.press('Escape');
  await p.locator('#tab-pool').click(); await p.locator('#cards-roller .card').filter({ has: p.locator('b', { hasText: /^Low roller/ }) }).click();
  await p.locator('#tab-fences').click(); await p.locator('#cards-nfence .card').filter({ has: p.locator('b', { hasText: /^Moved/ }) }).click();
  await p.locator('#tab-passage').click(); await p.locator('#cards-passage .card').filter({ has: p.locator('b', { hasText: /^New paving/ }) }).click();
  // the inset fence card warns while a kitchen is chosen, not with none
  await p.locator('#tab-fences').click();
  const warnNone = await p.locator('#cards-pier .card-warn:not([hidden])').isVisible();
  await p.evaluate(() => __viewer.setOption('kitchen', 'kitchen_split'));
  const warnSplit = await p.locator('#cards-pier .card-warn:not([hidden])').isVisible();
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
// 4. "Copy design for Bob" in the settings: the design on screen as /bob/profile.json, and nothing else changes
{
  const KEYS = ['roller', 'kitchen', 'post', 'pump', 'play', 'spaCover', 'pier', 'nfence', 'passage', 'bfence', 'bplant', 'wallcap', 'deck'];
  const ctx = await b.newContext({ viewport: { width: 1400, height: 850 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:4173' });
  let { p, errs } = await open(ctx, '&layout=b');
  await p.evaluate(() => { __viewer.setOption('kitchen', 'kitchen_lounge'); __viewer.setOption('wallcap', 'wallcap_limestone'); __viewer.setOption('lighting', 'lights_resort'); });
  const saved = await p.evaluate(() => localStorage.getItem('pool-settings'));
  const before = await p.evaluate(() => ({ cam: __viewer.camera.position.toArray(), opts: JSON.stringify(Object.fromEntries(Object.keys(__viewer.model).filter(k => typeof __viewer.model[k] === 'string').map(k => [k, __viewer.model[k]]))) }));
  await p.locator('#settings-btn').click();
  const label = await p.locator('#copy-design').textContent();
  check('settings: a "Copy design for Bob" button', label === 'Copy design for Bob' && await p.locator('#copy-design').isVisible(), label);
  await p.locator('#copy-design').click(); await p.waitForTimeout(300);
  const note = await p.locator('#copy-design-note').textContent();
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  let j = null; try { j = JSON.parse(clip); } catch {}
  const live = await p.evaluate(() => ({ layout: __viewer.layout, m: Object.fromEntries(['roller', 'kitchen', 'post', 'pump', 'play', 'spaCover', 'pier', 'nfence', 'passage', 'bfence', 'bplant', 'wallcap', 'deck'].map(k => [k, __viewer.model[k]])), lighting: __viewer.model.lighting }));
  check('  copies the design as profile.json, says "Copied"', /^Copied/.test(note) && j && j.layout === 'b' && j.scenario === 'proposed' && /^\d{4}-\d{2}-\d{2}$/.test(j.revised)
    && JSON.stringify(Object.keys(j.options).sort()) === JSON.stringify([...KEYS].sort()) && !('corner' in j.options) && KEYS.every(k => j.options[k] === live.m[k]) && j.lights?.scheme === live.lighting && 'adjust' in j.lights,
    j ? `${j.layout} kitchen ${j.options.kitchen} wallcap ${j.options.wallcap} lights ${j.lights.scheme}` : clip.slice(0, 60));
  const after = await p.evaluate(() => ({ cam: __viewer.camera.position.toArray(), opts: JSON.stringify(Object.fromEntries(Object.keys(__viewer.model).filter(k => typeof __viewer.model[k] === 'string').map(k => [k, __viewer.model[k]]))) }));
  check('  and changes nothing else (options, camera, saved settings)', after.opts === before.opts && JSON.stringify(after.cam) === JSON.stringify(before.cam) && (await p.evaluate(() => localStorage.getItem('pool-settings'))) === saved);
  // the clipboard refused: the JSON in a selected read-only box instead
  await p.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('denied')); });
  await p.locator('#copy-design').click(); await p.waitForTimeout(300);
  const box = await p.evaluate(() => { const t = document.getElementById('copy-design-text'); return { shown: !t.hidden && t.offsetHeight > 0, ro: t.readOnly, selected: t.selectionStart === 0 && t.selectionEnd === t.value.length && t.value.length > 0, focused: document.activeElement === t, json: (() => { try { return JSON.parse(t.value).layout; } catch { return null; } })() }; });
  check('  clipboard refused: the JSON shows read-only and selected', box.shown && box.ro && box.selected && box.focused && box.json === 'b', JSON.stringify(box));
  await p.close();
  // not offered in Bob's locked profile
  ({ p } = await open(ctx, '&profile=bob'));
  await p.locator('#settings-btn').click();
  check('  not shown in the ?profile=bob walkthrough', !(await p.locator('#copy-design').isVisible()));
  check('  console clean', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}
// 5. drone mode is gone: a saved {"mode":"drone"} (the normal walkthrough's or Bob's), or a layout swap handed over
//    from an older page in the drone, opens flying, with only Walk and Fly to choose from and no console errors
{
  const seeded = async (seed, q) => {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 700 } });
    await ctx.addInitScript(s => { try { if (location.pathname.startsWith('/model/') && !sessionStorage.seeded) { sessionStorage.seeded = 1; for (const [k, v] of Object.entries(s.local ?? {})) localStorage.setItem(k, v); for (const [k, v] of Object.entries(s.session ?? {})) sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify({ ...v, at: Date.now() })); } } catch {} }, seed);
    const { p, errs } = await open(ctx, q);
    const s = await p.evaluate(() => ({ mode: __viewer.walker.mode, drone: !!document.getElementById('mode-drone'), fly: document.getElementById('mode-fly').getAttribute('aria-pressed'), y: __viewer.camera.position.y }));
    await ctx.close();
    return { s, errs };
  };
  let { s, errs } = await seeded({ local: { 'pool-settings': JSON.stringify({ mode: 'drone' }) } }, '');
  check('saved {"mode":"drone"} opens flying', s.mode === 'fly' && s.fly === 'true' && !s.drone && s.y > 1, JSON.stringify(s));
  check('  console clean', errs.length === 0, errs[0] ?? '');
  ({ s, errs } = await seeded({ local: { 'pool-settings-profile': JSON.stringify({ mode: 'drone' }) } }, '&profile=bob'));
  check('Bob\'s view with a saved {"mode":"drone"} opens flying', s.mode === 'fly' && !s.drone, JSON.stringify(s));
  check('  console clean', errs.length === 0, errs[0] ?? '');
  const handoff = { layout: 'a', mode: 'drone', feet: [1.3, 2.37, 2.6], cam: [2, 25, 30], target: [1, 2.4, 2], yaw: 0, pitch: -0.5, minutes: 780, date: '2027-01-16', scenario: 'proposed', people: true, options: {} };
  ({ s, errs } = await seeded({ session: { 'pool-layout-swap': handoff } }, '&layout=a'));
  check('a layout swap handed over in the drone opens flying there', s.mode === 'fly' && Math.abs(s.y - 25) < 0.5, JSON.stringify(s));
  check('  console clean', errs.length === 0, errs[0] ?? '');
}
console.log(fail ? `FAIL (${fail})` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

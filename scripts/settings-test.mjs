// Settings (Round 17d): a first visit gets the defaults (Medium, fps on, no outdoor kitchen) and opens at the time it
// is now in Perth (AWST, UTC+8), whatever the browser's timezone; option changes are remembered across a reload, the
// time and date are not (a reload goes back to now), old saved times are ignored, and ?t= / ?date= still win.
// The clock is mocked: an init script shifts Date to a chosen moment (time keeps running from there).
// Round 30: Layout B's own default wall top (no cap) and the "Use the final design" button.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
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
// 6. Round 30: Layout B's own default wall top is no cap (the final design); SK02's stays the aggregate cap. A saved
//    wall top without wallcapChosen came along as a default, so it gives way to the layout's; a picked or linked one wins.
const FINAL = JSON.parse(readFileSync('public/bob/profile.json', 'utf8'));
const KEYS6 = ['roller', 'kitchen', 'post', 'pump', 'play', 'spaCover', 'pier', 'nfence', 'passage', 'bfence', 'bplant', 'wallcap', 'deck'];
/** A new context with localStorage seeded once (a reload keeps what the page saved since), and a page opened in it. */
const seededOpen = async (local, q) => {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 850 } });
  await ctx.addInitScript(s => { try { if (location.pathname.startsWith('/model/') && !sessionStorage.seeded) { sessionStorage.seeded = 1; localStorage.setItem('pool-settings', JSON.stringify(s)); } } catch {} }, local);
  // every hint shown, kept (one shown while loading is gone again by the time it has settled)
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const h = document.getElementById('hint'); window.__hints = [];
    if (h) new MutationObserver(() => { if (!h.hidden) window.__hints.push(h.textContent); }).observe(h, { childList: true, subtree: true, characterData: true, attributes: true });
  }));
  const { p, errs } = await open(ctx, q);
  return { ctx, p, errs };
};
{
  const wallcapOf = async (local, q) => { const { ctx, p } = await seededOpen(local, q); const w = await p.evaluate(() => __viewer.model.wallcap); await ctx.close(); return w; };
  let w = await wallcapOf({}, '&layout=b');
  check('wall tops: a first visit to Layout B shows no cap', w === 'wallcap_none', w);
  w = await wallcapOf({}, '&layout=a');
  check('  a first visit to SK02\'s layout: the aggregate cap', w === 'wallcap_aggregate', w);
  w = await wallcapOf({ layout: 'b', options: { wallcap: 'wallcap_aggregate' } }, '');
  check('  a saved aggregate cap without wallcapChosen, in B: no cap', w === 'wallcap_none', w);
  w = await wallcapOf({ layout: 'b', wallcapChosen: true, options: { wallcap: 'wallcap_aggregate' } }, '');
  check('  the same with wallcapChosen: the aggregate cap', w === 'wallcap_aggregate', w);
  w = await wallcapOf({}, '&layout=b&wallcap=aggregate');
  check('  ?wallcap=aggregate in B: the aggregate cap', w === 'wallcap_aggregate', w);
}
// 7. Round 30: "Use the final design" in the settings: every option and the lighting as /bob/profile.json, saved as
//    your own. From another layout it loads that layout, keeping the view and the mode; in the same layout, in place.
{
  const snapshot = p => p.evaluate(keys => ({ layout: __viewer.layout, mode: __viewer.walker.mode, cam: __viewer.camera.position.toArray(), scenario: __viewer.state().scenario,
    lighting: __viewer.model.lighting, m: Object.fromEntries(keys.map(k => [k, __viewer.model[k]])), saved: JSON.parse(localStorage.getItem('pool-settings') ?? '{}'),
    dialog: document.getElementById('settings').open, hint: (window.__hints ?? []).join(' | '), marker: window.__marker === 1 }), KEYS6);
  const matches = s => KEYS6.filter(k => s.m[k] !== FINAL.options[k]);
  const savedMatches = s => KEYS6.filter(k => s.saved.options?.[k] !== FINAL.options[k]);
  // ---- from SK02's layout, flying high over the yard (a layout swap: the page reloads)
  const own = { layout: 'a', wallcapChosen: true, options: { wallcap: 'wallcap_aggregate', kitchen: 'kitchen_split', roller: 'roller_deep', lighting: 'lights_specced' } };
  let { ctx, p, errs } = await seededOpen(own, '');
  await p.evaluate(() => { __viewer.setMode('fly'); __viewer.walker.startFly(new __viewer.THREE.Vector3(4, 12, 6), 0.4, -0.6); }); await p.waitForTimeout(500);
  const a0 = await snapshot(p);
  check('final design: starts in SK02\'s layout with the saved design', a0.layout === 'a' && a0.m.kitchen === 'kitchen_split' && a0.m.roller === 'roller_deep' && a0.m.wallcap === 'wallcap_aggregate' && a0.mode === 'fly', JSON.stringify(a0.m));
  await p.locator('#settings-btn').click();
  check('  settings: a "Use the final design" button, with a note', (await p.locator('#final-design').textContent()) === 'Use the final design' && await p.locator('#final-design').isVisible()
    && /design we're having built/.test(await p.locator('#final-design-field .final-help').textContent()));
  await Promise.all([p.waitForURL(/layout=b/, { timeout: 30000 }), p.locator('#final-design').click()]);
  await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 120000 });
  const a1 = await snapshot(p);
  check('  loads the profile\'s layout', a1.layout === FINAL.layout, a1.layout);
  check('  every option is the profile\'s', matches(a1).length === 0, matches(a1).map(k => `${k}: ${a1.m[k]}`).join(', '));
  check('  lighting is the profile\'s scheme, Proposed', a1.lighting === FINAL.lights.scheme && a1.scenario === 'proposed', `${a1.lighting} ${a1.scenario}`);
  check('  saved as your own (options, layout, picked on purpose)', savedMatches(a1).length === 0 && a1.saved.options?.lighting === FINAL.lights.scheme && a1.saved.layout === FINAL.layout && a1.saved.wallcapChosen === true && a1.saved.pierChosen === true,
    savedMatches(a1).join(', '));
  check('  the light adjustments are the profile\'s', FINAL.lights.adjust ? JSON.stringify(a1.saved.lightAdjust?.[FINAL.lights.scheme]) === JSON.stringify(FINAL.lights.adjust) : !a1.saved.lightAdjust?.[FINAL.lights.scheme]);
  const moved = Math.hypot(a1.cam[0] - a0.cam[0], a1.cam[1] - a0.cam[1], a1.cam[2] - a0.cam[2]);
  check('  the same mode, the same view (flying: within 0.5 m)', a1.mode === a0.mode && moved < 0.5, `${a1.mode}, moved ${moved.toFixed(2)} m`);
  check('  says so', /final design/i.test(a1.hint), a1.hint);
  // and it sticks: a reload is still the final design (Layout B's defaults don't override it)
  await p.reload(); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 120000 });
  const a2 = await snapshot(p);
  check('  after a reload: still the final design', a2.layout === FINAL.layout && matches(a2).length === 0 && a2.lighting === FINAL.lights.scheme, matches(a2).join(', '));
  check('  console clean', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
  // ---- in Layout B with your own wall top and kitchen: in place, no reload, the camera stays put
  ({ ctx, p, errs } = await seededOpen({ layout: 'b', wallcapChosen: true, options: { wallcap: 'wallcap_aggregate', kitchen: 'kitchen_split' } }, ''));
  await p.evaluate(() => { __viewer.place(1.3, 3.0, 2.6, 156, -5); window.__marker = 1; }); await p.waitForTimeout(800);
  const b0 = await snapshot(p);
  check('final design, same layout: starts with your own wall top and kitchen', b0.layout === 'b' && b0.m.wallcap === 'wallcap_aggregate' && b0.m.kitchen === 'kitchen_split' && b0.mode === 'walk', JSON.stringify(b0.m));
  // the profile can't be read: a note in the dialog, and nothing changes
  await p.route('**/bob/profile.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{ not json' }));
  await p.locator('#settings-btn').click(); await p.locator('#final-design').click(); await p.waitForTimeout(500);
  const bad = await snapshot(p), badNote = await p.locator('#final-design-note').textContent();
  check('  a broken profile.json: says so, changes nothing', /couldn't/i.test(badNote) && bad.dialog && JSON.stringify(bad.m) === JSON.stringify(b0.m) && JSON.stringify(bad.saved) === JSON.stringify(b0.saved), badNote);
  await p.unroute('**/bob/profile.json');
  await p.locator('#final-design').click();
  await p.waitForFunction(o => Object.entries(o).every(([k, v]) => __viewer.model[k] === v), FINAL.options, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(300);
  const b1 = await snapshot(p);
  check('  every option is the profile\'s, in place (no reload)', matches(b1).length === 0 && b1.marker && b1.layout === 'b', matches(b1).map(k => `${k}: ${b1.m[k]}`).join(', '));
  check('  lighting is the profile\'s scheme, Proposed', b1.lighting === FINAL.lights.scheme && b1.scenario === 'proposed', b1.lighting);
  check('  saved as your own', savedMatches(b1).length === 0 && b1.saved.wallcapChosen === true && b1.saved.pierChosen === true, savedMatches(b1).join(', '));
  const still = Math.hypot(b1.cam[0] - b0.cam[0], b1.cam[1] - b0.cam[1], b1.cam[2] - b0.cam[2]);
  check('  the camera and mode stay put', still < 0.01 && b1.mode === 'walk', `moved ${still.toFixed(3)} m, ${b1.mode}`);
  check('  the dialog closes and a hint says so', !b1.dialog && /final design/i.test(b1.hint), b1.hint);
  check('  the Finishes summary follows', /no cap/i.test(await p.locator('#tab-finishes span').textContent()));
  check('  console clean', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
  // ---- not offered in Bob's own locked view
  ({ ctx, p } = await seededOpen({}, '&profile=bob'));
  await p.locator('#settings-btn').click();
  check('final design: not shown in the ?profile=bob walkthrough', !(await p.locator('#final-design').isVisible()));
  await ctx.close();
}
console.log(fail ? `FAIL (${fail})` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

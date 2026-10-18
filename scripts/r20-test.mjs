// Round 20 tests: the open roller channel (card, Daisy link, the deep end's fill hidden through "a|b", E unrolls and
// rolls back with no lids, walking and flying, in both layouts), the deck-edge straight fence with both gate keys,
// and the posts' View no longer landing on the moved climbing frame. Headless on the real GPU; exits 1 on failure.
//   node scripts/r20-test.mjs [--out review/round20/test]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'review/round20/test';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const load = async (q = '') => { await p.goto(`http://localhost:4173/model/walk/?q=Medium&nohelp&date=2027-01-16&t=885${q}`); await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 }); await p.addStyleTag({ content: '.fps,.joystick{display:none!important}' }); };
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(56)} ${info}`); if (!ok) fail++; };
const wait = ms => p.waitForTimeout(ms);
const shot = n => p.locator('#canvas').screenshot({ path: `${OUT}/${n}.png` });
const opt = (k, v) => p.evaluate(([k, v]) => __viewer.setOption(k, v), [k, v]);
const tipText = async () => (await p.locator('#gate-tip').isVisible() ? (await p.locator('#gate-tip').innerText()).toLowerCase() : '');
/** Visible meshes whose name starts with prefix: [visible, total]. */
const shown = prefix => p.evaluate(pre => { let n = 0, v = 0; __viewer.model.root.traverse(o => { if (o.isMesh && o.name.startsWith(pre)) { n++; let q = o, ok = true; while (q) { if (!q.visible) ok = false; q = q.parent; } if (ok) v++; } }); return [v, n]; }, prefix);
const box = () => p.evaluate(() => { const b = __viewer.blankets.boxes.find(b => b.group === 'roller_channel'); return b && { phase: b.phase, progress: b.progress.value, lids: !!b.hinge, origin: b.origin.toArray(), dir: b.dir.toArray() }; });

const channel = async label => {
  await opt('roller', 'roller_channel'); await wait(600);
  const c = await box();
  check(`${label}: the channel has a blanket and no lids`, !!c && !c.lids, JSON.stringify(c?.origin?.map(v => +v.toFixed(2))));
  const parts = await shown('roller_channel_');
  check(`${label}: the channel shows`, parts[0] > 0 && parts[0] === parts[1], `${parts[0]} of ${parts[1]}`);
  const fill = await shown('pitfill_roller_pit_roller_channel');
  check(`${label}: the deep end's paving fill is cut away ("a|b")`, fill[1] > 0 && fill[0] === 0, `${fill[0]} of ${fill[1]} shown`);
  // stand on the concourse beside the channel, on the far side from the pool, looking at it
  await p.evaluate(([o, d]) => { const x = o[0] - d[0] * 1.0, z = o[2] - d[2] * 1.0; const yaw = Math.atan2(d[0], d[2]) * 180 / Math.PI; __viewer.place(x, o[1] + 0.6, z, yaw + 180, -25); }, [c.origin, c.dir]);
  await wait(1400);
  let tip = await tipText();
  check(`${label}: by the channel, "unroll the blanket"`, tip.includes('unroll the blanket'), tip || await p.evaluate(() => __viewer.walker.feet.toArray().map(v => v.toFixed(2)).join(',')));
  await shot(`${label}_channel_in`);
  await p.keyboard.press('KeyE'); await wait(2500);
  const mid = await box();
  check(`${label}: E unrolls it at once (no lids to open)`, mid.phase === 'unrolling' && mid.progress > 0.1 && mid.progress < 0.95, `${mid.phase} ${mid.progress.toFixed(2)}`);
  await shot(`${label}_channel_unrolling`);
  await wait(3000);
  const out = await box();
  check(`${label}: then it's across the pool`, out.phase === 'out' && out.progress === 1, `${out.phase} ${out.progress}`);
  tip = await tipText();
  check(`${label}: "roll the blanket in"`, tip.includes('roll the blanket in'), tip);
  await shot(`${label}_channel_out`);
  // and back, flying
  await p.evaluate(() => __viewer.setMode('fly')); await wait(500);
  await p.keyboard.press('KeyE'); await wait(5800);
  const back = await box();
  check(`${label}, flying: E rolls it back in`, back.phase === 'in' && back.progress === 0, `${back.phase} ${back.progress}`);
  await p.evaluate(() => __viewer.setMode('walk'));
  await opt('roller', 'none'); await wait(400);
  const fill2 = await shown('pitfill_roller_pit_roller_channel');
  check(`${label}: no cover, the fill is back`, fill2[0] === fill2[1] && fill2[1] > 0);
  await opt('roller', 'roller_pit'); await wait(400);
  const fill3 = await shown('pitfill_roller_pit_roller_channel');
  check(`${label}: the blanket box cuts it away too`, fill3[0] === 0);
  await opt('roller', 'none');
};

await load();
// --- the cards
await p.evaluate(() => { __viewer.setPanel(true); window.__openCategory('pool'); });
const card = p.locator('#cards-roller .card-wrap').filter({ has: p.locator('b', { hasText: /^Open channel, deep end$/ }) });
check('Pool cover: an "Open channel, deep end" card', await card.count() === 1);
check('  linking the Daisy SQ', (await card.locator('a.card-link').getAttribute('href'))?.includes('sq-pool-roller'));
await card.locator('summary').click();
const more = await card.locator('.card-more p').innerText();
check('  More: why the Daisy SQ, and the trench\'s hazards', /0\.6 m/.test(more) && /0\.75 m/.test(more) && /trip hazard/.test(more) && /drain/.test(more) && /grate|rail/.test(more));
await p.screenshot({ path: `${OUT}/card_channel.png` });
await p.evaluate(() => window.__openCategory('fences'));
check('Fences: a "Deck edge, then past the pier" card', await p.locator('#cards-pier .card b', { hasText: /^Deck edge, then past the pier$/ }).count() === 1);

await channel('A');

// --- the deck-edge fence, with SK02's gate and with the one long bench's
await opt('pier', 'pier_straight_edge'); await wait(500);
let sk = await shown('fence_pool_east_sk02_straight_edge'), so = await shown('fence_pool_east_south_straight_edge');
check('deck edge: shows with SK02\'s gate', sk[0] === sk[1] && sk[1] > 0 && so[0] === 0, `${sk[0]}/${sk[1]}, south ${so[0]}`);
const asDrawn = await shown('fence_pool_east_sk02_straight_deck');
const gates = await p.evaluate(() => __viewer.model.gates.filter(g => __viewer.model.gateVisible(g)).map(g => g.hinge.toArray().map(v => +v.toFixed(2)).join(',')));
check('  its gate (on the deck edge) is a working gate', gates.includes('3.35,2.47,3.25'), gates.join(' | '));
await p.evaluate(() => __viewer.goToCam('18_pier_fence', true)); await wait(1500);
await shot('pier_straight_edge_18');
await opt('kitchen', 'kitchen_continuous'); await wait(500);
sk = await shown('fence_pool_east_sk02_straight_edge'); so = await shown('fence_pool_east_south_straight_edge');
check('deck edge with the one long bench: the duck\'s gate instead', so[0] === so[1] && so[1] > 0 && sk[0] === 0, `south ${so[0]}/${so[1]}, sk02 ${sk[0]}`);
await opt('kitchen', 'kitchen_none'); await opt('pier', 'pier_as_drawn');
void asDrawn;

// --- the posts' View with the play area moved: not on the climbing frame
await opt('play', 'play_moved'); await wait(500);
await p.evaluate(() => { window.__openCategory('alfresco'); });
await p.locator('#cards-post').locator('..').locator('.view-btn').click(); await wait(2200);
let w = await p.evaluate(() => { const k = __viewer.walker, f = k.feet; return { feet: f.toArray(), crouch: k.crouching, head: k.headroomAt(f.x, f.z, f.y) }; });
check('posts\' View, play area moved: standing on the yard\'s floor', !w.crouch && w.head > 1.8 && w.feet[1] < 2.6, `feet ${w.feet.map(v => v.toFixed(2))} headroom ${w.head.toFixed(2)}`);
await shot('view10_play_moved');
await opt('play', 'play_as_is'); await wait(400);
await p.locator('#cards-post').locator('..').locator('.view-btn').click(); await wait(2200);
w = await p.evaluate(() => { const k = __viewer.walker; return { feet: k.feet.toArray(), crouch: k.crouching }; });
check('  play area where it is: on the floor too, not the wall', !w.crouch && w.feet[1] < 2.6, w.feet.map(v => v.toFixed(2)).join(','));
// seated views keep their seat
await p.evaluate(() => __viewer.goToCam('06_sunken_lounge', true)); await wait(800);
const cam6 = await p.evaluate(() => __viewer.camera.position.toArray());
const want6 = JSON.parse(readFileSync('public/model/web/cameras.json', 'utf8')).find(c => c.name === '06_sunken_lounge').pos;
check('  a seated view still sits where its camera is', Math.hypot(cam6[0] - want6[0], cam6[1] - want6[1], cam6[2] - want6[2]) < 0.15, `${cam6.map(v => v.toFixed(2))} vs ${want6.map(v => v.toFixed(2))}`);

// --- Layout B
await load('&layout=b');
await channel('B');

check('console clean', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(fail ? `${fail} FAILED` : 'PASS');
await b.close();
process.exit(fail ? 1 : 0);

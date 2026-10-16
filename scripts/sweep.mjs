// Every camera in cameras.json, Today and Proposed, at the Cycles render time (16 Jan 14:45), beside its Cycles
// still; one contact sheet (walk | Cycles per row), plus a check of where each camera really landed.
//   node scripts/sweep.mjs [--label now] [--out review/round12/sweep] [--extra "x=1"] [--only 01,05]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const LABEL = arg('label', 'now'), OUT = arg('out', 'review/round12/sweep'), EXTRA = arg('extra', ''), ONLY = arg('only', ''), T = Number(arg('t', 885));
mkdirSync(OUT, { recursive: true });
const cams = JSON.parse(readFileSync('public/model/web/cameras.json', 'utf8')).filter(c => !ONLY || ONLY.split(',').some(o => c.name.startsWith(o)));
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(`http://localhost:4173/model/walk/?q=Medium&panel=0&nohelp&date=2027-01-16${EXTRA ? '&' + EXTRA : ''}`);
await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 180000 });
await p.addStyleTag({ content: '.hud,.hint-pill,.welcome,.status-pill,.gate-tip,.fps,.crosshair,.joystick{display:none!important}' });
const rows = [], report = [];
for (const scen of ['existing', 'proposed']) {
  await p.evaluate(s => __viewer.setScenario(s), scen);
  for (const c of cams) {
    const ref = `public/model/img/${c.name}__${scen}.jpg`;
    if (!existsSync(ref)) continue;
    const info = await p.evaluate(([n, t]) => { __viewer.setTime(t); __viewer.goToCam(n, true); return 0; }, [c.name, T]);
    await p.waitForTimeout(2300);
    const where = await p.evaluate(() => { const s = __viewer.state(); const cp = __viewer.camera.position; return { cam: [cp.x, cp.y, cp.z], mode: __viewer.walker.mode }; });
    const d = Math.hypot(where.cam[0] - c.pos[0], where.cam[1] - c.pos[1], where.cam[2] - c.pos[2]);
    const file = `${OUT}/${LABEL}_${c.name}_${scen}.png`;
    await p.locator('#canvas').screenshot({ path: file });
    report.push(`${c.name.padEnd(24)} ${scen.padEnd(9)} mode ${String(where.mode).padEnd(5)} off by ${d.toFixed(2)} m (dy ${(where.cam[1] - c.pos[1]).toFixed(2)})`);
    rows.push([file, ref, `${c.name} ${scen}`]);
  }
}
console.log(report.join('\n'));
writeFileSync(`${OUT}/${LABEL}_positions.txt`, report.join('\n') + '\n');
const W = 640, H = 360, tiles = [];
for (const [a, r, name] of rows) {
  const label = Buffer.from(`<svg width="${W}" height="28"><rect width="100%" height="100%" fill="black" opacity="0.6"/><text x="8" y="20" font-family="Helvetica" font-size="18" fill="white">${name}</text></svg>`);
  tiles.push(await sharp(a).resize(W, H).composite([{ input: label, top: 0, left: 0 }]).toBuffer(), await sharp(r).resize(W, H).toBuffer());
}
await sharp({ create: { width: W * 2, height: H * rows.length, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % 2) * W, top: Math.floor(i / 2) * H }))).jpeg({ quality: 80 }).toFile(`${OUT}/${LABEL}_sheet.jpg`);
console.log('saved', `${OUT}/${LABEL}_sheet.jpg`, errs.length ? '\nERRORS ' + [...new Set(errs)].join(' / ') : '');
await b.close();

// Load the walkthrough as if the page were hidden (background tab / hidden pane): document.hidden is true and
// requestAnimationFrame callbacks are held, as browsers do, until the page is "shown" after SHOW_MS. Prints the marks.
//   node scripts/hidden-load.mjs [show after ms, default 6000]
import { chromium } from 'playwright';
const SHOW = Number(process.argv[2] ?? 6000);
const b = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.addInitScript(show => {
  let hidden = true; const held = []; const raf = window.requestAnimationFrame.bind(window);
  Object.defineProperty(document, 'hidden', { get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible') });
  window.requestAnimationFrame = cb => { if (hidden) { held.push(cb); return 0; } return raf(cb); };
  setTimeout(() => { hidden = false; window.__shownAt = Math.round(performance.now()); held.splice(0).forEach(cb => raf(cb)); document.dispatchEvent(new Event('visibilitychange')); }, show);
}, SHOW);
await p.goto('http://localhost:4173/model/walk/?panel=0&nohelp');
await p.waitForFunction(() => window.__marks?.some(m => m[0] === 'settled'), null, { timeout: 120000 });
const r = await p.evaluate(() => ({ shown: window.__shownAt, marks: window.__marks.map(m => m.join(' ')).join(' | ') }));
console.log('shown at', r.shown, 'ms\n', r.marks, errs.length ? '\nERRORS ' + errs.join(' / ') : '');
await b.close();

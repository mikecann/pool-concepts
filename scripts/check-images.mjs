// Check every image the pages can show is served (no 404s): the renders page's gallery and the walkthrough's
// card thumbnails. Needs `npm run serve` running. The TS modules are loaded through Vite.
import { createServer } from 'vite';
import { existsSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:4173/model/';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { allImageUrls } = await vite.ssrLoadModule('/src/gallery.ts');
const { CARD_IMAGES } = await vite.ssrLoadModule('/src/choices.ts');
await vite.close();
const urls = [...new Set([...allImageUrls(), ...CARD_IMAGES.map(c => 'img/' + c.img),
  'img/03_lawn_to_terrace__proposed.jpg', 'img/night_14_spa_to_canal_dusk.jpg'])];   // the chooser's two cards
// cards whose option render hasn't been made yet: the page shows "Render to come" for these, so they're expected
const PENDING = new Set([...CARD_IMAGES.filter(c => !existsSync(`public/model/img/${c.src}`)).map(c => 'img/' + c.img),
  // option renders the model agent hasn't made yet (the renders page shows "render to come")
  // anything else not synced yet (the model agent's renders arrive after its export): all images come from the sync,
  // so 'missing' means a file that's on disk but doesn't serve
  ...urls.filter(u => !existsSync(`public/model/${u}`))]);
const bad = [], pending = [];
await Promise.all(urls.map(async u => { const r = await fetch(base + u, { method: 'HEAD' }); if (!r.ok) (PENDING.has(u) ? pending : bad).push(`${r.status} ${u}`); }));
console.log(`${urls.length} images checked, ${bad.length} missing${pending.length ? `, ${pending.length} awaiting a render (shown as "Render to come")` : ''}`);
for (const b of [...bad.sort(), ...pending.map(p => p + ' (awaiting render)')]) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);

// Check every image the side panel can show is served (no 404s). Needs `npm run serve` running.
import { allImageUrls } from '../src/gallery.ts';
const base = process.argv[2] ?? 'http://localhost:4173/model/';
const urls = [...new Set(allImageUrls())];
const bad = [];
await Promise.all(urls.map(async u => { const r = await fetch(base + u, { method: 'HEAD' }); if (!r.ok) bad.push(`${r.status} ${u}`); }));
console.log(`${urls.length} images checked, ${bad.length} missing`);
for (const b of bad.sort()) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);

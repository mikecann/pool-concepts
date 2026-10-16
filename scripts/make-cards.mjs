// Small thumbnails for the walkthrough's design-choice cards (img/card_*.jpg), cut from the option renders.
//   node --experimental-strip-types scripts/make-cards.mjs [public/model/img]
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { CARD_IMAGES } from '../src/choices.ts';
const dir = process.argv[2] ?? 'public/model/img';
// option renders arrive in batches: a card whose render isn't there yet is skipped (the page shows it without
// a picture) and picked up on the next sync
const missing = [];
let made = 0;
for (const { img, src } of CARD_IMAGES) {
  if (!existsSync(`${dir}/${src}`)) { missing.push(src); continue; }
  try { await sharp(`${dir}/${src}`).resize(320, 200, { fit: 'cover' }).jpeg({ quality: 74, mozjpeg: true }).toFile(`${dir}/${img}`); made++; }
  catch (e) { missing.push(`${src} (${e.message})`); }
}
console.log(`made ${made} card thumbnails${missing.length ? `, skipped ${missing.length} without a render yet: ${missing.join(', ')}` : ''}`);

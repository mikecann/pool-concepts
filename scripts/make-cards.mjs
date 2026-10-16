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
for (const { img, src, crop } of CARD_IMAGES) {
  if (!existsSync(`${dir}/${src}`)) { missing.push(src); continue; }
  try {
    // crop: [left, top, width, height] as fractions, to the part of the render the option changes
    let im = sharp(`${dir}/${src}`);
    if (crop) { const m = await sharp(`${dir}/${src}`).metadata(); im = sharp(await im.extract({ left: Math.round(crop[0] * m.width), top: Math.round(crop[1] * m.height), width: Math.round(crop[2] * m.width), height: Math.round(crop[3] * m.height) }).toBuffer()); }
    await im.resize(320, 200, { fit: 'cover' }).jpeg({ quality: 74, mozjpeg: true }).toFile(`${dir}/${img}`); made++; }
  catch (e) { missing.push(`${src} (${e.message})`); }
}
console.log(`made ${made} card thumbnails${missing.length ? `, skipped ${missing.length} without a render yet: ${missing.join(', ')}` : ''}`);

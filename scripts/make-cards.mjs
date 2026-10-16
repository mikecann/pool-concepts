// Small thumbnails for the walkthrough's design-choice cards (img/card_*.jpg), cut from the option renders.
//   node --experimental-strip-types scripts/make-cards.mjs [public/model/img]
import sharp from 'sharp';
import { CARD_IMAGES } from '../src/choices.ts';
const dir = process.argv[2] ?? 'public/model/img';
for (const { img, src } of CARD_IMAGES) {
  await sharp(`${dir}/${src}`).resize(320, 200, { fit: 'cover' }).jpeg({ quality: 74, mozjpeg: true }).toFile(`${dir}/${img}`);
}
console.log(`made ${CARD_IMAGES.length} card thumbnails`);

// Thumbnails for the renders page's strip when it shows the final design: public/bob/renders/thumbs/thumb_<view>.jpg,
// from Bob's set (public/bob/renders/<view>__proposed.jpg), at the size and quality the-pool's web_images.py uses for
// SK02's img/thumb_<view>.jpg (480 x 270, quality 80). Run it again whenever Bob's renders are replaced.
//   node --experimental-strip-types scripts/make-final-thumbs.mjs [public/bob/renders]
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { VIEWS } from '../src/views.ts';
const dir = process.argv[2] ?? 'public/bob/renders';
mkdirSync(`${dir}/thumbs`, { recursive: true });
const missing = [];
let made = 0;
for (const [id] of VIEWS) {
  const src = `${dir}/${id}__proposed.jpg`;
  if (!existsSync(src)) { missing.push(src); continue; }
  await sharp(src).resize(480, 270, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${dir}/thumbs/thumb_${id}.jpg`);
  made++;
}
console.log(`made ${made} final-design thumbnails${missing.length ? `, ${missing.length} without a render: ${missing.join(', ')}` : ''}`);

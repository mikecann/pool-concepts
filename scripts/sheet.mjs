// dev helper: tile screenshots into one contact sheet. node scripts/sheet.mjs out.png cols w a.png b.png ...
import sharp from 'sharp';
const [out, cols, w, ...files] = process.argv.slice(2);
const W = Number(w), H = Math.round(W * 9 / 16), C = Number(cols), R = Math.ceil(files.length / C);
const tiles = await Promise.all(files.map(f => sharp(f).resize(W, H).toBuffer()));
await sharp({ create: { width: W * C, height: H * R, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % C) * W, top: Math.floor(i / C) * H }))).png().toFile(out);

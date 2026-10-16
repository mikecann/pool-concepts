// Mean colour of named rectangles (in an 800x450 frame) in two same-camera images: ours vs Cycles.
//   node scripts/patch-sample.mjs ours.png cycles.jpg name:x0,y0,x1,y1 …
import sharp from 'sharp';
const [a, b, ...rects] = process.argv.slice(2);
const W = 800, H = 450;
const load = async f => (await sharp(f).resize(W, H).removeAlpha().raw().toBuffer());
const [A, B] = await Promise.all([load(a), load(b)]);
const mean = (buf, [x0, y0, x1, y1]) => { let s = [0, 0, 0], n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3; s[0] += buf[i]; s[1] += buf[i + 1]; s[2] += buf[i + 2]; n++; } return s.map(v => Math.round(v / n)); };
for (const r of rects) { const q = r.split(':')[1].split(',').map(Number); console.log(r.split(':')[0].padEnd(14), 'ours', mean(A, q).join(','), '  cycles', mean(B, q).join(',')); }

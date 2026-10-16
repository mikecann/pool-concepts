// Median sky colour (sRGB 0-255) at a few heights in two same-camera images: ours vs the Cycles still.
//   node scripts/sky-sample.mjs ours.png cycles.jpg [rows as fractions of the height, default .02,.08,.15,.22,.28]
import sharp from 'sharp';
const [a, b, rowsArg] = process.argv.slice(2);
const rows = (rowsArg ?? '.02,.08,.15,.22,.28').split(',').map(Number);
const W = 800, H = 450;
const load = async f => (await sharp(f).resize(W, H).removeAlpha().raw().toBuffer());
const [A, B] = await Promise.all([load(a), load(b)]);
const med = v => v.sort((x, y) => x - y)[Math.floor(v.length / 2)];
for (const r of rows) {
  const y = Math.round(r * H);
  const pick = buf => { const R = [], G = [], Bl = []; for (let x = 0; x < W; x++) { const i = (y * W + x) * 3; const [rr, gg, bb] = [buf[i], buf[i + 1], buf[i + 2]];
    if (bb > rr && bb > 90) { R.push(rr); G.push(gg); Bl.push(bb); } } return R.length > 40 ? [med(R), med(G), med(Bl)] : null; };
  // only columns that are sky in both
  const pa = pick(A), pb = pick(B);
  console.log(`row ${String(r).padEnd(5)} ours ${pa ? pa.join(',') : '-'}   cycles ${pb ? pb.join(',') : '-'}`);
}

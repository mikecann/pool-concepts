#!/bin/zsh
# Copy the renders and the web model from the private the-pool repo into public/model.
# Usage: scripts/sync-model.sh [path-to-the-pool]   (default ../the-pool)
# The page itself (public/model/index.html + assets/) is the walkthrough, built from this repo with `npm run build`.
set -e
cd "$(dirname "$0")/.."
POOL=${1:-../the-pool}
OUT=public/model

rm -rf $OUT/img && mkdir -p $OUT/img $OUT/web
uv run --quiet --with pillow python $POOL/model/scripts/web_images.py $POOL/renders/model $OUT/img
# Layout B's renders (renders/model/layout_b/<cam>__proposed_layoutb.png) -> img/layoutb_<cam>.jpg, as web_images.py
# does for the others (1600 x 900, quality 84)
uv run --quiet --with pillow python - $POOL/renders/model/layout_b $OUT/img <<'PY'
import glob, os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
n = 0
for p in sorted(glob.glob(os.path.join(src, "*.png"))):
    b = os.path.basename(p)[:-4].replace("__proposed_layoutb", "")
    Image.open(p).convert("RGB").resize((1600, 900), Image.LANCZOS).save(os.path.join(dst, f"layoutb_{b}.jpg"), quality=84, optimize=True, progressive=True)
    n += 1
print(n, "Layout B images")
PY
# pool-model.glb, cameras.json and lights.json come from the-pool's scripts/web/export.sh; the -b files are Layout B
# (export.sh pool-model-b.blend b), loaded only when that layout is chosen
cp $POOL/model/web/pool-model.glb $POOL/model/web/cameras.json $POOL/model/web/lights.json $OUT/web/
cp $POOL/model/web/pool-model-b.glb $POOL/model/web/cameras-b.json $POOL/model/web/lights-b.json $OUT/web/
node --experimental-strip-types scripts/make-cards.mjs $OUT/img 2>&1 | grep -v ExperimentalWarning
du -sh $OUT

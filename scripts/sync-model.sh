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
# pool-model.glb, cameras.json and lights.json come from the-pool's scripts/web/export.sh
cp $POOL/model/web/pool-model.glb $POOL/model/web/cameras.json $POOL/model/web/lights.json $OUT/web/
du -sh $OUT

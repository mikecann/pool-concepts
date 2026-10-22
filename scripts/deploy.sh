#!/bin/zsh
# Build, deploy to Cloudflare, then request the model files once so the first visitor after a deploy
# doesn't wait for a cold fetch of the 15 MB model (the cache is per data centre, so this warms ours).
# Usage: scripts/deploy.sh   (run scripts/sync-model.sh ../the-pool first if the model or renders changed)
set -e
cd "$(dirname "$0")/.."
npm run build
# Our own pinned copy of wrangler, so a broken global install (as on 22 Oct) can't stop a deploy.
W=.wrangler-cli/node_modules/.bin/wrangler
[ -x "$W" ] || npm i --silent --no-audit --no-fund --prefix .wrangler-cli wrangler@4.112.0
"$W" deploy
V=$(grep -o "pool-model\.glb?v=[A-Za-z0-9_-]*" public/model/assets/walk-*.js | head -1 | sed 's/.*?v=//')
for f in pool-model.glb cameras.json lights.json dims.json; do
  curl -s -o /dev/null -w "warm $f %{http_code} %{size_download} bytes %{time_total}s\n" "https://pool.mikecann.app/model/web/$f?v=$V"
done
VB=$(grep -o "pool-model-b\.glb?v=[A-Za-z0-9_-]*" public/model/assets/walk-*.js | head -1 | sed 's/.*?v=//')
for f in pool-model-b.glb cameras-b.json lights-b.json dims-b.json; do
  curl -s -o /dev/null -w "warm $f %{http_code} %{size_download} bytes %{time_total}s\n" "https://pool.mikecann.app/model/web/$f?v=$VB"
done

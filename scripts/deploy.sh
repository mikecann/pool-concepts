#!/bin/zsh
# Build, deploy to Cloudflare, then request the model files once so the first visitor after a deploy
# doesn't wait for a cold fetch of the 15 MB model (the cache is per data centre, so this warms ours).
# Usage: scripts/deploy.sh   (run scripts/sync-model.sh ../the-pool first if the model or renders changed)
set -e
cd "$(dirname "$0")/.."
npm run build
npx wrangler@4.112.0 deploy
V=$(grep -o "pool-model\.glb?v=[A-Za-z0-9_-]*" public/model/assets/walk-*.js | head -1 | sed 's/.*?v=//')
for f in pool-model.glb cameras.json lights.json; do
  curl -s -o /dev/null -w "warm $f %{http_code} %{size_download} bytes %{time_total}s\n" "https://pool.mikecann.app/model/web/$f?v=$V"
done

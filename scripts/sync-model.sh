#!/bin/zsh
# Copy the 3D model page, its renders and the web GLB from the private the-pool repo into public/model.
# Usage: scripts/sync-model.sh [path-to-the-pool]   (default ../the-pool)
set -e
cd "$(dirname "$0")/.."
POOL=${1:-../the-pool}
OUT=public/model

rm -rf $OUT/img && mkdir -p $OUT/img $OUT/web
uv run --quiet --with pillow python $POOL/model/scripts/web_images.py $POOL/renders/model $OUT/img
cp $POOL/model/web/pool-model.glb $POOL/model/web/cameras.json $OUT/web/

# The page source is written for a Claude artifact (no <html>/<head>), so wrap it in a full document here.
uv run --quiet python - $POOL/model/web/keel-retreat-pool-model.html $OUT/index.html <<'EOF'
import sys
src, dst = sys.argv[1], sys.argv[2]
page = open(src).read().replace('<meta charset="utf-8">\n', "", 1)
cut = page.index("</style>") + len("</style>")
head, body = page[:cut], page[cut:]
body = body.replace('<div class="wrap">', '<div class="wrap">\n  <a class="back" href="../">&larr; All pool concepts</a>', 1)
doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
{head}
<style>
:root {{ padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }}
img {{ max-width: 100%; }}
[hidden] {{ display: none !important; }}
.back {{ font-family: var(--font-display); text-transform: uppercase; letter-spacing: .08em; font-weight: 600; font-size: 14px;
  text-decoration: none; color: var(--muted); }}
.back:hover {{ color: var(--accent); }}
</style>
</head>
<body>
{body}
</body>
</html>
"""
open(dst, "w").write(doc)
print("wrote", dst)
EOF
du -sh $OUT

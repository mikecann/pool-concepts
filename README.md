# Pool concepts

Concepts for our pool, spa and alfresco, served at [pool.mikecann.app](https://pool.mikecann.app). A static site on Cloudflare (Workers static assets), not indexed by search engines.

- `public/index.html`: the list of concepts, newest first.
- `public/concepts/`: the earlier concept images (June SketchUp concept, July AI concept images).
- `public/model/`: the 3D model page, its renders and the web GLB. Generated from the private `the-pool` repo; don't edit by hand.

## Updating the model

The model, renders and page live in `the-pool/model` (Blender, scripts, `web/keel-retreat-pool-model.html`). After re-rendering there:

```bash
scripts/sync-model.sh ../the-pool
npx wrangler deploy
```

`sync-model.sh` turns the renders into web JPEGs, copies the GLB, and wraps the page in a full HTML document with a link back here.

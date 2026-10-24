import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

// The build writes index.html + assets/ into public/model/ next to the renders (img/) and model files (web/),
// so it must never empty that folder. In dev, serve img/ and web/ from there too, and /bob/ (the final design's
// profile and renders, which the renders page shows) from public/bob.
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const modelFiles = (): Plugin => ({
  name: 'model-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.split('?')[0].match(/^\/(model\/(?:img|web)|bob)\/(.+)$/);
      if (!m) return next();
      const dir = join('public', m[1]), file = normalize(join(dir, decodeURIComponent(m[2])));
      if (!file.startsWith(normalize(dir + '/')) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
      res.setHeader('Content-Length', statSync(file).size);
      createReadStream(file).pipe(res);
    });
  },
});

// A content hash of the exported model files, added to their URLs as ?v=… so public/_headers can let browsers
// keep them for a week: a new export changes the hash on the next build, so nobody gets a stale model.
// Layout B's files (-b) get their own hash, so a new export of one layout doesn't refetch the other.
const modelVersion = (suffix = '') => {
  const h = createHash('sha1');
  for (const f of [`pool-model${suffix}.glb`, `lights${suffix}.json`, `cameras${suffix}.json`, `dims${suffix}.json`]) {
    const p = join('public/model/web', f);
    if (existsSync(p)) h.update(readFileSync(p));
  }
  return h.digest('hex').slice(0, 10);
};

export default defineConfig({
  define: { __MODEL_V__: JSON.stringify(modelVersion()), __MODEL_V_B__: JSON.stringify(modelVersion('-b')) },
  base: '/model/',
  publicDir: false,
  plugins: [modelFiles()],
  build: {
    outDir: 'public/model', emptyOutDir: false, target: 'es2022', chunkSizeWarningLimit: 2000,
    // three pages: /model/ (choose), /model/renders/ (no three.js) and /model/walk/ (the 3D walkthrough)
    rollupOptions: { input: { home: 'index.html', renders: 'renders/index.html', walk: 'walk/index.html' } },
  },
});

import { defineConfig, type Plugin } from 'vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

// The build writes index.html + assets/ into public/model/ next to the renders (img/) and model files (web/),
// so it must never empty that folder. In dev, serve img/ and web/ from there too.
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const modelFiles = (): Plugin => ({
  name: 'model-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.split('?')[0].match(/^\/model\/((img|web)\/.+)$/);
      if (!m) return next();
      const file = normalize(join('public/model', decodeURIComponent(m[1])));
      if (!file.startsWith(normalize('public/model/')) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
      res.setHeader('Content-Length', statSync(file).size);
      createReadStream(file).pipe(res);
    });
  },
});

export default defineConfig({
  base: '/model/',
  publicDir: false,
  plugins: [modelFiles()],
  build: {
    outDir: 'public/model', emptyOutDir: false, target: 'es2022', chunkSizeWarningLimit: 2000,
    // three pages: /model/ (choose), /model/renders/ (no three.js) and /model/walk/ (the 3D walkthrough)
    rollupOptions: { input: { home: 'index.html', renders: 'renders/index.html', walk: 'walk/index.html' } },
  },
});

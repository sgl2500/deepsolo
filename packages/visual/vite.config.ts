import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

function worldLayoutSavePlugin(): Plugin {
  return {
    name: 'world-layout-save',
    configureServer(server) {
      server.middlewares.use('/api/save-indoor-layout', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const layout = data.layout;
            if (!layout || typeof layout.sceneId !== 'string' || layout.sceneId.length === 0) {
              throw new Error('missing layout.sceneId');
            }
            const generatedPath = path.resolve(__dirname, 'src/content/generated_indoor_layouts.json');
            const existing = fs.existsSync(generatedPath)
              ? JSON.parse(fs.readFileSync(generatedPath, 'utf-8'))
              : { version: 1, savedAt: 0, scenes: {} };
            existing.version = 1;
            existing.savedAt = Date.now();
            existing.scenes = existing.scenes && typeof existing.scenes === 'object' ? existing.scenes : {};
            existing.scenes[layout.sceneId] = {
              ...layout,
              savedAt: Date.now(),
            };
            fs.writeFileSync(generatedPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || 'invalid data' }));
          }
        });
      });

      server.middlewares.use('/api/save-world-layout', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (!Array.isArray(data.items)) throw new Error('missing items');
            const outPath = path.resolve(__dirname, 'src/data/world_layout_override.json');
            fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
            if (Array.isArray(data.automatedBuildings)) {
              const generatedPath = path.resolve(__dirname, 'src/content/generated_buildings.json');
              fs.writeFileSync(generatedPath, JSON.stringify(data.automatedBuildings, null, 2) + '\n', 'utf-8');
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || 'invalid data' }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1800,
  },
  server: {
    port: 3456,
    open: true,
  },
  plugins: [worldLayoutSavePlugin()],
});

import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

function worldLayoutSavePlugin(): Plugin {
  return {
    name: 'world-layout-save',
    configureServer(server) {
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

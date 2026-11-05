import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

function offlineShell(): Plugin {
  return {
    name: 'offline-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(name => name !== 'offline-worker.js');
      const publicFiles = ['manifest.webmanifest', 'icons/logo.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/apple-touch-icon.png'];
      const precache = [...new Set(['index.html', ...files, ...publicFiles])].map(name => './' + name);
      const fingerprint = createHash('sha256');
      for (const name of files.sort()) {
        const file = bundle[name];
        fingerprint.update(name);
        fingerprint.update(file.type === 'chunk' ? file.code : file.source);
      }
      for (const name of publicFiles) fingerprint.update(readFileSync('public/' + name));
      const template = readFileSync('offline-worker.js', 'utf8');
      fingerprint.update(template);
      const source = template.replace('__CACHE_NAME__', 'open-learning-shell-' + fingerprint.digest('hex').slice(0, 16))
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'offline-worker.js', source });
    }
  };
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/open-learning/' : '/',
  plugins: [offlineShell()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
}));

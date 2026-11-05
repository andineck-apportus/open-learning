import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker() {
 const listeners = {};
 const matches = [];
 const cache = { match: async (request, options) => { matches.push(options); return 'cached'; } };
 const self = { registration: { scope: 'https://example.test/open-learning/' }, addEventListener: (name, fn) => { listeners[name] = fn; } };
 const caches = { open: async () => cache };
 const source = readFileSync(new URL('../offline-worker.js', import.meta.url), 'utf8')
  .replace('__PRECACHE__', JSON.stringify(['./index.html', './assets/app.js']));
 vm.runInNewContext(source, { self, caches, URL, fetch: async () => 'network', Promise });
 return { listeners, matches };
}

test('offline cache serves the app assets even when the server varies by Origin', async () => {
 const { listeners, matches } = worker();
 let response;
 listeners.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://example.test/open-learning/assets/app.js' }, respondWith: value => { response = value; } });
 assert.equal(await response, 'cached');
 assert.equal(matches[0].ignoreVary, true);
});

test('external services and non-GET requests bypass the offline cache', () => {
 const { listeners } = worker();
 for (const request of [
  { method: 'GET', url: 'https://graph.microsoft.com/v1.0/me' },
  { method: 'POST', url: 'https://example.test/open-learning/api/extract' },
  { method: 'GET', url: 'https://example.test/other/assets/app.js' }
 ]) {
  let intercepted = false;
  listeners.fetch({ request, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
 }
});

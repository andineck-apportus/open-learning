import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {fileURLToPath} from 'node:url';
const code=await build({entryPoints:[fileURLToPath(new URL('./ai-key.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});const {loadAiKey,saveAiKey,extractionEndpoint}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
function storage(entries = []) {
 const values = new Map(entries);
 return {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
 };
}
test('the key survives reload in the same tab and can be cleared', () => {
 const local = storage(), session = storage();
 saveAiKey('test-only-key', session);
 assert.equal(loadAiKey(local, session), 'test-only-key');
 assert.equal(loadAiKey(local, session), 'test-only-key');
 assert.equal(loadAiKey(local, storage()), '');
 saveAiKey('', session);
 assert.equal(loadAiKey(local, session), '');
});
test('a legacy persistent key moves into the tab session', () => {
 const local = storage([['ol-api-remembered', 'test-only-key'], ['ol-api-persist', 'yes']]);
 const session = storage();
 assert.equal(loadAiKey(local, session), 'test-only-key');
 assert.equal(local.getItem('ol-api-remembered'), null);
 assert.equal(local.getItem('ol-api-persist'), null);
 assert.equal(loadAiKey(local, session), 'test-only-key');
});
test('AI credentials cannot be sent over an unencrypted remote connection',()=>{assert.equal(extractionEndpoint('https://worker.example/'),'https://worker.example/api/extract');assert.equal(extractionEndpoint('http://localhost:8787'),'http://localhost:8787/api/extract');for(const u of ['http://remote.example','https://user:password@example.com','https://example.com/?key=secret','https://example.com/#secret'])assert.throws(()=>extractionEndpoint(u))});

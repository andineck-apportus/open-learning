import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {fileURLToPath} from 'node:url';
const bundle=await build({entryPoints:[fileURLToPath(new URL('./SyncBadge.tsx',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {syncAppearance}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('green status requires a completed cloud sync, not just a connected account',()=>{
 assert.equal(syncAppearance('Synchronisiert · 14:00',true,false,'').state,'success');
 for(const state of ['Synchronisiert …','Auf diesem Gerät gespeichert','Änderungen warten auf Synchronisation','Offline – Änderungen bleiben lokal'])assert.notEqual(syncAppearance(state,true,false,'').state,'success');
 assert.notEqual(syncAppearance('Synchronisiert · 14:00',false,false,'').state,'success');
 assert.equal(syncAppearance('Synchronisiert · 14:00',true,true,'').state,'syncing');
 assert.equal(syncAppearance('Synchronisiert · 14:00',true,false,'Network down').state,'error');
});

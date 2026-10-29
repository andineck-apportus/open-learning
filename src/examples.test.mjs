import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=await build({entryPoints:[fileURLToPath(new URL('./model.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {initialLibrary,exampleForItem}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('all built-in sample cards include a bilingual example, including older installations',()=>{
 const set=initialLibrary().sets[0];assert.equal(set.items.length,28);
 for(const item of set.items){assert.ok(item.example.includes('\n'));const old={...item};delete old.example;assert.equal(exampleForItem(set.id,old),item.example)}
});
test('user examples, deliberate removal and edited/imported cards are never replaced',()=>{
 const set=initialLibrary().sets[0],item=set.items[0];
 assert.equal(exampleForItem(set.id,{...item,example:'My own sentence'}),'My own sentence');
 assert.equal(exampleForItem(set.id,{...item,example:''}),'');
 const old={...item};delete old.example;
 assert.equal(exampleForItem('imported',old),undefined);
 assert.equal(exampleForItem(set.id,{...old,front:'edited'}),undefined);
 assert.equal(exampleForItem(set.id,{...old,id:'imported-card'}),undefined);
});

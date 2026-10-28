import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const bundle=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {RoundProgress,LearningProgress} from './LearningProgress';export const round=props=>renderToStaticMarkup(<RoundProgress {...props}/>);export const levels=props=>renderToStaticMarkup(<LearningProgress {...props}/>);`,resolveDir:fileURLToPath(new URL('.',import.meta.url)),loader:'jsx'},bundle:true,platform:'node',format:'cjs',write:false});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {round,levels}=module.exports;
test('exam progress shows completion without revealing which answers were correct',()=>{
 const html=round({total:3,results:[{correct:false},{correct:true}],conceal:true});
 assert.match(html,/aria-valuenow="2"/);assert.match(html,/2 von 3/);
 assert.ok(!html.includes('round-known'));assert.ok(!html.includes('round-review'));
 assert.equal((html.match(/class="round-neutral"/g)||[]).length,2);
});
test('round summary displays actual accuracy and handles empty rounds',()=>{
 assert.match(round({total:4,results:[{correct:true},{correct:false},{correct:true},{correct:true}],summary:true}),/75 Prozent richtig/);
 assert.match(round({total:0,results:[],summary:true}),/0 Prozent richtig/);
});
test('an empty learning set has a neutral graphic and readable stage labels',()=>{
 const html=levels({levels:[]});assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'));assert.match(html,/Noch üben/);assert.match(html,/Sicher/);
});

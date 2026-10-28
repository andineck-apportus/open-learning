import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundled=await build({entryPoints:[fileURLToPath(new URL('./keyboard-layout.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {keyboardLayout,editAnswer}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
test('answer languages select their alphabet and language-specific letters',()=>{
 assert.deepEqual(keyboardLayout('Französisch').rows,['qwertzuiop','asdfghjkl','yxcvbnm']);
 assert.equal(keyboardLayout('Französisch').name,'Français · QWERTZ');
 for(const c of ['é','è','ê','à','ç','œ'])assert.ok(keyboardLayout('Französisch').accents.includes(c));
 assert.equal(keyboardLayout('Deutsch').rows[0],'qwertzuiop');
 assert.ok(keyboardLayout('Deutsch').accents.includes('ß'));
 assert.ok(!keyboardLayout('Deutsch (Schweiz)').accents.includes('ß'));
 assert.equal(keyboardLayout('Englisch').rows[0],'qwertyuiop');
 assert.equal(keyboardLayout('Englisch').accents.length,0);
 assert.ok(keyboardLayout('Spanisch').rows.join('').includes('ñ'));
 assert.equal(keyboardLayout('Antwort').lang,'und');
});
test('sentence entry supports insertion, selection replacement and accented characters',()=>{
 assert.deepEqual(editAnswer('ecole',0,1,'é'),{text:'école',caret:1});
 assert.deepEqual(editAnswer('Jaime',1,1,"'"),{text:"J'aime",caret:2});
 assert.deepEqual(editAnswer('dehors',6,6,' '),{text:'dehors ',caret:7});
 assert.deepEqual(editAnswer('Ich mag das',8,11,'dich'),{text:'Ich mag dich',caret:12});
});
test('backspace removes the preceding character or selected range without truncating the rest',()=>{
 assert.deepEqual(editAnswer('école',1,1,'Backspace'),{text:'cole',caret:0});
 assert.deepEqual(editAnswer('à la maison',2,5,'Backspace'),{text:'à maison',caret:2});
 assert.deepEqual(editAnswer('😊a',2,2,'Backspace'),{text:'a',caret:0});
 assert.deepEqual(editAnswer('a',0,0,'Backspace'),{text:'a',caret:0});
});

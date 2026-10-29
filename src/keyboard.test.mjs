import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundled=await build({stdin:{contents:"export * from './keyboard-layout'; export * from './keyboard-preferences';",resolveDir:fileURLToPath(new URL('.',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {keyboardLayout,editAnswer,needsCustomKeyboard,parseKeyboardPreferences}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
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

test('QWERTZ and QWERTY are independent of keyboard language and retain accents',()=>{
 assert.deepEqual(keyboardLayout('Französisch','qwerty').rows,['qwertyuiop','asdfghjkl','zxcvbnm']);
 assert.equal(keyboardLayout('Französisch','qwerty').name,'Français · QWERTY');
 assert.deepEqual(keyboardLayout('Französisch','qwerty').accents,keyboardLayout('Französisch').accents);
 assert.equal(keyboardLayout('Englisch','qwertz').rows[0],'qwertzuiop');
 assert.ok(keyboardLayout('es','qwertz').rows.join('').includes('ñ'));
 assert.ok(keyboardLayout('de-CH','qwerty').accents.includes('ü'));
 assert.ok(!keyboardLayout('de-CH','qwerty').accents.includes('ß'));
});
test('saved keyboard choices validate language and arrangement independently',()=>{
 assert.deepEqual(parseKeyboardPreferences(JSON.stringify({language:'fr',arrangement:'qwerty',onDesktop:true})),{language:'fr',arrangement:'qwerty',onDesktop:true});
 assert.deepEqual(parseKeyboardPreferences(JSON.stringify({language:'en',arrangement:'broken',onDesktop:'false'})),{language:'en',arrangement:'auto',onDesktop:false});
 for(const value of [null,'{','[]','42'])assert.deepEqual(parseKeyboardPreferences(value),{language:'auto',arrangement:'auto',onDesktop:false});
});
test('tablets keep the custom keyboard independent of width and primary pointer',()=>{
 // iPad Safari desktop mode: a Mac-like UA, touch display, and attached mouse.
 assert.equal(needsCustomKeyboard({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',maxTouchPoints:5,smallScreen:false,coarsePointer:false}),true);
 // Android and older iPad browsers may not expose reliable touch APIs.
 assert.equal(needsCustomKeyboard({userAgent:'Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',smallScreen:false}),true);
 assert.equal(needsCustomKeyboard({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',smallScreen:false}),true);
 assert.equal(needsCustomKeyboard({userAgent:'Desktop',mobileHint:true}),true);
 assert.equal(needsCustomKeyboard({userAgent:'Desktop',coarsePointer:true}),true);
 assert.equal(needsCustomKeyboard({userAgent:'Desktop',maxTouchPoints:10}),true);
 assert.equal(needsCustomKeyboard({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',maxTouchPoints:0,smallScreen:false,coarsePointer:false}),false);
 assert.equal(needsCustomKeyboard({smallScreen:true}),true);
});

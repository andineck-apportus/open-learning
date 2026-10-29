import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const bundle=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {AnswerInput} from './AnswerInput';export const render=props=>renderToStaticMarkup(<AnswerInput value="" onChange={()=>{}} onSubmit={()=>{}} language="Französisch" {...props}/>);`,resolveDir:fileURLToPath(new URL('.',import.meta.url)),loader:'jsx'},bundle:true,platform:'node',format:'cjs',write:false});
function render({small=false,coarse=false,touch=0,ua='Desktop',preferences=null,blockedStorage=false,props={}}={}){
 const module={exports:{}};
 new Function('require','module','exports','window','navigator','localStorage',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports,{matchMedia:query=>({matches:query.includes('max-width')?small:coarse})},{userAgent:ua,maxTouchPoints:touch},{getItem(){if(blockedStorage)throw Error('Storage blocked');return preferences&&JSON.stringify(preferences)}});
 return module.exports.render(props);
}
test('wide iPad in desktop mode renders its own keyboard without autofocus or native text input',()=>{
 const html=render({touch:5,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15'});
 assert.match(html,/readOnly=""/);assert.match(html,/inputMode="none"/);assert.ok(!html.includes('autofocus'));
 assert.match(html,/Bildschirmtastatur Français · QWERTZ/);assert.match(html,/aria-label="Tastatursprache"/);assert.match(html,/aria-label="Tastenanordnung"/);
});
test('wide Android tablet still uses the app keyboard when pointer and touch hints are absent',()=>{
 const html=render({ua:'Mozilla/5.0 (Linux; Android 14; Tablet) Chrome/130.0.0.0'});
 assert.match(html,/inputMode="none"/);assert.match(html,/answer-keyboard/);
});
test('physical desktop input remains available unless the on-screen keyboard is explicitly chosen',()=>{
 const desktop=render();assert.match(desktop,/inputMode="text"/);assert.ok(!desktop.includes('readOnly=""'));assert.ok(!desktop.includes('class="answer-keyboard"'));
 const chosen=render({preferences:{language:'en',arrangement:'qwertz',onDesktop:true}});assert.match(chosen,/readOnly=""/);assert.match(chosen,/Bildschirmtastatur English · QWERTZ/);
});
test('language override keeps the answer language and text unchanged',()=>{
 const html=render({touch:5,preferences:{language:'de-CH',arrangement:'qwerty'},props:{value:'école'}});
 assert.match(html,/Bildschirmtastatur Deutsch \(CH\) · QWERTY/);assert.match(html,/lang="fr"/);assert.match(html,/value="école"/);
});
test('blocked storage cannot disable a tablet keyboard; word building does not open native input',()=>{
 assert.match(render({touch:5,blockedStorage:true}),/inputMode="none"/);
 const built=render({touch:5,props:{built:true}});assert.match(built,/readOnly=""/);assert.match(built,/inputMode="none"/);assert.ok(!built.includes('class="answer-keyboard"'));
});
test('a submitted answer keeps the keyboard present and locked while Weiter stays available',()=>{
 const html=render({small:true,props:{value:'école',answerLocked:true,submitLabel:'Weiter',allowEmpty:true}});
 assert.match(html,/value="école"/);assert.match(html,/readOnly=""/);assert.match(html,/class="answer-keyboard"/);
 assert.match(html,/class="keyboard-key" disabled=""|disabled="" class="keyboard-key"/);
 assert.match(html,/<button type="submit" class="primary answer-submit">.*Weiter<\/button>/);
});

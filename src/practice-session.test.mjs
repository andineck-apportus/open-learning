import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=await build({entryPoints:[fileURLToPath(new URL('./practice-session.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
const {loadPracticeSession,savePracticeSession,clearPracticeSession}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function storage(){const data=new Map();global.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};return data}
const session=(setId='s')=>({setId,mode:'test',cards:[{id:'c',front:'Schule',back:'école',direction:'front-back'}],pos:0,results:[{id:'a',setId,itemId:'c',correct:true,practiceMode:'test'}],drill:false,settled:true,draft:'école',retry:false,revealed:true});
test('partial rounds, drafts and rated-answer state survive a reload independently per set',()=>{
 storage();savePracticeSession(session('s'));savePracticeSession({...session('t'),draft:'éc',settled:false,results:[]});
 assert.deepEqual(loadPracticeSession('s'),session('s'));assert.equal(loadPracticeSession('t').draft,'éc');
 clearPracticeSession('s');assert.equal(loadPracticeSession('s'),null);assert.equal(loadPracticeSession('t').setId,'t');
});
test('legacy unfinished rounds migrate without reviving a completed session',()=>{
 const data=storage();data.set('ol-practice-session-v1',JSON.stringify(session()));
 assert.deepEqual(loadPracticeSession('s'),session());savePracticeSession(session());assert.ok(!data.has('ol-practice-session-v1'));
 clearPracticeSession('s');assert.equal(loadPracticeSession('s'),null);
});
test('damaged stored rounds are ignored instead of being resumed',()=>{
 const data=storage();data.set('ol-practice-session-v1:s','{broken');assert.equal(loadPracticeSession('s'),null);
 data.set('ol-practice-session-v1:s',JSON.stringify({...session(),pos:99}));assert.equal(loadPracticeSession('s'),null);
 data.set('ol-practice-session-v1:s',JSON.stringify({...session(),setId:'other'}));assert.equal(loadPracticeSession('s'),null);
});
test('Memory retains the board order and found pairs, without converting guesses into knowledge',()=>{
 storage();const game={...session(),mode:'memory',results:[],settled:false,interaction:{pos:0,picked:[],matched:['0-f','0-b'],misses:2,tiles:[{id:'0-f',pair:0,text:'Schule'},{id:'0-b',pair:0,text:'école'}],letters:[]}};
 savePracticeSession(game);assert.deepEqual(loadPracticeSession('s'),game);
});
test('a correction keeps the original failed result and its draft across a reload',()=>{
 const data=storage();const correcting={...session(),mode:'listen',correction:'typing',draft:'éc',results:[{...session().results[0],correct:false,practiceMode:'listen'}]};
 savePracticeSession(correcting);assert.deepEqual(loadPracticeSession('s'),correcting);
 savePracticeSession({...correcting,correction:'done',draft:'école'});assert.equal(loadPracticeSession('s').results[0].correct,false);assert.equal(loadPracticeSession('s').correction,'done');
 data.set('ol-practice-session-v1:s',JSON.stringify({...correcting,correction:'invalid'}));assert.equal(loadPracticeSession('s'),null);
});

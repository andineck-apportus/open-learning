import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=await build({entryPoints:[fileURLToPath(new URL('./learning-engine.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
const {accepts,progressFor,shuffled,languageCode,preferredDirection,learningLevels,levelCounts}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('full sentences preserve words and accept punctuation and curly apostrophes',()=>{assert.ok(accepts(' Il m’aide souvent! ','Il m\'aide souvent.'));assert.ok(!accepts('Il aide souvent','Il m\'aide souvent.'));assert.ok(!accepts('ecole','école'));assert.ok(accepts('géniale','génial/e'))});
test('learning levels and due dates are isolated by set and direction',()=>{const now=Date.parse('2026-10-28T12:00:00Z');const a={id:'1',itemId:'i',setId:'s',direction:'front-back',correct:true,attempts:1,createdAt:new Date(now).toISOString()};assert.deepEqual(progressFor([],'s','i','front-back',now),{level:0,due:true});assert.deepEqual(progressFor([a],'s','i','front-back',now),{level:1,due:false});assert.equal(progressFor([a],'s','i','back-front',now).level,0);assert.equal(progressFor([a],'s','i','front-back',now+86400000).due,true);assert.equal(progressFor([a,{...a,id:'2',correct:false,createdAt:new Date(now+1).toISOString()}],'s','i','front-back',now).level,0)});
test('shuffle preserves repeated letters without mutating source',()=>{const source=['l','l','e'];assert.deepEqual(shuffled(source).sort(),['e','l','l']);assert.deepEqual(source,['l','l','e']);assert.equal(languageCode('Französisch'),'fr-FR');assert.equal(languageCode('Frage'),undefined)});

test('visual learning levels count each card once in the selected direction',()=>{
 const set={id:'s',items:[{id:'i',kind:'translation'},{id:'qa',kind:'qa'}]};
 const first={id:'a',itemId:'i',setId:'s',direction:'front-back',correct:true,attempts:1,createdAt:'2026-10-28T12:00:00Z'};
 const records=[first,{...first,id:'b',direction:'back-front'},{...first,id:'c',itemId:'qa'}];
 assert.deepEqual(learningLevels(set,records,'front-back'),[1,1]);
 assert.deepEqual(learningLevels(set,records,'back-front'),[1,1]);
 assert.deepEqual(levelCounts(learningLevels(set,records,'back-front')),[0,2,0,0,0,0]);
 assert.deepEqual(levelCounts([]),[0,0,0,0,0,0]);
});
test('a card only reaches the safe stage after five direct successes; mistakes return it to practice',()=>{
 const set={id:'s',items:[{id:'i',kind:'translation'}]};
 const records=Array.from({length:7},(_,i)=>({id:String(i),itemId:'i',setId:'s',direction:'front-back',correct:true,attempts:1,createdAt:new Date(Date.UTC(2026,9,20+i)).toISOString()}));
 assert.deepEqual(levelCounts(learningLevels(set,records,'front-back')),[0,0,0,0,0,1]);
 assert.deepEqual(learningLevels(set,[...records,{...records[0],id:'error',correct:false,createdAt:'2026-10-28T12:00:00Z'}],'front-back'),[0]);
 assert.deepEqual(learningLevels(set,[{...records[0],practiceMode:'listen'}],'front-back'),[0]);
});
test('overview and learning view use the same native-language direction',()=>{
 assert.equal(preferredDirection(['Französisch','Deutsch (Schweiz)'],'Deutsch'),'back-front');
 assert.equal(preferredDirection(['Deutsch','Englisch'],'Deutsch'),'front-back');
 assert.equal(preferredDirection(['Frage','Antwort'],'Deutsch'),'front-back');
});
test('Memory never promotes or resets a knowledge level',()=>{
 const a={id:'a',itemId:'i',setId:'s',direction:'front-back',correct:true,attempts:1,createdAt:'2026-10-29T10:00:00Z',practiceMode:'write'};
 const memory={...a,id:'m',practiceMode:'memory',correct:false,attempts:2,createdAt:'2026-10-29T11:00:00Z'};
 assert.equal(progressFor([a,memory],'s','i','front-back').level,1);
 assert.equal(progressFor([{...memory,correct:true,attempts:1}],'s','i','front-back').level,0);
});
test('dictation speaks the foreign language regardless of which side contains the native language',async()=>{
 const {listeningDirection}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 assert.equal(listeningDirection(['Französisch','Deutsch'],'Deutsch'),'front-back');
 assert.equal(listeningDirection(['Deutsch','Französisch'],'Deutsch'),'back-front');
 assert.equal(listeningDirection(['Deutsch (Schweiz)','Englisch'],'Deutsch'),'back-front');
 assert.equal(listeningDirection(['Englisch','Italienisch'],'English'),'back-front');
 assert.equal(listeningDirection(['Französisch','Deutsch'],'Französisch'),'back-front');
});

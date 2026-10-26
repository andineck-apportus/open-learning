import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLibrary,mergeLibraries,stampChanges,deleteLibraryEntity,canonical,validLibrary} from './model.ts';
const edit=(base,index,field,value)=>{const next=structuredClone(base);next.sets[0].items[index][field]=value;return stampChanges(base,next)};
test('concurrent edits to different cards and fields survive both merge directions',()=>{
 const base=initialLibrary(),a=edit(base,0,'front','A'),b=edit(base,1,'front','B'),c=edit(base,0,'back','C');
 const merged=mergeLibraries(mergeLibraries(a,b),c);
 assert.equal(merged.sets[0].items.find(x=>x.id==='u2-1').front,'A');
 assert.equal(merged.sets[0].items.find(x=>x.id==='u2-1').back,'C');
 assert.equal(merged.sets[0].items.find(x=>x.id==='u2-2').front,'B');
 assert.equal(canonical(merged),canonical(mergeLibraries(c,mergeLibraries(b,a))));
});
test('card deletion wins over stale/offline edits',()=>{
 const base=initialLibrary(),next=structuredClone(base);next.sets[0].items.shift();
 const deleted=stampChanges(base,next),edited=edit(base,0,'front','offline');
 for(const m of [mergeLibraries(deleted,edited),mergeLibraries(edited,deleted)])assert.ok(!m.sets[0].items.some(x=>x.id==='u2-1'));
});
test('merge is idempotent and stable over repeated synchronisations',()=>{
 const base=initialLibrary(),a=edit(base,0,'front','A'),b=edit(base,1,'back','B');
 const merged=mergeLibraries(a,b);
 assert.equal(canonical(merged),canonical(mergeLibraries(merged,merged)));
 assert.equal(canonical(merged),canonical(mergeLibraries(merged,a)));
});
test('same-field simultaneous writes converge deterministically',()=>{
 const base=initialLibrary(),a=edit(base,0,'front','A'),b=edit(base,0,'front','B');
 b.sets[0].items[0].fieldVersions.front=a.sets[0].items[0].fieldVersions.front;
 assert.equal(canonical(mergeLibraries(a,b)),canonical(mergeLibraries(b,a)));
});
test('edits made during an upload remain pending and are not replaced by its snapshot',()=>{
 const base=initialLibrary(),upload=edit(base,0,'front','uploaded'),latest=edit(upload,1,'front','during upload');
 const result=mergeLibraries(latest,upload);
 assert.equal(result.sets[0].items.find(x=>x.id==='u2-2').front,'during upload');
 assert.notEqual(canonical(result),canonical(upload));
});
test('fresh-device sample cannot overwrite existing learning data',()=>{
 const base=initialLibrary(),updated=edit(base,0,'front','edited');
 assert.equal(mergeLibraries(updated,initialLibrary()).sets[0].items[0].front,'edited');
});
test('source card order survives synchronisation',()=>{
 const base=initialLibrary(),merged=mergeLibraries(base,base);
 assert.deepEqual(merged.sets[0].items.map(x=>x.id),base.sets[0].items.map(x=>x.id));
});
test('deleted subject cannot be resurrected by an offline new card',()=>{
 const base=initialLibrary(),a=deleteLibraryEntity(base,'subject','french'),b=edit(base,0,'front','late');
 assert.equal(mergeLibraries(a,b).sets.length,0);
});
test('malformed cloud documents are rejected before writing',()=>{
 assert.ok(validLibrary(initialLibrary()));
 assert.ok(!validLibrary({schema:1,subjects:[],sets:[{}],attempts:[],updatedAt:'today'}));
 const x=initialLibrary();x.sets[0].items[0].front=null;assert.ok(!validLibrary(x));
});

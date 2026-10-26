import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLibrary,deleteLibraryEntity,mergeLibraries} from './model.ts';
test('deleted sets and attempts stay deleted in both sync directions',()=>{
 const original=initialLibrary(); original.attempts=[{id:'a',setId:'unite2'}];
 const removed=deleteLibraryEntity(original,'set','unite2');
 for(const merged of [mergeLibraries(original,removed),mergeLibraries(removed,original)]){
  assert.equal(merged.sets.length,0);assert.equal(merged.attempts.length,0);assert.equal(merged.subjects.length,1);
 }
});
test('deleting a subject removes child sets including stale-device additions',()=>{
 const original=initialLibrary(),removed=deleteLibraryEntity(original,'subject','french');
 original.sets.push({...original.sets[0],id:'offline-new'});
 for(const merged of [mergeLibraries(original,removed),mergeLibraries(removed,original)]){
  assert.equal(merged.subjects.length,0);assert.equal(merged.sets.length,0);assert.ok(merged.deletedSetIds.includes('offline-new'));
 }
});
test('newer subject rename survives sync with old backups',()=>{
 const old=initialLibrary(),renamed=structuredClone(old);renamed.subjects[0]={...old.subjects[0],name:'Français',updatedAt:'2026-10-26T10:00:00Z'};
 for(const merged of [mergeLibraries(old,renamed),mergeLibraries(renamed,old)])assert.equal(merged.subjects[0].name,'Français');
});

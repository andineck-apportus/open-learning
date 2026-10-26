import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialLibrary,stampChanges,mergeLibraries} from './model.ts';
const bundled=await build({entryPoints:[new URL('./replica-cloud.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
const {readReplicas,writeReplica,clearReplicaCache}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const c={provider:'google',token:'test-only'};
function drive(){
 const files=new Map();let serial=0;const original=global.fetch;
 global.fetch=async(input,init={})=>{
  const u=new URL(input),id=u.pathname.split('/').at(-1);
  if(init.method==='POST'){
   const chunks=init.body.split('\r\n\r\n'),meta=JSON.parse(chunks[1].split('\r\n--')[0]),data=JSON.parse(chunks[2].split('\r\n--')[0]);
   files.set(String(++serial),{id:String(serial),name:meta.name,version:'1',data});return Response.json({id:String(serial)});
  }
  if(init.method==='PATCH'){assert.ok(files.has(id));const f=files.get(id);f.data=JSON.parse(init.body);f.version=String(+f.version+1);return Response.json({id})}
  if(u.searchParams.get('alt')==='media')return Response.json(files.get(id).data);
  return Response.json({files:[...files.values()].map(({data,...meta})=>meta)});
 };
 return {files,restore:()=>{global.fetch=original;clearReplicaCache()}};
}
test('two devices uploading concurrently never overwrite one another',async()=>{
 const mock=drive();try{
  const base=initialLibrary(),aa=structuredClone(base),bb=structuredClone(base);aa.sets[0].items[0].front='A';bb.sets[0].items[1].front='B';
  const a=stampChanges(base,aa),b=stampChanges(base,bb);
  await Promise.all([writeReplica(c,'device-a',a),writeReplica(c,'device-b',b)]);
  const remote=await readReplicas(c,'device-a');assert.equal(mock.files.size,2);
  assert.equal(remote.data.sets[0].items[0].front,'A');assert.equal(remote.data.sets[0].items[1].front,'B');
  await writeReplica(c,'device-a',remote.data,remote.ownId);assert.equal(mock.files.size,2);
  assert.equal([...mock.files.values()].find(f=>f.name.includes('device-b')).data.sets[0].items[1].front,'B');
 }finally{mock.restore()}
});
test('duplicate replica creation after ambiguous network failure loses no data',async()=>{
 const mock=drive();try{
  const base=initialLibrary();await writeReplica(c,'same-device',base);await writeReplica(c,'same-device',base);
  const remote=await readReplicas(c,'same-device');assert.ok(remote.ownId);assert.equal(remote.data.sets[0].items.length,base.sets[0].items.length);
 }finally{mock.restore()}
});
test('legacy cloud file is read but never selected for writing',async()=>{
 const mock=drive();try{
  mock.files.set('legacy',{id:'legacy',name:'open-learning.json',version:'1',data:initialLibrary()});
  const remote=await readReplicas(c,'new-device');assert.equal(remote.ownId,undefined);assert.ok(remote.data);
  await writeReplica(c,'new-device',remote.data,remote.ownId);assert.equal(mock.files.size,2);
 }finally{mock.restore()}
});
test('changed file versions invalidate cached content',async()=>{
 const mock=drive();try{
  await writeReplica(c,'device',initialLibrary());const first=await readReplicas(c,'device');
  const updated=structuredClone(first.data);updated.sets[0].items[0].front='new';
  const f=mock.files.get(first.ownId);f.version='2';f.data=stampChanges(first.data,updated);
  const second=await readReplicas(c,'device');assert.equal(second.data.sets[0].items[0].front,'new');
 }finally{mock.restore()}
});
test('corrupt remote document stops the sync instead of replacing it',async()=>{
 const mock=drive();try{
  mock.files.set('bad',{id:'bad',name:'open-learning.json',version:'1',data:{schema:999}});
  await assert.rejects(readReplicas(c,'device'),/Ungültiger/);assert.equal(mock.files.size,1);
 }finally{mock.restore()}
});
test('pagination reads every device and HTTP failures propagate',async()=>{
 const original=global.fetch;let requests=0;
 try{
  global.fetch=async(url)=>{requests++;const u=new URL(url);if(u.searchParams.get('alt')==='media')return Response.json(initialLibrary());return Response.json(u.searchParams.has('pageToken')?{files:[{id:'second',name:'open-learning.json',version:'1'}]}:{files:[],nextPageToken:'next'})};
  assert.ok((await readReplicas(c,'device')).data);assert.equal(requests,3);
  global.fetch=async()=>new Response('',{status:429});await assert.rejects(readReplicas(c,'device'),/429/);
 }finally{global.fetch=original;clearReplicaCache()}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialLibrary,mergeLibraries} from './model.ts';
const bundled=await build({entryPoints:[decodeURIComponent(new URL('./use-auto-sync.ts',import.meta.url).pathname)],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-adapters',setup(b){
 b.onResolve({filter:/^(react|\.\/local|\.\/google-session|\.\/microsoft-session|\.\/replica-cloud)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='react'?`export const useState=v=>{const f=globalThis.fixture,i=f.states.length;f.states.push(v);return [v,n=>f.states[i]=n]};export const useRef=v=>({current:v});export const useEffect=f=>globalThis.fixture.effects.push(f);`:a.path==='./local'?`export const loadLocal=async()=>globalThis.fixture.disk;export const saveLocal=async d=>{const f=globalThis.fixture;f.disk=f.merge(f.disk,d);return f.disk};`:a.path==='./microsoft-session'?`export const microsoftAccessToken=async()=>globalThis.fixture.msAuthError?Promise.reject(Error('Auth missing')):'microsoft-test';`:a.path==='./google-session'?`export const googleAccessToken=async()=>'test';export const hasGoogleSession=()=>true;`:`export class CloudError extends Error{};export const clearReplicaCache=()=>{};export const readReplicas=async()=>{const f=globalThis.fixture;if(f.fail)throw Error('Network down');return {data:f.remote,ownId:'own'}};export const writeReplica=async(c,id,data)=>{const f=globalThis.fixture;f.writes.push(data);if(f.hold)await f.hold;f.remote=data};`}));
}}]});
const {useAutoSync}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<400;i++){if(fn())return;await wait(10)}throw Error('condition not reached')}
function start(connection={provider:'google',token:'test'}){
 const original={navigator:global.navigator,window:global.window,document:global.document,BroadcastChannel:global.BroadcastChannel};
 Object.defineProperty(global,'navigator',{configurable:true,value:{onLine:true}});global.window=new EventTarget();global.document=Object.assign(new EventTarget(),{visibilityState:'visible'});global.BroadcastChannel=undefined;
 const f=global.fixture={disk:initialLibrary(),remote:null,merge:mergeLibraries,states:[],effects:[],writes:[]};
 const api=useAutoSync(connection),cleanups=f.effects.map(e=>e());
 return {f,api,stop:()=>{cleanups.forEach(c=>c?.());Object.defineProperty(global,'navigator',{configurable:true,value:original.navigator});global.window=original.window;global.document=original.document;global.BroadcastChannel=original.BroadcastChannel;delete global.fixture}};
}
test('startup auto-syncs and concurrent requests share one upload',async()=>{
 const {f,api,stop}=start();try{await until(()=>f.writes.length===1);await api.sync();assert.equal(f.writes.length,1);assert.match(f.states[1],/Synchronisiert/)}finally{stop()}
});
test('offline edits persist and online event uploads them without manual action',async()=>{
 const {f,api,stop}=start();try{
  await until(()=>f.writes.length===1);navigator.onLine=false;
  api.modify(d=>({...d,subjects:d.subjects.map(s=>({...s,name:'Offline edit'}))}));await wait(20);await api.sync();
  assert.equal(f.disk.subjects[0].name,'Offline edit');assert.equal(f.writes.length,1);assert.match(f.states[1],/Offline/);
  navigator.onLine=true;window.dispatchEvent(new Event('online'));await until(()=>f.writes.length===2);assert.equal(f.remote.subjects[0].name,'Offline edit');
 }finally{stop()}
});
test('new input during upload is preserved and causes follow-up upload',async()=>{
 const {f,api,stop}=start();try{
  await until(()=>f.writes.length===1);let release;f.hold=new Promise(r=>release=r);
  api.modify(d=>({...d,subjects:d.subjects.map(s=>({...s,name:'First'}))}));const active=api.sync();await until(()=>f.writes.length===2);
  api.modify(d=>({...d,subjects:d.subjects.map(s=>({...s,name:'Second'}))}));release();f.hold=null;await active;
  await until(()=>f.writes.length===3);assert.equal(f.remote.subjects[0].name,'Second');assert.equal(f.disk.subjects[0].name,'Second');
 }finally{stop()}
});
test('network error retains edits, reports retry and recovers',async()=>{
 const {f,api,stop}=start();try{
  await until(()=>f.writes.length===1);f.fail=true;api.modify(d=>({...d,subjects:d.subjects.map(s=>({...s,name:'Pending'}))}));await api.sync();
  assert.match(f.states[1],/Neuversuch/);assert.equal(f.disk.subjects[0].name,'Pending');f.fail=false;
  window.dispatchEvent(new Event('online'));await until(()=>f.writes.length===2);assert.equal(f.remote.subjects[0].name,'Pending');
 }finally{stop()}
});

test('Microsoft uses the same automatic merge and upload path',async()=>{
 const {f,api,stop}=start({provider:'microsoft',token:'',accountId:'account',siteId:'site'});try{
  await until(()=>f.writes.length===1);api.modify(d=>({...d,subjects:d.subjects.map(s=>({...s,name:'SharePoint edit'}))}));await api.sync();
  await until(()=>f.writes.length===2);assert.equal(f.remote.subjects[0].name,'SharePoint edit');assert.match(f.states[1],/Synchronisiert/);
 }finally{stop()}
});

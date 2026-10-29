import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {initialLibrary,stampChanges} from './model.ts';
const compiled=await build({entryPoints:[fileURLToPath(new URL('./microsoft-graph.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {readMicrosoftReplicas,writeMicrosoftReplica,clearMicrosoftCache,sharePointAddress,graphRequest}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
function mockDrive(){const original=global.fetch,files=new Map(),calls=[];let serial=0;
 global.fetch=async(url,init={})=>{calls.push({url:String(url),init});const path=new URL(url).pathname;
  if(path.endsWith('/special/approot'))return Response.json({id:'app-folder'});
  if(path.endsWith('/children'))return Response.json({value:[...files.values()].map(({data,...meta})=>meta)});
  if(init.method==='PUT'){let file;
   if(path.includes('app-folder:/')){const name=decodeURIComponent(path.split('app-folder:/')[1].split(':/content')[0]);file=[...files.values()].find(f=>f.name===name);if(!file){file={id:'file-'+(++serial),name,eTag:'0'};files.set(file.id,file)}}
   else file=files.get(decodeURIComponent(path.split('/items/')[1].split('/')[0]));
   file.data=JSON.parse(init.body);file.eTag=String(Number(file.eTag)+1);return Response.json({id:file.id,eTag:file.eTag});
  }
  if(path.endsWith('/content')){const id=decodeURIComponent(path.split('/items/')[1].split('/')[0]);return Response.json(files.get(id).data)}
  throw Error('Unexpected Graph request '+path);
 };
 return {files,calls,stop(){global.fetch=original;clearMicrosoftCache()}};
}
const connection={provider:'microsoft',token:'test-only',accountId:'account-one',siteId:'tenant.sharepoint.com,site,web'};
test('SharePoint replicas merge simultaneous device edits without overwriting another device',async()=>{
 const mock=mockDrive();try{const original=initialLibrary(),a=structuredClone(original),b=structuredClone(original);a.sets[0].items[0].front='device a';b.sets[0].items[1].front='device b';
  await Promise.all([writeMicrosoftReplica(connection,'a',stampChanges(original,a)),writeMicrosoftReplica(connection,'b',stampChanges(original,b))]);
  const read=await readMicrosoftReplicas(connection,'a');assert.equal(read.data.sets[0].items[0].front,'device a');assert.equal(read.data.sets[0].items[1].front,'device b');assert.equal(mock.files.size,2);
  await writeMicrosoftReplica(connection,'a',read.data,read.ownId);assert.equal(mock.files.size,2);assert.ok(mock.calls.every(call=>call.url.startsWith('https://graph.microsoft.com/v1.0/sites/')));
 }finally{mock.stop()}
});
test('accounts using the same SharePoint app folder cannot merge one another’s learning data',async()=>{
 const mock=mockDrive();try{await writeMicrosoftReplica(connection,'a',initialLibrary());const other={...connection,accountId:'account-two'};
  assert.equal((await readMicrosoftReplicas(other,'b')).data,null);await writeMicrosoftReplica(other,'b',initialLibrary());assert.equal(mock.files.size,2);assert.ok((await readMicrosoftReplicas(connection,'a')).ownId);
 }finally{mock.stop()}
});
test('corrupt Microsoft data fail closed rather than allowing an upload',async()=>{
 const mock=mockDrive();try{await writeMicrosoftReplica(connection,'a',initialLibrary());[...mock.files.values()][0].data={broken:true};await assert.rejects(readMicrosoftReplicas(connection,'a'),/Ungültiger/)}finally{mock.stop()}
});
test('paging cannot send Microsoft tokens to an untrusted nextLink',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return Response.json(calls===1?{id:'app'}:{value:[],'@odata.nextLink':'https://evil.example/steal'})};
 try{await assert.rejects(readMicrosoftReplicas(connection,'a'),/Ungültiges Microsoft-Ziel/);assert.equal(calls,2)}finally{global.fetch=original;clearMicrosoftCache()}
});
test('SharePoint accepts website addresses but rejects unsafe origins and file links',()=>{
 assert.equal(sharePointAddress('https://school.sharepoint.com/sites/lernen').resource,'sites/school.sharepoint.com:/sites/lernen');
 for(const url of ['http://school.sharepoint.com/sites/lernen','https://school.sharepoint.com.evil.test/sites/lernen','https://user:pass@school.sharepoint.com/sites/lernen','https://school.sharepoint.com/sites/lernen/file.docx'])assert.throws(()=>sharePointAddress(url));
});

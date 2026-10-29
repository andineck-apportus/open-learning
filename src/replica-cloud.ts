import {readMicrosoftReplicas,writeMicrosoftReplica,clearMicrosoftCache} from './microsoft-graph';
import {CloudError} from './cloud-errors';
export {CloudError} from './cloud-errors';
import {mergeLibraries,validLibrary,type Library} from './model';
import type {Connection} from './cloud';
const root='https://www.googleapis.com/drive/v3/files';
const prefix='open-learning-replica-v2-';
const cache=new Map<string,{version:string;data:Library}>();

async function request(url:string,token:string,init:RequestInit={}) {
 const r=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(25000),headers:{Authorization:'Bearer '+token,...init.headers}});
 if(!r.ok)throw new CloudError(r.status);return r;
}
export function clearReplicaCache(){cache.clear();clearMicrosoftCache()}
export async function readReplicas(c:Connection,device:string):Promise<{data:Library|null;ownId?:string}> {
 if(c.provider==='microsoft')return readMicrosoftReplicas(c,device);
 const files:{id:string;name:string;version:string}[]=[];let page='';
 do {
  const q=new URLSearchParams({spaces:'appDataFolder',pageSize:'1000',fields:'files(id,name,version),nextPageToken,incompleteSearch',q:"trashed = false and (name = 'open-learning.json' or name contains 'open-learning-replica-v2-')",...(page?{pageToken:page}:{})});
  const body=await (await request(root+'?'+q,c.token)).json();
  if(body.incompleteSearch)throw Error('Cloud-Liste unvollständig; es wurde nichts überschrieben.');
  files.push(...body.files);page=body.nextPageToken||'';
 }while(page);
 let data:Library|null=null;let ownId:string|undefined;
 for(const f of files.sort((a,b)=>a.id.localeCompare(b.id))){
  if(f.name!=='open-learning.json'&&!/^open-learning-replica-v2-[\w-]+\.json$/.test(f.name))continue;
  let entry=cache.get(f.id);
  if(!entry||entry.version!==f.version){
   const value=await (await request(root+'/'+encodeURIComponent(f.id)+'?alt=media',c.token)).json();
   if(!validLibrary(value))throw Error('Ungültiger Cloud-Datenstand; automatische Synchronisation angehalten.');
   entry={version:f.version,data:value};cache.set(f.id,entry);
  }
  data=data?mergeLibraries(data,entry.data):entry.data;
  if(f.name===prefix+device+'.json')ownId=f.id;
 }
 return {data,ownId};
}
// Only this browser's replica is written. Other devices' files are never overwritten.
// The caller holds a cross-tab Web Lock throughout read/merge/write.
export async function writeReplica(c:Connection,device:string,data:Library,ownId?:string):Promise<void> {
 if(c.provider==='microsoft')return writeMicrosoftReplica(c,device,data,ownId);
 const body=JSON.stringify(data);
 if(ownId){
  await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(ownId)+'?uploadType=media',c.token,{method:'PATCH',headers:{'Content-Type':'application/json'},body});
  cache.delete(ownId);return;
 }
 const boundary='ol'+crypto.randomUUID().replace(/-/g,'');
 const content='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:prefix+device+'.json',parents:['appDataFolder']})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+boundary+'--';
 await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',c.token,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:content});
 // A timeout after a successful POST is safe: next read discovers all copies and merges them.
}

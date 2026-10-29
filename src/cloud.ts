import{Library,validLibrary}from './model';import type{Provider}from './oauth';
export type Connection={provider:Provider;token:string;remoteId?:string;etag?:string;accountId?:string;siteId?:string;clientId?:string};
export class ConflictError extends Error{constructor(){super('Cloud-Datei wurde auf einem anderen Gerät geändert. Bitte erneut synchronisieren.')}}
async function request(url:string,token:string,init:RequestInit={}){const res=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...init.headers}});if(res.status===412||res.status===409)throw new ConflictError();if(!res.ok&&res.status!==404)throw Error('Cloud '+res.status+': '+(await res.text()).slice(0,250));return res}
const google='https://www.googleapis.com/drive/v3/files';
const graph='https://graph.microsoft.com/v1.0/me/drive';
export async function readCloud(c:Connection):Promise<{data:Library|null;connection:Connection}>{
 if(c.provider==='google'){
  let id=c.remoteId;
  if(!id){const q=new URLSearchParams({spaces:'appDataFolder',fields:'files(id,name),nextPageToken',q:"name = 'open-learning.json' and trashed = false"});const r=await request(google+'?'+q,c.token);const x=await r.json();id=x.files?.[0]?.id}
  if(!id)return{data:null,connection:c};
  const r=await request(google+'/'+encodeURIComponent(id)+'?alt=media',c.token);
  const value=await r.json();if(!validLibrary(value))throw Error('Ungültiges Cloud-Dateiformat');
  const meta=await (await request(google+'/'+encodeURIComponent(id)+'?fields=id,version',c.token)).json();
  return{data:value,connection:{...c,remoteId:id,etag:String(meta.version)}}
 }
 const base=graph+'/special/approot:/open-learning.json:';
 const r=await request(base+'/content',c.token);
 if(r.status===404)return{data:null,connection:c};
 const value=await r.json();if(!validLibrary(value))throw Error('Ungültiges Cloud-Dateiformat');
 const meta=await (await request(base+'?%24select=id,eTag',c.token)).json();
 return{data:value,connection:{...c,remoteId:meta.id,etag:meta.eTag}}
}
export async function writeCloud(c:Connection,data:Library):Promise<Connection>{
 const body=JSON.stringify(data);
 if(c.provider==='google'){
  if(!c.remoteId){
   const boundary='ol'+crypto.randomUUID().replace(/-/g,'');
   const content='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:'open-learning.json',parents:['appDataFolder']})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+boundary+'--';
   const r=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version',c.token,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:content});const d=await r.json();return{...c,remoteId:d.id,etag:String(d.version)}
  }
  // Drive supports ETag preconditions on media resources; preserve remote version and verify before writing.
  const meta=await (await request(google+'/'+encodeURIComponent(c.remoteId)+'?fields=version',c.token)).json();
  if(c.etag&&String(meta.version)!==c.etag)throw new ConflictError();
  const r=await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(c.remoteId)+'?uploadType=media&fields=id,version',c.token,{method:'PATCH',headers:{'Content-Type':'application/json'},body});
  const d=await r.json();return{...c,etag:String(d.version)}
 }
 const base=graph+'/special/approot:/open-learning.json:';
 const r=await request(base+'/content',c.token,{method:'PUT',headers:{'Content-Type':'application/json',...(c.etag?{'If-Match':c.etag}: {'If-None-Match':'*'})},body});
 const d=await r.json();return{...c,remoteId:d.id,etag:d.eTag}
}

import {type Library,mergeLibraries,validLibrary} from './model';
import {type Connection} from './cloud';
import {CloudError} from './cloud-errors';
export const GRAPH='https://graph.microsoft.com/v1.0';
const cache=new Map<string,{version:string;data:Library}>();
export const clearMicrosoftCache=()=>cache.clear();
export async function graphRequest(path:string,token:string,init:RequestInit={}){
 const url=new URL(path,GRAPH+'/');
 if(url.origin!=='https://graph.microsoft.com'||!url.pathname.startsWith('/v1.0/'))throw Error('Ungültiges Microsoft-Ziel');
 const response=await fetch(url.href,{...init,cache:'no-store',signal:AbortSignal.timeout(25000),headers:{...init.headers,Authorization:'Bearer '+token}});
 if(!response.ok)throw new CloudError(response.status);return response;
}
export function sharePointAddress(input:string){
 const url=new URL(input.trim());
 if(url.protocol!=='https:'||!/^([a-z0-9-]+)\.sharepoint\.com$/i.test(url.hostname)||url.username||url.password||url.port||url.search||url.hash)throw Error('Bitte die SharePoint-Website angeben, z. B. https://firma.sharepoint.com/sites/lernen.');
 const path=url.pathname.replace(/\/+$/,'');
 if(path&&!/^\/(sites|teams)\/[^/]+$/i.test(path))throw Error('Bitte die Website-Adresse verwenden, keinen Datei- oder Freigabelink.');
 return {url:url.origin+path,resource:'sites/'+url.hostname+(path?':'+path.split('/').map(encodeURIComponent).join('/'):'')};
}
export async function resolveSharePoint(input:string,token:string){const target=sharePointAddress(input);const data=await(await graphRequest(target.resource+'?$select=id',token)).json();if(typeof data.id!=='string'||!data.id)throw Error('SharePoint-Website nicht gefunden.');return data.id as string}
const drive=(c:Connection)=>c.siteId?'sites/'+encodeURIComponent(c.siteId)+'/drive':'me/drive';
async function prefix(c:Connection){if(!c.accountId)throw Error('Microsoft-Konto fehlt. Bitte erneut verbinden.');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.accountId));const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');return 'open-learning-'+id+'-replica-v2-'}
async function folder(c:Connection){const data=await(await graphRequest(drive(c)+'/special/approot?$select=id',c.token)).json();if(!data.id)throw Error('Microsoft-App-Ordner nicht verfügbar.');return String(data.id)}
export async function readMicrosoftReplicas(c:Connection,device:string):Promise<{data:Library|null;ownId?:string}>{
 const p=await prefix(c),base=drive(c),dir=await folder(c);let next=base+'/items/'+encodeURIComponent(dir)+'/children?$select=id,name,eTag&$top=200';
 const files:{id:string;name:string;eTag?:string}[]=[];
 do{const page=await(await graphRequest(next,c.token)).json();if(!Array.isArray(page.value))throw Error('Microsoft-Dateiliste unvollständig.');files.push(...page.value);next=page['@odata.nextLink']||''}while(next);
 let data:Library|null=null,ownId:string|undefined;
 for(const f of files.sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  if(typeof f.name!=='string'||!(f.name.startsWith(p)&&/^[\w.-]+\.json$/.test(f.name)||!c.siteId&&f.name==='open-learning.json'))continue;
  const key=(c.accountId||'')+'|'+(c.siteId||'onedrive')+'|'+f.id;let entry=cache.get(key);
  if(!entry||!f.eTag||entry.version!==f.eTag){const value=await(await graphRequest(base+'/items/'+encodeURIComponent(f.id)+'/content',c.token)).json();if(!validLibrary(value))throw Error('Ungültiger Microsoft-Datenstand; es wurde nichts überschrieben.');entry={version:f.eTag||'',data:value};cache.set(key,entry)}
  data=data?mergeLibraries(data,entry.data):entry.data;if(f.name===p+device+'.json')ownId=f.id;
 }
 return {data,ownId};
}
export async function writeMicrosoftReplica(c:Connection,device:string,data:Library,ownId?:string){
 if(!/^[\w-]+$/.test(device))throw Error('Ungültige Gerätekennung');
 const base=drive(c);const path=ownId?base+'/items/'+encodeURIComponent(ownId)+'/content':base+'/items/'+encodeURIComponent(await folder(c))+':/'+encodeURIComponent(await prefix(c)+device+'.json')+':/content';
 await graphRequest(path,c.token,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});clearMicrosoftCache();
}

import {type Library,initialLibrary,validLibrary,mergeLibraries,canonical} from './model';
const dbName='open-learning',store='state',key='library';
async function openDB(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore(store);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function loadLocal():Promise<Library>{
 const db=await openDB();try{return await new Promise((resolve,reject)=>{const t=db.transaction(store,'readonly');const r=t.objectStore(store).get(key);r.onsuccess=()=>{if(r.result===undefined)resolve(initialLibrary());else if(validLibrary(r.result))resolve(r.result);else reject(Error('Lokale Daten sind beschädigt. Bitte ein Backup wiederherstellen.'))};r.onerror=()=>reject(r.error)})}finally{db.close()}
}
// IndexedDB read+merge+write is one transaction, so two tabs cannot clobber one another.
export async function saveLocal(data:Library):Promise<Library>{
 const db=await openDB();try{return await new Promise((resolve,reject)=>{
  const t=db.transaction(store,'readwrite'),s=t.objectStore(store),r=s.get(key);let merged=data;
  r.onsuccess=()=>{if(r.result!==undefined&&!validLibrary(r.result)){t.abort();return}merged=r.result?mergeLibraries(r.result,data):data;if(canonical(r.result)!==canonical(merged))s.put(merged,key)};
  t.oncomplete=()=>resolve(merged);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Lokale Daten konnten nicht sicher gespeichert werden.'));
 })}finally{db.close()}
}

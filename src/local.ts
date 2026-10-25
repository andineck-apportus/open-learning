import{Library,initialLibrary,validLibrary}from './model';
const dbName='open-learning',store='state',key='library';
async function openDB(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore(store);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function loadLocal():Promise<Library>{try{const db=await openDB();return await new Promise((resolve,reject)=>{const t=db.transaction(store,'readonly');const r=t.objectStore(store).get(key);r.onsuccess=()=>{db.close();resolve(validLibrary(r.result)?r.result:initialLibrary())};r.onerror=()=>reject(r.error)})}catch{return initialLibrary()}}
export async function saveLocal(data:Library){const db=await openDB();await new Promise<void>((resolve,reject)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).put(data,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error)});db.close()}

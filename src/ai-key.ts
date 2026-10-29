/** One-time migration: a legacy key may live in memory, but is removed from browser storage immediately. */
export function takeLegacyAiKey(local:Pick<Storage,'getItem'|'removeItem'>=localStorage,session:Pick<Storage,'getItem'|'removeItem'>=sessionStorage){
 let key='';try{key=local.getItem('ol-api-remembered')||session.getItem('ol-api-session')||''}catch{}
 for(const [store,name] of [[local,'ol-api-remembered'],[local,'ol-api-persist'],[session,'ol-api-session']] as const){try{store.removeItem(name)}catch{}}
 return key;
}
export function extractionEndpoint(value:string){
 const url=new URL(value);const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw Error('Der KI-Dienst muss HTTPS verwenden. HTTP ist nur für lokale Entwicklung erlaubt.');
 return url.href.replace(/\/+$/,'')+'/api/extract';
}

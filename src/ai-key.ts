const SESSION_KEY = 'ol-api-session';

export function saveAiKey(key: string, session = sessionStorage) {
 try {
  if (key) session.setItem(SESSION_KEY, key);
  else session.removeItem(SESSION_KEY);
 } catch {
  // The key can still be used until reload if session storage is blocked.
 }
}

export function loadAiKey(local = localStorage, session = sessionStorage) {
 let key = '';
 try {
  key = session.getItem(SESSION_KEY) || local.getItem('ol-api-remembered') || '';
 } catch {}
 if (key) saveAiKey(key, session);

 for (const name of ['ol-api-remembered', 'ol-api-persist']) {
  try { local.removeItem(name); } catch {}
 }
 return key;
}

export function extractionEndpoint(value:string){
 const url=new URL(value);const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw Error('Der KI-Dienst muss HTTPS verwenden. HTTP ist nur für lokale Entwicklung erlaubt.');
 return url.href.replace(/\/+$/,'')+'/api/extract';
}

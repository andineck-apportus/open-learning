const endpoint=(import.meta.env.VITE_AI_WORKER_URL||'https://open-learning-ai.andineck.workers.dev').replace(/\/+$/,'');
const SESSION='ol-google-device-session-v1',PENDING='ol-google-login-verifier';
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
type DeviceSession={session:string;expiresAt:number};
function saved():DeviceSession|null {
 try {const v=JSON.parse(localStorage.getItem(SESSION)||'null');if(v&&typeof v.session==='string'&&v.expiresAt>Date.now())return v;}catch{}
 localStorage.removeItem(SESSION);return null;
}
export const hasGoogleSession=()=>!!saved();
async function call(path:string,body?:unknown,session?:string) {
 const response=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session}:{})},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(25000)});
 const data=await response.json();
 if(!response.ok){if(response.status===401&&session)localStorage.removeItem(SESSION);throw Error(data.error||'Google-Verbindung fehlgeschlagen');}
 return data;
}
export async function beginGoogleLogin() {
 const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 sessionStorage.setItem(PENDING,verifier);
 const data=await call('/auth/google/start',{challenge});
 const target=new URL(data.url);if(target.origin!=='https://accounts.google.com')throw Error('Ungültiges Google-Anmeldeziel');
 location.assign(target.href);
}
export async function finishGoogleLogin():Promise<boolean> {
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(!fragment.has('ol_ticket')&&!fragment.has('ol_error'))return false;
 history.replaceState({},'',location.pathname+location.search);
 if(fragment.has('ol_error')){sessionStorage.removeItem(PENDING);throw Error(fragment.get('ol_error')!);}
 const verifier=sessionStorage.getItem(PENDING);
 if(!verifier)throw Error('Anmeldung gehört zu einer anderen Browsersitzung. Bitte erneut verbinden.');
 try {
  const data=await call('/auth/session/exchange',{ticket:fragment.get('ol_ticket'),verifier});
  const previous=saved();
  localStorage.setItem(SESSION,JSON.stringify(data));localStorage.setItem('ol-last-cloud-provider','google');
  sessionStorage.removeItem('ol-google-session');
  // A new login on this device supersedes its prior session.
  if(previous)void call('/auth/logout',{},previous.session).catch(()=>{});
  return true;
 }finally{sessionStorage.removeItem(PENDING);}
}
export async function googleAccessToken():Promise<string> {
 const session=saved();if(!session)throw Error('Bitte Google Drive verbinden.');
 const data=await call('/auth/token',{},session.session);
 return data.accessToken;
}
export async function disconnectGoogle() {
 const session=saved();
 // Only clear locally after the server has confirmed revocation; allow retry offline.
 if(session)await call('/auth/logout',{},session.session);
 localStorage.removeItem(SESSION);sessionStorage.removeItem('ol-google-session');
}

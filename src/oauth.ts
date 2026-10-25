export type Provider='google'|'microsoft';
export type OAuthConfig={googleClientId:string;microsoftClientId:string};
const bytes=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function challenge(verifier:string){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))}
const redirect=()=>location.origin+location.pathname;
export async function startLogin(provider:Provider,config:OAuthConfig){
 const clientId=provider==='google'?config.googleClientId:config.microsoftClientId;
 if(!clientId)throw Error('Client-ID für '+provider+' fehlt.');
 const state=base64url(bytes(24)),verifier=base64url(bytes(32));
 sessionStorage.setItem('ol-oauth',JSON.stringify({provider,state,verifier,redirect:redirect()}));
 const scope=provider==='google'?'https://www.googleapis.com/auth/drive.appdata':'offline_access Files.ReadWrite.AppFolder User.Read';
 const base=provider==='google'?'https://accounts.google.com/o/oauth2/v2/auth':'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
 const q=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirect(),scope,state,code_challenge_method:'S256',code_challenge:await challenge(verifier)});
 if(provider==='google')q.set('access_type','online');
 location.assign(base+'?'+q);
}
export async function finishLogin(config:OAuthConfig):Promise<{provider:Provider;accessToken:string}|null>{
 const query=new URLSearchParams(location.search);if(!query.has('code')&&!query.has('error'))return null;
 const saved=sessionStorage.getItem('ol-oauth');if(!saved)throw Error('OAuth-Sitzung fehlt.');const p=JSON.parse(saved)as{provider:Provider;state:string;verifier:string;redirect:string};
 if(query.get('state')!==p.state)throw Error('OAuth state stimmt nicht überein.');
 if(query.has('error'))throw Error(query.get('error_description')||query.get('error')||'Anmeldung abgebrochen');
 const clientId=p.provider==='google'?config.googleClientId:config.microsoftClientId;
 const endpoint=p.provider==='google'?'https://oauth2.googleapis.com/token':'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
 const body=new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code:query.get('code')!,redirect_uri:p.redirect,code_verifier:p.verifier});
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const data=await res.json();
 if(!res.ok||!data.access_token)throw Error(data.error_description||data.error||'Token-Austausch fehlgeschlagen');
 history.replaceState({},'',location.pathname+location.hash);sessionStorage.removeItem('ol-oauth');
 return{provider:p.provider,accessToken:data.access_token}
}

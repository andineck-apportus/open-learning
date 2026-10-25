export type Provider='google'|'microsoft';
export type OAuthConfig={googleClientId:string;microsoftClientId:string};
const bytes=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function challenge(verifier:string){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))}
const redirect=()=>location.origin+location.pathname;
export async function startLogin(provider:Provider,config:OAuthConfig){
 if(provider==='google')throw Error('Google nutzt den Browser-Token-Dialog.');
 const clientId=config.microsoftClientId;
 if(!clientId)throw Error('Client-ID für '+provider+' fehlt.');
 const state=base64url(bytes(24)),verifier=base64url(bytes(32));
 sessionStorage.setItem('ol-oauth',JSON.stringify({provider,state,verifier,redirect:redirect()}));
 const scope='offline_access Files.ReadWrite.AppFolder User.Read';
 const base='https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
 const q=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirect(),scope,state,code_challenge_method:'S256',code_challenge:await challenge(verifier)});
 location.assign(base+'?'+q);
}
export async function finishLogin(config:OAuthConfig):Promise<{provider:Provider;accessToken:string}|null>{
 const query=new URLSearchParams(location.search);if(!query.has('code')&&!query.has('error'))return null;
 const saved=sessionStorage.getItem('ol-oauth');
 // Ignore and clean up redirect parameters left behind by the retired Google
 // authorization-code flow. Google now uses a popup token flow instead.
 if(saved){
   let previous: {provider?:Provider}|null=null;
   try{previous=JSON.parse(saved)}catch{}
   if(previous?.provider==='google'){
     const clean=new URL(location.href);
     for(const name of ['code','state','scope','authuser','prompt','error','error_description'])clean.searchParams.delete(name);
     history.replaceState({},'',clean.pathname+clean.search+clean.hash);
     sessionStorage.removeItem('ol-oauth');
     return null;
   }
 }
 if(!saved)throw Error('OAuth-Sitzung fehlt.');
 const p=JSON.parse(saved)as{provider:Provider;state:string;verifier:string;redirect:string};
 if(query.get('state')!==p.state)throw Error('OAuth state stimmt nicht überein.');
 if(query.has('error'))throw Error(query.get('error_description')||query.get('error')||'Anmeldung abgebrochen');
 if(p.provider!=='microsoft')throw Error('Ungültiger OAuth-Rücksprung');
 const clientId=config.microsoftClientId;
 const endpoint='https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
 const body=new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code:query.get('code')!,redirect_uri:p.redirect,code_verifier:p.verifier});
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const data=await res.json();
 if(!res.ok||!data.access_token)throw Error(data.error_description||data.error||'Token-Austausch fehlgeschlagen');
 history.replaceState({},'',location.pathname+location.hash);sessionStorage.removeItem('ol-oauth');
 return{provider:p.provider,accessToken:data.access_token}
}

/**
 * Google Identity Services browser-side token model. Does not exchange a web
 * authorization code or need a client_secret. Access token stays in memory.
 * The GIS script is loaded in index.html before a user clicks the button.
 */
type GoogleTokenResponse = {access_token?:string;expires_in?:number;scope?:string;error?:string;error_description?:string};
type GoogleIdentityWindow = Window & {google?: {accounts:{oauth2:{
  initTokenClient:(opts:{client_id:string;scope:string;callback:(r:GoogleTokenResponse)=>void;error_callback?:(e:{type?:string})=>void})=>{requestAccessToken:(opts?:{prompt?:string})=>void}
}}}};
export function connectGoogleDrive(config:OAuthConfig):Promise<{provider:'google';accessToken:string;expiresIn:number}> {
  if(!config.googleClientId)throw Error('Google Client-ID fehlt.');
  const gis=(window as GoogleIdentityWindow).google?.accounts?.oauth2;
  if(!gis)throw Error('Google-Anmeldebibliothek ist noch nicht geladen. Bitte Seite neu laden und nochmals versuchen.');
  return new Promise((resolve,reject)=>{
    const client=gis.initTokenClient({
      client_id:config.googleClientId,
      scope:'https://www.googleapis.com/auth/drive.appdata',
      callback:(response)=>{
        if(response.error||!response.access_token){reject(Error(response.error_description||response.error||'Google hat kein Zugriffstoken zurückgegeben'));return}
        const granted=(response.scope||'').split(' ');
        if(!granted.includes('https://www.googleapis.com/auth/drive.appdata')){reject(Error('Drive-Berechtigung wurde nicht erteilt'));return}
        resolve({provider:'google',accessToken:response.access_token,expiresIn:response.expires_in||3600});
      },
      error_callback:e=>reject(Error('Google-Anmeldedialog: '+(e.type||'unbekannter Fehler')))
    });
    // Keep this within the originating click handler to avoid popup blockers.
    client.requestAccessToken();
  });
}

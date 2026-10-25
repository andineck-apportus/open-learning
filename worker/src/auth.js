const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async text => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
const now = () => Math.floor(Date.now() / 1000);
const valid = text => typeof text === 'string' && /^[A-Za-z0-9_-]{43}$/.test(text);
async function key(env) {
 const raw = unb64(env.TOKEN_ENCRYPTION_KEY);
 if(raw.length !== 32) throw Error('Invalid encryption key');
 return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function encrypt(text, env) {
 const iv = crypto.getRandomValues(new Uint8Array(12));
 const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('open-learning-refresh-v1')}, await key(env), encoder.encode(text));
 return b64(iv)+'.'+b64(new Uint8Array(cipher));
}
export async function decrypt(text, env) {
 const [iv,cipher] = text.split('.');
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:encoder.encode('open-learning-refresh-v1')},await key(env),unb64(cipher)));
}
const headers = {'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function json(data,status=200,origin='') {return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Vary':'Origin'}})}
function redirect(env, params) {return new Response(null,{status:303,headers:{...headers,Location:env.APP_URL+'#'+new URLSearchParams(params)}})}
async function body(request) {
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('JSON required');
 const raw=await request.text();if(raw.length>2048)throw Error('Body too large');return JSON.parse(raw);
}
async function googleToken(env,params) {
 const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,...params}),signal:AbortSignal.timeout(15000)});
 const data=await res.json();return {ok:res.ok,data};
}
export async function cleanup(env) {
 await env.AUTH_DB.batch(['oauth_states','oauth_tickets','oauth_sessions'].map(table=>env.AUTH_DB.prepare(`DELETE FROM ${table} WHERE expires_at <= ?`).bind(now())));
}
export async function handleAuth(request,env) {
 const url=new URL(request.url), path=url.pathname, origin=request.headers.get('Origin')||'';
 const appOrigin=new URL(env.APP_URL).origin;
 if(path==='/auth/health')return json({ready:!!(env.AUTH_DB&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.TOKEN_ENCRYPTION_KEY),version:1},200,origin===appOrigin?origin:'');
 if(path!=='/auth/google/callback') {
  if(origin!==appOrigin)return json({error:'Origin not allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}});
  if(request.method!=='POST')return json({error:'Method not allowed'},405,origin);
 }
 if(!env.AUTH_DB||!env.GOOGLE_CLIENT_SECRET||!env.TOKEN_ENCRYPTION_KEY)return json({error:'Die dauerhafte Google-Anmeldung ist noch nicht vollständig eingerichtet.'},503,origin);
 try {
  if(path==='/auth/google/start') {
   const {challenge}=await body(request);
   if(!valid(challenge))return json({error:'Invalid challenge'},400,origin);
   const state=random(),verifier=random();
   await env.AUTH_DB.prepare('INSERT INTO oauth_states (id,challenge,verifier,expires_at) VALUES (?,?,?,?)').bind(await hash(state),challenge,verifier,now()+600).run();
   const params=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.GOOGLE_REDIRECT_URI,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:await hash(verifier),code_challenge_method:'S256'});
   return json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params},200,origin);
  }
  if(path==='/auth/google/callback') {
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const state=url.searchParams.get('state');
   if(!valid(state))return json({error:'Invalid OAuth state'},400);
   const pending=await env.AUTH_DB.prepare('DELETE FROM oauth_states WHERE id=? AND expires_at>? RETURNING *').bind(await hash(state),now()).first();
   if(!pending)return json({error:'Login expired or already used. Please restart from Open Learning.'},400);
   if(url.searchParams.has('error'))return redirect(env,{ol_error:'Google-Anmeldung abgebrochen'});
   const code=url.searchParams.get('code');
   if(!code||code.length>2048)return redirect(env,{ol_error:'Ungültiger Google-Rücksprung'});
   const {ok,data}=await googleToken(env,{grant_type:'authorization_code',code,redirect_uri:env.GOOGLE_REDIRECT_URI,code_verifier:pending.verifier});
   if(!ok||!data.refresh_token||!data.scope?.split(' ').includes(SCOPE))return redirect(env,{ol_error:'Google hat keinen dauerhaften Drive-Zugriff erteilt. Bitte erneut verbinden.'});
   const ticket=random();
   await env.AUTH_DB.prepare('INSERT INTO oauth_tickets (id,challenge,refresh_cipher,expires_at) VALUES (?,?,?,?)').bind(await hash(ticket),pending.challenge,await encrypt(data.refresh_token,env),now()+120).run();
   return redirect(env,{ol_ticket:ticket});
  }
  if(path==='/auth/session/exchange') {
   const {ticket,verifier}=await body(request);
   if(!valid(ticket)||!valid(verifier))return json({error:'Invalid exchange'},400,origin);
   const pending=await env.AUTH_DB.prepare('DELETE FROM oauth_tickets WHERE id=? AND challenge=? AND expires_at>? RETURNING *').bind(await hash(ticket),await hash(verifier),now()).first();
   if(!pending)return json({error:'Anmeldung abgelaufen oder gehört zu einem anderen Browser.'},401,origin);
   const session=random(),expiresAt=now()+180*86400;
   await env.AUTH_DB.prepare('INSERT INTO oauth_sessions (id,refresh_cipher,expires_at) VALUES (?,?,?)').bind(await hash(session),pending.refresh_cipher,expiresAt).run();
   return json({session,expiresAt:expiresAt*1000},200,origin);
  }
  const bearer=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!bearer)return json({error:'Bitte Google Drive erneut verbinden.'},401,origin);
  const id=await hash(bearer);
  if(path==='/auth/logout') {
   await env.AUTH_DB.prepare('DELETE FROM oauth_sessions WHERE id=?').bind(id).run();
   return json({ok:true},200,origin);
  }
  if(path==='/auth/token') {
   const session=await env.AUTH_DB.prepare('SELECT * FROM oauth_sessions WHERE id=? AND expires_at>?').bind(id,now()).first();
   if(!session)return json({error:'Sitzung abgelaufen. Bitte Google Drive erneut verbinden.'},401,origin);
   const {ok,data}=await googleToken(env,{grant_type:'refresh_token',refresh_token:await decrypt(session.refresh_cipher,env)});
   if(!ok) {
    if(data.error==='invalid_grant') {await env.AUTH_DB.prepare('DELETE FROM oauth_sessions WHERE id=?').bind(id).run();return json({error:'Google-Zugriff widerrufen oder abgelaufen. Bitte erneut verbinden.'},401,origin);}
    return json({error:'Google ist derzeit nicht erreichbar oder die Server-Konfiguration ist ungültig.'},502,origin);
   }
   if(data.refresh_token)await env.AUTH_DB.prepare('UPDATE oauth_sessions SET refresh_cipher=? WHERE id=?').bind(await encrypt(data.refresh_token,env),id).run();
   return json({accessToken:data.access_token,expiresIn:data.expires_in||3600},200,origin);
  }
  return json({error:'Not found'},404,origin);
 } catch {return path==='/auth/google/callback'?redirect(env,{ol_error:'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'}):json({error:'Authentifizierung fehlgeschlagen. Bitte erneut versuchen.'},500,origin)}
}

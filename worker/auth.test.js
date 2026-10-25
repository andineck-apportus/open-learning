import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleAuth,hash,encrypt,decrypt,cleanup} from './src/auth.js';
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const adapter={prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null},async run(){return db.prepare(sql).run(...args)}}}}},batch(q){return Promise.all(q.map(x=>x.run()))}};
const env={AUTH_DB:adapter,APP_URL:'https://example.com/app/',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test-only',GOOGLE_REDIRECT_URI:'https://worker.example/auth/google/callback',TOKEN_ENCRYPTION_KEY:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')};
const request=(path,body={},token,origin='https://example.com')=>new Request('https://worker.example'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
let revoked=false,refreshes=0;
globalThis.fetch=async (url,options)=>{
 assert.equal(url,'https://oauth2.googleapis.com/token');const p=options.body;
 if(p.get('grant_type')==='refresh_token'){refreshes++;assert.equal(p.get('refresh_token'),'secret-refresh');return Response.json(revoked?{error:'invalid_grant'}:{access_token:'fresh-access-'+refreshes,expires_in:3600},{status:revoked?400:200});}
 assert.ok(p.get('code_verifier'));return Response.json({access_token:'access',refresh_token:'secret-refresh',scope:'https://www.googleapis.com/auth/drive.appdata'});
};
test('OAuth replay protection, PKCE, encryption, refresh, isolation, logout and revocation',async()=>{
 const cipher=await encrypt('secret-refresh',env);assert.ok(!cipher.includes('secret-refresh'));assert.equal(await decrypt(cipher,env),'secret-refresh');
 await assert.rejects(()=>decrypt(cipher,{...env,TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,4).toString('base64url')}));
 assert.equal((await handleAuth(request('/auth/google/start',{},null,'https://evil.example'),env)).status,403);
 assert.equal((await handleAuth(request('/auth/google/start',{challenge:'bad'}),env)).status,400);
 const verifier=Buffer.alloc(32,5).toString('base64url');
 async function login(){
  const start=await (await handleAuth(request('/auth/google/start',{challenge:await hash(verifier)}),env)).json();
  const auth=new URL(start.url);assert.equal(auth.searchParams.get('access_type'),'offline');assert.equal(auth.searchParams.get('scope'),'https://www.googleapis.com/auth/drive.appdata');
  const callback=new Request(env.GOOGLE_REDIRECT_URI+'?state='+auth.searchParams.get('state')+'&code=example');
  const result=await handleAuth(callback,env);assert.equal(result.status,303);
  assert.equal((await handleAuth(callback,env)).status,400);
  const ticket=new URLSearchParams(new URL(result.headers.get('Location')).hash.slice(1)).get('ol_ticket');
  assert.equal((await handleAuth(request('/auth/session/exchange',{ticket,verifier:Buffer.alloc(32,6).toString('base64url')}),env)).status,401);
  const exchange=await handleAuth(request('/auth/session/exchange',{ticket,verifier}),env);assert.equal(exchange.status,200);
  assert.equal((await handleAuth(request('/auth/session/exchange',{ticket,verifier}),env)).status,401);
  return (await exchange.json()).session;
 }
 const a=await login(),b=await login();
 const row=db.prepare('SELECT * FROM oauth_sessions WHERE id=?').get(await hash(a));assert.ok(row);assert.notEqual(row.id,a);assert.ok(!row.refresh_cipher.includes('secret-refresh'));
 const first=await (await handleAuth(request('/auth/token',{},a),env)).json();
 const second=await (await handleAuth(request('/auth/token',{},a),env)).json();assert.notEqual(first.accessToken,second.accessToken);
 assert.equal((await handleAuth(request('/auth/logout',{},a),env)).status,200);
 assert.equal((await handleAuth(request('/auth/token',{},a),env)).status,401);
 assert.equal((await handleAuth(request('/auth/token',{},b),env)).status,200);
 revoked=true;assert.equal((await handleAuth(request('/auth/token',{},b),env)).status,401);
 assert.equal(db.prepare('SELECT count(*) AS n FROM oauth_sessions').get().n,0);
 db.prepare('INSERT INTO oauth_states VALUES (?,?,?,?)').run('expired','c','v',1);await cleanup(env);
 assert.equal(db.prepare('SELECT count(*) AS n FROM oauth_states').get().n,0);
});

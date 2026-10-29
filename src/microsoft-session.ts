import type {PublicClientApplication} from '@azure/msal-browser';
import {type Connection} from './cloud';
import {CloudError} from './cloud-errors';
import {resolveSharePoint,sharePointAddress} from './microsoft-graph';
const CLIENT='ol-microsoft-client-id',TARGET='ol-microsoft-target',LAST='ol-last-cloud-provider';
let pending:Promise<PublicClientApplication>|undefined,instanceId='';
export const microsoftClientId=()=>localStorage.getItem(CLIENT)||import.meta.env.VITE_MICROSOFT_CLIENT_ID||'';
export function saveMicrosoftClientId(id:string){if(id&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error('Bitte eine gültige Microsoft-Anwendungs-ID eintragen.');if(id)localStorage.setItem(CLIENT,id);else localStorage.removeItem(CLIENT)}
function target():string{const value=sessionStorage.getItem(TARGET)||'';return value?sharePointAddress(value).url:''}
const scopes=(site:string)=>['Files.ReadWrite.AppFolder',...(site?['Sites.Read.All']:[])];
async function client(id=microsoftClientId()){
 if(!id)throw Error('Die Microsoft-Anmeldung muss zuerst eingerichtet werden.');
 if(!pending||id!==instanceId){instanceId=id;pending=(async()=>{const {PublicClientApplication,BrowserCacheLocation}=await import('@azure/msal-browser');const app=new PublicClientApplication({auth:{clientId:id,authority:'https://login.microsoftonline.com/common',redirectUri:location.origin+location.pathname},cache:{cacheLocation:BrowserCacheLocation.SessionStorage}});await app.initialize();const result=await app.handleRedirectPromise({navigateToLoginRequestUrl:false});if(result?.account)app.setActiveAccount(result.account);return app})().catch(e=>{pending=undefined;throw e})}
 return pending;
}
export async function beginMicrosoftLogin(siteUrl=''){
 const site=siteUrl?sharePointAddress(siteUrl).url:'';
 const app=await client(),previous=localStorage.getItem(LAST);sessionStorage.setItem(TARGET,site);localStorage.setItem(LAST,'microsoft');
 try{await app.acquireTokenRedirect({scopes:scopes(site),prompt:'select_account'})}catch(e){if(previous)localStorage.setItem(LAST,previous);else localStorage.removeItem(LAST);throw e}
}
export async function finishMicrosoftLogin():Promise<Connection|null>{
 if(localStorage.getItem(LAST)!=='microsoft'||!microsoftClientId())return null;
 const app=await client(),accounts=app.getAllAccounts();const account=app.getActiveAccount()||(accounts.length===1?accounts[0]:null);if(!account)return null;app.setActiveAccount(account);
 const site=target();const result=await app.acquireTokenSilent({account,scopes:scopes(site)});
 return {provider:'microsoft',token:result.accessToken,accountId:account.homeAccountId,clientId:microsoftClientId(),...(site?{siteId:await resolveSharePoint(site,result.accessToken)}:{})};
}
export async function microsoftAccessToken(c:Connection){
 const app=await client(c.clientId);const account=app.getAllAccounts().find(a=>a.homeAccountId===c.accountId);if(!account)throw new CloudError(401);
 try{return (await app.acquireTokenSilent({account,scopes:scopes(c.siteId?'sharepoint':'')})).accessToken}catch(e){if(e instanceof (await import('@azure/msal-browser')).InteractionRequiredAuthError)throw new CloudError(401);throw Error('Microsoft ist vorübergehend nicht erreichbar.')}
}
export async function disconnectMicrosoft(){const app=await client();const account=app.getActiveAccount();await app.clearCache(account?{account}:undefined);app.setActiveAccount(null);sessionStorage.removeItem(TARGET);localStorage.removeItem(LAST)}

export type Provider='google'|'microsoft';
export type OAuthConfig={googleClientId:string;microsoftClientId:string};
// Microsoft sign-in and renewal use MSAL in microsoft-session.ts.

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

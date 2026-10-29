import React from 'react';
import {PracticeIcon} from './PracticeIcon';
export function syncAppearance(status:string,connected:boolean,syncing:boolean,error:string){
 if(error)return {state:'error',label:'Sync-Fehler'};
 if(syncing)return {state:'syncing',label:'Sync läuft'};
 if(connected&&/^Synchronisiert · /.test(status))return {state:'success',label:'Synchronisiert'};
 if(status.startsWith('Offline'))return {state:'offline',label:'Offline'};
 return {state:'local',label:connected?'Änderungen lokal':'Lokal'};
}
export function SyncBadge({status,connected,syncing,error}:{status:string;connected:boolean;syncing:boolean;error:string}){
 const view=syncAppearance(status,connected,syncing,error);
 return <span className={`sync-compact sync-${view.state}`} role="status" title={error||status}>{view.state==='success'?<PracticeIcon name="check"/>:<span className={syncing?'sync-indicator syncing':'sync-indicator'}/>}<span>{view.label}</span></span>;
}

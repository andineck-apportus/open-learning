import {useEffect,useRef,useState} from 'react';
import {canonical,mergeLibraries,stampChanges,type Library} from './model';
import {loadLocal,saveLocal} from './local';
import type {Connection} from './cloud';
import {googleAccessToken,hasGoogleSession} from './google-session';
import {readReplicas,writeReplica,clearReplicaCache,CloudError} from './replica-cloud';

export function useAutoSync(connection:Connection|null){
 const [lib,setLib]=useState<Library|null>(null),[status,setStatus]=useState('Lade lokale Daten …'),[syncing,setSyncing]=useState(false),[error,setError]=useState('');
 const current=useRef<Library|null>(null),conn=useRef(connection);conn.current=connection;
 const running=useRef<Promise<void>|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),failures=useRef(0),retryAt=useRef(0),alive=useRef(true),paused=useRef(false),generation=useRef(0);
 const channel=useRef<BroadcastChannel|null>(null),persistQueue=useRef<Promise<void>>(Promise.resolve()),lastSaved=useRef('');
 const device=useRef(''),localRetry=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 function apply(data:Library){if(!alive.current)return;const merged=current.current?mergeLibraries(current.current,data):data;if(canonical(merged)!==canonical(current.current)){current.current=merged;setLib(merged)}}
 function schedule(delay=1500){clearTimeout(timer.current);if(paused.current)return;timer.current=setTimeout(()=>void sync(),Math.max(delay,retryAt.current-Date.now()))}
 function persist(data:Library){
  const job=persistQueue.current.then(async()=>{const merged=await saveLocal(data);apply(merged);const saved=canonical(merged);if(lastSaved.current!==saved)channel.current?.postMessage('changed');lastSaved.current=saved});
  persistQueue.current=job.catch(e=>{if(alive.current){setError('Lokales Speichern fehlgeschlagen: '+String(e));setStatus('Speicherfehler – Seite bitte offen lassen');clearTimeout(localRetry.current);localRetry.current=setTimeout(()=>{if(current.current)void persist(current.current).then(()=>schedule()).catch(()=>{})},5000)}});return job;
 }
 function modify(fn:(d:Library)=>Library){
  if(!current.current)return;const next=stampChanges(current.current,fn(current.current));current.current=next;setLib(next);setStatus('Wird lokal gespeichert …');
  void persist(next).then(()=>{if(!running.current)setStatus(conn.current?'Änderungen warten auf Synchronisation':'Nur auf diesem Gerät gespeichert');schedule()}).catch(()=>{});
 }
 async function sync(){
  if(running.current)return running.current;
  if(paused.current||!current.current||!conn.current)return;
  if(!navigator.onLine){setStatus('Offline – Änderungen bleiben auf diesem Gerät');return;}
  if(conn.current.provider!=='google'){setStatus('Automatische Synchronisation benötigt Google Drive');return;}
  const epoch=generation.current;const valid=()=>alive.current&&!paused.current&&epoch===generation.current&&conn.current?.provider==='google';
  const run=async()=>{
   if(!valid())return;setSyncing(true);setStatus('Synchronisiert …');
   try{
    await persistQueue.current;
    const disk=await loadLocal();apply(disk);
    const token=await googleAccessToken();if(!valid())return;
    const c:Connection={provider:'google',token};
    const remote=await readReplicas(c,device.current);if(!valid())return;
    const merged=remote.data?mergeLibraries(current.current!,remote.data):current.current!;
    await persist(merged);if(!valid()||!hasGoogleSession())return;
    // Edits made while downloading/saving must be included; edits during upload remain pending.
    const payload=current.current!;
    if(!remote.data||canonical(payload)!==canonical(mergeLibraries(remote.data,remote.data))){
     await writeReplica(c,device.current,payload,remote.ownId);
    }
    if(!valid())return;
    failures.current=0;retryAt.current=0;setError('');
    if(canonical(current.current)===canonical(payload)){setStatus('Synchronisiert · '+new Date().toLocaleTimeString())}
    else{setStatus('Weitere Änderungen werden synchronisiert …');schedule(500)}
   }catch(e){
    if(!valid())return;
    const auth=e instanceof CloudError&&(e.status===401||e.status===403)||!hasGoogleSession();
    const wait=Math.min(60000,2000*2**Math.min(failures.current++,5))+Math.random()*1000;retryAt.current=Date.now()+wait;
    setStatus(auth?'Google-Zugriff erneuern – Änderungen bleiben lokal':'Synchronisation unterbrochen – automatischer Neuversuch');
    setError(e instanceof Error?e.message:String(e));
    if(!auth)schedule(wait);
   }finally{if(alive.current)setSyncing(false)}
  };
  running.current=(async()=>{if(navigator.locks)await navigator.locks.request('open-learning-cloud-v2',run);else await run()})().finally(()=>{running.current=null});
  return running.current;
 }
 async function pause(){paused.current=true;generation.current++;clearTimeout(timer.current);await running.current}
 useEffect(()=>{
  alive.current=true;
  // Without Web Locks use a separate replica per tab; never share an unprotected writer.
  if(navigator.locks){let id=localStorage.getItem('ol-sync-device-v2');if(!id){id=crypto.randomUUID();localStorage.setItem('ol-sync-device-v2',id)}device.current=id}else device.current=crypto.randomUUID();
  loadLocal().then(data=>{if(alive.current){apply(data);lastSaved.current=canonical(data);setStatus('Auf diesem Gerät gespeichert');schedule(0)}}).catch(e=>setError(String(e)));
  if(typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel('ol-library-v2');channel.current.onmessage=()=>{void loadLocal().then(data=>{apply(data);schedule()}).catch(e=>setError(String(e)))}}
  const wake=()=>{if(document.visibilityState==='visible'){retryAt.current=0;schedule(0)}};
  const offline=()=>setStatus('Offline – Änderungen bleiben auf diesem Gerät');
  const beforeUnload=(e:BeforeUnloadEvent)=>{if(current.current&&canonical(current.current)!==lastSaved.current){e.preventDefault()}};
  const interval=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()>=retryAt.current)schedule(0)},30000);
  window.addEventListener('online',wake);window.addEventListener('offline',offline);window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);window.addEventListener('beforeunload',beforeUnload);
  return()=>{alive.current=false;generation.current++;clearTimeout(timer.current);clearTimeout(localRetry.current);clearInterval(interval);channel.current?.close();window.removeEventListener('online',wake);window.removeEventListener('offline',offline);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake);window.removeEventListener('beforeunload',beforeUnload)};
 },[]);
 useEffect(()=>{generation.current++;paused.current=false;clearReplicaCache();failures.current=0;retryAt.current=0;if(connection)schedule(0);else{clearTimeout(timer.current);setStatus('Nur auf diesem Gerät gespeichert')}},[connection?.provider]);
 return {lib,modify,sync,pause,status,syncing,syncError:error};
}

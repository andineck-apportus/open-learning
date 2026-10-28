import React,{useEffect,useMemo,useState,useRef} from 'react';import{createRoot}from'react-dom/client';import './style.css';
import{type Library,type SetData,type Item,type Attempt,uid,normalize,possibleAnswers,mergeLibraries,deleteLibraryEntity,setLanguageLabels}from './model';
import {useAutoSync} from './use-auto-sync';import{startLogin,finishLogin,type Provider,type OAuthConfig}from './oauth';import{type Connection}from './cloud';
import { recognizeImage, pairCandidates } from './ocr';
import {beginGoogleLogin,finishGoogleLogin,hasGoogleSession,disconnectGoogle} from './google-session';
type ManageAction={kind:'subject'|'set';mode:'create'|'rename'|'delete';id?:string;name:string};
type Task={item:Item;setId:string;direction:'front-back'|'back-front'};
const config:OAuthConfig={googleClientId:import.meta.env.VITE_GOOGLE_CLIENT_ID||'',microsoftClientId:import.meta.env.VITE_MICROSOFT_CLIENT_ID||''};
const GSESSION='ol-google-session',API_SESSION='ol-api-session',API_LOCAL='ol-api-remembered',API_REMEMBER='ol-api-persist',LAST_PROVIDER='ol-last-cloud-provider';
const download=(filename:string,data:string)=>{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function App(){
 const [tab,setTab]=useState<'home'|'subject'|'set'|'edit'|'learn'|'settings'|'import'>('home');
 const [selected,setSelected]=useState('unite2'),[selectedSubject,setSelectedSubject]=useState('french');
 const [connection,setConnection]=useState<Connection|null>(null);
 const {lib,modify,sync,pause:pauseSync,status:syncStatus,syncing,syncError}=useAutoSync(connection);
 const [cloudState,setCloudState]=useState(()=>hasGoogleSession()?'Google Drive wird verbunden …':'Nicht verbunden');
 const [manage,setManage]=useState<ManageAction|null>(null);
 const [direction,setDirection]=useState<'mixed'|'front-back'|'back-front'>('mixed');
 const [studyMode,setStudyMode]=useState<'flip'|'write'|'test'>('flip'),[revealed,setRevealed]=useState(false),[showExamples,setShowExamples]=useState(false);
 const [tasks,setTasks]=useState<Task[]>([]),[pos,setPos]=useState(0),[answer,setAnswer]=useState(''),[attempt,setAttempt]=useState(1),[stage,setStage]=useState<'ask'|'hint'|'correct'|'wrong'|'done'>('ask'),[roundResults,setRoundResults]=useState<Attempt[]>([]);
 const [draft,setDraft]=useState<Item[]>([]),[image,setImage]=useState<string|null>(null),[importText,setImportText]=useState(''),[importStatus,setImportStatus]=useState('');
 const [importStage,setImportStage]=useState<'photo'|'analyzing'|'review'>('photo');
 const [isDragging,setIsDragging]=useState(false);
 const uploadInput=useRef<HTMLInputElement>(null);
 const cameraInput=useRef<HTMLInputElement>(null);
 const [importSubjectChoice,setImportSubjectChoice]=useState('__new__');
 const [detectedSubject,setDetectedSubject]=useState('');
 const [importDestination,setImportDestination]=useState('__new__');
 const [suggestedTitle,setSuggestedTitle]=useState('');
 const [newSetTitle,setNewSetTitle]=useState(''),[targetSubject,setTargetSubject]=useState('french'),[draftFrontLanguage,setDraftFrontLanguage]=useState(''),[draftBackLanguage,setDraftBackLanguage]=useState(''),[ocrLanguages,setOcrLanguages]=useState('fra+deu'),[ocrProgress,setOcrProgress]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const [notice,setNotice]=useState('');
 const configuredWorker=import.meta.env.VITE_AI_WORKER_URL||'https://open-learning-ai.andineck.workers.dev';
 const [workerOverride,setWorkerOverride]=useState(()=>localStorage.getItem('ol-ai-worker-override')||'');
 const workerUrl=workerOverride||configuredWorker;
 const [rememberAiKey,setRememberAiKey]=useState(()=>localStorage.getItem(API_REMEMBER)==='yes');
 const [aiKey,setAiKey]=useState(()=>localStorage.getItem(API_LOCAL)||sessionStorage.getItem(API_SESSION)||''),[aiModel,setAiModel]=useState('gpt-4.1-mini');
 const [aiMode,setAiMode]=useState<'auto'|'translation'|'qa'>('auto');

 useEffect(()=>{
  if(rememberAiKey){if(aiKey)localStorage.setItem(API_LOCAL,aiKey);else localStorage.removeItem(API_LOCAL);sessionStorage.removeItem(API_SESSION);}
  else{localStorage.removeItem(API_LOCAL);if(aiKey)sessionStorage.setItem(API_SESSION,aiKey);else sessionStorage.removeItem(API_SESSION);}
 },[aiKey,rememberAiKey]);
 useEffect(()=>{localStorage.setItem(API_REMEMBER,rememberAiKey?'yes':'no')},[rememberAiKey]);

 useEffect(()=>{finishLogin(config).then(c=>{if(c){setConnection({provider:c.provider,token:c.accessToken});localStorage.setItem(LAST_PROVIDER,c.provider);setCloudState(c.provider==='google'?'Google Drive verbunden':'OneDrive verbunden');setTab('settings')}}).catch(e=>setError('Anmeldung: '+e.message))},[]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   const completed=await finishGoogleLogin();
   if(completed&&active)setTab('settings');
   if(hasGoogleSession()){
    if(active){setConnection({provider:'google',token:''});setCloudState('Google Drive dauerhaft verbunden');}
   }
  })().catch(e=>{if(active){setCloudState(hasGoogleSession()?'Google Drive vorübergehend nicht erreichbar – Seite neu laden':'Google Drive: Bitte erneut verbinden');setError(e.message)}});
  return()=>{active=false};
 },[]);
 async function authorizeGoogle(){
  setBusy(true);setError('');
  try{await beginGoogleLogin()}catch(e){setError('Google Drive: '+String(e instanceof Error?e.message:e));setBusy(false)}
 }
 async function disconnectCloud(){
  setBusy(true);setError('');
  try{await pauseSync();if(connection?.provider==='google'||hasGoogleSession())await disconnectGoogle();sessionStorage.removeItem(GSESSION);localStorage.removeItem(LAST_PROVIDER);setConnection(null);setCloudState('Nicht verbunden')}
  catch(e){setError('Trennen fehlgeschlagen: '+String(e));setConnection(null)}finally{setBusy(false)}
 }
 const sets=lib?.sets||[],currentSet=sets.find(s=>s.id===selected)||sets[0],subject=lib?.subjects.find(s=>s.id===currentSet?.subjectId);
 const activeSubject=lib?.subjects.find(x=>x.id===selectedSubject)||subject||lib?.subjects[0];
 const subjectSets=sets.filter(s=>s.subjectId===activeSubject?.id);
 const [frontLabel,backLabel]=currentSet?setLanguageLabels(currentSet,subject?.name||''):['Seite 1','Seite 2'];
 const isTranslationSet=!!currentSet&&currentSet.items.length>0&&currentSet.items.some(i=>i.kind==='translation');
 const directionText=(dir:'front-back'|'back-front')=>dir==='front-back'?frontLabel+' → '+backLabel:backLabel+' → '+frontLabel;
 function openSubject(id:string){setSelectedSubject(id);setTab('subject');setNotice('')}
 function openSet(id:string){setSelected(id);const matching=sets.find(x=>x.id===id);if(matching)setSelectedSubject(matching.subjectId);setTab('set');setNotice('')}
 function openImport(){const id=tab==='subject'?activeSubject?.id||'':currentSet?.subjectId||activeSubject?.id||'';setTargetSubject(id);setImportSubjectChoice(id||'__new__');setImportDestination('__new__');setTab('import')}
 const subjectIcon=(name:string)=>/franz/i.test(name)?'🇫🇷':/engl/i.test(name)?'🇬🇧':/geschicht/i.test(name)?'🏛️':/bio/i.test(name)?'🌱':/geo/i.test(name)?'🌍':/mathe/i.test(name)?'∑':'📚';
 function updateSet(fn:(s:SetData)=>SetData){if(!currentSet)return;modify(d=>({...d,sets:d.sets.map(s=>s.id===currentSet.id?{...fn(s),updatedAt:new Date().toISOString()}:s)}))}
 const total=lib?.attempts.length||0;
 function startPractice(items?:Task[]){if(!currentSet)return;const q=items||currentSet.items.flatMap(item=>direction==='mixed'&&item.kind==='translation'?[{item,setId:currentSet.id,direction:'front-back' as const},{item,setId:currentSet.id,direction:'back-front' as const}]:[{item,setId:currentSet.id,direction:direction==='back-front'&&item.kind==='translation'?'back-front' as const:'front-back' as const}]);setTasks(q);setPos(0);setAnswer('');setAttempt(1);setRevealed(false);setStage('ask');setRoundResults([]);setTab('learn');setNotice('')}
 const task=tasks[pos],prompt=task?(task.direction==='front-back'?task.item.front:task.item.back):'',expected=task?(task.direction==='front-back'?task.item.back:task.item.front):'';
 const options=task?[...possibleAnswers(expected),...(task.direction==='front-back'?(task.item.alternatives||[]):[])]:[];
 const correct=options.some(s=>normalize(s)===normalize(answer));
 const hint=()=>{const expectedWord=options[0]||'';if(normalize(answer).length<normalize(expectedWord).length)return 'In deiner Antwort fehlt möglicherweise etwas.';if(normalize(answer).length>normalize(expectedWord).length)return 'Prüfe, ob etwas zu viel geschrieben ist.';return 'Prüfe die Schreibweise und achte auf Akzente und Artikel. Anfangsbuchstabe: '+expectedWord.slice(0,1)};
 function check(){if(!task||!answer.trim())return;if(correct||attempt===2||studyMode==='test'){const r:Attempt={id:uid(),itemId:task.item.id,setId:task.setId,direction:task.direction,correct,attempts:attempt,createdAt:new Date().toISOString()};modify(d=>({...d,attempts:[...d.attempts,r]}));setRoundResults(v=>[...v,r]);setStage(correct?'correct':'wrong')}else{setAttempt(2);setStage('hint');setAnswer('')}}
 function rateFlip(isRight:boolean){if(!task)return;const r:Attempt={id:uid(),itemId:task.item.id,setId:task.setId,direction:task.direction,correct:isRight,attempts:1,createdAt:new Date().toISOString()};modify(d=>({...d,attempts:[...d.attempts,r]}));setRoundResults(v=>[...v,r]);next()}
 function next(){if(pos+1===tasks.length)setStage('done');else{setPos(p=>p+1);setAnswer('');setAttempt(1);setRevealed(false);setStage('ask')}}
 function saveManaged(name:string){
  if(!manage||!name.trim())return;
  const now=new Date().toISOString();
  if(manage.mode==='create'){
   const id=uid();
   if(manage.kind==='subject'){modify(d=>({...d,subjects:[...d.subjects,{id,name:name.trim(),updatedAt:now}]}));setSelectedSubject(id);setTab('subject')}
   else if(activeSubject){modify(d=>({...d,sets:[...d.sets,{id,subjectId:activeSubject.id,title:name.trim(),items:[],createdAt:now,updatedAt:now}]}));setSelected(id);setTab('set')}
  }else if(manage.mode==='rename'){
   modify(d=>manage.kind==='subject'?{...d,subjects:d.subjects.map(x=>x.id===manage.id?{...x,name:name.trim(),updatedAt:now}:x)}:{...d,sets:d.sets.map(x=>x.id===manage.id?{...x,title:name.trim(),updatedAt:now}:x)});
  }
  setManage(null);
 }
 function deleteManaged(){
  if(!manage?.id||!lib)return;
  const parent=lib.sets.find(x=>x.id===manage.id)?.subjectId;
  modify(d=>deleteLibraryEntity(d,manage.kind,manage.id!));
  if(manage.kind==='subject'){setSelectedSubject('');setSelected('');setTab('home')}
  else{setSelected('');if(parent)setSelectedSubject(parent);setTab('subject')}
  setManage(null);
 }
 function parseText(){
  const rows=importText.split('\n').filter(Boolean).map(line=>{const cells=line.includes('\t')?line.split('\t'):line.split(';');return{id:uid(),front:(cells[0]||'').trim(),back:cells.slice(1).join(';').trim(),kind:'translation' as const}}).filter(x=>x.front&&x.back);
  setDraft(rows);setImportStage('review');
  setImportStatus(rows.length+' Lernkarten vorgeschlagen. Bitte kontrollieren.');
  if(!suggestedTitle)setSuggestedTitle('Neues Lernset');
 }
 function preparePhoto(file:File){
  if(!file.type.startsWith('image/')){setImportStatus('Bitte ein Bild im JPEG-, PNG- oder WebP-Format auswählen.');return}
  if(image)URL.revokeObjectURL(image);
  const url=URL.createObjectURL(file);
  setImage(url);setDraft([]);setImportStage('analyzing');setImportStatus('Foto wird analysiert …');
  void extractWithAI(url);
 }
 async function extractWithAI(photoUrl=image){
  if(!photoUrl){setImportStage('photo');setImportStatus('Bitte zuerst ein Foto auswählen.');return}
  if(!workerUrl||!aiKey){setImportStage('photo');setImportStatus('Für die automatische Erkennung zuerst unter Einstellungen den OpenAI-API-Key eingeben. Das Foto bleibt ausgewählt.');return}
  setBusy(true);setImportStage('analyzing');
  try{
   const imageBlob=await (await fetch(photoUrl)).blob();
   // Keep the payload below the Worker size limit; avoid uploading full-resolution phone photos.
   const img=await createImageBitmap(imageBlob);
   const maxSide=1800,scale=Math.min(1,maxSide/Math.max(img.width,img.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Bildverarbeitung nicht verfügbar');
   ctx.drawImage(img,0,0,canvas.width,canvas.height);img.close();
   const dataUrl=canvas.toDataURL('image/jpeg',0.82);
   const reply=await fetch(workerUrl.replace(/\/+$/,'')+'/api/extract',{method:'POST',headers:{'Content-Type':'application/json','X-OpenAI-Key':aiKey},body:JSON.stringify({image:dataUrl,subject:'Bitte Fach aus dem Foto automatisch erkennen',mode:'auto',model:aiModel})});
   const response=await reply.json().catch(()=>({error:'Keine gültige Antwort des KI-Dienstes'}));
   if(!reply.ok)throw Error(response.error||('HTTP '+reply.status));
   if(!Array.isArray(response.items))throw Error('Ungültige KI-Antwort');
   const proposals:Item[]=response.items.map((x:{front:string;back:string;kind:string;example?:string})=>({id:uid(),front:String(x.front||''),back:String(x.back||''),example:String(x.example||''),kind:x.kind==='qa'?'qa':'translation'})).filter((x:Item)=>x.front.trim()&&x.back.trim());
   if(proposals.length===0)throw Error('Keine lesbaren Lernkarten gefunden. Bitte ein schärferes Foto machen.');
   const isTranslation=proposals.some(x=>x.kind==='translation');
   const detected=typeof response.subjectName==='string'?response.subjectName.trim():isTranslation?(String(response.frontLanguage||'').trim()||'Sprachen'):'Allgemein';
   const match=lib?.subjects.find(x=>x.name.toLocaleLowerCase('de')===detected.toLocaleLowerCase('de'));
   setDetectedSubject(detected);setImportSubjectChoice(match?.id||'__new__');
   setSuggestedTitle(String(response.suggestedSetTitle||'Neues Lernset').slice(0,100));
   setDraftFrontLanguage(isTranslation?String(response.frontLanguage||'').trim():'Frage');
   setDraftBackLanguage(isTranslation?String(response.backLanguage||'').trim():'Antwort');
   setImportDestination('__new__');setDraft(proposals);setImportStage('review');
   setImportStatus(proposals.length+' Lernkarten erkannt. Bitte Fach, Lernset und Inhalte überprüfen.');
  }catch(e){
   setImportStage('photo');setImportStatus('KI-Erkennung fehlgeschlagen: '+String(e)+'. Foto erneut analysieren oder ein anderes auswählen.');
  }finally{setBusy(false)}
 }
 async function extractOnDevice(){
  if(!image)return;
  setBusy(true);
  try{
   const result=await recognizeImage(image,ocrLanguages.split('+'),v=>setOcrProgress(v));
   setImportText(result);const entries=pairCandidates(result);
   setDraft(entries.map(([front,back])=>({id:uid(),front,back,kind:'translation'})));
   setDetectedSubject('Sprachen');setImportSubjectChoice('__new__');setSuggestedTitle('Neues Lernset');
   setDraftFrontLanguage('');setDraftBackLanguage('');setImportDestination('__new__');setImportStage('review');
   setImportStatus(entries.length+' mögliche Paare erkannt. Bitte alle Einträge prüfen.');
  }catch(e){setImportStatus('Texterkennung fehlgeschlagen: '+String(e))}finally{setBusy(false)}
 }
 function approveDraft(){
  const good=draft.filter(x=>x.front.trim()&&x.back.trim());
  if(!good.length){setImportStatus('Bitte mindestens eine vollständige Lernkarte prüfen.');return}
  const chosenSubject=lib?.subjects.find(x=>x.id===importSubjectChoice);
  const newSubjectName=detectedSubject.trim();
  if(importSubjectChoice==='__new__'&&!newSubjectName){setImportStatus('Bitte einen Fachnamen eingeben.');return}
  const title=suggestedTitle.trim();
  if(importDestination==='__new__'&&!title){setImportStatus('Bitte einen Lernset-Titel eingeben.');return}
  if(importDestination!=='__new__'&&!sets.some(s=>s.id===importDestination&&s.subjectId===chosenSubject?.id)){setImportStatus('Bitte ein gültiges Lernset auswählen.');return}
  const subjectId=chosenSubject?.id||uid();
  const id=importDestination==='__new__'?uid():importDestination;
  const now=new Date().toISOString();
  modify(d=>{
   const nextSubjects=chosenSubject?d.subjects:[...d.subjects,{id:subjectId,name:newSubjectName}];
   const nextSets=importDestination==='__new__'
    ?[...d.sets,{id,subjectId,title,items:good,frontLanguage:draftFrontLanguage.trim()||undefined,backLanguage:draftBackLanguage.trim()||undefined,createdAt:now,updatedAt:now}]
    :d.sets.map(set=>set.id===id?{...set,items:[...set.items,...good],frontLanguage:set.frontLanguage||draftFrontLanguage.trim()||undefined,backLanguage:set.backLanguage||draftBackLanguage.trim()||undefined,updatedAt:now}:set);
   return{...d,subjects:nextSubjects,sets:nextSets};
  });
  setSelectedSubject(subjectId);setSelected(id);setImportStage('photo');
  setDraft([]);setImportText('');setSuggestedTitle('');setDetectedSubject('');setImportSubjectChoice('__new__');setImportDestination('__new__');
  if(image)URL.revokeObjectURL(image);setImage(null);setTab('set');
 }
 function resetImport(){
  if(image)URL.revokeObjectURL(image);setImage(null);setDraft([]);setImportText('');setImportStage('photo');
  setImportStatus('');setSuggestedTitle('');setDetectedSubject('');setImportSubjectChoice('__new__');setImportDestination('__new__');
 }
 async function restore(file:File){try{const d=JSON.parse(await file.text());if(d.schema!==1||!Array.isArray(d.sets)||!Array.isArray(d.attempts)||!Array.isArray(d.subjects))throw Error('Ungültiges Format');modify(x=>mergeLibraries(x,d));setNotice('Importiertes Backup lokal zusammengeführt.')}catch(e){setError('Backup-Import fehlgeschlagen: '+String(e))}}
 const correctCount=roundResults.filter(r=>r.correct).length;
 const successRate=roundResults.length?correctCount/roundResults.length:0;
 const fireConfetti=roundResults.length>0&&successRate>5/6;
 const celebrationTitle=successRate===1?'Wahnsinn – alles richtig!':fireConfetti?'Fantastisch gemacht!':successRate>=0.6?'Richtig gut drangeblieben!':'Stark, dass du geübt hast!';
 const celebrationMessage=successRate===1?'Das war eine perfekte Runde. Dein Einsatz hat sich gelohnt!':fireConfetti?'Über fünf Sechstel richtig – das ist eine richtig starke Leistung!':successRate>=0.6?'Du hast schon viel geschafft. Mit jeder Runde wirst du sicherer.':'Jedes geübte Wort zählt. Die schwierigen Karten machen wir beim nächsten Mal leichter!';
  const stats=useMemo(()=>{if(!lib)return[];return lib.sets.map(s=>{const rs=lib.attempts.filter(r=>r.setId===s.id);const last=new Map(rs.map(r=>[r.itemId+'|'+r.direction,r]));const mastered=[...last.values()].filter(r=>r.correct&&r.attempts===1).length;return{id:s.id,total:s.items.length,tries:rs.length,mastered}})},[lib]);
 if(!lib)return <main><p>{syncError||'Open Learning wird geladen …'}</p>{syncError&&<button onClick={()=>location.reload()}>Erneut versuchen</button>}</main>;
 return <main>
 <header className="app-header">
  <div className="brand-group"><span className="brand-mark" aria-hidden="true">✦</span><div><strong className="brand">open learning<span className="brand-dot">.</span></strong><p className="muted">Lernen, das bleibt.</p></div></div>
  <span className="pill"><span className="status-dot"/> {connection?connection.provider==='google'?'Google Drive':'OneDrive':'Nur dieses Gerät'}</span>
 </header>
 <div className="sync-status" role="status" aria-live="polite"><span className={syncing?"sync-indicator syncing":"sync-indicator"}/>{syncStatus}{syncError&&<span className="sync-error">{syncError}</span>}</div>
 <nav className="main-nav" aria-label="Hauptnavigation">
  <button onClick={()=>setTab('home')} className={tab==='home'?'active':''}><span aria-hidden="true">⌂</span> Übersicht</button>
  <button onClick={openImport} className={tab==='import'?'active':''}><span aria-hidden="true">◎</span> Importieren</button>
  <button onClick={()=>setTab('settings')} className={tab==='settings'?'active':''}><span aria-hidden="true">⚙</span> Einstellungen</button>
 </nav>
 {error&&<div role="alert" className="error"><span>{error}</span><button onClick={()=>setError('')}>Schliessen</button></div>}{notice&&<p className="muted" role="status">{notice}</p>}
 {tab==='home'&&<div className="page-stack">
 <div className="flat-toolbar"><h1>Fächer</h1><button className="primary" onClick={openImport}>+ Import</button></div>
}
 {tab==='subject'&&activeSubject&&<div className="page-stack">
  <div className="breadcrumb"><button onClick={()=>setTab('home')}>Alle Fächer</button><span>›</span><strong>{activeSubject.name}</strong></div>
  <section className="content-panel"><div className="section-heading"><div><span className="subject-tile-icon">{subjectIcon(activeSubject.name)}</span><span className="eyebrow">FACH</span><h1>{activeSubject.name}</h1><p className="muted">{subjectSets.length} Lernsets</p></div><div className="action-row"><button onClick={()=>setManage({kind:"subject",mode:"rename",id:activeSubject.id,name:activeSubject.name})}>Fach umbenennen</button><button className="danger-text" onClick={()=>setManage({kind:"subject",mode:"delete",id:activeSubject.id,name:activeSubject.name})}>Fach löschen</button></div></div><div className="collection-toolbar"><h2>Lernsets</h2><div className="action-row"><button onClick={openImport}>Foto importieren</button><button className="primary" onClick={()=>setManage({kind:"set",mode:"create",name:""})}>+ Lernset hinzufügen</button></div></div>
   {subjectSets.length?<div className="set-directory">{subjectSets.map(st=><article className="managed-card" key={st.id}><button className="set-tile" onClick={()=>openSet(st.id)}>
    <span className="set-tile-symbol" aria-hidden="true">▤</span><span className="set-tile-info"><strong>{st.title}</strong><small>{st.items.length} Lernkarten · {lib.attempts.filter(r=>r.setId===st.id).length} Lernversuche</small></span><span className="tile-arrow" aria-hidden="true">→</span>
   </button><div className="card-actions"><button aria-label={st.title+" umbenennen"} onClick={()=>setManage({kind:"set",mode:"rename",id:st.id,name:st.title})}>Umbenennen</button><button className="danger-text" aria-label={st.title+" löschen"} onClick={()=>setManage({kind:"set",mode:"delete",id:st.id,name:st.title})}>Löschen</button></div></article>)}</div>:<div className="empty-state"><span>📚</span><h3>Hier ist noch Platz für Neues.</h3><p>Erstelle dein erstes Lernset oder fotografiere eine Schulbuchseite.</p><button onClick={openImport}>Foto importieren</button></div>}
 
  </section>
 </div>}
 {tab==='set'&&currentSet&&<div className="page-stack">
  <div className="breadcrumb"><button onClick={()=>setTab('home')}>Alle Fächer</button><span>›</span><button onClick={()=>openSubject(currentSet.subjectId)}>{subject?.name}</button><span>›</span><strong>{currentSet.title}</strong></div>
  <section className="focus-panel set-detail">
   <div className="section-heading"><span className="eyebrow">LERNSET · {subject?.name}</span><div className="action-row"><button onClick={()=>setManage({kind:"set",mode:"rename",id:currentSet.id,name:currentSet.title})}>Lernset umbenennen</button><button className="danger-text" onClick={()=>setManage({kind:"set",mode:"delete",id:currentSet.id,name:currentSet.title})}>Lernset löschen</button></div></div><h1>{currentSet.title}</h1><p className="muted">{currentSet.items.length} Lernkarten · {lib.attempts.filter(r=>r.setId===currentSet.id).length} Lernversuche</p>
   <div className="method-title"><h2>Lernen</h2></div>
   <div className="method-grid">
    {([['flip','▣','Lernkarten',''],['write','✎','Schreiben',''],['test','✓','Prüfung','']] as const).map(([value,symbol,name,description])=><button key={value} aria-pressed={studyMode===value} className={'method-tile '+(studyMode===value?'chosen':'')} onClick={()=>setStudyMode(value)}><span className="method-symbol">{symbol}</span><strong>{name}</strong><small>{description}</small></button>)}
   </div>
   <div className="direction-choice"><label>Abfragerichtung<select value={direction} onChange={e=>setDirection(e.target.value as typeof direction)}>
 <option value="mixed">{isTranslationSet?frontLabel+' ↔ '+backLabel+' (gemischt)':'Frage → Antwort (gemischt)'}</option>
 <option value="front-back">{directionText('front-back')}</option>
 {isTranslationSet&&<option value="back-front">{directionText('back-front')}</option>}
 </select></label>
 {isTranslationSet&&<details className="language-correction"><summary>Sprachen korrigieren</summary><div className="language-pair-fields"><label>Sprache der Vorderseite<input value={currentSet.frontLanguage||frontLabel} onChange={e=>updateSet(s=>({...s,frontLanguage:e.target.value}))}/></label><label>Sprache der Rückseite<input value={currentSet.backLanguage||backLabel} onChange={e=>updateSet(s=>({...s,backLanguage:e.target.value}))}/></label></div></details>}
 </div>
   <div className="action-row"><button className="primary" disabled={!currentSet.items.length} onClick={()=>startPractice()}>▶ Lernen starten</button><button onClick={()=>setTab('edit')}>Bearbeiten</button><button onClick={()=>{setTargetSubject(currentSet.subjectId);openImport()}}>+ Karten hinzufügen</button></div>
   {!currentSet.items.length&&<p className="muted">Dieses Lernset ist noch leer. Erstelle zuerst Karten oder importiere ein Foto.</p>}
  </section>
 </div>}
 {tab==='edit'&&<section className="flat-edit"><div className="breadcrumb"><button onClick={()=>openSet(currentSet?.id||selected)}>← {currentSet?.title||'Lernset'}</button></div><div className="flat-toolbar"><h2>Karten</h2><button className="primary" onClick={()=>updateSet(s=>({...s,items:[...s.items,{id:uid(),front:'',back:'',kind:'translation'}]}))}>+ Karte</button></div>
 {currentSet?.items.map((item,i)=><div className="compact-edit-card" key={item.id}>
  <span className="review-number">{i+1}</span><div className="edit-fields"><input aria-label="Vorderseite" value={item.front} onChange={e=>updateSet(set=>({...set,items:set.items.map(x=>x.id===item.id?{...x,front:e.target.value}:x)}))}/><input aria-label="Rückseite" value={item.back} onChange={e=>updateSet(set=>({...set,items:set.items.map(x=>x.id===item.id?{...x,back:e.target.value}:x)}))}/>
  <input className="example-input" aria-label="Beispielsatz (optional)" placeholder="Beispielsatz (optional)" value={item.example||''} onChange={e=>updateSet(set=>({...set,items:set.items.map(x=>x.id===item.id?{...x,example:e.target.value}:x)}))}/></div>
  <button className="remove-card" aria-label="Karte löschen" onClick={()=>{if(confirm('Karte löschen?'))updateSet(set=>({...set,deletedItemIds:[...(set.deletedItemIds||[]),item.id],items:set.items.filter(x=>x.id!==item.id)}))}}>×</button>
 </div>)}
 <div className="action-row"><button className="primary" onClick={()=>openSet(currentSet?.id||selected)}>Fertig</button></div></section>}

 {tab==='import'&&<section className="import-wizard">
 <div className="import-heading"><h1>Import</h1></div>
 <div className="wizard-steps"><span className={importStage==='photo'?'active':''}>Foto</span><span className={importStage==='analyzing'?'active':''}>Erkennen</span><span className={importStage==='review'?'active':''}>Prüfen</span></div>
 {importStage!=='review'&&<div className="upload-workflow">
  <input ref={cameraInput} className="visually-hidden" tabIndex={-1} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)preparePhoto(f);e.target.value=''}}/>
  <input ref={uploadInput} className="visually-hidden" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)preparePhoto(f);e.target.value=''}}/>
  <div className={'drop-zone '+(isDragging?'is-dragging':'')} onDragEnter={e=>{e.preventDefault();setIsDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={e=>{e.preventDefault();setIsDragging(false)}} onDrop={e=>{e.preventDefault();setIsDragging(false);const f=e.dataTransfer.files[0];if(f)preparePhoto(f)}}>
   {image?<img className="upload-preview" src={image} alt="Ausgewähltes Schulbuchfoto"/>:<div className="upload-symbol" aria-hidden="true">📷</div>}
   <h2>{importStage==='analyzing'?'Dein Lernstoff wird erkannt …':image?'Foto ausgewählt':'Hier beginnt dein Lernset'}</h2>

   <div className="upload-actions"><button className="primary" disabled={busy} onClick={()=>cameraInput.current?.click()}>Kamera</button><button disabled={busy} onClick={()=>uploadInput.current?.click()}>Datei auswählen</button></div>
   {importStage==='analyzing'&&<div className="loading-line" role="status">Foto wird analysiert …</div>}
  </div>
  {image&&importStage==='photo'&&<button className="primary" disabled={busy||!aiKey} onClick={()=>void extractWithAI()}>Erneut analysieren</button>}
  {!aiKey&&<div className="hint">Für automatische KI-Erkennung bitte zuerst unter <button onClick={()=>setTab('settings')}>Einstellungen → KI-Verbindung</button> einen OpenAI-API-Key eingeben.</div>}
  <details className="import-fallback"><summary>Alternativ Text importieren oder OCR verwenden</summary>
   <label>Vokabelpaare: eine Zeile pro Karte, getrennt durch Semikolon
    <textarea rows={5} value={importText} onChange={e=>setImportText(e.target.value)} placeholder={'bonjour;Guten Tag\nmerci;Danke'}/>
   </label><button onClick={parseText} disabled={!importText.trim()}>Karten aus Text erstellen</button>
   {image&&<><label>OCR-Sprache<select value={ocrLanguages} onChange={e=>setOcrLanguages(e.target.value)}><option value="fra+deu">Französisch + Deutsch</option><option value="eng+deu">Englisch + Deutsch</option><option value="deu">Deutsch</option><option value="eng">Englisch</option></select></label><button disabled={busy} onClick={()=>void extractOnDevice()}>Einfache Texterkennung</button></>}
  </details>
 </div>}
 {importStatus&&<p className={importStage==='review'?'import-message':'hint'} role="status">{importStatus}</p>}
 {importStage==='review'&&<div className="review-workflow">
  <div className="section-heading"><div><span className="eyebrow">VORSCHLÄGE PRÜFEN</span><h2>{draft.length} Lernkarten erkannt</h2></div><button onClick={resetImport}>Anderes Foto wählen</button></div>
  <div className="review-meta">
   <label>Fach<select value={importSubjectChoice} onChange={e=>{setImportSubjectChoice(e.target.value);setImportDestination('__new__')}}>
    <option value="__new__">+ Neues Fach</option>
    {lib.subjects.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
   </select></label>
   {importSubjectChoice==='__new__'&&<label>Erkanntes Fach (korrigierbar)<input value={detectedSubject} onChange={e=>setDetectedSubject(e.target.value)} placeholder="z. B. Geschichte" /></label>}
   <label>Speichern in<select value={importDestination} onChange={e=>setImportDestination(e.target.value)}>
    <option value="__new__">+ Neues Lernset</option>
    {sets.filter(x=>x.subjectId===importSubjectChoice).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}
   </select></label>
   {importDestination==='__new__'&&<label>Titel des Lernsets<input value={suggestedTitle} onChange={e=>setSuggestedTitle(e.target.value)} placeholder="z. B. Unité 3" /></label>}
  </div>
  {draft.some(x=>x.kind==='translation')&&<div className="language-review"><span className="eyebrow">SPRACHEN ERKANNT</span><div className="language-pair-fields"><label>Vorderseite<input value={draftFrontLanguage} onChange={e=>setDraftFrontLanguage(e.target.value)} placeholder="z. B. Französisch"/></label><label>Rückseite<input value={draftBackLanguage} onChange={e=>setDraftBackLanguage(e.target.value)} placeholder="z. B. Deutsch"/></label></div><p className="language-example">{draftFrontLanguage||'Sprache 1'} ↔ {draftBackLanguage||'Sprache 2'}</p></div>}
  <div className="section-heading"><h2>Karten kontrollieren</h2><span className="muted">Jede Karte kann bearbeitet oder entfernt werden.</span></div>
  <div className="review-cards">{draft.map((item,i)=><div className="review-card" key={item.id}><span className="review-number">{i+1}</span><label>Vorderseite<input aria-label={'Vorderseite '+(i+1)} value={item.front} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,front:e.target.value}:x))}/></label><label>Rückseite<input aria-label={'Rückseite '+(i+1)} value={item.back} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,back:e.target.value}:x))}/></label><input className="review-example" aria-label={'Beispielsatz '+(i+1)} placeholder="Beispielsatz (optional)" value={item.example||''} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,example:e.target.value}:x))}/><button className="remove-card" aria-label={'Karte '+(i+1)+' entfernen'} onClick={()=>setDraft(d=>d.filter(x=>x.id!==item.id))}>×</button></div>)}</div>
  <div className="review-footer"><button onClick={()=>setDraft(d=>[...d,{id:uid(),front:'',back:'',kind:d.some(x=>x.kind==='translation')?'translation':'qa'}])}>+ Karte ergänzen</button><button className="primary" disabled={!draft.some(x=>x.front.trim()&&x.back.trim())} onClick={approveDraft}>✓ Geprüfte Karten speichern</button></div>
 </div>}
 </section>}

 {tab==='learn'&&<section className="study-page">
 <div className="study-top"><button className="subtle-button" onClick={()=>setTab('home')}>← Übersicht</button><span className="eyebrow">{studyMode==='flip'?'LERNKARTEN':studyMode==='write'?'SCHREIBTRAINING':'LERNKONTROLLE'}</span></div>
 {stage==='done'?<div className="complete-screen">
 {fireConfetti&&<div className="confetti-cannon" aria-hidden="true">{Array.from({length:58},(_,i)=><i key={i} style={{'--particle':i,'--angle':(i*137.5)%360+'deg','--distance':(130+(i%8)*19)+'px','--delay':(i%8)*0.035+'s','--tone':i%6} as React.CSSProperties}/>)}</div>}
 <span className="big-emoji">{successRate===1?'🏆':fireConfetti?'🎊':'🌟'}</span>
 <span className="eyebrow">LERNRUNDE ABGESCHLOSSEN</span>
 <h1>{celebrationTitle}</h1>
 <p className="celebration-message">{celebrationMessage}</p>
 <p className="score-line"><strong>{correctCount} von {roundResults.length}</strong> Aufgaben richtig ({Math.round(successRate*100)} %)</p><div className="result-grid"><div><strong>{roundResults.filter(r=>r.correct&&r.attempts===1).length}</strong><span>Direkt richtig</span></div><div><strong>{roundResults.filter(r=>r.correct&&r.attempts===2).length}</strong><span>Mit Hinweis</span></div><div><strong>{roundResults.filter(r=>!r.correct).length}</strong><span>Noch üben</span></div></div><div className="action-row center"><button className="primary" onClick={()=>startPractice(tasks.filter((_,i)=>{const r=roundResults[i];return r&&(!r.correct||r.attempts===2)}))} disabled={!roundResults.some(r=>!r.correct||r.attempts===2)}>Schwierige wiederholen ↻</button><button onClick={()=>startPractice()}>Ganzes Set neu starten</button></div></div>
 :task?<><div className="study-progress"><span>Karte {pos+1} von {tasks.length}</span><span>{Math.round(pos/tasks.length*100)}%</span></div><progress value={pos} max={tasks.length}/>
 <div className="learning-card">{task.item.example&&<label className="show-example"><input type="checkbox" checked={showExamples} onChange={e=>setShowExamples(e.target.checked)}/> Beispielsatz</label>}<span className="eyebrow">{task.item.kind==='translation'?directionText(task.direction):'FRAGE → ANTWORT'}</span><h1>{prompt}</h1>
 {studyMode==='flip'?<div className="reveal-area">{revealed?<><div className="divider-short"/><span className="eyebrow">LÖSUNG</span><h2>{expected}</h2>{showExamples&&task.item.example&&<p className="study-example">{task.item.example}</p>}<div className="rating-grid"><button className="rate-wrong" onClick={()=>rateFlip(false)}>✕ &nbsp; Noch nicht</button><button className="rate-correct" onClick={()=>rateFlip(true)}>✓ &nbsp; Gewusst!</button></div></>:<button className="reveal-button" onClick={()=>setRevealed(true)}>Antwort aufdecken <span aria-hidden="true">↻</span></button>}</div>
 :<div className="answer-area"><p className="muted">{studyMode==='test'?'Prüfungsmodus: ein Versuch, keine Hinweise.':attempt===1?'Schreibe deine Antwort. Du hast zwei Versuche.':'Zweiter Versuch'}</p>
 {stage==='hint'&&<div className="hint">💡 {hint()}</div>}
 {(stage==='ask'||stage==='hint')?<form onSubmit={e=>{e.preventDefault();check()}}><input autoFocus value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Deine Antwort eingeben …" aria-label="Deine Antwort"/><button className="primary" disabled={!answer.trim()}>Antwort prüfen →</button></form>:<><div className={stage==='correct'?'success':'error'}><strong>{stage==='correct'?'🎉 Richtig!':'Noch nicht ganz.'}</strong><p>Lösung: {options.join(' / ')}</p>{showExamples&&task.item.example&&<p className="study-example">{task.item.example}</p>}{stage==='wrong'&&<p>Deine Antwort: {answer}</p>}</div><button className="primary" onClick={next}>Nächste Karte →</button></>}
 </div>}</div></>:<p>Keine Aufgaben in diesem Lernset.</p>}</section>}
 {tab==='settings'&&<section><h1>Eigener Cloud-Speicher</h1><p>Synchronisiere deine Lerninhalte und Versuche über Google Drive oder OneDrive. Lerninhalte bleiben in deinem Cloud-Speicher; die Anmeldung wird sicher auf dem Server verwaltet.</p><div className="two"><button disabled={busy} onClick={()=>void authorizeGoogle()}>{connection?.provider==='google'?'Google Drive erneut autorisieren':localStorage.getItem(LAST_PROVIDER)==='google'?'Google Drive-Zugriff erneuern':'Mit Google Drive verbinden'}</button><button disabled={!config.microsoftClientId} onClick={()=>startLogin('microsoft',config).catch(e=>setError(e.message))}>Mit OneDrive verbinden</button></div>
 {!config.microsoftClientId&&<p className="muted">Nicht alle Cloud-Anbieter sind konfiguriert. Verfügbare Verbindungen kannst du oben auswählen.</p>}
 <p><strong>Verbindung:</strong> {cloudState}</p><p><strong>Synchronisation:</strong> {syncStatus}</p>
 {connection&&<div className="action-row"><button className="primary" disabled={syncing} onClick={()=>void sync()}>{syncing?'Synchronisiert …':'Cloud synchronisieren'}</button><button onClick={disconnectCloud}>Verbindung trennen</button></div>}
 <p className="muted">Google Drive bleibt auf diesem Gerät auch nach einem Neuladen oder Browser-Neustart verbunden. Zugriffstokens werden automatisch erneuert. Die Gerätesitzung gilt bis zu 180 Tage; bei einem Widerruf durch Google ist eine erneute Anmeldung nötig. Nur auf privaten, vertrauenswürdigen Geräten angemeldet bleiben.</p>
 <h2>✨ KI-Verbindung (BYO OpenAI)</h2>
 <p>Dein API-Key bleibt bei einem Seiten-Refresh erhalten. Optional kannst du ihn auf diesem Gerät auch über einen Browser-Neustart hinaus speichern.</p>
 {!configuredWorker&&!workerOverride&&<p className="hint">Die KI-Verbindung wurde vom Betreiber noch nicht aktiviert. Lernkarten und Cloud-Speicher funktionieren weiterhin ohne KI.</p>}
 <label>Persönlicher OpenAI-API-Key
  <input type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" value={aiKey} onChange={e=>setAiKey(e.target.value.trim())}/>
 </label>
 <label>KI-Modell
  <select value={aiModel} onChange={e=>setAiModel(e.target.value)}>
   <option value="gpt-4.1-mini">GPT-4.1 mini (Standard)</option><option value="gpt-4o-mini">GPT-4o mini</option>
   <option value="gpt-4.1">GPT-4.1</option><option value="gpt-4o">GPT-4o</option>
  </select>
 </label>
 <label className="key-persistence"><input type="checkbox" checked={rememberAiKey} onChange={e=>setRememberAiKey(e.target.checked)}/><span>API-Key dauerhaft auf diesem Gerät speichern</span></label>
 <p className="security-note">Bei dieser Option liegt der API-Key unverschlüsselt im Browser-Speicher. Browser-Erweiterungen, andere Nutzer desselben Browserprofils und kompromittierte Skripte könnten ihn auslesen. Nur auf einem vertrauenswürdigen privaten Gerät verwenden; separaten API-Key mit kleinem Budget wählen.</p>
 <button onClick={()=>{setAiKey('');setRememberAiKey(false);sessionStorage.removeItem(API_SESSION);localStorage.removeItem(API_LOCAL)}}>Gespeicherten API-Key löschen</button>
 <p className="muted">Sicherheit: Dein Schlüssel wird für die Bildanalyse über HTTPS an den KI-Dienst übertragen und ist während der Sitzung im Browser verfügbar. Verwende einen separaten API-Projektschlüssel mit kleinem Budget. Der Betreiber des KI-Dienstes könnte Anfragen und Schlüssel technisch einsehen.</p>
 <details><summary>Erweitert: eigenen KI-Dienst verwenden (Self-Hosting)</summary>
  <label>Alternative Worker-Adresse (optional)<input type="url" autoComplete="off" spellCheck={false} placeholder="https://mein-worker.workers.dev" value={workerOverride} onChange={e=>{const v=e.target.value.trim();setWorkerOverride(v);if(v)localStorage.setItem('ol-ai-worker-override',v);else localStorage.removeItem('ol-ai-worker-override')}}/></label>
  <p className="muted">Nur für fortgeschrittene Benutzer. Standardmässig verwendet Open Learning den zentralen Dienst, sobald dieser eingerichtet ist.</p>
 </details>
 <h2>Backup</h2><button onClick={()=>download('open-learning-backup.json',JSON.stringify(lib,null,2))}>JSON exportieren</button><label>JSON importieren<input type="file" accept="application/json" onChange={async e=>{const f=e.target.files?.[0];if(f)restore(f)}}/></label><p className="muted">Google-Refresh-Tokens werden verschlüsselt auf dem Server gespeichert. Dieses Gerät speichert eine widerrufbare Sitzung; «Verbindung trennen» beendet sie auf dem Server. Die Lerninhalte bleiben lokal gespeichert; Google Drive wird beim Öffnen, nach Änderungen, bei der Rückkehr zur App und während der Nutzung alle 30 Sekunden automatisch abgeglichen. Offline gespeicherte Änderungen werden bei wiederhergestellter Verbindung übertragen. Bei gleichzeitiger Bearbeitung desselben Felds gilt die neuere Änderung; verschiedene Karten und Felder werden zusammengeführt. Dein OpenAI-Key wird nicht in Google Drive gespeichert.</p></section>}
 {manage&&<ManageDialog action={manage} library={lib} onCancel={()=>setManage(null)} onSave={saveManaged} onDelete={deleteManaged}/>}
 <footer>Open Learning · MIT · BYOE · <span>Fotos und Inhalte vor Freigabe prüfen</span></footer></main>
}
function ManageDialog({action,library,onCancel,onSave,onDelete}:{action:ManageAction;library:Library;onCancel:()=>void;onSave:(name:string)=>void;onDelete:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[name,setName]=useState(action.name);
 const noun=action.kind==='subject'?'Fach':'Lernset',deleting=action.mode==='delete';
 const affected=library.sets.filter(s=>action.kind==='subject'?s.subjectId===action.id:s.id===action.id);
 const cards=affected.reduce((n,s)=>n+s.items.length,0),attempts=library.attempts.filter(a=>affected.some(s=>s.id===a.setId)).length;
 const duplicate=action.kind==='subject'&&library.subjects.some(s=>s.id!==action.id&&s.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase());
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close()},[]);
 return <dialog ref={dialog} className="manage-dialog" aria-labelledby="manage-title" onCancel={onCancel}>
  <form onSubmit={e=>{e.preventDefault();if(deleting)onDelete();else if(!duplicate)onSave(name)}}>
   <h2 id="manage-title">{noun} {deleting?'löschen?':action.mode==='create'?'hinzufügen':'umbenennen'}</h2>
   {deleting?<><p><strong>„{action.name}“</strong> wird mit {action.kind==='subject'?affected.length+' Lernsets, ':''}{cards} Lernkarten und {attempts} Lernversuchen gelöscht.</p><p className="muted">Das kann nicht rückgängig gemacht werden. Beim nächsten Synchronisieren wird die Löschung auch in der Cloud übernommen.</p></>:<><label htmlFor="manage-name">{action.kind==='subject'?'Name des Fachs':'Titel des Lernsets'}</label><input id="manage-name" autoFocus value={name} maxLength={100} onChange={e=>setName(e.target.value)} placeholder={action.kind==='subject'?'z. B. Geschichte':'z. B. Unité 3'} required aria-describedby={duplicate?'duplicate-name':undefined}/>{duplicate&&<p id="duplicate-name" role="alert" className="danger-text">Ein Fach mit diesem Namen existiert bereits.</p>}</>}
   <div className="dialog-actions"><button type="button" autoFocus={deleting} onClick={onCancel}>Abbrechen</button><button className={deleting?'danger-button':'primary'} disabled={!deleting&&(!name.trim()||duplicate)}>{deleting?noun+' löschen':action.mode==='create'?noun+' hinzufügen':'Speichern'}</button></div>
  </form>
 </dialog>;
}
function SetPicker({sets,selected,setSelected}:{sets:SetData[];selected:string;setSelected:(s:string)=>void}){return <label>Lernset <select value={selected} onChange={e=>setSelected(e.target.value)}>{sets.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
createRoot(document.getElementById('root')!).render(<App/>);


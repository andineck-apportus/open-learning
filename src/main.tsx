import {takeLegacyAiKey,extractionEndpoint} from './ai-key';
import {SyncBadge} from './SyncBadge';
import {beginMicrosoftLogin,finishMicrosoftLogin,disconnectMicrosoft,microsoftClientId,saveMicrosoftClientId} from './microsoft-session';
import {LearningProgress} from './LearningProgress';
import {learningLevels,preferredDirection} from './learning-engine';
import {Practice} from './Practice';
import React,{useEffect,useMemo,useState,useRef} from 'react';import{createRoot}from'react-dom/client';import './style.css';
import{type Library,type SetData,type Item,type Attempt,uid,normalize,possibleAnswers,mergeLibraries,deleteLibraryEntity,setLanguageLabels,exampleForItem}from './model';
import {useAutoSync} from './use-auto-sync';import{type Connection}from './cloud';
import { recognizeImage, pairCandidates } from './ocr';
import {beginGoogleLogin,finishGoogleLogin,hasGoogleSession,disconnectGoogle} from './google-session';
type ManageAction={kind:'subject'|'set';mode:'create'|'rename'|'delete';id?:string;name:string};
type Task={item:Item;setId:string;direction:'front-back'|'back-front'};
const GSESSION='ol-google-session',API_SESSION='ol-api-session',API_LOCAL='ol-api-remembered',API_REMEMBER='ol-api-persist',LAST_PROVIDER='ol-last-cloud-provider';
const download=(filename:string,data:string)=>{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function App(){
 const [tab,setTab]=useState<'home'|'subject'|'subject-edit'|'set'|'edit'|'settings'|'import'>('home');
 const [selected,setSelected]=useState('unite2'),[selectedSubject,setSelectedSubject]=useState('french');
 const [connection,setConnection]=useState<Connection|null>(null);
 const {lib,modify,sync,pause:pauseSync,status:syncStatus,syncing,syncError}=useAutoSync(connection);
 const [msClientId,setMsClientId]=useState(microsoftClientId),[sharePointUrl,setSharePointUrl]=useState('');
 const [cloudState,setCloudState]=useState(()=>hasGoogleSession()?'Google Drive wird verbunden …':'Nicht verbunden');
 const [manage,setManage]=useState<ManageAction|null>(null);
 const [direction,setDirection]=useState<'mixed'|'front-back'|'back-front'>('back-front');
 const [nativeLanguage,setNativeLanguage]=useState(()=>localStorage.getItem('ol-native-language')||'Deutsch');
 useEffect(()=>{localStorage.setItem('ol-native-language',nativeLanguage)},[nativeLanguage]);
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

 const [aiKey,setAiKey]=useState(takeLegacyAiKey),[aiModel,setAiModel]=useState('gpt-4.1-mini');
 const [aiMode,setAiMode]=useState<'auto'|'translation'|'qa'>('auto');

 useEffect(()=>{localStorage.removeItem(API_LOCAL);sessionStorage.removeItem(API_SESSION);localStorage.removeItem(API_REMEMBER)},[]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   const completed=await finishGoogleLogin();
   if(completed&&active)setTab('settings');
   if(localStorage.getItem(LAST_PROVIDER)==='microsoft'){const microsoft=await finishMicrosoftLogin();if(microsoft&&active){setConnection(microsoft);setCloudState(microsoft.siteId?'SharePoint verbunden':'OneDrive verbunden');setTab('settings')}return;}
   if(hasGoogleSession()){
    if(active){setConnection({provider:'google',token:''});setCloudState('Google Drive dauerhaft verbunden');}
   }
  })().catch(e=>{if(active){setCloudState('Cloud: Bitte erneut verbinden');setError(e.message)}});
  return()=>{active=false};
 },[]);
 async function authorizeGoogle(){
  setBusy(true);setError('');
  try{await beginGoogleLogin()}catch(e){setError('Google Drive: '+String(e instanceof Error?e.message:e));setBusy(false)}
 }
 async function disconnectCloud(){
  setBusy(true);setError('');
  try{await pauseSync();if(connection?.provider==='microsoft')await disconnectMicrosoft();else if(hasGoogleSession())await disconnectGoogle();sessionStorage.removeItem(GSESSION);localStorage.removeItem(LAST_PROVIDER);setConnection(null);setCloudState('Nicht verbunden')}
  catch(e){setError('Trennen fehlgeschlagen: '+String(e));setConnection(null)}finally{setBusy(false)}
 }
 async function authorizeMicrosoft(site=''){
  setBusy(true);setError('');
  try{saveMicrosoftClientId(msClientId.trim());await pauseSync();await beginMicrosoftLogin(site)}catch(e){setError(e instanceof Error?e.message:'Microsoft-Anmeldung fehlgeschlagen');setConnection(c=>c?{...c}:null);setBusy(false)}
 }
 const sets=lib?.sets||[],currentSet=sets.find(s=>s.id===selected)||sets[0],subject=lib?.subjects.find(s=>s.id===currentSet?.subjectId);
 const activeSubject=lib?.subjects.find(x=>x.id===selectedSubject)||subject||lib?.subjects[0];
 const subjectSets=sets.filter(s=>s.subjectId===activeSubject?.id);
 const [frontLabel,backLabel]=currentSet?setLanguageLabels(currentSet,subject?.name||''):['Seite 1','Seite 2'];
 const isTranslationSet=!!currentSet&&currentSet.items.length>0&&currentSet.items.some(i=>i.kind==='translation');
 const directionText=(dir:'front-back'|'back-front')=>dir==='front-back'?frontLabel+' → '+backLabel:backLabel+' → '+frontLabel;
 
 function chooseSetDirection(set:SetData){
   const subj=lib?.subjects.find(x=>x.id===set.subjectId);
   const [from,to]=setLanguageLabels(set,subj?.name||'');
   const isQa=set.items.length>0&&set.items.every(x=>x.kind==='qa');
   const normal=(x:string)=>x.trim().toLocaleLowerCase('de').replace(/\s*\([^)]*\)\s*/g,'');
   setDirection(isQa?'front-back':normal(to)===normal(nativeLanguage)&&normal(from)!==normal(nativeLanguage)?'back-front':'front-back');
 }
 useEffect(()=>{if(currentSet)chooseSetDirection(currentSet)},[currentSet?.id,currentSet?.frontLanguage,currentSet?.backLanguage,nativeLanguage]);
 function openSubject(id:string){setSelectedSubject(id);setTab('subject');setNotice('')}
 function openSet(id:string){setSelected(id);const matching=sets.find(x=>x.id===id);if(matching){setSelectedSubject(matching.subjectId);chooseSetDirection(matching)}setTab('set');setNotice('')}
 function openImport(){const id=(tab==='subject'||tab==='subject-edit')?activeSubject?.id||'':currentSet?.subjectId||activeSubject?.id||'';setTargetSubject(id);setImportSubjectChoice(id||'__new__');setImportDestination('__new__');setTab('import')}
 const subjectIcon=(name:string)=>/franz/i.test(name)?'🇫🇷':/engl/i.test(name)?'🇬🇧':/geschicht/i.test(name)?'🏛️':/bio/i.test(name)?'🌱':/geo/i.test(name)?'🌍':/mathe/i.test(name)?'∑':'📚';
 function updateSet(fn:(s:SetData)=>SetData){if(!currentSet)return;modify(d=>({...d,sets:d.sets.map(s=>s.id===currentSet.id?{...fn(s),updatedAt:new Date().toISOString()}:s)}))}
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
   const reply=await fetch(extractionEndpoint(workerUrl),{method:'POST',headers:{'Content-Type':'application/json','X-OpenAI-Key':aiKey},body:JSON.stringify({image:dataUrl,subject:'Bitte Fach aus dem Foto automatisch erkennen',mode:'auto',model:aiModel})});
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
 const levelsBySet=useMemo(()=>new Map((lib?.sets||[]).map(s=>{const labels=setLanguageLabels(s,lib?.subjects.find(sub=>sub.id===s.subjectId)?.name||'');return [s.id,learningLevels(s,lib?.attempts||[],preferredDirection(labels,nativeLanguage))]})),[lib,nativeLanguage]);
 if(!lib)return <main><p>{syncError||'Open Learning wird geladen …'}</p>{syncError&&<button onClick={()=>location.reload()}>Erneut versuchen</button>}</main>;
 return <main>
 <header className="app-header compact-app-header">
  <button type="button" className="brand-home" onClick={()=>setTab('home')} aria-label="Zur Fächerübersicht">
   <span className="brand-mark" aria-hidden="true">✦</span><strong className="brand">open learning<span className="brand-dot">.</span></strong>
  </button>
  <div className="header-tools"><SyncBadge status={syncStatus} connected={!!connection} syncing={syncing} error={syncError}/>

  <button className={'header-settings '+(tab==='settings'?'active':'')} aria-label="Einstellungen" title="Einstellungen" onClick={()=>setTab(tab==='settings'?'home':'settings')}><UiIcon kind="settings"/></button></div>
 </header>
  {error&&<div role="alert" className="error"><span>{error}</span><button onClick={()=>setError('')}>Schliessen</button></div>}{notice&&<p className="muted" role="status">{notice}</p>}
 {tab==='home'&&<div className="page-stack">
 <div className="flat-toolbar"><h1>Fächer</h1><div className="action-row"><button className="primary" onClick={()=>setManage({kind:'subject',mode:'create',name:''})}>+ Fach</button><button onClick={openImport}>Import</button></div></div>
 <section className="content-panel"><div className="subject-directory">{lib.subjects.map(sub=><article className="managed-card" key={sub.id}>
 <button className="subject-tile" onClick={()=>openSubject(sub.id)}><span className="subject-tile-icon">{subjectIcon(sub.name)}</span><span className="subject-tile-info"><strong>{sub.name}</strong><small>{sets.filter(x=>x.subjectId===sub.id).length} Sets</small></span><span className="tile-arrow">›</span></button>
 
 </article>)}</div></section>
 </div>}
 {tab==='subject'&&activeSubject&&<div className="page-stack">
  <div className="breadcrumb"><button onClick={()=>setTab('home')}>Alle Fächer</button><span>›</span><strong>{activeSubject.name}</strong></div>
  <section className="content-panel"><div className="flat-toolbar subject-heading"><div className="subject-name"><span className="subject-tile-icon">{subjectIcon(activeSubject.name)}</span><div><h1>{activeSubject.name}</h1><p className="muted">{subjectSets.length} Lernsets</p></div></div><button className="subtle-button" onClick={()=>setTab('subject-edit')}><UiIcon kind="edit"/> Bearbeiten</button></div>
   {subjectSets.length?<div className="set-directory">{subjectSets.map(st=><article className="managed-card" key={st.id}><button className="set-tile" onClick={()=>openSet(st.id)}>
    <span className="set-tile-symbol" aria-hidden="true"><UiIcon kind="book"/></span><span className="set-tile-info"><strong>{st.title}</strong><small>{st.items.length} Karten</small><LearningProgress levels={levelsBySet.get(st.id)||[]} compact/></span><span className="tile-arrow" aria-hidden="true"><UiIcon kind="chevron"/></span>
   </button></article>)}</div>:<div className="empty-state"><h3>Noch keine Lernsets</h3><button onClick={()=>setTab('subject-edit')}>Bearbeiten</button></div>}
 
  </section>
 </div>}
 {tab==='subject-edit'&&activeSubject&&<div className="page-stack">
  <div className="breadcrumb"><button onClick={()=>openSubject(activeSubject.id)}>← {activeSubject.name}</button></div>
  <section className="content-panel subject-edit-page">
   <div className="flat-toolbar"><h1>Fach bearbeiten</h1><button className="primary" onClick={()=>openSubject(activeSubject.id)}>Fertig</button></div>
   <div className="edit-management">
    <div className="edit-management-row"><strong>{activeSubject.name}</strong><button onClick={()=>setManage({kind:'subject',mode:'rename',id:activeSubject.id,name:activeSubject.name})}>Umbenennen</button><button className="danger-text" onClick={()=>setManage({kind:'subject',mode:'delete',id:activeSubject.id,name:activeSubject.name})}>Löschen</button></div>
   </div>
   <h2>Lernsets</h2>
   <div className="subject-edit-actions"><button className="primary" onClick={()=>setManage({kind:'set',mode:'create',name:''})}>+ Lernset hinzufügen</button><button onClick={openImport}><UiIcon kind="camera"/> Foto importieren</button></div>
   <div className="subject-edit-list">{subjectSets.map(st=><div className="subject-edit-item" key={st.id}><span className="set-tile-symbol"><UiIcon kind="book"/></span><span className="subject-edit-item-name">{st.title}</span><button onClick={()=>openSet(st.id)}>Öffnen</button><button onClick={()=>setManage({kind:'set',mode:'rename',id:st.id,name:st.title})}>Umbenennen</button><button className="danger-text" onClick={()=>setManage({kind:'set',mode:'delete',id:st.id,name:st.title})}>Löschen</button></div>)}</div>
  </section>
 </div>}
 {tab==='set'&&currentSet&&<div className="page-stack">
  <div className="breadcrumb"><button onClick={()=>setTab('home')}>Fächer</button><span>›</span><button onClick={()=>openSubject(currentSet.subjectId)}>{subject?.name}</button></div>
  <section className="focus-panel set-detail">
   <div className="flat-toolbar set-title-row"><div><h1>{currentSet.title}</h1><p className="muted">{currentSet.items.length} Karten</p></div>
    <button className="subtle-button" onClick={()=>setTab('edit')}><UiIcon kind="edit"/> Bearbeiten</button></div>
   <Practice key={currentSet.id} set={currentSet} labels={[frontLabel,backLabel]} attempts={lib?.attempts||[]} nativeLanguage={nativeLanguage} onRecord={records=>modify(d=>({...d,attempts:[...d.attempts,...records.filter(r=>!d.attempts.some(a=>a.id===r.id))]}))}/>
   {!currentSet.items.length&&<p className="muted">Noch keine Karten vorhanden.</p>}
  </section>
 </div>}
 {tab==='edit'&&currentSet&&<section className="flat-edit">
  <div className="breadcrumb"><button onClick={()=>openSet(currentSet.id)}>← {currentSet.title}</button></div>
  <div className="flat-toolbar"><h2>Bearbeiten</h2><button className="primary" onClick={()=>updateSet(s=>({...s,items:[...s.items,{id:uid(),front:'',back:'',kind:'translation'}]}))}>+ Karte</button></div>
  <div className="edit-management">
   <div className="edit-management-row"><strong>{currentSet.title}</strong><button onClick={()=>setManage({kind:'set',mode:'rename',id:currentSet.id,name:currentSet.title})}>Umbenennen</button><button className="danger-text" onClick={()=>setManage({kind:'set',mode:'delete',id:currentSet.id,name:currentSet.title})}>Löschen</button></div>
   {currentSet.items.some(x=>x.kind==='translation')&&<div className="language-pair-fields"><label>Ausgangssprache<input value={currentSet.frontLanguage??frontLabel} onChange={e=>updateSet(s=>({...s,frontLanguage:e.target.value}))}/></label><label>Zielsprache<input value={currentSet.backLanguage??backLabel} onChange={e=>updateSet(s=>({...s,backLanguage:e.target.value}))}/></label></div>}
   <button onClick={()=>{setTargetSubject(currentSet.subjectId);openImport()}}><UiIcon kind="camera"/> Karten importieren</button>
  </div>
  <h3>Karten ({currentSet.items.length})</h3>
  {currentSet.items.map((item,i)=><div className="compact-edit-card" key={item.id}>
   <span className="review-number">{i+1}</span><div className="edit-fields"><input aria-label="Vorderseite" value={item.front} onChange={e=>updateSet(set=>({...set,items:set.items.map(x=>x.id===item.id?{...x,front:e.target.value}:x)}))}/><input aria-label="Rückseite" value={item.back} onChange={e=>updateSet(set=>({...set,items:set.items.map(x=>x.id===item.id?{...x,back:e.target.value}:x)}))}/>
    <input className="example-input" aria-label="Beispielsatz (optional)" placeholder="Beispielsatz (optional)" value={exampleForItem(currentSet.id,item)||''} onChange={e=>updateSet(set=>({...set,items:set.items.map(x=>x.id===item.id?{...x,example:e.target.value}:x)}))}/></div>
   <button className="remove-card" aria-label="Karte löschen" onClick={()=>{if(confirm('Karte löschen?'))updateSet(set=>({...set,deletedItemIds:[...(set.deletedItemIds||[]),item.id],items:set.items.filter(x=>x.id!==item.id)}))}}>×</button>
  </div>)}
  <div className="action-row"><button className="primary" onClick={()=>openSet(currentSet.id)}>Fertig</button></div>
 </section>}
 {tab==='import'&&<section className="import-wizard">
 <div className="import-heading"><h1>Import</h1></div>
 <div className="wizard-steps"><span className={importStage==='photo'?'active':''}>Foto</span><span className={importStage==='analyzing'?'active':''}>Erkennen</span><span className={importStage==='review'?'active':''}>Prüfen</span></div>
 {importStage!=='review'&&<div className="upload-workflow">
  <input ref={cameraInput} className="visually-hidden" tabIndex={-1} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)preparePhoto(f);e.target.value=''}}/>
  <input ref={uploadInput} className="visually-hidden" tabIndex={-1} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)preparePhoto(f);e.target.value=''}}/>
  <div className={'drop-zone '+(isDragging?'is-dragging':'')} onDragEnter={e=>{e.preventDefault();setIsDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={e=>{e.preventDefault();setIsDragging(false)}} onDrop={e=>{e.preventDefault();setIsDragging(false);const f=e.dataTransfer.files[0];if(f)preparePhoto(f)}}>
   {image?<img className="upload-preview" src={image} alt="Ausgewähltes Schulbuchfoto"/>:<div className="upload-symbol" aria-hidden="true"><UiIcon kind="camera"/></div>}
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
  <div className="review-cards">{draft.map((item,i)=><div className="review-card" key={item.id}><span className="review-number">{i+1}</span><label>Vorderseite<input aria-label={'Vorderseite '+(i+1)} value={item.front} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,front:e.target.value}:x))}/></label><label>Rückseite<input aria-label={'Rückseite '+(i+1)} value={item.back} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,back:e.target.value}:x))}/></label><input className="review-example" aria-label={'Beispielsatz '+(i+1)} placeholder="Beispielsatz (optional)" value={exampleForItem(currentSet.id,item)||''} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,example:e.target.value}:x))}/><button className="remove-card" aria-label={'Karte '+(i+1)+' entfernen'} onClick={()=>setDraft(d=>d.filter(x=>x.id!==item.id))}>×</button></div>)}</div>
  <div className="review-footer"><button onClick={()=>setDraft(d=>[...d,{id:uid(),front:'',back:'',kind:d.some(x=>x.kind==='translation')?'translation':'qa'}])}>+ Karte ergänzen</button><button className="primary" disabled={!draft.some(x=>x.front.trim()&&x.back.trim())} onClick={approveDraft}>✓ Geprüfte Karten speichern</button></div>
 </div>}
 </section>}

 {tab==='settings'&&<section className="compact-settings">
 <div className="settings-heading"><button className="icon-button" onClick={()=>setTab('home')} aria-label="Zurück"><UiIcon kind="back"/></button><h1>Einstellungen</h1></div>
 <div className="setting-group">
  <div className="settings-title"><h2>Speicher & Synchronisierung</h2><Help text="Lernkarten und Fortschritt werden zuerst lokal gespeichert und mit dem verbundenen Speicher automatisch abgeglichen. Microsoft verwendet einen eigenen App-Ordner und getrennte Datenstände pro Konto."/></div>
  <p className="setting-status">{connection?.provider==='google'?'Google Drive verbunden':connection?.provider==='microsoft'?(connection.siteId?'SharePoint verbunden':'OneDrive verbunden'):cloudState}</p>
  <div className="cloud-provider-grid">
   <div className="cloud-provider"><strong>Google Drive</strong><button disabled={busy} onClick={()=>void authorizeGoogle()}>{connection?.provider==='google'?'Erneut verbinden':'Verbinden'}</button></div>
   <div className="cloud-provider"><strong>OneDrive</strong><small>Privat, Arbeit oder Schule</small><button disabled={busy||!msClientId.trim()} onClick={()=>void authorizeMicrosoft()}>{connection?.provider==='microsoft'&&!connection.siteId?'Erneut verbinden':'Verbinden'}</button></div>
   <div className="cloud-provider"><strong>SharePoint</strong><label>Website-Adresse<input type="url" value={sharePointUrl} onChange={e=>setSharePointUrl(e.target.value)} placeholder="https://firma.sharepoint.com/sites/lernen"/></label><small>Microsoft fragt zusätzlich Leserechte für Websites an. Schreibzugriff wird für den App-Ordner verwendet.</small><button disabled={busy||!msClientId.trim()||!sharePointUrl.trim()} onClick={()=>void authorizeMicrosoft(sharePointUrl)}>Verbinden</button></div>
  </div>
  {!msClientId.trim()&&<p className="cloud-setup-note">Die Microsoft-Anmeldung muss einmal eingerichtet werden.</p>}
  <details className="settings-secondary"><summary>Microsoft-Anmeldung einrichten</summary><label>Anwendungs-ID (Client-ID)<input value={msClientId} onChange={e=>setMsClientId(e.target.value.trim())} placeholder="Microsoft-Entra-Anwendungs-ID"/></label><p className="muted">Öffentliche ID einer Entra-SPA für private und geschäftliche Konten. Kein Client-Secret eingeben.</p></details>
  {connection&&<div className="action-row"><button disabled={syncing||busy} onClick={()=>void sync()}>{syncing?'Synchronisiere …':'Jetzt synchronisieren'}</button><button disabled={busy} onClick={disconnectCloud}>Verbindung trennen</button></div>}
 </div>
 <div className="setting-group">
  <div className="settings-title"><h2>KI-Erkennung</h2><Help text="Für die Fotoanalyse wird dein eigener OpenAI-API-Key verwendet. Der Schlüssel bleibt nur bis zum Neuladen im Arbeitsspeicher. Ein eingegebener Schlüssel ist für Browser-Skripte zugänglich; für stärkeren Schutz ist eine geschützte serverseitige Ablage erforderlich."/></div>
  <label htmlFor="openai-key">OpenAI-API-Key</label>
  <div className="key-field">
   <input id="openai-key" type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" value={aiKey} onChange={e=>setAiKey(e.target.value.trim())}/>
   <button type="button" className="key-delete" aria-label="Gespeicherten API-Key löschen" title="API-Key löschen" disabled={!aiKey} onClick={()=>{setAiKey('');sessionStorage.removeItem(API_SESSION);localStorage.removeItem(API_LOCAL)}}><UiIcon kind="trash"/></button>
  </div>
  <div className="ai-preferences">
   <label className="model-choice">Modell<select value={aiModel} onChange={e=>setAiModel(e.target.value)}>
    <option value="gpt-4.1-mini">GPT-4.1 mini</option><option value="gpt-4o-mini">GPT-4o mini</option><option value="gpt-4.1">GPT-4.1</option><option value="gpt-4o">GPT-4o</option>
   </select></label>
   <p className="key-memory-note">Nur bis zum Neuladen · wird nicht dauerhaft auf diesem Gerät gespeichert.</p>
  </div>
 </div>
 <div className="setting-group">
  <div className="settings-title"><h2>Lernen</h2><Help text="Standardmässig wird von deiner Muttersprache in die zu lernende Sprache abgefragt. Die Richtung lässt sich in jedem Lernset ändern; gemischte Abfrage ist optional."/></div>
  <label>Muttersprache<input value={nativeLanguage} onChange={e=>setNativeLanguage(e.target.value)} placeholder="z. B. Deutsch"/></label>
 </div>
 <details className="settings-secondary"><summary>Erweitert & Backup</summary>
  <label>Eigener KI-Dienst (optional) <Help text="Die Adresse ersetzt ausschliesslich den Dienst für den Fotoimport. Der eingegebene API-Schlüssel wird an diesen Dienst gesendet. Der Server muss POST /api/extract unterstützen, dieselbe Antwortstruktur liefern und Anfragen dieser Website über CORS erlauben. Google-Login und Synchronisation bleiben beim Open-Learning-Anmeldedienst. Ohne eigene URL gilt der Standarddienst."/></label>
  <div className="worker-url-row"><input type="url" aria-label="Adresse des eigenen KI-Dienstes" autoComplete="off" spellCheck={false} placeholder="https://mein-worker.workers.dev" value={workerOverride} onChange={e=>{const v=e.target.value.trim();setWorkerOverride(v);if(v)localStorage.setItem('ol-ai-worker-override',v);else localStorage.removeItem('ol-ai-worker-override')}}/>{workerOverride&&<button type="button" onClick={()=>{setWorkerOverride('');localStorage.removeItem('ol-ai-worker-override')}}>Standard</button>}</div>
  <div className="action-row"><button onClick={()=>download('open-learning-backup.json',JSON.stringify(lib,null,2))}>Backup exportieren</button><label className="backup-import">Backup importieren<input type="file" accept="application/json" onChange={async e=>{const f=e.target.files?.[0];if(f)restore(f)}}/></label></div>
  <Help text="Backups enthalten deine Fächer, Lernsets und Lernversuche, aber keine Anmeldetokens oder KI-API-Keys. Der Import führt vorhandene Daten zusammen."/>
 </details>
 </section>}
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
function Help({text}:{text:string}){
 return <details className="info-popover"><summary aria-label="Information anzeigen" title="Information"><UiIcon kind="info"/></summary><div className="info-popup" role="note"><p>{text}</p></div></details>
}
function UiIcon({kind}:{kind:'home'|'camera'|'settings'|'book'|'chevron'|'back'|'edit'|'info'|'trash'}){
 const path={
 home:<><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></>,
 camera:<><path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></>,
 settings:<><path d="M10.5 2h3l.5 2.2 1.8.8 1.9-1.3 2.1 2.1-1.3 1.9.8 1.8 2.2.5v3l-2.2.5-.8 1.8 1.3 1.9-2.1 2.1-1.9-1.3-1.8.8-.5 2.2h-3l-.5-2.2-1.8-.8-1.9 1.3-2.1-2.1 1.3-1.9-.8-1.8-2.2-.5v-3l2.2-.5.8-1.8-1.3-1.9 2.1-2.1 1.9 1.3 1.8-.8z"/><circle cx="12" cy="12" r="3.2"/></>,
 book:<><path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 1-2-2z"/><path d="M4 17a2 2 0 0 1 2-2h13"/></>,
 chevron:<path d="m9 6 6 6-6 6"/>,
 back:<path d="m15 18-6-6 6-6"/>,
 edit:<><path d="M12 20h9"/><path d="M16.5 3.5a2 2 0 0 1 3 3L8 18l-5 1 1-5Z"/></>,
 info:<><circle cx="12" cy="12" r="10"/><path d="M12 11v5"/><path d="M12 7h.01"/></>,
 trash:<><path d="M4 7h16M10 4h4l1 3H9l1-3ZM7 7l1 14h8l1-14M10 11v7M14 11v7"/></>,
 }[kind];
 return <svg className="ui-icon" aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
}
function SetPicker({sets,selected,setSelected}:{sets:SetData[];selected:string;setSelected:(s:string)=>void}){return <label>Lernset <select value={selected} onChange={e=>setSelected(e.target.value)}>{sets.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
createRoot(document.getElementById('root')!).render(<App/>);


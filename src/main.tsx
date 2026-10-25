import React,{useEffect,useMemo,useState} from 'react';import{createRoot}from'react-dom/client';import './style.css';
import{type Library,type SetData,type Item,type Attempt,uid,normalize,possibleAnswers,mergeLibraries}from './model';
import{loadLocal,saveLocal}from './local';import{startLogin,finishLogin,connectGoogleDrive,type Provider,type OAuthConfig}from './oauth';import{readCloud,writeCloud,type Connection,ConflictError}from './cloud';
import { recognizeImage, pairCandidates } from './ocr';
type Task={item:Item;setId:string;direction:'front-back'|'back-front'};
const config:OAuthConfig={googleClientId:import.meta.env.VITE_GOOGLE_CLIENT_ID||'',microsoftClientId:import.meta.env.VITE_MICROSOFT_CLIENT_ID||''};
const download=(filename:string,data:string)=>{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function App(){
 const [lib,setLib]=useState<Library|null>(null),[tab,setTab]=useState<'home'|'subject'|'set'|'edit'|'learn'|'settings'|'import'>('home');
 const [selected,setSelected]=useState('unite2'),[selectedSubject,setSelectedSubject]=useState('french'),[connection,setConnection]=useState<Connection|null>(null),[cloudState,setCloudState]=useState('Nicht verbunden');
 const [subjectName,setSubjectName]=useState(''),[setName,setSetName]=useState(''),[direction,setDirection]=useState<'mixed'|'front-back'|'back-front'>('mixed');
 const [studyMode,setStudyMode]=useState<'flip'|'write'|'test'>('flip'),[revealed,setRevealed]=useState(false);
 const [tasks,setTasks]=useState<Task[]>([]),[pos,setPos]=useState(0),[answer,setAnswer]=useState(''),[attempt,setAttempt]=useState(1),[stage,setStage]=useState<'ask'|'hint'|'correct'|'wrong'|'done'>('ask'),[roundResults,setRoundResults]=useState<Attempt[]>([]);
 const [draft,setDraft]=useState<Item[]>([]),[image,setImage]=useState<string|null>(null),[importText,setImportText]=useState(''),[importStatus,setImportStatus]=useState('');
 const [newSetTitle,setNewSetTitle]=useState(''),[targetSubject,setTargetSubject]=useState('french'),[ocrLanguages,setOcrLanguages]=useState('fra+deu'),[ocrProgress,setOcrProgress]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const [notice,setNotice]=useState('');
 const configuredWorker=import.meta.env.VITE_AI_WORKER_URL||'https://open-learning-ai.andineck.workers.dev';
 const [workerOverride,setWorkerOverride]=useState(()=>localStorage.getItem('ol-ai-worker-override')||'');
 const workerUrl=workerOverride||configuredWorker;
 const [aiKey,setAiKey]=useState(''),[aiModel,setAiModel]=useState('gpt-4.1-mini');
 const [aiMode,setAiMode]=useState<'auto'|'translation'|'qa'>('auto');
 useEffect(()=>{loadLocal().then(setLib).catch(e=>setError(String(e)))},[]);
 useEffect(()=>{if(lib)saveLocal(lib).catch(e=>setError('Lokales Speichern fehlgeschlagen: '+String(e)))},[lib]);
 useEffect(()=>{finishLogin(config).then(c=>{if(c){setConnection({provider:c.provider,token:c.accessToken});setCloudState(c.provider==='google'?'Google Drive verbunden':'OneDrive verbunden');setTab('settings')}}).catch(e=>setError('Anmeldung: '+e.message))},[]);
 const sets=lib?.sets||[],currentSet=sets.find(s=>s.id===selected)||sets[0],subject=lib?.subjects.find(s=>s.id===currentSet?.subjectId);
 const activeSubject=lib?.subjects.find(x=>x.id===selectedSubject)||subject||lib?.subjects[0];
 const subjectSets=sets.filter(s=>s.subjectId===activeSubject?.id);
 function openSubject(id:string){setSelectedSubject(id);setTab('subject');setNotice('')}
 function openSet(id:string){setSelected(id);setTab('set');setNotice('')}
 function openImport(){setTargetSubject(currentSet?.subjectId||activeSubject?.id||'french');setTab('import')}
 const subjectIcon=(name:string)=>/franz/i.test(name)?'🇫🇷':/engl/i.test(name)?'🇬🇧':/geschicht/i.test(name)?'🏛️':/bio/i.test(name)?'🌱':/geo/i.test(name)?'🌍':/mathe/i.test(name)?'∑':'📚';
 function modify(fn:(d:Library)=>Library){setLib(old=>old?{...fn(old),updatedAt:new Date().toISOString()}:old);setNotice('Lokal gespeichert – Cloud-Synchronisation separat ausführen.')}
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
 function addSubject(){if(!subjectName.trim())return;const id=uid();modify(d=>({...d,subjects:[...d.subjects,{id,name:subjectName.trim()}]}));setSubjectName('');setSelectedSubject(id);setTab('subject')}
 function addSet(){if(!setName.trim()||!activeSubject)return;const s:SetData={id:uid(),subjectId:activeSubject.id,title:setName.trim(),items:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};modify(d=>({...d,sets:[...d.sets,s]}));setSelected(s.id);setSetName('');setTab('set')}
 function parseText(){const rows=importText.split('\n').filter(Boolean).map(line=>{const cells=line.includes('\t')?line.split('\t'):line.split(';');return{ id:uid(),front:(cells[0]||'').trim(),back:(cells.slice(1).join(';')||'').trim(),kind:'translation' as const}}).filter(x=>x.front&&x.back);setDraft(rows);setImportStatus(rows.length+' Vorschläge erkannt. Bitte kontrollieren.')}
 async function importPhoto(file:File){if(image)URL.revokeObjectURL(image);setImage(URL.createObjectURL(file));setImportStatus('Foto bereit. «Text aus Foto erkennen» arbeitet direkt auf diesem Gerät.');setDraft([]);}
 async function extractWithAI(){
   if(!image){setImportStatus('Bitte zuerst ein Foto auswählen.');return}
   if(!workerUrl||!aiKey){setImportStatus('Bitte zuerst unter Einstellungen die Worker-URL und einen API-Key für diese Sitzung eingeben.');return}
   if(!/^https:\/\//i.test(workerUrl)){setImportStatus('Für den KI-Dienst ist HTTPS erforderlich.');return}
   setBusy(true);
   try{
     const imageBlob=await (await fetch(image)).blob();
     const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('Foto konnte nicht gelesen werden'));r.readAsDataURL(imageBlob)});
     const endpoint=workerUrl.replace(/\/+$/,'')+'/api/extract';
     const reply=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-OpenAI-Key':aiKey},body:JSON.stringify({image:dataUrl,subject:lib?.subjects.find(x=>x.id===targetSubject)?.name||subject?.name||'Lernstoff',mode:aiMode,model:aiModel})});
     const response=await reply.json().catch(()=>({error:'Keine gültige Antwort des KI-Dienstes'}));
     if(!reply.ok)throw Error(response.error||('HTTP '+reply.status));
     if(!Array.isArray(response.items))throw Error('Keine Lernkarten vom KI-Dienst erhalten');
     const proposals:Item[]=response.items.map((x:{front:string;back:string;kind:string})=>({id:uid(),front:String(x.front||''),back:String(x.back||''),kind:x.kind==='qa'?'qa':'translation'})).filter((x:Item)=>x.front.trim()&&x.back.trim());
     setDraft(proposals);
     setImportStatus(proposals.length+' Karten vorgeschlagen. Bitte kontrollieren und erst danach speichern.');
   }catch(e){setImportStatus('KI-Import fehlgeschlagen: '+String(e))}
   finally{setBusy(false)}
 }
 async function extractOnDevice(){
  if(!image){setImportStatus('Bitte zuerst ein Foto machen.');return}
  setBusy(true);setOcrProgress(0);
  try {
    const result=await recognizeImage(image,ocrLanguages.split('+'),v=>setOcrProgress(v));
    setImportText(result);
    const entries=pairCandidates(result);
    setDraft(entries.map(([front,back])=>({id:uid(),front,back,kind:'translation'})));
    setImportStatus(entries.length?entries.length+' mögliche Paare erkannt. Bitte jedes Paar kontrollieren und fehlende Zeilen im Textfeld ergänzen.':'Text erkannt, aber keine sicheren Wortpaare. Bitte den erkannten Text im Feld korrigieren und mit Semikolon zwischen Frage und Antwort trennen.');
  }catch(e){setImportStatus('Erkennung fehlgeschlagen: '+String(e)+'. Du kannst die Liste weiterhin als Text einfügen.')}finally{setBusy(false)}
 }
 function approveDraft(){
   const good=draft.filter(x=>x.front.trim()&&x.back.trim());if(!good.length)return;
   if(newSetTitle.trim()){
     const now=new Date().toISOString();const id=uid();
     const s:SetData={id,subjectId:targetSubject,title:newSetTitle.trim(),items:good,createdAt:now,updatedAt:now};
     modify(d=>({...d,sets:[...d.sets,s]}));setSelected(id);setNewSetTitle('');
   }else{
     if(!currentSet)return;
     updateSet(s=>({...s,items:[...s.items,...good]}));
   }
   setDraft([]);if(image)URL.revokeObjectURL(image);setImage(null);setImportText('');setTab('edit');
 }
 async function sync(){if(!connection||!lib)return;setBusy(true);setError('');try{const remote=await readCloud(connection);const merged=remote.data?mergeLibraries(lib,remote.data):lib;const saved=await writeCloud(remote.connection,merged);setLib(merged);setConnection(saved);setCloudState('Synchronisiert: '+new Date().toLocaleTimeString());setNotice('Cloud und Gerät synchronisiert.')}catch(e){setError((e instanceof ConflictError?'Speicherkonflikt: ':'Cloud-Fehler: ')+String(e));setCloudState('Synchronisation fehlgeschlagen')}finally{setBusy(false)}}
 async function restore(file:File){try{const d=JSON.parse(await file.text());if(d.schema!==1||!Array.isArray(d.sets)||!Array.isArray(d.attempts)||!Array.isArray(d.subjects))throw Error('Ungültiges Format');modify(x=>mergeLibraries(x,d));setNotice('Importiertes Backup lokal zusammengeführt.')}catch(e){setError('Backup-Import fehlgeschlagen: '+String(e))}}
 const correctCount=roundResults.filter(r=>r.correct).length;
 const successRate=roundResults.length?correctCount/roundResults.length:0;
 const fireConfetti=roundResults.length>0&&successRate>5/6;
 const celebrationTitle=successRate===1?'Wahnsinn – alles richtig!':fireConfetti?'Fantastisch gemacht!':successRate>=0.6?'Richtig gut drangeblieben!':'Stark, dass du geübt hast!';
 const celebrationMessage=successRate===1?'Das war eine perfekte Runde. Dein Einsatz hat sich gelohnt!':fireConfetti?'Über fünf Sechstel richtig – das ist eine richtig starke Leistung!':successRate>=0.6?'Du hast schon viel geschafft. Mit jeder Runde wirst du sicherer.':'Jedes geübte Wort zählt. Die schwierigen Karten machen wir beim nächsten Mal leichter!';
  const stats=useMemo(()=>{if(!lib)return[];return lib.sets.map(s=>{const rs=lib.attempts.filter(r=>r.setId===s.id);const last=new Map(rs.map(r=>[r.itemId+'|'+r.direction,r]));const mastered=[...last.values()].filter(r=>r.correct&&r.attempts===1).length;return{id:s.id,total:s.items.length,tries:rs.length,mastered}})},[lib]);
 if(!lib)return <main><p>Open Learning wird geladen …</p></main>;
 return <main>
 <header className="app-header">
  <div className="brand-group"><span className="brand-mark" aria-hidden="true">✦</span><div><strong className="brand">open learning<span className="brand-dot">.</span></strong><p className="muted">Lernen, das bleibt.</p></div></div>
  <span className="pill"><span className="status-dot"/> {connection?connection.provider==='google'?'Google Drive':'OneDrive':'Nur dieses Gerät'}</span>
 </header>
 <nav className="main-nav" aria-label="Hauptnavigation">
  <button onClick={()=>setTab('home')} className={tab==='home'?'active':''}><span aria-hidden="true">⌂</span> Übersicht</button>
  <button onClick={openImport} className={tab==='import'?'active':''}><span aria-hidden="true">◎</span> Importieren</button>
  <button onClick={()=>{if(currentSet)setTab('edit');else setTab('home')}} className={tab==='edit'?'active':''}><span aria-hidden="true">▤</span> Lernkarten</button>
  <button onClick={()=>setTab('settings')} className={tab==='settings'?'active':''}><span aria-hidden="true">⚙</span> Einstellungen</button>
 </nav>
 {error&&<div role="alert" className="error"><span>{error}</span><button onClick={()=>setError('')}>Schliessen</button></div>}{notice&&<p className="muted" role="status">{notice}</p>}
 {tab==='home'&&<div className="page-stack">
 <section className="hero compact-hero"><div className="hero-copy">
  <span className="eyebrow">DEIN LERNRAUM</span><h1>Was möchtest du heute <em>lernen?</em></h1>
  <p>Wähle ein Fach, öffne dein Lernset und lerne Schritt für Schritt.</p>
  <button className="hero-action" onClick={openImport}>◎ &nbsp; Lernstoff fotografieren <span aria-hidden="true">↗</span></button>
 </div><div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-card hero-card-back">A → B</div><div className="hero-card hero-card-front"><span>bonjour</span><small>guten Tag ✦</small></div></div></section>
 <section className="content-panel">
  <div className="section-heading"><div><span className="eyebrow">DEINE BIBLIOTHEK</span><h2>Fächer</h2><p className="muted">Wähle ein Fach, um seine Lernsets zu sehen.</p></div><span className="overview-count">{lib.subjects.length} Fächer · {sets.length} Lernsets</span></div>
  <div className="subject-directory">{lib.subjects.map((sub,i)=><button className="subject-tile" key={sub.id} onClick={()=>openSubject(sub.id)}>
   <span className="subject-tile-icon">{subjectIcon(sub.name)}</span>
   <span className="subject-tile-info"><strong>{sub.name}</strong><small>{sets.filter(x=>x.subjectId===sub.id).length} Lernsets</small></span>
   <span className="tile-arrow" aria-hidden="true">→</span>
  </button>)}</div>
  <details className="create-panel"><summary>+ Neues Fach hinzufügen</summary><form className="inline-create" onSubmit={e=>{e.preventDefault();addSubject()}}><input value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="Zum Beispiel Geschichte" aria-label="Fachname"/><button className="primary" disabled={!subjectName.trim()}>Fach erstellen</button></form></details>
 </section>
 <div className="stat-grid"><div className="stat-tile"><span>▤ LERNSETS</span><strong>{sets.length}</strong><small>Bereit zum Üben</small></div><div className="stat-tile"><span>✎ LERNVERSUCHE</span><strong>{total}</strong><small>Jeder Versuch zählt</small></div><div className="stat-tile"><span>◈ FÄCHER</span><strong>{lib.subjects.length}</strong><small>Alles an einem Ort</small></div></div>
 </div>}
 {tab==='subject'&&activeSubject&&<div className="page-stack">
  <div className="breadcrumb"><button onClick={()=>setTab('home')}>Alle Fächer</button><span>›</span><strong>{activeSubject.name}</strong></div>
  <section className="content-panel"><div className="section-heading"><div><span className="subject-tile-icon">{subjectIcon(activeSubject.name)}</span><span className="eyebrow">FACH</span><h1>{activeSubject.name}</h1><p className="muted">{subjectSets.length} Lernsets · Wähle ein Lernset zum Üben oder Bearbeiten.</p></div><button className="subtle-button" onClick={openImport}>◎ Lernstoff fotografieren</button></div>
   {subjectSets.length?<div className="set-directory">{subjectSets.map(st=><button className="set-tile" key={st.id} onClick={()=>openSet(st.id)}>
    <span className="set-tile-symbol" aria-hidden="true">▤</span><span className="set-tile-info"><strong>{st.title}</strong><small>{st.items.length} Lernkarten · {lib.attempts.filter(r=>r.setId===st.id).length} Lernversuche</small></span><span className="tile-arrow" aria-hidden="true">→</span>
   </button>)}</div>:<div className="empty-state"><span>📚</span><h3>Hier ist noch Platz für Neues.</h3><p>Erstelle dein erstes Lernset oder fotografiere eine Schulbuchseite.</p><button onClick={openImport}>Foto importieren</button></div>}
   <details className="create-panel"><summary>+ Neues Lernset in {activeSubject.name}</summary><form className="inline-create" onSubmit={e=>{e.preventDefault();addSet()}}><input value={setName} onChange={e=>setSetName(e.target.value)} placeholder="Zum Beispiel Unité 3" aria-label="Titel des Lernsets"/><button className="primary" disabled={!setName.trim()}>Lernset erstellen</button></form></details>
  </section>
 </div>}
 {tab==='set'&&currentSet&&<div className="page-stack">
  <div className="breadcrumb"><button onClick={()=>setTab('home')}>Alle Fächer</button><span>›</span><button onClick={()=>openSubject(currentSet.subjectId)}>{subject?.name}</button><span>›</span><strong>{currentSet.title}</strong></div>
  <section className="focus-panel set-detail">
   <span className="eyebrow">LERNSET · {subject?.name}</span><h1>{currentSet.title}</h1><p className="muted">{currentSet.items.length} Lernkarten · {lib.attempts.filter(r=>r.setId===currentSet.id).length} Lernversuche</p>
   <div className="method-title"><h2>Wie möchtest du lernen?</h2><p className="muted">Wähle deine Lernmethode und die Richtung.</p></div>
   <div className="method-grid">
    {([['flip','▤','Karten aufdecken','Antwort ansehen und selbst bewerten'],['write','✎','Schreibtraining','Schreiben, Hinweis, zweiter Versuch'],['test','✓','Lernkontrolle','Wie eine Prüfung, ohne Hilfen']] as const).map(([value,symbol,name,description])=><button key={value} aria-pressed={studyMode===value} className={'method-tile '+(studyMode===value?'chosen':'')} onClick={()=>setStudyMode(value)}><span className="method-symbol">{symbol}</span><strong>{name}</strong><small>{description}</small></button>)}
   </div>
   <div className="direction-choice"><label>Abfragerichtung<select value={direction} onChange={e=>setDirection(e.target.value as typeof direction)}><option value="mixed">Beide Richtungen gemischt</option><option value="front-back">A → B</option><option value="back-front">B → A</option></select></label></div>
   <div className="action-row"><button className="primary" disabled={!currentSet.items.length} onClick={()=>startPractice()}>▶ Lernen starten</button><button onClick={()=>setTab('edit')}>Lernkarten bearbeiten</button><button onClick={()=>{setTargetSubject(currentSet.subjectId);openImport()}}>+ Karten hinzufügen</button></div>
   {!currentSet.items.length&&<p className="muted">Dieses Lernset ist noch leer. Erstelle zuerst Karten oder importiere ein Foto.</p>}
  </section>
 </div>}
 {tab==='edit'&&<section><div className="breadcrumb"><button onClick={()=>openSet(currentSet?.id||selected)}>← Lernset</button><span>›</span><strong>Karten bearbeiten</strong></div><h1>Einträge kontrollieren</h1><SetPicker sets={sets} selected={selected} setSelected={setSelected}/>{currentSet?.items.map((item,i)=><div className="entry" key={item.id}><span>{i+1}</span><input aria-label="Vorderseite" value={item.front} onChange={e=>updateSet(s=>({...s,items:s.items.map(x=>x.id===item.id?{...x,front:e.target.value}:x)}))}/><input aria-label="Rückseite" value={item.back} onChange={e=>updateSet(s=>({...s,items:s.items.map(x=>x.id===item.id?{...x,back:e.target.value}:x)}))}/><button aria-label="Eintrag löschen" onClick={()=>{if(confirm('Eintrag wirklich löschen?'))updateSet(s=>({...s,items:s.items.filter(x=>x.id!==item.id)}))}}>×</button></div>)}<button onClick={()=>updateSet(s=>({...s,items:[...s.items,{id:uid(),front:'',back:'',kind:'translation'}]}))}>+ Eintrag</button><button className="primary" onClick={()=>startPractice()}>Lernen</button></section>}

 {tab==='import'&&<section>
 <h1>📷 Foto → Lernkarten</h1>
 <p>Fotografiere eine gut beleuchtete Buchseite. Die Texterkennung läuft direkt auf deinem Smartphone – ohne API-Schlüssel. Die Zuordnung von zwei Spalten ist ein Vorschlag und muss geprüft werden.</p>
 <label>Neues Kartenset (optional; leer lassen, um das ausgewählte Set zu ergänzen)
  <input value={newSetTitle} onChange={e=>setNewSetTitle(e.target.value)} placeholder="z. B. Französisch – Unité 3"/>
 </label>
 {newSetTitle.trim()?<label>Fach<select value={targetSubject} onChange={e=>setTargetSubject(e.target.value)}>{lib.subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>:<SetPicker sets={sets} selected={selected} setSelected={setSelected}/>}
 <label>Sprache des Buchtextes
 <select value={ocrLanguages} onChange={e=>setOcrLanguages(e.target.value)}>
  <option value="fra+deu">Französisch + Deutsch</option>
  <option value="eng+deu">Englisch + Deutsch</option>
  <option value="deu">Deutsch (z. B. Geschichte)</option>
  <option value="eng">Englisch</option>
 </select></label>
 <label>Foto aufnehmen oder Bild auswählen
 <input type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)importPhoto(f)}}/></label>
 {image&&<div className="photo-panel"><img className="preview" src={image} alt="Fotografierte Lernseite"/>
  <label>KI-Erkennung
   <select value={aiMode} onChange={e=>setAiMode(e.target.value as typeof aiMode)}>
    <option value="auto">Automatisch (Vokabeln oder Wissensfragen)</option>
    <option value="translation">Vokabelpaare</option>
    <option value="qa">Fragen und Antworten (z.B. Geschichte)</option>
   </select>
  </label>
  <button className="primary" disabled={busy||!workerUrl||!aiKey} onClick={extractWithAI}>{busy?'KI analysiert …':'✨ Foto mit KI analysieren'}</button>
  {(!workerUrl||!aiKey)&&<p className="hint">KI noch nicht verbunden: Unter <button onClick={()=>setTab('settings')}>Einstellungen → KI-Verbindung</button> Worker-URL und API-Key eingeben.</p>}
  <details><summary>Alternative: einfache Texterkennung ohne KI (OCR)</summary>
   <p>Nur für klar strukturierte Tabellen empfohlen; Zuordnung muss manuell geprüft werden.</p>
   <button disabled={busy} onClick={extractOnDevice}>Text lokal erkennen</button>
   {busy&&<progress value={ocrProgress} max="100" aria-label="Fortschritt der Texterkennung"/>}
  </details>
 </div>}
 <label>Erkannter Text / Textimport
 <textarea rows={8} value={importText} onChange={e=>setImportText(e.target.value)} placeholder={'Bonjour;Guten Tag\nMerci;Danke'}/></label>
 <p className="muted">Für die automatische Paarbildung sollten die Zeilen zwei Spalten haben, getrennt durch Tabulator, Semikolon oder deutlich breiten Abstand. Du kannst die OCR-Ausgabe vor dem Erstellen bearbeiten.</p>
 <button onClick={parseText} disabled={!importText.trim()}>Aus dem Text Karten vorschlagen</button>
 {importStatus&&<p role="status" className="hint">{importStatus}</p>}
 {draft.length>0&&<div className="panel"><h2>✅ Kontrolle vor dem Speichern ({draft.length})</h2>
 <p>Frage und Antwort bearbeiten, falsche Paare entfernen und erst dann bestätigen.</p>
 {draft.map((item,i)=><div className="entry" key={item.id}><span>{i+1}</span>
 <input aria-label="Vorschlag Vorderseite" value={item.front} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,front:e.target.value}:x))}/>
 <input aria-label="Vorschlag Rückseite" value={item.back} onChange={e=>setDraft(d=>d.map(x=>x.id===item.id?{...x,back:e.target.value}:x))}/>
 <button aria-label="Vorschlag entfernen" onClick={()=>setDraft(d=>d.filter(x=>x.id!==item.id))}>×</button></div>)}
 <button onClick={()=>setDraft(d=>[...d,{id:uid(),front:'',back:'',kind:'translation'}])}>+ Eintrag ergänzen</button>
 <button className="primary" onClick={approveDraft}>Geprüfte Karten {newSetTitle.trim()?'als neues Set speichern':'zum Set hinzufügen'}</button>
 <button onClick={()=>setDraft([])}>Vorschläge verwerfen</button></div>}
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
 <div className="learning-card"><span className="eyebrow">{task.direction==='front-back'?'SEITE A → B':'SEITE B → A'}</span><h1>{prompt}</h1>
 {studyMode==='flip'?<div className="reveal-area">{revealed?<><div className="divider-short"/><span className="eyebrow">LÖSUNG</span><h2>{expected}</h2><p>Hattest du die richtige Antwort im Kopf?</p><div className="rating-grid"><button className="rate-wrong" onClick={()=>rateFlip(false)}>✕ &nbsp; Noch nicht</button><button className="rate-correct" onClick={()=>rateFlip(true)}>✓ &nbsp; Gewusst!</button></div></>:<button className="reveal-button" onClick={()=>setRevealed(true)}>Antwort aufdecken <span aria-hidden="true">↻</span></button>}</div>
 :<div className="answer-area"><p className="muted">{studyMode==='test'?'Prüfungsmodus: ein Versuch, keine Hinweise.':attempt===1?'Schreibe deine Antwort. Du hast zwei Versuche.':'Zweiter Versuch'}</p>
 {stage==='hint'&&<div className="hint">💡 {hint()}</div>}
 {(stage==='ask'||stage==='hint')?<form onSubmit={e=>{e.preventDefault();check()}}><input autoFocus value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Deine Antwort eingeben …" aria-label="Deine Antwort"/><button className="primary" disabled={!answer.trim()}>Antwort prüfen →</button></form>:<><div className={stage==='correct'?'success':'error'}><strong>{stage==='correct'?'🎉 Richtig!':'Noch nicht ganz.'}</strong><p>Lösung: {options.join(' / ')}</p>{stage==='wrong'&&<p>Deine Antwort: {answer}</p>}</div><button className="primary" onClick={next}>Nächste Karte →</button></>}
 </div>}</div></>:<p>Keine Aufgaben in diesem Lernset.</p>}</section>}
 {tab==='settings'&&<section><h1>Eigener Cloud-Speicher</h1><p>Synchronisiere deine Lerninhalte und Versuche über Google Drive oder OneDrive. Keine zentrale Datenbank.</p><div className="two"><button disabled={!config.googleClientId} onClick={()=>connectGoogleDrive(config).then(c=>{setConnection({provider:'google',token:c.accessToken});setCloudState('Google Drive verbunden');setError('')}).catch(e=>setError('Anmeldung: '+e.message))}>Mit Google Drive verbinden</button><button disabled={!config.microsoftClientId} onClick={()=>startLogin('microsoft',config).catch(e=>setError(e.message))}>Mit OneDrive verbinden</button></div>{(!config.googleClientId||!config.microsoftClientId)&&<p className="muted">OAuth Client-IDs fehlen noch. Anleitung in docs/setup.md. Die Buttons werden nach der Konfiguration aktiviert.</p>}<p><strong>Status:</strong> {cloudState}</p>{connection&&<><button className="primary" disabled={busy} onClick={sync}>{busy?'Synchronisiert …':'Cloud synchronisieren'}</button><button onClick={()=>{setConnection(null);setCloudState('Nicht verbunden')}}>Verbindung trennen</button></>}<h2>✨ KI-Verbindung (BYO OpenAI)</h2>
 <p>Gib deinen eigenen OpenAI-API-Key ein, um aus Fotos automatisch Lernkarten erstellen zu lassen. Der Key wird nicht dauerhaft gespeichert; nach einem Neustart musst du ihn erneut eingeben.</p>
 {!configuredWorker&&!workerOverride&&<p className="hint">Die KI-Verbindung wurde vom Betreiber noch nicht aktiviert. Lernkarten und Cloud-Speicher funktionieren weiterhin ohne KI.</p>}
 <label>Persönlicher OpenAI-API-Key (nur diese Sitzung)
  <input type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" value={aiKey} onChange={e=>setAiKey(e.target.value.trim())}/>
 </label>
 <label>KI-Modell
  <select value={aiModel} onChange={e=>setAiModel(e.target.value)}>
   <option value="gpt-4.1-mini">GPT-4.1 mini (Standard)</option><option value="gpt-4o-mini">GPT-4o mini</option>
   <option value="gpt-4.1">GPT-4.1</option><option value="gpt-4o">GPT-4o</option>
  </select>
 </label>
 <button onClick={()=>setAiKey('')}>API-Key aus der Sitzung entfernen</button>
 <p className="muted">Sicherheit: Dein Schlüssel wird für die Bildanalyse über HTTPS an den KI-Dienst übertragen und ist während der Sitzung im Browser verfügbar. Verwende einen separaten API-Projektschlüssel mit kleinem Budget. Der Betreiber des KI-Dienstes könnte Anfragen und Schlüssel technisch einsehen.</p>
 <details><summary>Erweitert: eigenen KI-Dienst verwenden (Self-Hosting)</summary>
  <label>Alternative Worker-Adresse (optional)<input type="url" autoComplete="off" spellCheck={false} placeholder="https://mein-worker.workers.dev" value={workerOverride} onChange={e=>{const v=e.target.value.trim();setWorkerOverride(v);if(v)localStorage.setItem('ol-ai-worker-override',v);else localStorage.removeItem('ol-ai-worker-override')}}/></label>
  <p className="muted">Nur für fortgeschrittene Benutzer. Standardmässig verwendet Open Learning den zentralen Dienst, sobald dieser eingerichtet ist.</p>
 </details>
 <h2>Backup</h2><button onClick={()=>download('open-learning-backup.json',JSON.stringify(lib,null,2))}>JSON exportieren</button><label>JSON importieren<input type="file" accept="application/json" onChange={async e=>{const f=e.target.files?.[0];if(f)restore(f)}}/></label><p className="muted">Cloud-Tokens werden nicht dauerhaft gespeichert. Nach einem Browser-Neustart ist eine neue Anmeldung nötig. Bis zur erfolgreichen Synchronisation sind Änderungen nur auf diesem Gerät.</p></section>}
 <footer>Open Learning · MIT · BYOE · <span>Fotos und Inhalte vor Freigabe prüfen</span></footer></main>
}
function SetPicker({sets,selected,setSelected}:{sets:SetData[];selected:string;setSelected:(s:string)=>void}){return <label>Lernset <select value={selected} onChange={e=>setSelected(e.target.value)}>{sets.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
createRoot(document.getElementById('root')!).render(<App/>);

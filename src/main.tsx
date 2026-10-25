import React,{useEffect,useMemo,useState} from 'react';import{createRoot}from'react-dom/client';import './style.css';
import{type Library,type SetData,type Item,type Attempt,uid,normalize,possibleAnswers,mergeLibraries}from './model';
import{loadLocal,saveLocal}from './local';import{startLogin,finishLogin,type Provider,type OAuthConfig}from './oauth';import{readCloud,writeCloud,type Connection,ConflictError}from './cloud';
import { recognizeImage, pairCandidates } from './ocr';
type Task={item:Item;setId:string;direction:'front-back'|'back-front'};
const config:OAuthConfig={googleClientId:import.meta.env.VITE_GOOGLE_CLIENT_ID||'',microsoftClientId:import.meta.env.VITE_MICROSOFT_CLIENT_ID||''};
const download=(filename:string,data:string)=>{const a=document.createElement('a');const u=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function App(){
 const [lib,setLib]=useState<Library|null>(null),[tab,setTab]=useState<'home'|'edit'|'learn'|'settings'|'import'>('home');
 const [selected,setSelected]=useState('unite2'),[connection,setConnection]=useState<Connection|null>(null),[cloudState,setCloudState]=useState('Nicht verbunden');
 const [subjectName,setSubjectName]=useState(''),[setName,setSetName]=useState(''),[direction,setDirection]=useState<'mixed'|'front-back'|'back-front'>('mixed');
 const [tasks,setTasks]=useState<Task[]>([]),[pos,setPos]=useState(0),[answer,setAnswer]=useState(''),[attempt,setAttempt]=useState(1),[stage,setStage]=useState<'ask'|'hint'|'correct'|'wrong'|'done'>('ask'),[roundResults,setRoundResults]=useState<Attempt[]>([]);
 const [draft,setDraft]=useState<Item[]>([]),[image,setImage]=useState<string|null>(null),[importText,setImportText]=useState(''),[importStatus,setImportStatus]=useState('');
 const [newSetTitle,setNewSetTitle]=useState(''),[targetSubject,setTargetSubject]=useState('french'),[ocrLanguages,setOcrLanguages]=useState('fra+deu'),[ocrProgress,setOcrProgress]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const [notice,setNotice]=useState('');
 useEffect(()=>{loadLocal().then(setLib).catch(e=>setError(String(e)))},[]);
 useEffect(()=>{if(lib)saveLocal(lib).catch(e=>setError('Lokales Speichern fehlgeschlagen: '+String(e)))},[lib]);
 useEffect(()=>{finishLogin(config).then(c=>{if(c){setConnection({provider:c.provider,token:c.accessToken});setCloudState(c.provider==='google'?'Google Drive verbunden':'OneDrive verbunden');setTab('settings')}}).catch(e=>setError('Anmeldung: '+e.message))},[]);
 const sets=lib?.sets||[],currentSet=sets.find(s=>s.id===selected)||sets[0],subject=lib?.subjects.find(s=>s.id===currentSet?.subjectId);
 function modify(fn:(d:Library)=>Library){setLib(old=>old?{...fn(old),updatedAt:new Date().toISOString()}:old);setNotice('Lokal gespeichert – Cloud-Synchronisation separat ausführen.')}
 function updateSet(fn:(s:SetData)=>SetData){if(!currentSet)return;modify(d=>({...d,sets:d.sets.map(s=>s.id===currentSet.id?{...fn(s),updatedAt:new Date().toISOString()}:s)}))}
 const total=lib?.attempts.length||0;
 function startPractice(items?:Task[]){if(!currentSet)return;const q=items||currentSet.items.flatMap(item=>direction==='mixed'&&item.kind==='translation'?[{item,setId:currentSet.id,direction:'front-back' as const},{item,setId:currentSet.id,direction:'back-front' as const}]:[{item,setId:currentSet.id,direction:direction==='back-front'&&item.kind==='translation'?'back-front' as const:'front-back' as const}]);setTasks(q);setPos(0);setAnswer('');setAttempt(1);setStage('ask');setRoundResults([]);setTab('learn');setNotice('')}
 const task=tasks[pos],prompt=task?(task.direction==='front-back'?task.item.front:task.item.back):'',expected=task?(task.direction==='front-back'?task.item.back:task.item.front):'';
 const options=task?[...possibleAnswers(expected),...(task.direction==='front-back'?(task.item.alternatives||[]):[])]:[];
 const correct=options.some(s=>normalize(s)===normalize(answer));
 const hint=()=>{const expectedWord=options[0]||'';if(normalize(answer).length<normalize(expectedWord).length)return 'In deiner Antwort fehlt möglicherweise etwas.';if(normalize(answer).length>normalize(expectedWord).length)return 'Prüfe, ob etwas zu viel geschrieben ist.';return 'Prüfe die Schreibweise und achte auf Akzente und Artikel. Anfangsbuchstabe: '+expectedWord.slice(0,1)};
 function check(){if(!task||!answer.trim())return;if(correct||attempt===2){const r:Attempt={id:uid(),itemId:task.item.id,setId:task.setId,direction:task.direction,correct,attempts:attempt,createdAt:new Date().toISOString()};modify(d=>({...d,attempts:[...d.attempts,r]}));setRoundResults(v=>[...v,r]);setStage(correct?'correct':'wrong')}else{setAttempt(2);setStage('hint');setAnswer('')}}
 function next(){if(pos+1===tasks.length)setStage('done');else{setPos(p=>p+1);setAnswer('');setAttempt(1);setStage('ask')}}
 function addSubject(){if(!subjectName.trim())return;const id=uid();modify(d=>({...d,subjects:[...d.subjects,{id,name:subjectName.trim()}]}));setSubjectName('')}
 function addSet(){if(!setName.trim()||!lib?.subjects.length)return;const s: SetData={id:uid(),subjectId:lib.subjects[0].id,title:setName.trim(),items:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};modify(d=>({...d,sets:[...d.sets,s]}));setSelected(s.id);setSetName('');setTab('edit')}
 function parseText(){const rows=importText.split('\n').filter(Boolean).map(line=>{const cells=line.includes('\t')?line.split('\t'):line.split(';');return{ id:uid(),front:(cells[0]||'').trim(),back:(cells.slice(1).join(';')||'').trim(),kind:'translation' as const}}).filter(x=>x.front&&x.back);setDraft(rows);setImportStatus(rows.length+' Vorschläge erkannt. Bitte kontrollieren.')}
 async function importPhoto(file:File){if(image)URL.revokeObjectURL(image);setImage(URL.createObjectURL(file));setImportStatus('Foto bereit. «Text aus Foto erkennen» arbeitet direkt auf diesem Gerät.');setDraft([]);}
 async function extractWithAI(){if(!image){setImportStatus('Bitte zuerst ein Foto auswählen.');return}setBusy(true);try{const res=await fetch(image);const blob=await res.blob();const reader=new FileReader();const dataUrl=await new Promise<string>((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob)});const reply=await fetch('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:dataUrl})});if(!reply.ok)throw Error((await reply.text()).slice(0,200));const out=await reply.json() as {items:{front:string;back:string;kind?:string}[]};if(!Array.isArray(out.items))throw Error('Ungültige Antwort');setDraft(out.items.map(x=>({id:uid(),front:x.front||'',back:x.back||'',kind:x.kind==='qa'?'qa':'translation'})));setImportStatus('KI-Vorschläge geladen: '+out.items.length+'. Vor dem Speichern bitte kontrollieren.')}catch(e){setImportStatus('KI-Import fehlgeschlagen: '+String(e)+'. Der optionale API-Dienst muss separat laufen.')}finally{setBusy(false)}}
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
 const stats=useMemo(()=>{if(!lib)return[];return lib.sets.map(s=>{const rs=lib.attempts.filter(r=>r.setId===s.id);const last=new Map(rs.map(r=>[r.itemId+'|'+r.direction,r]));const mastered=[...last.values()].filter(r=>r.correct&&r.attempts===1).length;return{id:s.id,total:s.items.length,tries:rs.length,mastered}})},[lib]);
 if(!lib)return <main><p>Open Learning wird geladen …</p></main>;
 return <main><header><div><strong className="brand">✦ Open Learning</strong><p className="muted">Wissen entdecken. Üben. Behalten.</p></div><span className="pill">{connection?connection.provider==='google'?'Google Drive':'OneDrive':'Nur dieses Gerät'}</span></header>
 <nav><button onClick={()=>setTab('home')} className={tab==='home'?'active':''}>Übersicht</button><button onClick={()=>setTab('edit')} className={tab==='edit'?'active':''}>Einträge</button><button onClick={()=>setTab('import')} className={tab==='import'?'active':''}>Import</button><button onClick={()=>setTab('settings')} className={tab==='settings'?'active':''}>Einstellungen</button></nav>
 {error&&<div role="alert" className="error"><span>{error}</span><button onClick={()=>setError('')}>Schliessen</button></div>}{notice&&<p className="muted" role="status">{notice}</p>}
 {tab==='home'&&<section><h1>Meine Lernfächer</h1><p>Wähle ein Lernset und starte dein Training.</p><div className="two"><input placeholder="Neues Fach, z.B. Geschichte" value={subjectName} onChange={e=>setSubjectName(e.target.value)}/><button onClick={addSubject}>Fach hinzufügen</button></div><div className="subjects">{lib.subjects.map(s=><div className="subject" key={s.id}><h3>{s.name}</h3>{sets.filter(x=>x.subjectId===s.id).map(st=><button key={st.id} className={selected===st.id?'active':''} onClick={()=>setSelected(st.id)}>{st.title}</button>)}</div>)}</div><div className="two"><input placeholder="Name des Lernsets" value={setName} onChange={e=>setSetName(e.target.value)}/><button onClick={addSet}>Lernset erstellen</button></div>{currentSet&&<div className="panel"><h2>{subject?.name} · {currentSet.title}</h2><p>{currentSet.items.length} Einträge · {stats.find(x=>x.id===currentSet.id)?.tries||0} Versuche</p><label>Übungsrichtung <select value={direction} onChange={e=>setDirection(e.target.value as typeof direction)}><option value="mixed">Beide Richtungen</option><option value="front-back">Frage → Antwort</option><option value="back-front">Antwort → Frage</option></select></label><button className="primary" onClick={()=>startPractice()} disabled={!currentSet.items.length}>Training starten</button><button onClick={()=>setTab('import')}>Lernstoff importieren</button></div>}<p className="muted">Insgesamt {total} lokal erfasste Versuche. Cloud-Synchronisation unter Einstellungen.</p></section>}
 {tab==='edit'&&<section><h1>Einträge kontrollieren</h1><SetPicker sets={sets} selected={selected} setSelected={setSelected}/>{currentSet?.items.map((item,i)=><div className="entry" key={item.id}><span>{i+1}</span><input aria-label="Vorderseite" value={item.front} onChange={e=>updateSet(s=>({...s,items:s.items.map(x=>x.id===item.id?{...x,front:e.target.value}:x)}))}/><input aria-label="Rückseite" value={item.back} onChange={e=>updateSet(s=>({...s,items:s.items.map(x=>x.id===item.id?{...x,back:e.target.value}:x)}))}/><button aria-label="Eintrag löschen" onClick={()=>{if(confirm('Eintrag wirklich löschen?'))updateSet(s=>({...s,items:s.items.filter(x=>x.id!==item.id)}))}}>×</button></div>)}<button onClick={()=>updateSet(s=>({...s,items:[...s.items,{id:uid(),front:'',back:'',kind:'translation'}]}))}>+ Eintrag</button><button className="primary" onClick={()=>startPractice()}>Lernen</button></section>}

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
 <button className="primary" disabled={busy} onClick={extractOnDevice}>{busy?'Texterkennung läuft …':'🔎 Text aus Foto erkennen'}</button>
 {busy&&<progress value={ocrProgress} max="100" aria-label="Fortschritt der Texterkennung"/>}
 <details><summary>Erweiterte KI-Erkennung (eigener Server)</summary>
 <p>Für unstrukturierte Seiten und Geschichte genauer, benötigt einen separat gesicherten KI-Dienst. Auf GitHub Pages derzeit nicht verfügbar.</p>
 <button disabled={busy} onClick={extractWithAI}>KI-Dienst versuchen</button></details>
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

 {tab==='learn'&&<section>{stage==='done'?<><h1>{roundResults.every(r=>r.correct&&r.attempts===1)?'🎉🎊 Konfettibombe! 🎊🎉':'Runde geschafft! 🎉'}</h1><p>{roundResults.filter(r=>r.correct&&r.attempts===1).length} sofort richtig · {roundResults.filter(r=>r.correct&&r.attempts===2).length} mit Hinweis · {roundResults.filter(r=>!r.correct).length} falsch</p><button className="primary" onClick={()=>startPractice(tasks.filter((_,i)=>{const r=roundResults[i];return r&&!r.correct||r?.attempts===2}))}>Schwierige wiederholen</button><button onClick={()=>startPractice()}>Ganze Runde wiederholen</button></>:task?<><p className="muted">Aufgabe {pos+1} von {tasks.length} · Versuch {attempt}/2</p><progress value={pos} max={tasks.length}/><p>{task.direction==='front-back'?'Schreibe die Antwort':'Übersetze zurück'}</p><h1>{prompt}</h1><p className="muted">Eine zulässige Übersetzung reicht.</p>{stage==='hint'&&<div className="hint">💡 {hint()}</div>}{(stage==='ask'||stage==='hint')?<form onSubmit={e=>{e.preventDefault();check()}}><input autoFocus value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Deine Antwort …"/><button className="primary" disabled={!answer.trim()}>Prüfen</button></form>:<><div className={stage==='correct'?'success':'error'}>{stage==='correct'?'🎉 Richtig!':'Noch nicht richtig.'}<p>Lösung: {options.join(' / ')}</p>{stage==='wrong'&&<p>Deine Antwort: {answer}</p>}</div><button className="primary" onClick={next}>Weiter →</button></>}</>:<p>Keine Aufgaben in diesem Set.</p>}</section>}
 {tab==='settings'&&<section><h1>Eigener Cloud-Speicher</h1><p>Synchronisiere deine Lerninhalte und Versuche über Google Drive oder OneDrive. Keine zentrale Datenbank.</p><div className="two"><button disabled={!config.googleClientId} onClick={()=>startLogin('google',config).catch(e=>setError(e.message))}>Mit Google Drive verbinden</button><button disabled={!config.microsoftClientId} onClick={()=>startLogin('microsoft',config).catch(e=>setError(e.message))}>Mit OneDrive verbinden</button></div>{(!config.googleClientId||!config.microsoftClientId)&&<p className="muted">OAuth Client-IDs fehlen noch. Anleitung in docs/setup.md. Die Buttons werden nach der Konfiguration aktiviert.</p>}<p><strong>Status:</strong> {cloudState}</p>{connection&&<><button className="primary" disabled={busy} onClick={sync}>{busy?'Synchronisiert …':'Cloud synchronisieren'}</button><button onClick={()=>{setConnection(null);setCloudState('Nicht verbunden')}}>Verbindung trennen</button></>}<h2>Backup</h2><button onClick={()=>download('open-learning-backup.json',JSON.stringify(lib,null,2))}>JSON exportieren</button><label>JSON importieren<input type="file" accept="application/json" onChange={async e=>{const f=e.target.files?.[0];if(f)restore(f)}}/></label><p className="muted">Cloud-Tokens werden nicht dauerhaft gespeichert. Nach einem Browser-Neustart ist eine neue Anmeldung nötig. Bis zur erfolgreichen Synchronisation sind Änderungen nur auf diesem Gerät.</p></section>}
 <footer>Open Learning · MIT · BYOE · <span>Fotos und Inhalte vor Freigabe prüfen</span></footer></main>
}
function SetPicker({sets,selected,setSelected}:{sets:SetData[];selected:string;setSelected:(s:string)=>void}){return <label>Lernset <select value={selected} onChange={e=>setSelected(e.target.value)}>{sets.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
createRoot(document.getElementById('root')!).render(<App/>);

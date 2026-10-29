import {LearningProgress,RoundProgress} from './LearningProgress';
import {AnswerInput} from './AnswerInput';
import {PracticeIcon} from './PracticeIcon';
import {loadPracticeSession,savePracticeSession,clearPracticeSession,type Session} from './practice-session';
import React,{useEffect,useMemo,useState} from 'react';
import {type SetData,type Attempt,uid,possibleAnswers,exampleForItem} from './model';
import {accepts,languageCode,modes,progressFor,shuffled,preferredDirection,listeningDirection,learningLevels,type Mode} from './learning-engine';
type Card={id:string;front:string;back:string;example?:string;alternatives?:string[];direction:Attempt['direction']};

export function Practice({set,labels,attempts,onRecord,nativeLanguage='Deutsch'}:{set:SetData;labels:[string,string];attempts:Attempt[];nativeLanguage?:string;onRecord:(a:Attempt[])=>void}){
 const [mode,setMode]=useState<Mode>('flip'),[direction,setDirection]=useState<'front-back'|'back-front'>(preferredDirection(labels,nativeLanguage));
 const [group,setGroup]=useState('Lernen'),[scope,setScope]=useState('all'),[mix,setMix]=useState(true),[drill,setDrill]=useState(false);
 const [session,setSession]=useState<Session|null>(null),[resume,setResume]=useState(()=>loadPracticeSession(set.id)),[answer,setAnswer]=useState(''),[feedback,setFeedback]=useState<boolean|null>(null),[revealed,setRevealed]=useState(false),[retry,setRetry]=useState(false),[showExample,setShowExample]=useState(()=>localStorage.getItem('ol-show-examples-v2')!=='false'),[audioError,setAudioError]=useState('');
 const [picked,setPicked]=useState<string[]>([]),[matched,setMatched]=useState<string[]>([]),[misses,setMisses]=useState(0);
 const [correction,setCorrection]=useState<'typing'|'done'|undefined>(),[correctionError,setCorrectionError]=useState(false);
 const studyDirection=mode==='listen'?listeningDirection(labels,nativeLanguage):direction;
 const card=session?.cards[session.pos];const done=!!session&&session.pos>=session.cards.length;
 function exampleForCard(c:Card){const item=set.items.find(i=>i.id===c.id);return item?exampleForItem(set.id,item):c.example}
 const example=card?exampleForCard(card):undefined;
 const exampleCount=set.items.filter(i=>exampleForItem(set.id,i)?.trim()).length;
 const target=card?(session?.mode==='listen'?card.front:card.back):'';
 const answerLanguage=card?labels[(card.direction==='front-back')===(session?.mode==='listen')?0:1]:labels[1];
 const eligible=set.items.filter(i=>scope==='all'||progressFor(attempts,set.id,i.id,direction).due);
 const stages=learningLevels(set,attempts,session?.cards[0]?.direction||direction);
 useEffect(()=>{localStorage.setItem('ol-show-examples-v2',String(showExample))},[showExample]);
 useEffect(()=>()=>{if('speechSynthesis'in window)window.speechSynthesis.cancel()},[]);
 function reset(){setAnswer('');setFeedback(null);setRevealed(false);setRetry(false);setPicked([]);setMatched([]);setMisses(0);setAudioError('');setCorrection(undefined);setCorrectionError(false)}
 function start(only?:Card[]){const cards=only||eligible.map(i=>({id:i.id,front:studyDirection==='front-back'||i.kind==='qa'?i.front:i.back,back:studyDirection==='front-back'||i.kind==='qa'?i.back:i.front,example:exampleForItem(set.id,i),alternatives:studyDirection==='front-back'?i.alternatives:[],direction:i.kind==='qa'?'front-back':studyDirection}));reset();setSession({setId:set.id,mode:session?.mode||mode,cards:mix?shuffled(cards):cards,pos:0,results:[],drill:session?.drill??drill})}
 function speak(text:string,side:'front'|'back'='front'){
  if(!('speechSynthesis'in window)){setAudioError('Vorlesen ist in diesem Browser nicht verfügbar. Bitte einen anderen Lernmodus wählen.');return}
  const dir=card?.direction||direction;const label=labels[(dir==='front-back')===(side==='front')?0:1];const lang=languageCode(label);
  if(!lang){setAudioError('Für diese Sprache ist noch keine Sprachausgabe eingerichtet.');return}
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang=lang;utterance.onerror=()=>setAudioError('Die Sprachausgabe konnte nicht gestartet werden.');window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
 }
 function record(ok:boolean){if(!session||!card||feedback!==null)return;const a:Attempt={id:uid(),itemId:card.id,setId:set.id,direction:card.direction,correct:ok,attempts:retry?2:1,practiceMode:session.mode,createdAt:new Date().toISOString()};
  onRecord([a]);const cards=[...session.cards];if(session.drill&&session.mode!=='test'&&!ok&&cards.filter(c=>c.id===card.id).length<3)cards.splice(Math.min(session.pos+4,cards.length),0,card);
  setSession({...session,cards,results:[...session.results,a],settled:true});setFeedback(ok);setRevealed(true);
 }
 function next(){if(!session)return;setSession({...session,pos:session.pos+1,settled:false});reset()}
 function submit(value=answer){if(!card||!session)return;const ok=accepts(value,target,session.mode==='listen'?[]:card.alternatives);if(correction==='typing'){setCorrectionError(!ok);if(ok)setCorrection('done');return}if(!ok&&!retry&&session.mode==='write'&&!session.drill){setRetry(true);setAnswer('');return}record(ok)}
 useEffect(()=>{if(!session?.drill||!card||revealed||feedback!==null||['test','listen'].includes(session.mode))return;const timer=window.setTimeout(()=>setRevealed(true),5000);return()=>clearTimeout(timer)},[session?.pos,session?.drill,card?.id,revealed,feedback]);
 const choices=useMemo(()=>card?shuffled([...new Set([card.back,...shuffled(set.items.map(i=>card.direction==='front-back'?i.back:i.front).filter(x=>x!==card.back)).slice(0,3)])]):[],[card,set.items]);
 const truth=useMemo(()=>card?(Math.random()<.5?card.back:choices.find(x=>x!==card.back)||card.back):'',[card,choices]);
 const letters=useMemo(()=>session&&session.interaction?.pos===session.pos?session.interaction.letters:shuffled(Array.from(possibleAnswers(target)[0]||'').map((text,index)=>({text,index}))),[target,session?.pos]);
 const pairs=useMemo(()=>session?session.cards.slice(session.pos,session.pos+4):[],[session?.pos,session?.cards]);
 const tiles=useMemo(()=>session&&session.interaction?.pos===session.pos?session.interaction.tiles:shuffled(pairs.flatMap((c,i)=>[{id:`${i}-f`,pair:i,text:c.front},{id:`${i}-b`,pair:i,text:c.back}])),[pairs]);
 useEffect(()=>{if(session){const snapshot={...session,draft:answer,retry,revealed,correction,interaction:{pos:session.pos,picked,matched,misses,tiles,letters}};savePracticeSession(snapshot);setResume(snapshot)}},[session,answer,retry,revealed,correction,picked,matched,misses,tiles,letters]);
 function pick(id:string){if(feedback!==null||picked.includes(id)||matched.includes(id)||picked.length===2)return;const selection=[...picked,id];setPicked(selection);if(selection.length===2){const a=tiles.find(t=>t.id===selection[0])!,b=tiles.find(t=>t.id===id)!;if(a.pair===b.pair){setMatched(v=>[...v,...selection]);setPicked([])}else setMisses(v=>v+1)}}
 function finishPairs(){if(!session)return;const results=pairs.map(c=>({id:uid(),itemId:c.id,setId:set.id,direction:c.direction,correct:misses===0,attempts:misses?2:1,practiceMode:session.mode,createdAt:new Date().toISOString()}));onRecord(results);setSession({...session,results:[...session.results,...results],pos:session.pos+pairs.length});reset()}
 useEffect(()=>{if(!session||done)return;function keyboard(e:KeyboardEvent){if((e.target as HTMLElement)?.closest('input,textarea,select,button'))return;if(e.key==='Enter'&&feedback!==null&&correction!=='typing'){e.preventDefault();next()}else if(session?.mode==='flip'&&feedback===null){if(e.key===' '){e.preventDefault();setRevealed(true)}else if(revealed&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();record(e.key==='ArrowRight')}}}window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard)},[session,done,feedback,revealed,correction]);
 if(!session)return <div className="practice-setup">
  {resume?.setId===set.id&&resume.pos<resume.cards.length&&resume.cards.every(c=>set.items.some(i=>i.id===c.id))&&<button className="primary" onClick={()=>{reset();setGroup(['flip','write','test'].includes(resume.mode)?'Lernen':['listen','choice','build'].includes(resume.mode)?'Üben':'Spielen');setMode(resume.mode);setDirection(resume.cards[0]?.direction||direction);onRecord(resume.results);setAnswer(resume.draft||'');if(resume.interaction?.pos===resume.pos){setPicked(resume.interaction.picked);setMatched(resume.interaction.matched);setMisses(resume.interaction.misses)}setCorrection(resume.correction);setRetry(!!resume.retry);setRevealed(!!resume.revealed);if(resume.settled){setFeedback(resume.results.at(-1)?.correct??false);setRevealed(true)}setSession(resume)}}><PracticeIcon name="play"/>Fortsetzen · {modes.find(m=>m[0]===resume.mode)?.[1]} · {resume.results.length}/{resume.cards.length}</button>}
  <div className="practice-tabs">{['Lernen','Üben','Spielen'].map(g=><button key={g} aria-pressed={group===g} onClick={()=>{setGroup(g);setMode(g==='Lernen'?'flip':g==='Üben'?'choice':'match')}}><PracticeIcon name={g==='Lernen'?'learn':g==='Üben'?'repeat':'game'}/>{g}</button>)}</div>
  <div className="method-grid">{modes.filter(([m])=>group==='Lernen'?['flip','write','test'].includes(m):group==='Üben'?['listen','choice','build'].includes(m):['truth','match','memory'].includes(m)).map(([m,name,description])=><button key={m} className={'method-tile '+(mode===m?'chosen':'')} aria-pressed={mode===m} onClick={()=>setMode(m)}><PracticeIcon name={m}/><strong>{name}</strong><small>{description}</small></button>)}</div>
  {mode==='listen'?<p className="dictation-direction">Du hörst und schreibst <strong>{labels[studyDirection==='front-back'?0:1]}</strong>. Danach erscheint die Bedeutung auf {labels[studyDirection==='front-back'?1:0]}.</p>:<label className="practice-field">Richtung<select value={direction} onChange={e=>setDirection(e.target.value as typeof direction)}><option value="front-back">{labels[0]} → {labels[1]}</option>{set.items.some(i=>i.kind==='translation')&&<option value="back-front">{labels[1]} → {labels[0]}</option>}</select></label>}
  <LearningProgress levels={stages}/>
  {exampleCount>0?<label className="practice-check example-option"><input type="checkbox" checked={showExample} onChange={e=>setShowExample(e.target.checked)}/><span>Beispielsätze anzeigen <small>{mode==='listen'?'Nach der richtigen Eingabe als zusätzliche Hilfe.':'Als Hilfe beim Lernen; in Prüfungen erst bei der Auswertung.'}</small></span></label>:<p className="missing-examples">In diesem Set sind noch keine Beispielsätze hinterlegt. Du kannst sie unter „Bearbeiten“ bei den Karten ergänzen.</p>}
  <details className="practice-settings"><summary><PracticeIcon name="settings"/>Lernen anpassen</summary><div className="practice-settings-content">

   <label className="practice-field">Karten<select value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Alle Karten</option><option value="due">Heute wiederholen</option></select></label>
   <div className="practice-toggles"><label className="practice-check"><input type="checkbox" checked={mix} onChange={e=>setMix(e.target.checked)}/><span>Karten mischen</span></label>
   {mode!=='test'&&<label className="practice-check"><input type="checkbox" checked={drill} onChange={e=>setDrill(e.target.checked)}/><span>Kleine Portionen lernen <small>5 Karten mit zusätzlichen Wiederholungen</small></span></label>}</div>
   <details className="practice-help-details"><summary>Wie funktioniert das?</summary><p className="practice-help">In kleinen Portionen erscheint die Lösung nach 5 Sekunden. Fehler übst du bis zu zweimal erneut. Unter „Heute wiederholen“ findest du die fälligen Karten.</p></details>
  </div></details>
  <button className="primary start-learning" disabled={!eligible.length} onClick={()=>start(drill&&mode!=='test'?shuffled(eligible).slice(0,5).map(i=>({id:i.id,front:studyDirection==='front-back'||i.kind==='qa'?i.front:i.back,back:studyDirection==='front-back'||i.kind==='qa'?i.back:i.front,example:exampleForItem(set.id,i),alternatives:studyDirection==='front-back'?i.alternatives:[],direction:i.kind==='qa'?'front-back':studyDirection})):undefined)}><PracticeIcon name={eligible.length?'play':'check'}/>{eligible.length?(resume&&resume.pos<resume.cards.length?'Neue Runde starten':'Los geht’s'):'Für heute alles wiederholt'}</button>
 </div>;
 if(done)return <div className="complete-screen"><h2>{session.mode==='memory'?'Alle Paare gefunden!':session.results.every(r=>r.correct)?'Alles richtig – grossartig!':'Gut gemacht, du bleibst dran!'}</h2><RoundProgress results={session.results} total={session.cards.length} summary neutral={session.mode==='memory'}/>{session.mode!=='memory'&&<LearningProgress levels={stages}/>}<p className="practice-save-note">{session.mode==='memory'?'Spiel abgeschlossen.':'Deine beantworteten Karten sind gespeichert.'}</p>{session.mode==='test'&&session.cards.some(c=>exampleForCard(c))&&<details className="exam-examples"><summary>Beispielsätze ansehen</summary>{session.cards.filter(c=>exampleForCard(c)).map((c,i)=><p key={i}><strong>{c.front}</strong><br/>{exampleForCard(c)}</p>)}</details>}<div className="action-row">{session.mode!=='memory'&&<button onClick={()=>{const ids=new Set(session.results.filter(r=>!r.correct||r.attempts>1).map(r=>r.itemId));start(session.cards.filter((c,i,a)=>ids.has(c.id)&&a.findIndex(x=>x.id===c.id)===i))}} disabled={!session.results.some(r=>!r.correct||r.attempts>1)}><PracticeIcon name="repeat"/>Schwierige wiederholen</button>}<button className="primary" onClick={()=>{clearPracticeSession(set.id);setResume(null);setSession(null)}}><PracticeIcon name="check"/>Fertig</button></div></div>;
 if(!card)return null;
 const pairMode=session.mode==='match'||session.mode==='memory';
 const writingMode=['write','listen','test'].includes(session.mode);
 const correcting=correction==='typing',answered=feedback!==null&&!correcting;
 const result=feedback!==null&&!correcting&&<div role="status" className={'study-feedback '+(feedback||correction==='done'?'is-correct':'is-review')}>
  <strong>{session.mode==='test'?'Antwort gespeichert.':correction==='done'?'Richtig eingeprägt!':feedback?'Richtig!':'Noch üben'}</strong>
  {session.mode!=='test'&&<>
   {(!feedback||!writingMode)&&<p>{target}</p>}
   {session.mode==='listen'&&(feedback||correction==='done')&&<p className="dictation-translation">{card.back}</p>}
   {!feedback&&correction!=='done'&&['listen','write'].includes(session.mode)&&<button onClick={()=>{setCorrection('typing');setCorrectionError(false);setAnswer('')}}><PracticeIcon name="write"/>Richtig schreiben</button>}
  </>}
 </div>;
 return <section className={'study-page practice-study '+(writingMode?'writing-mode':'')}>
 <div className="flat-toolbar"><button aria-label="Speichern und pausieren" onClick={()=>{setSession(null);reset()}}><PracticeIcon name="back"/>Pause</button><strong className="practice-mode-title"><PracticeIcon name={session.mode}/>{modes.find(m=>m[0]===session.mode)?.[1]}</strong><span>{session.pos+1} / {session.cards.length}</span></div>
 <RoundProgress results={session.results} total={session.cards.length} conceal={session.mode==='test'} neutral={session.mode==='memory'}/>
 {pairMode?<><h2>{session.mode==='memory'?'Finde die Paare':'Was gehört zusammen?'}</h2><div className="pair-grid">{tiles.map(t=><button key={t.id} className={matched.includes(t.id)?'paired':''} aria-pressed={picked.includes(t.id)} disabled={matched.includes(t.id)} onClick={()=>pick(t.id)} aria-label={session.mode==='memory'&&!picked.includes(t.id)&&!matched.includes(t.id)?'Verdeckte Karte':t.text}>{session.mode==='memory'&&!picked.includes(t.id)&&!matched.includes(t.id)?'?':t.text}</button>)}</div>{picked.length===2&&<button onClick={()=>setPicked([])}>Noch einmal versuchen</button>}{matched.length===tiles.length&&<button className="primary" onClick={finishPairs}>Weiter<PracticeIcon name="next"/></button>}</>:<div className="learning-card">
  <div className="study-prompt">
   {correcting?<div className="study-question"><h1>{target}</h1><button className="subtle-button study-speak" aria-label="Lösung vorlesen" onClick={()=>speak(target,session.mode==='listen'?'front':'back')}><PracticeIcon name="listen"/></button></div>:session.mode==='listen'?<button onClick={()=>speak(card.front)}><PracticeIcon name="listen"/>Anhören</button>:<div className="study-question"><h1>{card.front}</h1><button className="subtle-button study-speak" aria-label="Aufgabe vorlesen" onClick={()=>speak(card.front)}><PracticeIcon name="listen"/></button></div>}
   {audioError&&<p role="status">{audioError}</p>}
   {example&&session.mode!=='test'&&(session.mode!=='listen'||feedback===true||correction==='done')&&<div className="study-example-control"><button className="subtle-button" aria-expanded={showExample} onClick={()=>setShowExample(!showExample)}>Beispielsatz {showExample?'ausblenden':'anzeigen'}</button>{showExample&&<p className="study-example">{example}</p>}</div>}
   {correcting&&<p className="study-retry" role={correctionError?'status':undefined}>{correctionError?'Vergleiche mit der richtigen Schreibweise.':'Zum Einprägen nochmals schreiben'}</p>}
   {retry&&!correcting&&feedback===null&&<p role="status" className="study-retry">Noch ein Versuch · Anfang: {target[0]}</p>}
   {writingMode&&result}
  </div>
  {writingMode?<form className="study-answer-form" onSubmit={e=>{e.preventDefault();if(answered)next();else submit()}}><AnswerInput value={answer} onChange={setAnswer} onSubmit={()=>answered?next():submit()} language={answerLanguage} answerLocked={answered} submitLabel={answered?'Weiter':'Antwort prüfen'} allowEmpty={answered}/></form>:feedback===null?<>
   {session.mode==='flip'?<>{!revealed?<button className="primary" onClick={()=>setRevealed(true)}><PracticeIcon name="flip"/>Antwort aufdecken</button>:<><h2>{target}</h2><div className="rating-grid"><button onClick={()=>record(false)}><PracticeIcon name="repeat"/>Noch üben</button><button className="primary" onClick={()=>record(true)}><PracticeIcon name="check"/>Gewusst</button></div></>}</>:
   session.mode==='choice'?<div className="practice-options">{choices.map(c=><button key={c} onClick={()=>submit(c)}>{c}</button>)}</div>:
   session.mode==='truth'?<><h2>{truth}</h2><div className="rating-grid"><button onClick={()=>record(truth!==card.back)}>Falsch</button><button onClick={()=>record(truth===card.back)}>Wahr</button></div></>:
   <><div className="letter-grid">{letters.map(l=><button key={l.index} disabled={picked.includes(String(l.index))} onClick={()=>{setPicked([...picked,String(l.index)]);setAnswer(answer+l.text)}}>{l.text===' '?'␣':l.text}</button>)}<button onClick={()=>{setAnswer('');setPicked([])}}><PracticeIcon name="repeat"/>Neu bauen</button></div><form onSubmit={e=>{e.preventDefault();submit()}}><AnswerInput value={answer} onChange={setAnswer} onSubmit={()=>submit()} language={answerLanguage} built/></form></>}
   {revealed&&session.mode!=='flip'&&<div><p>Lösung: {target}</p><button onClick={()=>record(false)}>Noch üben →</button></div>}
  </>:<>{result}<button className="primary" onClick={next}>Weiter<PracticeIcon name="next"/></button></>}
 </div>}
 </section>;
}

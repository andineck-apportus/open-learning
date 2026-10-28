import {LearningProgress,CardLevel,RoundProgress} from './LearningProgress';
import {AnswerInput} from './AnswerInput';
import {PracticeIcon} from './PracticeIcon';
import React,{useEffect,useMemo,useState} from 'react';
import {type SetData,type Attempt,uid,possibleAnswers} from './model';
import {accepts,languageCode,modes,progressFor,shuffled,preferredDirection,learningLevels,type Mode} from './learning-engine';
type Card={id:string;front:string;back:string;example?:string;alternatives?:string[];direction:Attempt['direction']};
type Session={setId:string;mode:Mode;cards:Card[];pos:number;results:Attempt[];drill:boolean;settled?:boolean};
const KEY='ol-practice-session-v1';
function saved():Session|null{try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&Array.isArray(x.cards)&&x.cards.every((c:Card)=>typeof c.id==='string'&&typeof c.front==='string'&&typeof c.back==='string')&&Number.isInteger(x.pos)&&x.pos>=0&&x.pos<=x.cards.length&&Array.isArray(x.results)&&modes.some(m=>m[0]===x.mode)?x:null}catch{return null}}
export function Practice({set,labels,attempts,onRecord,nativeLanguage='Deutsch'}:{set:SetData;labels:[string,string];attempts:Attempt[];nativeLanguage?:string;onRecord:(a:Attempt[])=>void}){
 const [mode,setMode]=useState<Mode>('flip'),[direction,setDirection]=useState<'front-back'|'back-front'>(preferredDirection(labels,nativeLanguage));
 const [group,setGroup]=useState('Lernen'),[scope,setScope]=useState('all'),[mix,setMix]=useState(true),[drill,setDrill]=useState(false);
 const [session,setSession]=useState<Session|null>(null),[resume,setResume]=useState(saved),[answer,setAnswer]=useState(''),[feedback,setFeedback]=useState<boolean|null>(null),[revealed,setRevealed]=useState(false),[retry,setRetry]=useState(false),[showExample,setShowExample]=useState(false),[audioError,setAudioError]=useState('');
 const [picked,setPicked]=useState<string[]>([]),[matched,setMatched]=useState<string[]>([]),[misses,setMisses]=useState(0);
 const card=session?.cards[session.pos];const done=!!session&&session.pos>=session.cards.length;
 const target=card?(session?.mode==='listen'?card.front:card.back):'';
 const answerLanguage=card?labels[(card.direction==='front-back')===(session?.mode==='listen')?0:1]:labels[1];
 const eligible=set.items.filter(i=>scope==='all'||progressFor(attempts,set.id,i.id,direction).due);
 const stages=learningLevels(set,attempts,session?.cards[0]?.direction||direction);
 useEffect(()=>{if(session){localStorage.setItem(KEY,JSON.stringify(session));setResume(session)}},[session]);
 useEffect(()=>()=>{if('speechSynthesis'in window)window.speechSynthesis.cancel()},[]);
 function reset(){setAnswer('');setFeedback(null);setRevealed(false);setRetry(false);setPicked([]);setMatched([]);setMisses(0);setAudioError('')}
 function start(only?:Card[]){const cards=only||eligible.map(i=>({id:i.id,front:direction==='front-back'||i.kind==='qa'?i.front:i.back,back:direction==='front-back'||i.kind==='qa'?i.back:i.front,example:i.example,alternatives:direction==='front-back'?i.alternatives:[],direction:i.kind==='qa'?'front-back':direction}));reset();setSession({setId:set.id,mode,cards:mix?shuffled(cards):cards,pos:0,results:[],drill})}
 function speak(text:string,side:'front'|'back'='front'){
  if(!('speechSynthesis'in window)){setAudioError('Vorlesen ist in diesem Browser nicht verfügbar. Bitte einen anderen Lernmodus wählen.');return}
  const dir=card?.direction||direction;const label=labels[(dir==='front-back')===(side==='front')?0:1];const lang=languageCode(label);
  if(!lang){setAudioError('Für diese Sprache ist noch keine Sprachausgabe eingerichtet.');return}
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang=lang;utterance.onerror=()=>setAudioError('Die Sprachausgabe konnte nicht gestartet werden.');window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
 }
 function record(ok:boolean){if(!session||!card||feedback!==null)return;const a:Attempt={id:uid(),itemId:card.id,setId:set.id,direction:card.direction,correct:ok,attempts:retry?2:1,practiceMode:session.mode,createdAt:new Date().toISOString()};
  if(session.mode!=='test')onRecord([a]);const cards=[...session.cards];if(session.drill&&session.mode!=='test'&&!ok&&cards.filter(c=>c.id===card.id).length<3)cards.splice(Math.min(session.pos+4,cards.length),0,card);
  setSession({...session,cards,results:[...session.results,a],settled:true});setFeedback(ok);setRevealed(true);
 }
 function next(){if(!session)return;if(session.mode==='test'&&session.pos+1===session.cards.length)onRecord(session.results);setSession({...session,pos:session.pos+1,settled:false});reset()}
 function submit(value=answer){if(!card||!session)return;const ok=accepts(value,target,session.mode==='listen'?[]:card.alternatives);if(!ok&&!retry&&session.mode==='write'&&!session.drill){setRetry(true);setAnswer('');return}record(ok)}
 useEffect(()=>{if(!session?.drill||!card||revealed||feedback!==null||session.mode==='test')return;const timer=window.setTimeout(()=>setRevealed(true),5000);return()=>clearTimeout(timer)},[session?.pos,session?.drill,card?.id,revealed,feedback]);
 const choices=useMemo(()=>card?shuffled([...new Set([card.back,...shuffled(set.items.map(i=>card.direction==='front-back'?i.back:i.front).filter(x=>x!==card.back)).slice(0,3)])]):[],[card,set.items]);
 const truth=useMemo(()=>card?(Math.random()<.5?card.back:choices.find(x=>x!==card.back)||card.back):'',[card,choices]);
 const letters=useMemo(()=>shuffled(Array.from(possibleAnswers(target)[0]||'').map((text,index)=>({text,index}))),[target,session?.pos]);
 const pairs=useMemo(()=>session?session.cards.slice(session.pos,session.pos+4):[],[session?.pos,session?.cards]);
 const tiles=useMemo(()=>shuffled(pairs.flatMap((c,i)=>[{id:`${i}-f`,pair:i,text:c.front},{id:`${i}-b`,pair:i,text:c.back}])),[pairs]);
 function pick(id:string){if(feedback!==null||picked.includes(id)||matched.includes(id)||picked.length===2)return;const selection=[...picked,id];setPicked(selection);if(selection.length===2){const a=tiles.find(t=>t.id===selection[0])!,b=tiles.find(t=>t.id===id)!;if(a.pair===b.pair){setMatched(v=>[...v,...selection]);setPicked([])}else setMisses(v=>v+1)}}
 function finishPairs(){if(!session)return;const results=pairs.map(c=>({id:uid(),itemId:c.id,setId:set.id,direction:c.direction,correct:misses===0,attempts:misses?2:1,createdAt:new Date().toISOString()}));onRecord(results);setSession({...session,results:[...session.results,...results],pos:session.pos+pairs.length});reset()}
 useEffect(()=>{if(!session||done)return;function keyboard(e:KeyboardEvent){if((e.target as HTMLElement)?.closest('input,textarea,select,button'))return;if(e.key==='Enter'&&feedback!==null){e.preventDefault();next()}else if(session?.mode==='flip'&&feedback===null){if(e.key===' '){e.preventDefault();setRevealed(true)}else if(revealed&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();record(e.key==='ArrowRight')}}}window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard)},[session,done,feedback,revealed]);
 if(!session)return <div className="practice-setup">
  {resume?.setId===set.id&&resume.pos<resume.cards.length&&resume.cards.every(c=>set.items.some(i=>i.id===c.id))&&<button className="primary" onClick={()=>{reset();if(resume.settled){setFeedback(resume.results.at(-1)?.correct??false);setRevealed(true)}setSession(resume)}}><PracticeIcon name="play"/>Weiterlernen · {modes.find(m=>m[0]===resume.mode)?.[1]}</button>}
  <div className="practice-tabs">{['Lernen','Üben','Spielen'].map(g=><button key={g} aria-pressed={group===g} onClick={()=>{setGroup(g);setMode(g==='Lernen'?'flip':g==='Üben'?'choice':'match')}}><PracticeIcon name={g==='Lernen'?'learn':g==='Üben'?'repeat':'game'}/>{g}</button>)}</div>
  <div className="method-grid">{modes.filter(([m])=>group==='Lernen'?['flip','write','test'].includes(m):group==='Üben'?['listen','choice','build'].includes(m):['truth','match','memory'].includes(m)).map(([m,name,description])=><button key={m} className={'method-tile '+(mode===m?'chosen':'')} aria-pressed={mode===m} onClick={()=>setMode(m)}><PracticeIcon name={m}/><strong>{name}</strong><small>{description}</small></button>)}</div>
  <label className="practice-field">Richtung<select value={direction} onChange={e=>setDirection(e.target.value as typeof direction)}><option value="front-back">{labels[0]} → {labels[1]}</option>{set.items.some(i=>i.kind==='translation')&&<option value="back-front">{labels[1]} → {labels[0]}</option>}</select></label>
  <LearningProgress levels={stages}/>
  <details className="practice-settings"><summary><PracticeIcon name="settings"/>Lernen anpassen</summary><div className="practice-settings-content">

   <label className="practice-field">Karten<select value={scope} onChange={e=>setScope(e.target.value)}><option value="all">Alle Karten</option><option value="due">Heute wiederholen</option></select></label>
   <div className="practice-toggles"><label className="practice-check"><input type="checkbox" checked={mix} onChange={e=>setMix(e.target.checked)}/><span>Karten mischen</span></label>
   {mode!=='test'&&<label className="practice-check"><input type="checkbox" checked={drill} onChange={e=>setDrill(e.target.checked)}/><span>Kleine Portionen lernen <small>5 Karten mit zusätzlichen Wiederholungen</small></span></label>}</div>
   <details className="practice-help-details"><summary>Wie funktioniert das?</summary><p className="practice-help">In kleinen Portionen erscheint die Lösung nach 5 Sekunden. Fehler übst du bis zu zweimal erneut. Richtige Antworten steigen eine Stufe auf; Wiederholungen folgen nach 1, 3, 7, 14 und 30 Tagen.</p></details>
  </div></details>
  <button className="primary start-learning" disabled={!eligible.length} onClick={()=>start(drill&&mode!=='test'?shuffled(eligible).slice(0,5).map(i=>({id:i.id,front:direction==='front-back'||i.kind==='qa'?i.front:i.back,back:direction==='front-back'||i.kind==='qa'?i.back:i.front,example:i.example,alternatives:direction==='front-back'?i.alternatives:[],direction:i.kind==='qa'?'front-back':direction})):undefined)}><PracticeIcon name={eligible.length?'play':'check'}/>{eligible.length?'Los geht’s':'Für heute alles wiederholt'}</button>
 </div>;
 if(done)return <div className="complete-screen"><h2>{session.results.every(r=>r.correct)?'Alles richtig – grossartig!':'Gut gemacht, du bleibst dran!'}</h2><RoundProgress results={session.results} total={session.cards.length} summary/><LearningProgress levels={stages}/><div className="action-row"><button onClick={()=>{const ids=new Set(session.results.filter(r=>!r.correct||r.attempts>1).map(r=>r.itemId));start(session.cards.filter((c,i,a)=>ids.has(c.id)&&a.findIndex(x=>x.id===c.id)===i))}} disabled={!session.results.some(r=>!r.correct||r.attempts>1)}><PracticeIcon name="repeat"/>Schwierige wiederholen</button><button className="primary" onClick={()=>{localStorage.removeItem(KEY);setResume(null);setSession(null)}}><PracticeIcon name="check"/>Fertig</button></div></div>;
 if(!card)return null;
 const pairMode=session.mode==='match'||session.mode==='memory';
 return <section className="study-page practice-study"><div className="flat-toolbar"><button onClick={()=>{setSession(null);reset()}}><PracticeIcon name="back"/>Pause</button><strong className="practice-mode-title"><PracticeIcon name={session.mode}/>{modes.find(m=>m[0]===session.mode)?.[1]}</strong><span>{session.pos+1} / {session.cards.length}</span></div><RoundProgress results={session.results} total={session.cards.length} conceal={session.mode==='test'}/>
 {pairMode?<><h2>{session.mode==='memory'?'Finde die Paare':'Was gehört zusammen?'}</h2><div className="pair-grid">{tiles.map(t=><button key={t.id} className={matched.includes(t.id)?'paired':''} aria-pressed={picked.includes(t.id)} disabled={matched.includes(t.id)} onClick={()=>pick(t.id)} aria-label={session.mode==='memory'&&!picked.includes(t.id)&&!matched.includes(t.id)?'Verdeckte Karte':t.text}>{session.mode==='memory'&&!picked.includes(t.id)&&!matched.includes(t.id)?'?':t.text}</button>)}</div>{picked.length===2&&<button onClick={()=>setPicked([])}>Noch einmal versuchen</button>}{matched.length===tiles.length&&<button className="primary" onClick={finishPairs}><span>Weiter</span><PracticeIcon name="next"/></button>}</>:<div className="learning-card">
  <CardLevel level={progressFor(attempts,set.id,card.id,card.direction).level}/><span className="eyebrow">{session.mode==='listen'?'HÖREN UND SCHREIBEN':card.direction==='front-back'?labels.join(' → '):[labels[1],labels[0]].join(' → ')}</span>{session.mode==='listen'?<button onClick={()=>speak(card.front)}><PracticeIcon name="listen"/>Anhören</button>:<><h1>{card.front}</h1><button className="subtle-button" onClick={()=>speak(card.front)}><PracticeIcon name="listen"/>Vorlesen</button></>}
  {audioError&&<p role="status">{audioError}</p>}
  {feedback===null? <>
   {session.mode==='flip'?<>{!revealed?<button className="primary" onClick={()=>setRevealed(true)}><PracticeIcon name="flip"/>Antwort aufdecken</button>:<><h2>{target}</h2><div className="rating-grid"><button onClick={()=>record(false)}><PracticeIcon name="repeat"/>Noch üben</button><button className="primary" onClick={()=>record(true)}><PracticeIcon name="check"/>Gewusst</button></div></>}</>:
   session.mode==='choice'?<div className="practice-options">{choices.map(c=><button key={c} onClick={()=>submit(c)}>{c}</button>)}</div>:
   session.mode==='truth'?<><h2>{truth}</h2><div className="rating-grid"><button onClick={()=>record(truth!==card.back)}>Falsch</button><button onClick={()=>record(truth===card.back)}>Wahr</button></div></>:
   <>{retry&&<p role="status">Noch ein Versuch. Anfang: {target[0]} · Achte auf Artikel und Akzente.</p>}{session.mode==='build'&&<div className="letter-grid">{letters.map(l=><button key={l.index} disabled={picked.includes(String(l.index))} onClick={()=>{setPicked([...picked,String(l.index)]);setAnswer(answer+l.text)}}>{l.text===' '?'␣':l.text}</button>)}<button onClick={()=>{setAnswer('');setPicked([])}}><PracticeIcon name="repeat"/>Neu bauen</button></div>}<form onSubmit={e=>{e.preventDefault();submit()}}><AnswerInput key={`${session.pos}-${session.mode}`} value={answer} onChange={setAnswer} onSubmit={()=>submit()} language={answerLanguage} built={session.mode==='build'}/></form></>}
   {revealed&&session.mode!=='flip'&&<div><p>Lösung: {target}</p><button onClick={()=>record(false)}>Noch üben →</button></div>}
  </>:<>{session.mode==='test'?<p>Antwort gespeichert.</p>:<div role="status" className={feedback?'success':'error'}><strong>{feedback?'Richtig!':'Das üben wir noch.'}</strong><p>Lösung: {target}</p>{answer&&<p>Deine Antwort: {answer}</p>}<button onClick={()=>speak(target,session.mode==='listen'?'front':'back')}><PracticeIcon name="listen"/>Lösung anhören</button></div>}<button className="primary" onClick={next}><span>Weiter</span><PracticeIcon name="next"/></button></>}
  {card.example&&(revealed||feedback!==null)&&session.mode!=='test'&&<div><button aria-expanded={showExample} onClick={()=>setShowExample(!showExample)}>Beispielsatz {showExample?'ausblenden':'anzeigen'}</button>{showExample&&<p className="study-example">{card.example}</p>}</div>}
 </div>}
 </section>;
}

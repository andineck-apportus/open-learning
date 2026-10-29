import React from 'react';
import {type Attempt} from './model';
import {levelCounts} from './learning-engine';
const stageLabels=['Noch üben','Wird sicherer','Sicher'];
export function LearningProgress({levels,compact=false}:{levels:number[];compact?:boolean}){
 const all=levelCounts(levels),counts=[all[0],all.slice(1,5).reduce((a,b)=>a+b,0),all[5]],colors=[0,3,5],total=levels.length;
 const description=counts.map((count,level)=>`${stageLabels[level]}: ${count}`).join(', ');
 const track=<span className="level-track" aria-hidden="true">{total?counts.map((count,level)=>count>0&&<span key={level} className={`level-segment level-${colors[level]}`} style={{flex:count}}/>):<span className="level-segment level-0" style={{flex:1}}/>}</span>;
 if(compact)return <span className="learning-progress-compact" role="img" aria-label={`Lernstand: ${description}`} title={description}>{track}</span>;
 return <div className="learning-progress" role="group" aria-label="Lernstand">
  <div className="learning-progress-heading"><strong>Dein Lernstand</strong><span>{total} Karten</span></div>
  {track}
  <div className="level-legend">{counts.map((count,level)=><span className="level-legend-item" key={level}><i className={`level-dot level-${colors[level]}`} aria-hidden="true"/><span>{stageLabels[level]}</span><strong>{count}</strong></span>)}</div>
  <details className="learning-explanation"><summary>Wie wird mein Lernstand berechnet?</summary><p>Jede direkt richtige Antwort bringt eine Karte einen Schritt weiter. Nach fünf richtigen Antworten ohne Fehler gilt sie als sicher. Bei einem Fehler oder einem zweiten Versuch kommt sie zurück zu „Noch üben“.</p><p>Die fünf Schritte planen die Wiederholung nach 1, 3, 7, 14 und 30 Tagen. Unter „Heute wiederholen“ erscheinen die fälligen Karten. Die beiden Lernrichtungen zählen getrennt. Memory und „Hören &amp; schreiben“ verändern diesen Wissensstand nicht.</p></details>
 </div>;
}
export function CardLevel({level}:{level:number}){
 const label=stageLabels[level===0?0:level===5?2:1];
 return <div className="card-level" role="img" aria-label={label} title={label}><span>{label}</span><span className="card-level-steps" aria-hidden="true">{[1,2,3,4,5].map(step=><i key={step} className={step<=level?`level-${level}`:''}/>)}</span></div>;
}
export function RoundProgress({results,total,conceal=false,summary=false,neutral=false}:{results:Attempt[];total:number;conceal?:boolean;summary?:boolean;neutral?:boolean}){
 const completed=Math.min(results.length,total),percent=total?Math.round(completed/total*100):0;
 const known=results.filter(r=>r.correct).length,review=results.length-known;
 const accuracy=results.length?Math.round(known/results.length*100):0;
 return <div className={summary?'round-progress round-summary':'round-progress'}>
  {summary&&neutral?<div className="game-summary"><strong>{completed}/{total}</strong><span>Karten zugeordnet</span></div>:summary?<div className="result-ring" role="img" aria-label={`${accuracy} Prozent richtig`} style={{'--result-angle':`${accuracy*3.6}deg`} as React.CSSProperties}><span><strong>{accuracy}%</strong><small>richtig</small></span></div>:<>
   <div className="round-caption"><span>{neutral?'Dein Spiel':'Deine Runde'}</span><strong>{percent}%</strong></div>
   <div className="round-track" role="progressbar" aria-label={neutral?"Spielfortschritt":"Rundenfortschritt"} aria-valuemin={0} aria-valuemax={total||1} aria-valuenow={completed} aria-valuetext={`${completed} von ${total} Karten beantwortet`} style={{gap:total>40?2:4}}>
    {Array.from({length:total},(_,index)=><span key={index} className={!results[index]?'round-pending':conceal||neutral?'round-neutral':results[index].correct?'round-known':'round-review'} aria-hidden="true"/>)}</div>
  </>}
  {!conceal&&!neutral&&<div className="round-legend"><span><i className="round-known" aria-hidden="true"/><strong>{known}</strong> Gewusst</span><span><i className="round-review" aria-hidden="true"/><strong>{review}</strong> Noch üben</span>{!summary&&<span><i className="round-pending" aria-hidden="true"/><strong>{Math.max(0,total-completed)}</strong> Offen</span>}</div>}
  {neutral&&!summary&&<span className="round-test-caption">{completed} / {total} Karten zugeordnet</span>}
  {conceal&&<span className="round-test-caption">{completed} / {total}</span>}
 </div>;
}

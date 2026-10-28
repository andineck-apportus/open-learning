import React from 'react';
import {type Attempt} from './model';
import {levelCounts} from './learning-engine';
const stageLabels=['Noch üben','Stufe 1','Stufe 2','Stufe 3','Stufe 4','Sicher'];
export function LearningProgress({levels,compact=false}:{levels:number[];compact?:boolean}){
 const counts=levelCounts(levels),total=levels.length;
 const description=counts.map((count,level)=>`${stageLabels[level]}: ${count}`).join(', ');
 const track=<span className="level-track" aria-hidden="true">{total?counts.map((count,level)=>count>0&&<span key={level} className={`level-segment level-${level}`} style={{flex:count}}/>):<span className="level-segment level-0" style={{flex:1}}/>}</span>;
 if(compact)return <span className="learning-progress-compact" role="img" aria-label={`Lernstand: ${description}`} title={description}>{track}</span>;
 return <div className="learning-progress" role="group" aria-label="Lernstand">
  <div className="learning-progress-heading"><strong>Dein Lernstand</strong><span>{total} Karten</span></div>
  {track}
  <div className="level-legend">{counts.map((count,level)=><span className="level-legend-item" key={level}><i className={`level-dot level-${level}`} aria-hidden="true"/><span>{stageLabels[level]}</span><strong>{count}</strong></span>)}</div>
 </div>;
}
export function CardLevel({level}:{level:number}){
 return <div className="card-level" role="img" aria-label={`Lernstufe ${level} von 5`} title={`Lernstufe ${level} von 5`}><span>Stufe {level}</span><span className="card-level-steps" aria-hidden="true">{[1,2,3,4,5].map(step=><i key={step} className={step<=level?`level-${level}`:''}/>)}</span></div>;
}
export function RoundProgress({results,total,conceal=false,summary=false}:{results:Attempt[];total:number;conceal?:boolean;summary?:boolean}){
 const completed=Math.min(results.length,total),percent=total?Math.round(completed/total*100):0;
 const known=results.filter(r=>r.correct).length,review=results.length-known;
 const accuracy=results.length?Math.round(known/results.length*100):0;
 return <div className={summary?'round-progress round-summary':'round-progress'}>
  {summary?<div className="result-ring" role="img" aria-label={`${accuracy} Prozent richtig`} style={{'--result-angle':`${accuracy*3.6}deg`} as React.CSSProperties}><span><strong>{accuracy}%</strong><small>richtig</small></span></div>:<>
   <div className="round-caption"><span>Deine Runde</span><strong>{percent}%</strong></div>
   <div className="round-track" role="progressbar" aria-label="Rundenfortschritt" aria-valuemin={0} aria-valuemax={total||1} aria-valuenow={completed} aria-valuetext={`${completed} von ${total} Karten beantwortet`} style={{gap:total>40?2:4}}>
    {Array.from({length:total},(_,index)=><span key={index} className={!results[index]?'round-pending':conceal?'round-neutral':results[index].correct?'round-known':'round-review'} aria-hidden="true"/>)}</div>
  </>}
  {!conceal&&<div className="round-legend"><span><i className="round-known" aria-hidden="true"/><strong>{known}</strong> Gewusst</span><span><i className="round-review" aria-hidden="true"/><strong>{review}</strong> Noch üben</span>{!summary&&<span><i className="round-pending" aria-hidden="true"/><strong>{Math.max(0,total-completed)}</strong> Offen</span>}</div>}
  {conceal&&<span className="round-test-caption">{completed} / {total}</span>}
 </div>;
}

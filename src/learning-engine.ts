import {type Attempt,normalize,possibleAnswers} from './model';
export type Mode='flip'|'write'|'listen'|'choice'|'build'|'truth'|'match'|'memory'|'test';
export const modes:[Mode,string,string][]=[['flip','Lernkarten','Aufdecken und selbst einschätzen'],['write','Schreiben','Die Antwort selbst eingeben'],['listen','Hören & schreiben','Zuhören und das Gehörte schreiben'],['choice','Auswahl','Die passende Antwort finden'],['build','Wort bauen','Die Lösung aus Buchstaben bauen'],['truth','Wahr oder falsch','Passt diese Antwort?'],['match','Zuordnen','Die passenden Paare verbinden'],['memory','Memory','Verdeckte Paare finden'],['test','Prüfung','Ein Versuch, Auswertung am Schluss']];
export function shuffled<T>(values:T[]):T[]{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
export function accepts(answer:string,expected:string,alternatives:string[]=[]){return [...possibleAnswers(expected),...alternatives].some(x=>normalize(x)===normalize(answer))}
export function progressFor(attempts:Attempt[],setId:string,itemId:string,direction:Attempt['direction'],now=Date.now()){
 const history=attempts.filter(a=>a.setId===setId&&a.itemId===itemId&&a.direction===direction&&a.practiceMode!=='listen').sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 let level=0;for(const a of history)level=a.correct&&a.attempts===1?Math.min(5,level+1):0;
 const last=history.at(-1);const days=[0,1,3,7,14,30][level];
 return {level,due:!last||now>=Date.parse(last.createdAt)+days*86400000};
}
export function languageCode(label:string){return /franz|french|^fr$/i.test(label)?'fr-FR':/engl|english|^en$/i.test(label)?'en-GB':/ital|^it$/i.test(label)?'it-IT':/span|^es$/i.test(label)?'es-ES':/deutsch|german|^de$/i.test(label)?'de-CH':undefined}

export function preferredDirection(labels:[string,string],nativeLanguage='Deutsch'):'front-back'|'back-front'{
 const plain=(label:string)=>label.trim().toLocaleLowerCase('de').replace(/\s*\([^)]*\)\s*/g,'');
 return plain(labels[1])===plain(nativeLanguage)&&plain(labels[0])!==plain(nativeLanguage)?'back-front':'front-back';
}
export function learningLevels(set:{id:string;items:{id:string;kind:string}[]},attempts:Attempt[],direction:Attempt['direction']){
 return set.items.map(item=>progressFor(attempts,set.id,item.id,item.kind==='qa'?'front-back':direction).level);
}
export function levelCounts(levels:number[]){return [0,1,2,3,4,5].map(level=>levels.filter(value=>value===level).length)}

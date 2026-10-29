import {type Attempt} from './model';
import {modes,type Mode} from './learning-engine';
export type SessionCard={id:string;front:string;back:string;example?:string;alternatives?:string[];direction:Attempt['direction']};
export type Session={setId:string;mode:Mode;cards:SessionCard[];pos:number;results:Attempt[];drill:boolean;settled?:boolean;draft?:string;retry?:boolean;revealed?:boolean;correction?:'typing'|'done';interaction?:{pos:number;picked:string[];matched:string[];misses:number;tiles:{id:string;pair:number;text:string}[];letters:{text:string;index:number}[]}};
const LEGACY='ol-practice-session-v1';
const key=(setId:string)=>`${LEGACY}:${encodeURIComponent(setId)}`;
function valid(x:Session|null,setId:string):x is Session{
 if(x?.correction!==undefined&&!['typing','done'].includes(x.correction))return false;
 const interaction=x?.interaction;
 const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(s=>typeof s==='string');
 if(interaction&&(!Number.isInteger(interaction.pos)||!strings(interaction.picked)||!strings(interaction.matched)||!Number.isFinite(interaction.misses)||!Array.isArray(interaction.tiles)||!interaction.tiles.every(t=>t&&typeof t.id==='string'&&Number.isInteger(t.pair)&&typeof t.text==='string')||!Array.isArray(interaction.letters)||!interaction.letters.every(l=>l&&typeof l.text==='string'&&Number.isInteger(l.index))))return false;
 if(x?.draft!==undefined&&typeof x.draft!=='string')return false;
 return !!x&&x.setId===setId&&Array.isArray(x.cards)&&x.cards.every(c=>c&&typeof c.id==='string'&&typeof c.front==='string'&&typeof c.back==='string'&&['front-back','back-front'].includes(c.direction))&&Number.isInteger(x.pos)&&x.pos>=0&&x.pos<=x.cards.length&&Array.isArray(x.results)&&x.results.every(r=>r&&typeof r.id==='string'&&r.setId===setId&&typeof r.correct==='boolean')&&modes.some(m=>m[0]===x.mode);
}
export function loadPracticeSession(setId:string):Session|null{
 try{const current=JSON.parse(localStorage.getItem(key(setId))||'null');if(valid(current,setId))return current;const old=JSON.parse(localStorage.getItem(LEGACY)||'null');return valid(old,setId)?old:null}catch{return null}
}
export function savePracticeSession(session:Session){
 localStorage.setItem(key(session.setId),JSON.stringify(session));
 // A successful write migrates the old single-session store for this set only.
 try{const old=JSON.parse(localStorage.getItem(LEGACY)||'null');if(old?.setId===session.setId)localStorage.removeItem(LEGACY)}catch{/* Ignore malformed legacy data. */}
}
export function clearPracticeSession(setId:string){localStorage.removeItem(key(setId));try{const old=JSON.parse(localStorage.getItem(LEGACY)||'null');if(old?.setId===setId)localStorage.removeItem(LEGACY)}catch{/* Ignore malformed legacy data. */}}

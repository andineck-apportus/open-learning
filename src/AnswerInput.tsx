import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {keyboardLayout,editAnswer} from './keyboard-layout';
import {PracticeIcon} from './PracticeIcon';
const MOBILE='(max-width: 760px), (pointer: coarse)';
export function AnswerInput({value,onChange,onSubmit,language,built=false}:{value:string;onChange:(text:string)=>void;onSubmit:()=>void;language:string;built?:boolean}){
 const [mobile,setMobile]=useState(()=>window.matchMedia(MOBILE).matches);
 const [shift,setShift]=useState(false),[symbols,setSymbols]=useState(false);
 const field=useRef<HTMLInputElement>(null),caret=useRef<number|null>(null);
 const layout=keyboardLayout(language),custom=mobile&&!built;
 useEffect(()=>{const query=window.matchMedia(MOBILE);const change=()=>setMobile(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[]);
 useEffect(()=>{setShift(false);setSymbols(false)},[language]);
 useLayoutEffect(()=>{if(caret.current!==null&&field.current){field.current.setSelectionRange(caret.current,caret.current);caret.current=null}},[value]);
 function type(key:string){const input=field.current;const result=editAnswer(value,input?.selectionStart??value.length,input?.selectionEnd??value.length,key);caret.current=result.caret;onChange(result.text);if(key!=='Backspace')setShift(false)}
 function hardware(e:React.KeyboardEvent<HTMLInputElement>){if(!custom||e.ctrlKey||e.metaKey||e.altKey||e.nativeEvent.isComposing)return;if(e.key==='Backspace'||e.key.length===1){e.preventDefault();type(e.key)}else if(e.key==='Enter'){e.preventDefault();if(value.trim())onSubmit()}}
 function key(text:string,display=text){return <button type="button" className="keyboard-key" key={text} onPointerDown={e=>e.preventDefault()} onClick={()=>type(shift?text.toLocaleUpperCase(layout.lang==='und'?undefined:layout.lang):text)}>{shift?display.toLocaleUpperCase(layout.lang==='und'?undefined:layout.lang):display}</button>}
 return <div className="answer-composer">
  <label className="answer-label" htmlFor="practice-answer">Deine Antwort <span>{language}</span></label>
  <input id="practice-answer" ref={field} lang={layout.lang} value={value} onChange={e=>onChange(e.target.value)} onKeyDown={hardware} readOnly={mobile||built} inputMode={mobile||built?'none':'text'} autoFocus={!mobile&&!built} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={built?'Tippe auf die Buchstaben …':'Deine Antwort …'} aria-describedby={custom?'practice-keyboard-name':undefined}/>
  {custom&&<div className="answer-keyboard" role="group" aria-label={`Bildschirmtastatur ${language}`}>
   <div className="keyboard-caption" id="practice-keyboard-name"><PracticeIcon name="keyboard"/><span>{layout.name}</span></div>
   {!symbols&&layout.accents.length>0&&<div className="keyboard-accents" aria-label="Sonderzeichen, seitlich wischen für weitere Zeichen">{layout.accents.map(c=>key(c))}</div>}
   {(symbols?['1234567890','.,!?\'"-:;','()/&+%=@']:layout.rows).map((row,i)=><div className="keyboard-row" key={`${symbols}-${i}`}>
    {!symbols&&i===2&&<button type="button" className="keyboard-key keyboard-function" aria-label="Grossbuchstaben" aria-pressed={shift} onPointerDown={e=>e.preventDefault()} onClick={()=>setShift(!shift)}><PracticeIcon name="shift"/></button>}
    {Array.from(row).map(c=>key(c))}
    {i===2&&<button type="button" className="keyboard-key keyboard-function" aria-label="Letztes Zeichen löschen" onPointerDown={e=>e.preventDefault()} onClick={()=>type('Backspace')}><PracticeIcon name="delete"/></button>}
   </div>)}
   <div className="keyboard-row keyboard-bottom">
    <button type="button" className="keyboard-key keyboard-function" aria-label={symbols?'Buchstaben':'Zahlen und Zeichen'} aria-pressed={symbols} onPointerDown={e=>e.preventDefault()} onClick={()=>setSymbols(!symbols)}>{symbols?'ABC':'123'}</button>
    {!symbols&&key("'")}
    <button type="button" className="keyboard-key keyboard-space" aria-label="Leerzeichen" onPointerDown={e=>e.preventDefault()} onClick={()=>type(' ')}><PracticeIcon name="space"/><span>Leerzeichen</span></button>
    {!symbols&&key('-')}
   </div>
  </div>}
  <button type="submit" className="primary answer-submit" disabled={!value.trim()}><PracticeIcon name="check"/>Antwort prüfen</button>
 </div>;
}

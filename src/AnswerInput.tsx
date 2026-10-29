import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {keyboardLayout,editAnswer} from './keyboard-layout';
import {PracticeIcon} from './PracticeIcon';
import {KEYBOARD_PREFERENCES_KEY,defaultKeyboardPreferences,keyboardLanguages,needsCustomKeyboard,parseKeyboardPreferences,type KeyboardLanguage,type KeyboardArrangement} from './keyboard-preferences';
const SMALL_SCREEN='(max-width: 760px)',TOUCH_POINTER='(pointer: coarse), (any-pointer: coarse)';
function deviceNeedsKeyboard(){return needsCustomKeyboard({
 smallScreen:window.matchMedia(SMALL_SCREEN).matches,
 coarsePointer:window.matchMedia(TOUCH_POINTER).matches,
 maxTouchPoints:navigator.maxTouchPoints,
 userAgent:navigator.userAgent,
 mobileHint:(navigator as Navigator & {userAgentData?:{mobile?:boolean}}).userAgentData?.mobile
})}
function storedPreferences(){try{return parseKeyboardPreferences(localStorage.getItem(KEYBOARD_PREFERENCES_KEY))}catch{return {...defaultKeyboardPreferences}}}
export function AnswerInput({value,onChange,onSubmit,language,built=false,answerLocked=false,submitLabel='Antwort prüfen',allowEmpty=false}:{value:string;onChange:(text:string)=>void;onSubmit:()=>void;language:string;built?:boolean;answerLocked?:boolean;submitLabel?:string;allowEmpty?:boolean}){
 const [automatic,setAutomatic]=useState(deviceNeedsKeyboard);
 const [preferences,setPreferences]=useState(storedPreferences);
 const [shift,setShift]=useState(false),[symbols,setSymbols]=useState(false);
 const field=useRef<HTMLInputElement>(null),caret=useRef<number|null>(null);
 const keyboardLanguage=preferences.language==='auto'?language:preferences.language;
 const layout=keyboardLayout(keyboardLanguage,preferences.arrangement),custom=(automatic||preferences.onDesktop)&&!built,locked=custom||built;
 const defaultArrangement=keyboardLayout(keyboardLanguage).rows[0].startsWith('qwertz')?'QWERTZ':'QWERTY';
 useEffect(()=>{const queries=[window.matchMedia(SMALL_SCREEN),window.matchMedia(TOUCH_POINTER)];const change=()=>setAutomatic(deviceNeedsKeyboard());queries.forEach(q=>q.addEventListener('change',change));return()=>queries.forEach(q=>q.removeEventListener('change',change))},[]);
 useEffect(()=>{try{localStorage.setItem(KEYBOARD_PREFERENCES_KEY,JSON.stringify(preferences))}catch{/* Typing remains available when storage is blocked. */}},[preferences]);
 useEffect(()=>{setShift(false);setSymbols(false)},[keyboardLanguage,preferences.arrangement]);
 useLayoutEffect(()=>{if(!locked&&!answerLocked)field.current?.focus({preventScroll:true})},[locked,answerLocked]);
 useLayoutEffect(()=>{if(caret.current!==null&&field.current){field.current.setSelectionRange(caret.current,caret.current);caret.current=null}},[value]);
 function type(key:string){if(answerLocked)return;const input=field.current;const result=editAnswer(value,input?.selectionStart??value.length,input?.selectionEnd??value.length,key);caret.current=result.caret;onChange(result.text);if(key!=='Backspace')setShift(false)}
 function hardware(e:React.KeyboardEvent<HTMLInputElement>){if(!custom||e.ctrlKey||e.metaKey||e.altKey||e.nativeEvent.isComposing)return;if(e.key==='Backspace'||e.key.length===1){e.preventDefault();type(e.key)}else if(e.key==='Enter'){e.preventDefault();if(value.trim())onSubmit()}}
 function key(text:string,display=text){return <button type="button" className="keyboard-key" disabled={answerLocked} key={text} onPointerDown={e=>e.preventDefault()} onClick={()=>type(shift?text.toLocaleUpperCase(layout.lang==='und'?undefined:layout.lang):text)}>{shift?display.toLocaleUpperCase(layout.lang==='und'?undefined:layout.lang):display}</button>}
 return <div className="answer-composer">
  <label className="answer-label" htmlFor="practice-answer">Deine Antwort <span>{language}</span></label>
  <input id="practice-answer" ref={field} lang={keyboardLayout(language).lang} value={value} onChange={e=>{if(!answerLocked)onChange(e.target.value)}} onKeyDown={e=>{if(!answerLocked)hardware(e)}} readOnly={locked||answerLocked} inputMode={locked?'none':'text'} autoFocus={!locked} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={built?'Tippe auf die Buchstaben …':'Deine Antwort …'} aria-describedby={custom?'practice-keyboard-name':undefined}/>
  {!automatic&&!built&&<button type="button" className="keyboard-toggle" aria-expanded={custom} onClick={()=>setPreferences(p=>({...p,onDesktop:!p.onDesktop}))}><PracticeIcon name="keyboard"/>Bildschirmtastatur {custom?'ausblenden':'anzeigen'}</button>}
  {custom&&<div className="answer-keyboard" role="group" aria-label={`Bildschirmtastatur ${layout.name}`}>
   <div className="keyboard-caption" id="practice-keyboard-name"><PracticeIcon name="keyboard"/><span>{layout.name}</span></div>
   <details className="keyboard-settings-panel"><summary>{layout.name} · anpassen</summary><div className="keyboard-settings">
    <label>Tastatursprache<select disabled={answerLocked} aria-label="Tastatursprache" value={preferences.language} onChange={e=>setPreferences(p=>({...p,language:e.target.value as KeyboardLanguage}))}>{keyboardLanguages.map(([code,name])=><option key={code} value={code}>{code==='auto'?`Auto · ${language}`:name}</option>)}</select></label>
    <label>Anordnung<select disabled={answerLocked} aria-label="Tastenanordnung" value={preferences.arrangement} onChange={e=>setPreferences(p=>({...p,arrangement:e.target.value as KeyboardArrangement}))}><option value="auto">Standard · {defaultArrangement}</option><option value="qwertz">QWERTZ</option><option value="qwerty">QWERTY</option></select></label>
   </div></details>
   {!symbols&&layout.accents.length>0&&<div className="keyboard-accents" aria-label="Sonderzeichen, seitlich wischen für weitere Zeichen">{layout.accents.map(c=>key(c))}</div>}
   {(symbols?['1234567890','.,!?\'"-:;','()/&+%=@']:layout.rows).map((row,i)=><div className="keyboard-row" key={`${symbols}-${i}`}>
    {!symbols&&i===2&&<button type="button" disabled={answerLocked} className="keyboard-key keyboard-function" aria-label="Grossbuchstaben" aria-pressed={shift} onPointerDown={e=>e.preventDefault()} onClick={()=>setShift(!shift)}><PracticeIcon name="shift"/></button>}
    {Array.from(row).map(c=>key(c))}
    {i===2&&<button type="button" disabled={answerLocked} className="keyboard-key keyboard-function" aria-label="Letztes Zeichen löschen" onPointerDown={e=>e.preventDefault()} onClick={()=>type('Backspace')}><PracticeIcon name="delete"/></button>}
   </div>)}
   <div className="keyboard-row keyboard-bottom">
    <button type="button" disabled={answerLocked} className="keyboard-key keyboard-function" aria-label={symbols?'Buchstaben':'Zahlen und Zeichen'} aria-pressed={symbols} onPointerDown={e=>e.preventDefault()} onClick={()=>setSymbols(!symbols)}>{symbols?'ABC':'123'}</button>
    {!symbols&&key("'")}
    <button type="button" disabled={answerLocked} className="keyboard-key keyboard-space" aria-label="Leerzeichen" onPointerDown={e=>e.preventDefault()} onClick={()=>type(' ')}><PracticeIcon name="space"/><span>Leerzeichen</span></button>
    {!symbols&&key('-')}
   </div>
  </div>}
  <button type="submit" className="primary answer-submit" disabled={!allowEmpty&&!value.trim()}><PracticeIcon name={allowEmpty?'next':'check'}/>{submitLabel}</button>
 </div>;
}

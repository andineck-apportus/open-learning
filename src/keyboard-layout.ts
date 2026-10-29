import {type KeyboardArrangement} from './keyboard-preferences';
export type KeyboardLayout={name:string;lang:string;rows:string[];accents:string[]};
/** The requested answer's language controls the keyboard, including reversed and dictation tasks. */
function defaultLayout(label:string):KeyboardLayout{
 if(/franz|french|^fr(?:-|$)/i.test(label))return {name:'Français · QWERTZ',lang:'fr',rows:['qwertzuiop','asdfghjkl','yxcvbnm'],accents:[...'éèêàçùâîôûëïüœæÿ']};
 if(/deutsch|german|^de(?:-|$)/i.test(label))return {name:/schweiz|swiss|de-ch/i.test(label)?'Deutsch (CH) · QWERTZ':'Deutsch · QWERTZ',lang:'de',rows:['qwertzuiop','asdfghjkl','yxcvbnm'],accents:[...(/schweiz|swiss|de-ch/i.test(label)?'äöü':'äöüß')]};
 if(/span|español|^es(?:-|$)/i.test(label))return {name:'Español · QWERTY',lang:'es',rows:['qwertyuiop','asdfghjklñ','zxcvbnm'],accents:[...'áéíóúü¿¡']};
 if(/ital|^it(?:-|$)/i.test(label))return {name:'Italiano · QWERTY',lang:'it',rows:['qwertyuiop','asdfghjkl','zxcvbnm'],accents:[...'àèéìòù']};
 if(/engl|english|^en(?:-|$)/i.test(label))return {name:'English · QWERTY',lang:'en',rows:['qwertyuiop','asdfghjkl','zxcvbnm'],accents:[]};
 return {name:'ABC · QWERTY',lang:'und',rows:['qwertyuiop','asdfghjkl','zxcvbnm'],accents:[...'äöüàáâçéèêëíîïñóôœúùû']};
}
/** Layout can change independently of the language's accents and special letters. */
export function keyboardLayout(label:string,arrangement:KeyboardArrangement='auto'):KeyboardLayout{
 const base=defaultLayout(label);
 if(arrangement==='auto')return base;
 const rows=arrangement==='qwertz'?['qwertzuiop','asdfghjkl','yxcvbnm']:['qwertyuiop','asdfghjkl','zxcvbnm'];
 if(base.lang==='es')rows[1]+='ñ';
 return {...base,name:base.name.replace(/QWERT[ZY]$/,arrangement.toUpperCase()),rows};
}
export function editAnswer(text:string,start:number,end:number,key:string){
 if(key==='Backspace'&&start===end&&start>0)start-=Array.from(text.slice(0,start)).at(-1)!.length;
 const insertion=key==='Backspace'?'':key;
 return {text:text.slice(0,start)+insertion+text.slice(end),caret:start+insertion.length};
}

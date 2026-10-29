export const keyboardLanguages=[
 ['auto','Automatisch'],['fr','Französisch'],['de-CH','Deutsch (CH)'],['de','Deutsch'],['en','Englisch'],['it','Italienisch'],['es','Spanisch']
] as const;
export type KeyboardLanguage=typeof keyboardLanguages[number][0];
export type KeyboardArrangement='auto'|'qwertz'|'qwerty';
export type KeyboardPreferences={language:KeyboardLanguage;arrangement:KeyboardArrangement;onDesktop:boolean};
export const KEYBOARD_PREFERENCES_KEY='ol-keyboard-preferences-v1';
export const defaultKeyboardPreferences:KeyboardPreferences={language:'auto',arrangement:'auto',onDesktop:false};
/** Ignore unknown/old preferences rather than making the answer field unusable. */
export function parseKeyboardPreferences(raw:string|null):KeyboardPreferences{
 try{const value=JSON.parse(raw||'null');return {
  language:keyboardLanguages.some(([code])=>code===value?.language)?value.language:'auto',
  arrangement:['auto','qwertz','qwerty'].includes(value?.arrangement)?value.arrangement:'auto',
  onDesktop:value?.onDesktop===true
 }}catch{return {...defaultKeyboardPreferences}}
}
export type KeyboardDeviceHints={smallScreen?:boolean;coarsePointer?:boolean;maxTouchPoints?:number;userAgent?:string;mobileHint?:boolean};
/** Capability checks are primary; UA hints also catch tablets in desktop mode and older browsers. */
export function needsCustomKeyboard(hints:KeyboardDeviceHints):boolean{
 return !!(hints.smallScreen||hints.coarsePointer||(hints.maxTouchPoints||0)>0||hints.mobileHint||/Android|iPad|iPhone|iPod|Tablet|Kindle|Silk|PlayBook|Mobile/i.test(hints.userAgent||''));
}

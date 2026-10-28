import React from 'react';
export type PracticeIconName='learn'|'game'|'flip'|'write'|'listen'|'choice'|'build'|'truth'|'match'|'memory'|'test'|'play'|'back'|'next'|'check'|'repeat'|'keyboard'|'shift'|'delete'|'space'|'letters'|'settings';
const paths:Record<PracticeIconName,React.ReactNode>={
 learn:<><path d="M12 5v15M3 4h4a7 7 0 0 1 5 2 7 7 0 0 1 5-2h4v15h-4a7 7 0 0 0-5 2 7 7 0 0 0-5-2H3V4Z"/></>,
 game:<><path d="M7 7h10a4 4 0 0 1 4 3l1 7a2 2 0 0 1-3 2l-3-3H8l-3 3a2 2 0 0 1-3-2l1-7a4 4 0 0 1 4-3Z"/><path d="M5 11h5M7.5 8.5v5M16 10h.01M18 12h.01"/></>,
 flip:<><rect x="7" y="3" width="13" height="16" rx="2"/><path d="M4 7v13a2 2 0 0 0 2 2h10M10 8h7M10 12h5"/></>,
 write:<><path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-5L4 14v6ZM4 20h16"/></>,
 listen:<><path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/></>,
 choice:<><rect x="3" y="4" width="5" height="5" rx="1"/><path d="m4 6 1 1 2-2M12 6h9M12 17h9"/><rect x="3" y="14" width="5" height="5" rx="1"/></>,
 build:<><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M7 6v2M16 17h2M15 4h5v5M4 15v5h5"/></>,
 truth:<><circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/></>,
 match:<><rect x="2" y="4" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1"/><path d="M8 7h7a4 4 0 0 1 0 8h-2M16 17H9a4 4 0 0 1 0-8h2"/></>,
 memory:<>{[3,13].flatMap(x=>[3,13].map(y=><rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" rx="1.5"/>))}</>,
 test:<><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h6M9 19h3"/></>,
 play:<path d="m8 4 12 8-12 8V4Z"/>,back:<path d="m14 5-7 7 7 7"/>,next:<path d="m10 5 7 7-7 7"/>,check:<path d="m5 12 4 4L20 5"/>,repeat:<><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>,
 keyboard:<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/></>,
 shift:<path d="m12 3 9 9h-6v8H9v-8H3l9-9Z"/>,delete:<><path d="M9 5h12v14H9l-7-7 7-7Z"/><path d="m12 9 6 6m0-6-6 6"/></>,space:<path d="M4 9v7h16V9"/>,letters:<><path d="m3 19 6-14 6 14M5 14h8M19 8v11M17 10h4"/></>,settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>
};
export function PracticeIcon({name,className=''}:{name:PracticeIconName;className?:string}){return <svg className={`practice-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>}

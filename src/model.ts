export type Versioned={fieldVersions?:Record<string,string>};
export type Item=Versioned&{position?:number;id:string;front:string;back:string;kind:'translation'|'qa';alternatives?:string[];example?:string;source?:string};
export type SetData=Versioned&{deletedItemIds?:string[];id:string;subjectId:string;title:string;items:Item[];frontLanguage?:string;backLanguage?:string;createdAt:string;updatedAt:string};
export type Subject=Versioned&{id:string;name:string;updatedAt?:string};
export type Attempt={id:string;itemId:string;setId:string;direction:'front-back'|'back-front';correct:boolean;attempts:number;practiceMode?:string;createdAt:string};
export type Library={schema:1;subjects:Subject[];sets:SetData[];attempts:Attempt[];deletedSubjectIds?:string[];deletedSetIds?:string[];updatedAt:string};
export const uid=()=>crypto.randomUUID();
export const normalize=(s:string)=>s.trim().toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[.!?]+$/,"").replace(/\s+/g,' ');
// Authored learning aids for the built-in sample set, not transcriptions from a photo.
const starterExamples=[
 'Paul est mon meilleur ami.\nPaul ist mein bester Freund.',
 'Ton idée est géniale !\nDeine Idee ist genial!',
 'Ce film est drôle.\nDieser Film ist lustig.',
 'Le quartier est tranquille.\nDas Quartier ist ruhig.',
 'Nous avons des goûts différents.\nWir haben unterschiedliche Vorlieben.',
 'Quelle est la différence ?\nWas ist der Unterschied?',
 'Ton amitié est importante pour moi.\nDeine Freundschaft ist mir wichtig.',
 'Je parle français avec mon voisin.\nIch spreche Französisch mit meinem Nachbarn.',
 'J’aime passer du temps avec mes amis.\nIch verbringe gern Zeit mit meinen Freunden.',
 'Nous avons le même âge.\nWir sind gleich alt.',
 'Nous parlons beaucoup ensemble.\nWir sprechen viel miteinander.',
 'J’aime son humour.\nIch mag seinen Humor.',
 'On rigole souvent ensemble.\nWir lachen oft zusammen.',
 'Nous aimons passer notre temps libre ensemble.\nWir verbringen unsere Freizeit gern zusammen.',
 'Même en vacances, elle garde toujours contact avec moi.\nAuch in den Ferien bleibt sie immer in Kontakt mit mir.',
 'Le soir, nous nous envoyons des clips.\nAm Abend senden wir uns Clips zu.',
 'Mon ami est drôle : il me fait rire.\nMein Freund ist lustig: Er bringt mich zum Lachen.',
 'Ma voisine a treize ans.\nMeine Nachbarin ist dreizehn Jahre alt.',
 'Ma voisine est très sympa.\nMeine Nachbarin ist sehr nett.',
 'Je rencontre un ami après l’école.\nIch treffe nach der Schule einen Freund.',
 'Je la connais depuis longtemps.\nIch kenne sie schon lange.',
 'Nous sommes amis depuis cinq ans.\nWir sind seit fünf Jahren befreundet.',
 'Nous avons beaucoup de points communs.\nWir haben viele Gemeinsamkeiten.',
 'Mon meilleur ami est toujours là pour moi.\nMein bester Freund ist immer für mich da.',
 'Je peux tout lui raconter, même mes soucis.\nIch kann ihm alles erzählen, auch meine Sorgen.',
 'Je peux lui faire confiance : il garde mes secrets.\nIch kann ihm vertrauen: Er behält meine Geheimnisse für sich.',
 'Il m’aide souvent avec mes devoirs.\nEr hilft mir oft bei meinen Hausaufgaben.',
 'Je lis tandis que Paul joue. J’ai presque fini.\nIch lese, während Paul spielt. Ich bin fast fertig.'
];

export const starterPairs:[string,string][]=[
['le meilleur ami / la meilleure amie','der beste Freund / die beste Freundin'],
['génial/e','genial'],['drôle, amusant/e','lustig, witzig, amüsant'],
['tranquille','ruhig, still'],['différent/e','anders, unterschiedlich, verschieden'],
['la différence','der Unterschied'],['important/e','wichtig'],['parler','sprechen'],
['aimer','mögen, gernhaben, lieben'],['le/la même','der/die/das gleiche'],
['beaucoup','viel'],["l'humour (m)",'der Humor'],['rigoler','lachen'],
['passer le temps libre ensemble','die Freizeit gemeinsam verbringen'],
['Elle garde toujours contact avec moi.','Sie bleibt immer in Kontakt mit mir.'],
['Nous nous envoyons des clips.','Wir senden uns Clips zu.'],['Il me fait rire.','Er bringt mich zum Lachen.'],
['avoir 13 ans','13 Jahre alt sein'],['le voisin / la voisine','der Nachbar / die Nachbarin'],
['rencontrer un ami','einen Freund treffen'],['Je le/la connais.','Ich kenne ihn/sie.'],
['depuis cinq ans','seit fünf Jahren'],['avoir des points communs','Gemeinsamkeiten haben'],
['être là pour qn','für jmdn. da sein'],['Je peux tout lui raconter.','Ich kann ihm/ihr alles erzählen.'],
['Je peux lui faire confiance.','Ich kann ihm/ihr vertrauen.'],["Il m'aide souvent.",'Er hilft mir oft.'],
['tandis que / presque','wohingegen (während) / fast']];
export function initialLibrary():Library{const now='2020-01-01T00:00:00.000Z';return{schema:1,subjects:[{id:'french',name:'Französisch'}],sets:[{id:'unite2',subjectId:'french',title:'Unité 2 – Lernziel 1',frontLanguage:'Französisch',backLanguage:'Deutsch',createdAt:now,updatedAt:now,items:starterPairs.map(([front,back],i)=>({id:'u2-'+(i+1),front,back,kind:'translation',example:starterExamples[i]}))}],attempts:[],updatedAt:now}}
export function validLibrary(x:unknown):x is Library {
 if(!x||typeof x!=='object')return false;
 const v=x as Library,ids=(a:unknown)=>a===undefined||Array.isArray(a)&&a.every(x=>typeof x==='string');
 const versioned=(a:Versioned)=>a.fieldVersions===undefined||!!a.fieldVersions&&typeof a.fieldVersions==='object'&&Object.values(a.fieldVersions).every(x=>typeof x==='string');
 const date=(a:unknown)=>typeof a==='string'&&Number.isFinite(Date.parse(a));
 return v.schema===1&&date(v.updatedAt)&&ids(v.deletedSubjectIds)&&ids(v.deletedSetIds)&&Array.isArray(v.subjects)&&v.subjects.every(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&versioned(s))&&Array.isArray(v.sets)&&v.sets.every(s=>s&&typeof s.id==='string'&&typeof s.subjectId==='string'&&typeof s.title==='string'&&date(s.createdAt)&&date(s.updatedAt)&&ids(s.deletedItemIds)&&versioned(s)&&Array.isArray(s.items)&&s.items.every(i=>i&&typeof i.id==='string'&&typeof i.front==='string'&&typeof i.back==='string'&&['translation','qa'].includes(i.kind)&&versioned(i)))&&Array.isArray(v.attempts)&&v.attempts.every(a=>a&&typeof a.id==='string'&&typeof a.itemId==='string'&&typeof a.setId==='string'&&date(a.createdAt)&&typeof a.correct==='boolean');
}
export function possibleAnswers(s:string):string[]{const special:Record<string,string[]>={'génial/e':['génial','géniale'],'différent/e':['différent','différente'],'important/e':['important','importante'],'le/la même':['le même','la même'],'Je le/la connais.':['Je le connais','Je la connais'],'le meilleur ami / la meilleure amie':['le meilleur ami','la meilleure amie'],'le voisin / la voisine':['le voisin','la voisine'],'tandis que / presque':['tandis que','presque'],'wohingegen (während) / fast':['wohingegen','während','fast'],'der beste Freund / die beste Freundin':['der beste Freund','die beste Freundin'],'der Nachbar / die Nachbarin':['der Nachbar','die Nachbarin'],'Ich kenne ihn/sie.':['Ich kenne ihn','Ich kenne sie'],'der/die/das gleiche':['der gleiche','die gleiche','das gleiche']};return special[s]??(s.includes(',')?s.split(',').map(x=>x.trim()):[s])}
export function deleteLibraryEntity(lib:Library,kind:'subject'|'set',id:string):Library {
 const deletedSubjectIds=[...new Set([...(lib.deletedSubjectIds||[]),...(kind==='subject'?[id]:[])])];
 const removedSets=lib.sets.filter(s=>kind==='subject'?s.subjectId===id:s.id===id).map(s=>s.id);
 const deletedSetIds=[...new Set([...(lib.deletedSetIds||[]),...removedSets,...(kind==='set'?[id]:[])])];
 return {...lib,deletedSubjectIds,deletedSetIds,subjects:lib.subjects.filter(s=>!deletedSubjectIds.includes(s.id)),sets:lib.sets.filter(s=>!deletedSetIds.includes(s.id)&&!deletedSubjectIds.includes(s.subjectId)),attempts:lib.attempts.filter(a=>!deletedSetIds.includes(a.setId)),updatedAt:new Date().toISOString()};
}
// Canonical ordering makes merging commutative, including equal timestamps.
export function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
const union=(a:string[]=[],b:string[]=[])=>[...new Set([...a,...b])].sort();
function mergeFields<T extends Versioned>(a:T,b:T,fields:string[],aFallback:string,bFallback:string):T {
 const out={...a} as T & Record<string,unknown>;const versions={...a.fieldVersions};
 for(const key of fields){
  const av=a.fieldVersions?.[key]||aFallback,bv=b.fieldVersions?.[key]||bFallback;
  const left=(a as Record<string,unknown>)[key],right=(b as Record<string,unknown>)[key];
  const useB=bv>av||(bv===av&&canonical(right)>canonical(left));
  (out as Record<string,unknown>)[key]=useB?right:left;versions[key]=useB?bv:av;
 }
 out.fieldVersions=versions;return out;
}
const subjectFields=['name'],setFields=['title','subjectId','frontLanguage','backLanguage'],itemFields=['front','back','kind','alternatives','example','source'];
const epoch='2020-01-01T00:00:00.000Z';
function withVersions(lib:Library):Library {
 const fill=<T extends Versioned>(v:T,fields:string[],fallback:string):T=>({...v,fieldVersions:Object.fromEntries(fields.map(k=>[k,v.fieldVersions?.[k]||fallback]))});
 return {...lib,subjects:lib.subjects.map(s=>fill(s,subjectFields,s.updatedAt||epoch)),sets:lib.sets.map(s=>({...fill(s,setFields,s.updatedAt),items:s.items.map((i,index)=>({...fill(i,itemFields,s.updatedAt),position:i.position??index}))}))};
}
export function mergeLibraries(a:Library,b:Library):Library {
 a=withVersions(a);b=withVersions(b);
 const deletedSubjectIds=union(a.deletedSubjectIds,b.deletedSubjectIds);
 const subjects=new Map(a.subjects.map(x=>[x.id,x]));
 for(const x of b.subjects){const old=subjects.get(x.id);subjects.set(x.id,old?{...mergeFields(old,x,subjectFields,old.updatedAt||epoch,x.updatedAt||epoch),updatedAt:[old.updatedAt||epoch,x.updatedAt||epoch].sort().at(-1)}:x)}
 const sets=new Map(a.sets.map(x=>[x.id,x]));
 for(const x of b.sets){
  const old=sets.get(x.id);if(!old){sets.set(x.id,x);continue;}
  const deletedItemIds=union(old.deletedItemIds,x.deletedItemIds);
  const items=new Map(old.items.map((i,index)=>[i.id,{...i,position:i.position??index}]));
  for(const [index,raw] of x.items.entries()){const i={...raw,position:raw.position??index};const prev=items.get(i.id);items.set(i.id,prev?{...mergeFields(prev,i,itemFields,old.updatedAt,x.updatedAt),position:Math.min(prev.position,i.position)}:i)}
  sets.set(x.id,{...mergeFields(old,x,setFields,old.updatedAt,x.updatedAt),createdAt:[old.createdAt,x.createdAt].sort()[0],updatedAt:[old.updatedAt,x.updatedAt].sort().at(-1)!,deletedItemIds,items:[...items.values()].filter(i=>!deletedItemIds.includes(i.id)).sort((a,b)=>(a.position??0)-(b.position??0)||a.id.localeCompare(b.id))});
 }
 const deletedSetIds=union(union(a.deletedSetIds,b.deletedSetIds),[...sets.values()].filter(s=>deletedSubjectIds.includes(s.subjectId)).map(s=>s.id));
 const attempts=new Map(a.attempts.map(x=>[x.id,x]));for(const x of b.attempts){const old=attempts.get(x.id);if(!old||canonical(x)>canonical(old))attempts.set(x.id,x)}
 return {schema:1,subjects:[...subjects.values()].filter(x=>!deletedSubjectIds.includes(x.id)).sort((a,b)=>a.id.localeCompare(b.id)),sets:[...sets.values()].filter(x=>!deletedSetIds.includes(x.id)).sort((a,b)=>a.id.localeCompare(b.id)),attempts:[...attempts.values()].filter(x=>!deletedSetIds.includes(x.setId)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)),deletedSubjectIds,deletedSetIds,updatedAt:[a.updatedAt,b.updatedAt].sort().at(-1)!};
}
// Stamp only edited fields; unrelated changes retain their original versions.
export function stampChanges(before:Library,after:Library):Library {
 const now=new Date(Math.max(Date.now(),Date.parse(before.updatedAt)+1)).toISOString();
 function stamp<T extends Versioned>(old:T|undefined,next:T,fields:string[],fallback:string):T {
  const versions={...old?.fieldVersions,...next.fieldVersions};
  for(const key of fields)versions[key]=!old||canonical((old as Record<string,unknown>)[key])!==canonical((next as Record<string,unknown>)[key])?now:(old.fieldVersions?.[key]||fallback);
  return {...next,fieldVersions:versions};
 }
 const subjects=after.subjects.map(x=>{const old=before.subjects.find(o=>o.id===x.id);return {...stamp(old,x,subjectFields,old?.updatedAt||epoch),updatedAt:old?.name===x.name?old.updatedAt:now}});
 const sets=after.sets.map(x=>{const old=before.sets.find(o=>o.id===x.id);return {...stamp(old,x,setFields,old?.updatedAt||epoch),updatedAt:canonical(old)===canonical(x)?x.updatedAt:now,deletedItemIds:union(x.deletedItemIds,old?.items.filter(i=>!x.items.some(n=>n.id===i.id)).map(i=>i.id)),items:x.items.map((i,index)=>({...stamp(old?.items.find(o=>o.id===i.id),i,itemFields,old?.updatedAt||epoch),position:i.position??index}))}});
 return {...after,subjects,sets,deletedSubjectIds:union(after.deletedSubjectIds,before.subjects.filter(x=>!after.subjects.some(y=>y.id===x.id)).map(x=>x.id)),deletedSetIds:union(after.deletedSetIds,before.sets.filter(x=>!after.sets.some(y=>y.id===x.id)).map(x=>x.id)),updatedAt:now};
}

/** Language labels are per set, and deliberately remain editable. Older data are compatible. */
export function setLanguageLabels(set:SetData,subjectName:string):[string,string]{
  if(set.items.length>0&&set.items.every(i=>i.kind==='qa'))return ['Frage','Antwort'];
  const name=subjectName.toLocaleLowerCase('de');
  const inherited=name.includes('französisch')?['Französisch','Deutsch']:name.includes('englisch')?['Englisch','Deutsch']:['Seite 1','Seite 2'];
  return [set.frontLanguage?.trim()||inherited[0],set.backLanguage?.trim()||inherited[1]];
}


/** Old installations get the same sample examples; edited/imported cards are never guessed. */
export function exampleForItem(setId:string,item:Item):string|undefined{
 if(item.example!==undefined)return item.example;
 if(setId!=='unite2')return undefined;
 const index=starterPairs.findIndex(([front,back],i)=>item.id===`u2-${i+1}`&&item.front===front&&item.back===back);
 return index<0?undefined:starterExamples[index];
}

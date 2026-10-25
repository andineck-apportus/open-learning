export type Item={id:string;front:string;back:string;kind:'translation'|'qa';alternatives?:string[];source?:string};
export type SetData={id:string;subjectId:string;title:string;items:Item[];createdAt:string;updatedAt:string};
export type Subject={id:string;name:string};
export type Attempt={id:string;itemId:string;setId:string;direction:'front-back'|'back-front';correct:boolean;attempts:number;createdAt:string};
export type Library={schema:1;subjects:Subject[];sets:SetData[];attempts:Attempt[];updatedAt:string};
export const uid=()=>crypto.randomUUID();
export const normalize=(s:string)=>s.trim().toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[.!?]+$/,"").replace(/\s+/g,' ');
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
export function initialLibrary():Library{const now=new Date().toISOString();return{schema:1,subjects:[{id:'french',name:'Französisch'}],sets:[{id:'unite2',subjectId:'french',title:'Unité 2 – Lernziel 1',createdAt:now,updatedAt:now,items:starterPairs.map(([front,back],i)=>({id:'u2-'+(i+1),front,back,kind:'translation'}))}],attempts:[],updatedAt:now}}
export function validLibrary(x:unknown):x is Library{if(!x||typeof x!=='object')return false;const a=x as Record<string,unknown>;return a.schema===1&&Array.isArray(a.subjects)&&Array.isArray(a.sets)&&Array.isArray(a.attempts)}
export function possibleAnswers(s:string):string[]{const special:Record<string,string[]>={'génial/e':['génial','géniale'],'différent/e':['différent','différente'],'important/e':['important','importante'],'le/la même':['le même','la même'],'Je le/la connais.':['Je le connais','Je la connais'],'le meilleur ami / la meilleure amie':['le meilleur ami','la meilleure amie'],'le voisin / la voisine':['le voisin','la voisine'],'tandis que / presque':['tandis que','presque'],'wohingegen (während) / fast':['wohingegen','während','fast'],'der beste Freund / die beste Freundin':['der beste Freund','die beste Freundin'],'der Nachbar / die Nachbarin':['der Nachbar','die Nachbarin'],'Ich kenne ihn/sie.':['Ich kenne ihn','Ich kenne sie'],'der/die/das gleiche':['der gleiche','die gleiche','das gleiche']};return special[s]??(s.includes(',')?s.split(',').map(x=>x.trim()):[s])}
export function mergeLibraries(a:Library,b:Library):Library{
 const byId=<T extends {id:string}>(xs:T[],ys:T[])=>[...new Map([...xs,...ys].map(x=>[x.id,x])).values()];
 const mergedSets=new Map(a.sets.map(s=>[s.id,s]));
 for(const s of b.sets){const old=mergedSets.get(s.id);if(!old||s.updatedAt>old.updatedAt)mergedSets.set(s.id,s)}
 return{schema:1,subjects:byId(a.subjects,b.subjects),sets:[...mergedSets.values()],attempts:byId(a.attempts,b.attempts),updatedAt:new Date().toISOString()}
}

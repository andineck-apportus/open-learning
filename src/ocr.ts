import { createWorker } from 'tesseract.js';

/** OCR runs on the user's own device. Language data are downloaded on first use. */
export async function recognizeImage(image: string, languages: string[], progress?: (value:number)=>void):Promise<string>{
  const worker=await createWorker(languages,1,{logger: m=>{
    if(m.status==='recognizing text')progress?.(Math.round((m.progress||0)*100));
  }});
  try {const {data}=await worker.recognize(image);return data.text;}finally{await worker.terminate();}
}
/** Conservative two-column line heuristics, with explicit human review before saving. */
export function pairCandidates(text:string):[string,string][]{
 const lines=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
 const pairs:[string,string][]=[];
 for(const line of lines){
  const cleaned=line.replace(/^\s*\d+[.)]\s*/,'').trim();
  const parts=cleaned.split(/\t+|\s*;\s*|\s{3,}|\s+[|¦]\s+/).map(s=>s.trim()).filter(Boolean);
  if(parts.length===2&&parts[0].length<160&&parts[1].length<160)pairs.push([parts[0],parts[1]]);
 }
 return pairs;
}

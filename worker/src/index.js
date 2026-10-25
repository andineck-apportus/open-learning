const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-OpenAI-Key',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const respond = (data, status, origin) => new Response(JSON.stringify(data), {
  status, headers: {'Content-Type':'application/json; charset=utf-8', ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin}
});
const allowedModels = new Set(['gpt-4.1-mini','gpt-4.1','gpt-4o-mini','gpt-4o']);
const schema = {
  type:'object', additionalProperties:false, required:['items','frontLanguage','backLanguage'], properties:{
    frontLanguage:{type:'string'},backLanguage:{type:'string'},
    items:{type:'array',items:{type:'object',additionalProperties:false,required:['front','back','kind'],properties:{
      front:{type:'string'},back:{type:'string'},kind:{type:'string',enum:['translation','qa']}
    }}}
  }
};
export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin')||'';
    const allowed=(env.ALLOWED_ORIGINS||'https://andineck-apportus.github.io,http://localhost:5173').split(',').map(x=>x.trim());
    // This is an abuse-reduction measure, not an authentication boundary. CORS can be bypassed by non-browser clients.
    if(!allowed.includes(origin))return new Response('Origin not allowed',{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...CORS_HEADERS,'Access-Control-Allow-Origin':origin}});
    if(new URL(request.url).pathname!=='/api/extract'||request.method!=='POST')
      return respond({error:'Not found'},404,origin);
    const key=request.headers.get('X-OpenAI-Key')||'';
    if(!/^sk-[A-Za-z0-9_-]{16,}$/.test(key))return respond({error:'Enter a valid-looking OpenAI API key.'},401,origin);
    const length=Number(request.headers.get('Content-Length')||0);
    if(length>6_000_000)return respond({error:'Image too large'},413,origin);
    let data;
    try{
      const raw=await request.text();
      if(raw.length>6_000_000)return respond({error:'Image too large'},413,origin);
      data=JSON.parse(raw);
    }catch{return respond({error:'Invalid JSON body'},400,origin)}
    const image=data?.image;
    if(typeof image!=='string'||image.length>6_000_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
      return respond({error:'Expected a JPEG, PNG or WebP image under the size limit'},400,origin);
    const topic=String(data.subject||'general study').slice(0,80);
    const mode=data.mode==='qa'?'qa':data.mode==='translation'?'translation':'auto';
    const model=allowedModels.has(data.model)?data.model:'gpt-4.1-mini';
    try{
      const timeout=AbortSignal.timeout(45000);
      const response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST', signal:timeout,
        headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify({
          model,store:false,max_output_tokens:2400,
          input:[{role:'user',content:[
            {type:'input_text',text:`Analyze this photographed school material for subject: ${topic}. Output only study cards grounded explicitly in the visible source. Mode: ${mode}. For vocabulary: associate the original language pairs accurately, do not invent translations. Identify the actual language on each side of the vocabulary table; return human-readable German language names in frontLanguage and backLanguage (e.g. Französisch and Deutsch) matching the order of the front and back entries. Do not assume front and back ordering from the subject label. If unsure, set that language name to an empty string. For factual question-answer sets use frontLanguage=Frage and backLanguage=Antwort. For factual subjects (history, biology, etc.) make brief clear factual question-answer cards based on the visible content; avoid speculative details. Preserve accents, articles and dates. If unreadable or ambiguous, omit that entry. Return up to 60 cards; the learner must review all proposals.`},
            {type:'input_image',image_url:image,detail:'high'}
          ]}],
          text:{format:{type:'json_schema',name:'study_cards',strict:true,schema}}
        })
      });
      if(!response.ok){
        const e=await response.json().catch(()=>({}));
        // Do not forward upstream headers or any credentials.
        return respond({error:e.error?.message||'AI request failed',code:response.status},response.status===429?429:502,origin);
      }
      const body=await response.json();
      const output=body.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
      if(!output)return respond({error:'AI returned no cards'},502,origin);
      const parsed=JSON.parse(output);
      if(!Array.isArray(parsed.items))return respond({error:'Invalid AI output'},502,origin);
      return respond({frontLanguage:String(parsed.frontLanguage||'').slice(0,40),backLanguage:String(parsed.backLanguage||'').slice(0,40),items:parsed.items.slice(0,60).filter(x=>x&&typeof x.front==='string'&&typeof x.back==='string'&&x.front.trim()&&x.back.trim()).map(x=>({front:x.front.slice(0,400),back:x.back.slice(0,400),kind:x.kind==='qa'?'qa':'translation'}))},200,origin);
    }catch(err){
      return respond({error:err?.name==='TimeoutError'?'AI request timed out':'AI request or parsing failed'},502,origin);
    }
  }
};

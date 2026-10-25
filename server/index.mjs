import http from 'node:http';
const port=Number(process.env.PORT||8787);
const origins=(process.env.ALLOWED_ORIGINS||'http://localhost:5173').split(',').map(s=>s.trim());
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
http.createServer(async(req,res)=>{
 const origin=req.headers.origin||'';
 if(origin&&origins.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return}
 if(req.url!=='/api/extract'||req.method!=='POST'){send(res,404,{error:'Not found'});return}
 if(!process.env.OPENAI_API_KEY){send(res,503,{error:'OPENAI_API_KEY not configured on server'});return}
 let input='';try{
  for await(const chunk of req){input+=chunk;if(input.length>9_000_000){send(res,413,{error:'Image too large'});return}}
  const {image}=JSON.parse(input);if(typeof image!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(image)){send(res,400,{error:'Expected JPEG, PNG or WEBP image data URL'});return}
  const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',input:[{role:'user',content:[{type:'input_text',text:'Extract all study pairs from this schoolbook photo. Preserve spelling, diacritics and articles exactly. For vocabulary return front in source language and back in target language. For non-vocabulary return a short question and answer. Do not invent missing content. Return JSON only in the schema requested.'},{type:'input_image',image_url:image}]}],text:{format:{type:'json_schema',name:'learning_entries',strict:true,schema:{type:'object',additionalProperties:false,required:['items'],properties:{items:{type:'array',items:{type:'object',additionalProperties:false,required:['front','back','kind'],properties:{front:{type:'string'},back:{type:'string'},kind:{type:'string',enum:['translation','qa']}}}}}}}}})});
  const response=await ai.json();if(!ai.ok){send(res,502,{error:'AI provider error',detail:response.error?.message||ai.status});return}
  const text=response.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;if(!text){send(res,502,{error:'AI returned no text'});return}
  const parsed=JSON.parse(text);if(!Array.isArray(parsed.items)){send(res,502,{error:'Invalid AI response'});return}
  send(res,200,{items:parsed.items.slice(0,150).map(x=>({front:String(x.front).slice(0,1000),back:String(x.back).slice(0,1000),kind:x.kind==='qa'?'qa':'translation'}))});
 }catch(e){send(res,500,{error:String(e)})}
}).listen(port,()=>console.log('Open Learning AI bridge listening on '+port));

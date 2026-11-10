// Local chat helper. No model API, keys, or external service calls.
import fs from 'node:fs/promises';
import {validateMaterial} from './core.mjs';
const base='http://127.0.0.1:8766';
async function request(path,options){const response=await fetch(base+path,options);const data=await response.json();if(!response.ok)throw Error(data.error||String(response.status));return data;}
const [command,file,requestId]=process.argv.slice(2);
try{
 if(command==='context')console.log(JSON.stringify(await request('/api/context'),null,2));
 else if(command==='practice'&&file){const material=validateMaterial(JSON.parse(await fs.readFile(file,'utf8')));const disk=await request('/api/state');const result=await request('/api/practice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:disk.revision,material})});if(requestId)await request('/api/rephrase/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId,status:'completed',materialIds:[material.id]})});console.log(JSON.stringify({revision:result.revision,temporary:material.title}));}
 else if(command==='review')console.log(JSON.stringify(await request('/api/rephrase'),null,2));
 else if(command==='status'){const disk=await request('/api/state');console.log(JSON.stringify({revision:disk.revision,materials:disk.state?.materials.map(m=>({id:m.id,title:m.title})),wordCount:disk.state?.words.length,selected:disk.state?.reviewKeys},null,2));}
 else if(command==='publish'&&file){const input=JSON.parse(await fs.readFile(file,'utf8'));const materials=(Array.isArray(input)?input:[input]).map(validateMaterial);const disk=await request('/api/state');const result=await request('/api/materials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:disk.revision,materials})});if(requestId)await request('/api/rephrase/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId,status:'completed',materialIds:materials.map(m=>m.id)})});console.log(JSON.stringify({revision:result.revision,added:materials.map(m=>m.title)}));}
 else throw Error('用法：node chat_bridge.mjs status | review | context | practice <材料.json> [复习请求ID] | publish <材料.json> [复习请求ID]');
}catch(e){console.error(e.message);process.exitCode=1;}

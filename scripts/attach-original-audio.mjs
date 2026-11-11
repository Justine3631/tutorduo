// Attach a locally owned audio track and verified sentence timings to one material.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateMaterial} from '../core.mjs';
import {sentenceParts} from '../reading.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:8766';
async function request(route,options){const response=await fetch(base+route,options),data=await response.json();if(!response.ok)throw Error(data.error||String(response.status));return data;}
try{
 const [id,input,timingFile]=process.argv.slice(2);
 if(!id||!input||!timingFile)throw Error('用法：node scripts/attach-original-audio.mjs <材料ID> <音频.mp3|m4a|wav> <逐句时间.json>');
 const disk=await request('/api/state'),material=disk.state?.materials.find(m=>m.id===id);
 if(!material)throw Error('材料不存在，请先导入正文。');
 const extension=path.extname(input).toLowerCase();if(!['.mp3','.m4a','.wav'].includes(extension))throw Error('只支持 MP3、M4A、WAV。');
 const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',path.resolve(input)],{encoding:'utf8'}).trim());
 const bytes=await fs.readFile(input),name=createHash('sha256').update(bytes).digest('hex')+extension;
 const sentences=JSON.parse(await fs.readFile(timingFile,'utf8'));
 const updated=validateMaterial({...material,originalAudio:{url:'audio/original/'+name,sentences}});
 const texts=material.paragraphs.flatMap(p=>sentenceParts(p.text).map(s=>s.text.trim()));
 if(texts.length!==sentences.length||texts.some((text,i)=>text!==sentences[i].text.trim()))throw Error('时间标注必须逐句对应网页拆句结果，不能仅有字幕片段。');
 if(!Number.isFinite(duration)||sentences.at(-1).end>duration+0.1)throw Error('时间标注超出音轨长度。');
 await fs.mkdir(path.join(root,'audio/original'),{recursive:true});
 try{await fs.writeFile(path.join(root,'audio/original',name),bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
 // Preserve every other field, material and learning record from the fetched revision.
 material.originalAudio=updated.originalAudio;
 const result=await request('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:disk.revision,state:disk.state})});
 console.log(JSON.stringify({title:material.title,revision:result.revision,sentences:sentences.length,duration}));
}catch(error){console.error(error.message);process.exitCode=1;}

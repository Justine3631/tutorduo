import {sentenceParts} from './reading.mjs';
import {createShadowPlayer} from './shadow-player.js?v=20261026-reading2';
import {validateMaterial,validateBackup,expressionKey,segments,parseSubtitles,reviewPrompt,reviewSelection} from './core.mjs?v=20261111-original1';
import {definitions} from './sample-definitions.mjs';
const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;};
const sample=validateMaterial({id:'sample-pause',title:'The tiny pause before you say yes.',subtitle:'在脱口而出的 “yes” 之前，留一点空间。',topic:'个人成长',sourceNote:'原创示例，不是 YouTube 字幕或研究引文。',prompt:'What could you say instead of an immediate yes? 用 30—60 秒描述你会如何回应一个临时请求。',paragraphs:[...document.querySelector('article').children].filter(n=>!n.classList.contains('chinese')).map(n=>({text:n.textContent,zh:n.nextElementSibling?.classList.contains('chinese')?n.nextElementSibling.textContent:'',annotations:[...n.querySelectorAll('[data-term]')].map(b=>({...definitions[b.dataset.term],text:b.textContent}))}))});
const KEY='tutorduo-v1';let state={version:1,materials:[sample],words:[],current:sample.id};let storageError='';
try{const raw=localStorage.getItem(KEY);if(raw)state=validateBackup(JSON.parse(raw));}catch{storageError='本地数据未能读取，未覆盖原记录。请先导出或检查浏览器存储。';}
let writable=!storageError;let currentAnnotation=null,currentParagraph=null,showChinese=false,listening=false,view='reading';let selected=new Set();
let revision=0,pendingSaves=0;let saveQueue=Promise.resolve();
function normalizeState(value){const normalized=validateBackup(value);normalized.reviewKeys=Array.isArray(value.reviewKeys)?value.reviewKeys.filter(k=>typeof k==='string'&&normalized.words.some(w=>w.key===k)).slice(0,20):[];return normalized;}
try{
 const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw Error('本机服务读取失败');const disk=await response.json();
 if(disk.state){state=normalizeState(disk.state);revision=disk.revision;writable=true;storageError='';}
 else if(writable){const migrated=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:disk.revision,state})});const result=await migrated.json();if(!migrated.ok)throw Error(result.error||'迁移失败');revision=result.revision;}
}catch(e){writable=false;storageError=e.message+'。未覆盖旧数据；当前只能查看或导出备份。';}
selected=new Set(state.reviewKeys||[]);
function save(){
 if(!writable){notify('保存已暂停，请导出备份后重新打开页面。');return Promise.resolve(false);}
 state.reviewKeys=[...selected];const snapshot=JSON.parse(JSON.stringify(state));pendingSaves++;
 saveQueue=saveQueue.then(async()=>{if(!writable)return false;try{const response=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:revision,state:snapshot})});const data=await response.json();if(!response.ok)throw Error(data.error||'保存失败');revision=data.revision;$('.draft-badge').textContent='已保存到本机';return true;}catch(e){writable=false;$('.draft-badge').textContent='未保存 · 请备份';notify(e.message+' 请导出备份保留本次修改，再刷新同步。');return false;}}).finally(()=>pendingSaves--);
 return saveQueue;
}
let sentenceClickTimer;let noticeTimer;function notify(message){const n=$('#notice');n.textContent=message;n.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.hidden=true,6000);}
const material=()=>view==='rephrase'?state.temporary:state.materials.find(m=>m.id===state.current&&!m.archived)||state.materials.find(m=>!m.archived);
const panel=el('section',undefined,'app-panel');panel.hidden=true;$('main').append(panel);
const views=['library','reading','words','rephrase'];
const nav=[...document.querySelectorAll('.nav-item')];nav.forEach((b,i)=>{b.disabled=false;b.addEventListener('click',()=>switchView(views[i]));});
function switchView(next){
 stopAudio();if(next!==view){currentAnnotation=null;currentParagraph=null;showChinese=false;listening=false;$('#translation').textContent='显示中文';$('#translation').setAttribute('aria-pressed','false');listenButton.textContent='听力模式：关';}view=next;
 nav.forEach((b,i)=>{b.classList.toggle('active',views[i]===next);b.removeAttribute('aria-current');if(views[i]===next)b.setAttribute('aria-current','page');});
 $('.topbar>span').textContent={library:'材料库',reading:'阅读学习',words:'词库与复习',rephrase:'REPHRASE · 词汇再创作'}[next];
 const readerVisible=next==='reading'||next==='rephrase'&&!!state.temporary;
 $('.workspace').hidden=!readerVisible;panel.hidden=readerVisible;
 if(readerVisible)renderReading();else if(next==='library')renderLibrary();else if(next==='words')renderWords();else{panel.replaceChildren(el('div','REPHRASE','eyebrow'),el('h1','词汇再创作'),el('p','还没有 REPHRASE 结果。在词库准备表达，再回到对话生成。最近一次结果会保存在这个独立页面。','help'),button('去词库选词',()=>switchView('words')));}
}
async function openMaterial(id){currentAnnotation=null;showChinese=false;listening=false;if(id===state.temporary?.id)switchView('rephrase');else{state.current=id;await save();switchView('reading');}window.scrollTo(0,0);}
function safeSource(url,start){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))return null;if(start!=null && /(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname))u.searchParams.set('t',Math.floor(start)+'s');return u.href;}catch{return null;}}
function sourceLink(url,start){const href=safeSource(url,start);if(!href)return null;const a=el('a',start==null?'打开来源 ↗':`原视频 ${Math.floor(start/60)}:${String(Math.floor(start%60)).padStart(2,'0')} ↗`);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
function renderReading(){const m=material();if(!m){switchView('library');return;}shadowPlayer.update(m);$('h1').textContent=m.title;$('.subtitle').textContent=m.subtitle;$('.eyebrow').textContent=(m.topic||'我的材料')+' / ENGLISH IN CONTEXT';$('.article-meta').textContent=`${m.topic||'英语学习'} · ${m.paragraphs.reduce((n,p)=>n+p.text.split(/\s+/).length,0)} 词 · 六级 / IELTS 6.5 起点`;
 $('.source-note').replaceChildren(el('span',m.sourceNote||'用户导入材料'));const link=sourceLink(m.sourceUrl);if(link)$('.source-note').append(' ',link);
 let practiceBanner=$('#practice-banner');if(!practiceBanner){practiceBanner=el('div',undefined,'practice-banner');practiceBanner.id='practice-banner';$('.reading').prepend(practiceBanner);}practiceBanner.replaceChildren();practiceBanner.hidden=m.id!==state.temporary?.id;if(!practiceBanner.hidden){practiceBanner.append(el('span','最近一次 REPHRASE · 已保存在本机'),button('保存副本到材料库',async()=>{const copy=validateMaterial({...m,id:crypto.randomUUID()});state.materials.push(copy);await save();renderReading();notify('已保存到材料库。');}));}
 updateAudioSource(m);
 const article=$('article');article.replaceChildren();let sentenceNumber=0;
 m.paragraphs.forEach((p,paragraphIndex)=>{
  const wrap=el('section',undefined,'paragraph-block');
  const tools=el('div',undefined,'paragraph-tools');
  const link=sourceLink(m.sourceUrl,p.start);if(link)tools.append(link);
  const translation=el('p',p.zh,'chinese');translation.hidden=!showChinese||!p.zh;
  tools.append(button('▶ 朗读本段',()=>playRows([...document.querySelectorAll('.sentence-row')].filter(row=>row.dataset.paragraph===String(paragraphIndex)))));
  if(p.zh&&!p.sentenceTranslations&&sentenceParts(p.text).length>1)tools.append(button('原段中文',()=>{translation.hidden=!translation.hidden;}));
  if(tools.childNodes.length)wrap.append(tools);
  const sentences=sentenceParts(p.text,p.annotations);
  sentences.forEach((sentence,sentenceIndex)=>{
   sentenceNumber++;const number=sentenceNumber;
   const row=el('div',undefined,'sentence-row');row.dataset.paragraph=paragraphIndex;row.dataset.number=number;row.dataset.text=sentence.text.trim();
   const english=el('p',undefined,'english');english.hidden=listening;
   for(const part of sentence.parts){
    if(part.annotation){const b=button(part.text,()=>showDefinition(part.annotation,p));b.className=part.annotation.type.includes('长难句')?'sentence':'expression';const word=state.words.find(w=>w.key===expressionKey(part.annotation));if(word?.status==='focus')b.classList.add('focused');if(word?.status==='passed')b.classList.add('passed');english.append(b);}
    else english.append(document.createTextNode(part.text));
   }
   const readFromHere=()=>playRows([...document.querySelectorAll('.sentence-row')].filter(row=>Number(row.dataset.number)>=number));
   english.addEventListener('click',event=>{clearTimeout(sentenceClickTimer);if(event.detail<2&&!event.target.closest('button')&&!window.getSelection()?.toString())sentenceClickTimer=setTimeout(()=>{if(!window.getSelection()?.toString())readFromHere();},220);});
   english.title='点击从这句往后读';
   english.tabIndex=0;english.addEventListener('keydown',event=>{if(event.target===english&&['Enter',' '].includes(event.key)){event.preventDefault();readFromHere();}});
   const translated=p.sentenceTranslations?.find(item=>item.text.trim()===sentence.text.trim())?.zh||(sentences.length===1?p.zh:'');
   const chinese=el('p',translated||'这句还没有逐句翻译。','sentence-translation');chinese.hidden=!showChinese;
   const body=el('div',undefined,'sentence-body');body.append(english,chinese);
   const listen=button('▶',()=>{chinese.hidden=!chinese.hidden;listen.setAttribute('aria-expanded',String(!chinese.hidden));});listen.className='sentence-listen';listen.setAttribute('aria-label',`展开第 ${number} 句中文`);listen.setAttribute('aria-expanded',String(!chinese.hidden));listen.title='展开或收起这句中文（不播放）';
   row.append(body,listen);wrap.append(row);
  });
  if(!p.sentenceTranslations&&sentences.length>1)wrap.append(translation);article.append(wrap);
 });
 prepareArticleAudio(m);
 if(queue.length){const number=currentRow?.dataset.number;queue.forEach(item=>{if(item.row)item.row=document.querySelector('.sentence-row[data-number="'+item.row.dataset.number+'"]');});currentRow=number?document.querySelector('.sentence-row[data-number="'+number+'"]'):null;audioUI();}
 $('.speaking h3').textContent=m.prompt||'用 30—60 秒复述主要内容，再说说它与你的生活有什么关系。';$('.speaking p').textContent='先不看正文，选 1—2 个新表达，用自己的话讲出来。';$('.practice-note').textContent='自行开口练习；当前未提供录音或自动评分。';$('.feature-note').textContent='收藏：加入待复习；重点：优先复习；已掌握：退出待复习，可恢复。';$('.listening-note p').textContent='先听原声，再展开英文核对。点英文句子从该句往后读；点句旁 ▶ 展开中文；也可朗读本段，随时暂停和继续。';
 if(!currentAnnotation){const p=m.paragraphs.find(p=>p.annotations.length);if(p){showDefinition(p.annotations[0],p);$('.detail-column').classList.remove('definition-open');}else showEmptyDefinition();}}
function showEmptyDefinition(){currentAnnotation=null;$('#term').textContent='这篇还没有表达讲解';$('#meaning').textContent='可以导出材料给对话补充标注，再作为新材料导入。';['form','context','example','example-zh','tip'].forEach(id=>$('#'+id).textContent='');$('.card-actions').replaceChildren();}
function showDefinition(a,p){currentAnnotation=a;currentParagraph=p;for(const [id,value]of Object.entries({term:a.term||a.text,type:a.type||'表达',form:a.form,meaning:a.meaning,context:a.context||sentenceParts(p.text).find(s=>s.text.includes(a.text))?.text||a.text,example:a.example,'example-zh':a.zh,tip:[a.usage,a.tip].filter(Boolean).join('\n')}))$('#'+id).textContent=value||'';$('.sample-label').textContent='当前语境';const actions=$('.card-actions');actions.replaceChildren();const w=state.words.find(w=>w.key===expressionKey(a));actions.append(button(w?.status==='saved'?'★ 待复习':'☆ 收藏',()=>setStatus('saved')),button(w?.status==='focus'?'◎ 已设重点':'◎ 重点',()=>setStatus('focus')),button(w?.status==='passed'?'↶ 恢复复习':'✓ 已掌握',()=>setStatus(w?.status==='passed'?'saved':'passed')));$('#example').hidden=!a.example;$('#example-zh').hidden=!a.example;$('#example').previousElementSibling.hidden=!a.example;const hear=button(a.example?'▶ 例句':'▶ 单词',()=>playText(a.example||a.text));hear.title=a.example?'朗读下面的英文例句':'朗读这个表达';actions.append(hear);memoryDetails.open=false;memoryDetails.hidden=!$('#tip').textContent;$('.detail-column').classList.add('definition-open');$('.detail-column').scrollTop=0;}
async function setStatus(status){if(!currentAnnotation)return;const key=expressionKey(currentAnnotation);let w=state.words.find(w=>w.key===key);if(!w){w={key,annotation:{...currentAnnotation},sentence:sentenceParts(currentParagraph.text).find(s=>s.text.includes(currentAnnotation.text))?.text.trim()||currentParagraph.text,sourceTitle:material().title,sourceUrl:material().sourceUrl,reason:'meaning'};state.words.push(w);}w.status=status;if(status==='passed')selected.delete(w.key);w.updated=new Date().toISOString();const ok=await save();const p=currentParagraph,a=currentAnnotation;renderReading();showDefinition(a,p);updateCount();notify(ok?'已保存到本地词库。':'当前变更仅在本次页面中有效，请导出备份。');}
function updateCount(){nav[2].querySelector('small').textContent=state.words.filter(w=>w.status!=='passed').length;}
const listenButton=button('听力模式：关',()=>{listening=!listening;listenButton.textContent='听力模式：'+(listening?'开':'关');renderReading();});$('.mode-tabs').append(listenButton);
$('#translation').addEventListener('click',()=>{showChinese=!showChinese;$('#translation').textContent=showChinese?'隐藏中文':'显示中文';$('#translation').setAttribute('aria-pressed',String(showChinese));renderReading();});
const lookupForm=el('form',undefined,'lookup-form'),lookupInput=el('input');lookupInput.placeholder='选词或输入单词查义';lookupInput.setAttribute('aria-label','本地词典查询');lookupForm.append(lookupInput,button('查词',()=>lookupWord(lookupInput.value)));lookupForm.addEventListener('submit',event=>{event.preventDefault();lookupWord(lookupInput.value);});$('.detail-column').prepend(lookupForm);
let lookupToken=0;
async function lookupWord(text,context=''){text=text.trim();if(!text)return;context=context||[...document.querySelectorAll('.sentence-row')].find(row=>row.dataset.text.toLowerCase().includes(text.toLowerCase()))?.dataset.text||text;lookupInput.value=text;const token=++lookupToken;try{const response=await fetch('/api/dictionary?word='+encodeURIComponent(text));const data=await response.json();if(token!==lookupToken)return;if(!response.ok)throw Error(data.error);const p={text:context||text};const a={text,term:data?.word||text,type:'本地词典',meaning:data?.translation?.replace(/\\n/g,'\n')||'本地词典未收录，或这是需要结合语境理解的短语。',form:data?.phonetic?'/'+data.phonetic+'/':'',example:'',usage:'词典列出基本义，不代表本句的确切含义。',tip:'词典来源：ECDICT（MIT）。'};showDefinition(a,p);if(!data)$('.card-actions').replaceChildren();}catch(error){notify(error.message);}}
const selectionTools=el('div',undefined,'selection-tools');selectionTools.hidden=true;document.body.append(selectionTools);
document.addEventListener('mouseup',event=>{if(selectionTools.contains(event.target))return;const selection=window.getSelection(),text=selection?.toString().trim();const parent=selection?.anchorNode?.parentElement?.closest('.english');if(!text||!parent||!parent.contains(event.target)||selection?.focusNode?.parentElement?.closest('.english')!==parent||text.length>160){selectionTools.hidden=true;return;}const context=parent.closest('.sentence-row').dataset.text;const rect=selection.getRangeAt(0).getBoundingClientRect();selectionTools.replaceChildren(button('查词',()=>{selectionTools.hidden=true;lookupWord(text,context);}));selectionTools.style.left=Math.max(8,Math.min(innerWidth-180,rect.left))+'px';selectionTools.style.top=Math.max(8,Math.min(innerHeight-45,rect.bottom+8))+'px';selectionTools.hidden=false;});
const memoryDetails=el('details',undefined,'memory-details');memoryDetails.append(el('summary','用法与记忆提示'));$('#tip').before(memoryDetails);memoryDetails.append($('#tip'));
const closeDefinition=button('关闭释义 ×',()=>$('.detail-column').classList.remove('definition-open'));closeDefinition.className='definition-close';$('.detail-column').prepend(closeDefinition);
const shadowPlayer=createShadowPlayer($('.voice-controls'),{stopSynthesis:pauseSynthesis,notify});
let audio=new Audio();let sequence=0,generating=false,queue=[],queueIndex=0,held=false,currentRow=null,originalActive=false;
const audioSource=el('select');audioSource.id='audio-source';audioSource.setAttribute('aria-label','正文音源');
for(const [value,text]of [['original','视频原声'],['synthesis','合成语音']]){const option=el('option',text);option.value=value;audioSource.append(option);}
const sourceLabel=el('label','正文音源 ');sourceLabel.append(audioSource);$('.voice-controls').prepend(sourceLabel);let sourceMaterialId=null;
function updateAudioSource(m){sourceLabel.hidden=!m.originalAudio;if(sourceMaterialId!==m.id){audioSource.value=m.originalAudio?'original':'synthesis';sourceMaterialId=m.id;}$('#voice').closest('label').hidden=useOriginal();}
function useOriginal(){return !!material()?.originalAudio&&audioSource.value==='original';}
audioSource.addEventListener('change',()=>{stopAudio();updateAudioSource(material());prepareArticleAudio(material(),true);});
const speechCache=new Map(),audioBuffers=new Map();let preparationToken=0,preparationKey='',preparationDone=0,preparationTotal=0;
function bufferedAudio(url,preload='auto'){if(!audioBuffers.has(url)){const buffer=new Audio(url);buffer.preload=preload;buffer.load();audioBuffers.set(url,buffer);}return audioBuffers.get(url);}
async function prepareArticleAudio(m,force=false){
 if(useOriginal()){++preparationToken;preparationKey='';bufferedAudio(m.originalAudio.url,'metadata');$('#cache-status').textContent='原声单轨 · 按句定位';return;}
 const voice=$('#voice').value,key=m.id+'|'+voice;
 if(!force&&preparationKey===key)return;
 preparationKey=key;const token=++preparationToken;const texts=m.paragraphs.flatMap(p=>sentenceParts(p.text).map(s=>s.text.trim()));let next=0;preparationDone=0;preparationTotal=texts.length;$('#cache-status').textContent=`正在准备 0/${preparationTotal}`;let failed=0;
 async function worker(){while(token===preparationToken&&next<texts.length){const text=texts[next++];try{const url=await speechURL(text,voice);if(token!==preparationToken)return;bufferedAudio(url);preparationDone++;}catch{failed++;}if(token===preparationToken){$('#cache-status').textContent=`音频已准备 ${preparationDone}/${preparationTotal}`;}}}
 await Promise.all([worker(),worker()]);if(token!==preparationToken)return;
 $('#cache-status').textContent=failed?`已准备 ${preparationDone}/${preparationTotal}，点击重试`:'本篇音频已缓存';
}

function speechURL(text,voice){
 const key=voice+'\0'+text;
 if(!speechCache.has(key)){
  const request=fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice})}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'生成失败');return data.url;}).catch(error=>{speechCache.delete(key);throw error;});
  speechCache.set(key,request);
 }
 return speechCache.get(key);
}
function audioUI(){
 $('#read').textContent='▶ 整篇朗读';
 $('#stop').textContent=held?'▶ 继续':'Ⅱ 暂停';$('#stop').disabled=!queue.length;
 $('#audio-status').textContent=held&&queue.length?'已暂停':generating?(originalActive?'加载原声音轨…':'准备当前句…'):queue.length?(currentRow?(originalActive?'原声第 ':'正在朗读第 ')+currentRow.dataset.number+' 句':'正在朗读'):'';
 document.querySelectorAll('.sentence-row').forEach(row=>row.classList.toggle('is-reading',row===currentRow));
}
function pauseSynthesis(){held=true;audio.pause();audioUI();}
function stopAudio(){shadowPlayer.stop();sequence++;audio.pause();audio.ontimeupdate=null;audio.onended=null;audio.onerror=null;originalActive=false;queue=[];generating=false;held=false;currentRow=null;audioUI();}
async function playOriginal(rows){
 const m=material(),allRows=[...document.querySelectorAll('.sentence-row')],timings=m.originalAudio.sentences;
 if(timings.length!==allRows.length||allRows.some((row,i)=>row.dataset.text!==timings[i].text)){notify('原声时间与句子不匹配，请切换合成语音。');return;}
 stopAudio();const token=sequence;
 queue=rows.map(row=>({...timings[Number(row.dataset.number)-1],row}));if(!queue.length)return;
 originalActive=true;generating=true;audio=bufferedAudio(m.originalAudio.url);audio.playbackRate=Number($('#speed').value);currentRow=rows[0];audioUI();
 const finish=()=>{audio.pause();audio.ontimeupdate=null;queue=[];originalActive=false;currentRow=null;audioUI();};
 audio.onended=()=>{if(token===sequence)finish();};audio.onerror=()=>{if(token===sequence){stopAudio();notify('原声音轨不可用，请切换“合成语音”；音频文件不包含在文字备份中。');}};
 try{
  if(audio.readyState<1)await new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);audioTrack.removeEventListener('loadedmetadata',loaded);audioTrack.removeEventListener('error',failed);};const audioTrack=audio,loaded=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(Error('原声音轨加载失败。'));},timer=setTimeout(()=>{cleanup();reject(Error('原声音轨加载超时。'));},15000);audioTrack.addEventListener('loadedmetadata',loaded);audioTrack.addEventListener('error',failed);});
  if(token!==sequence)return;
  if(queue.at(-1).end>audio.duration+0.1)throw Error('逐句时间超出原声音轨长度，请检查时间标注。');
  audio.currentTime=queue[0].start;generating=false;
  audio.ontimeupdate=()=>{if(token!==sequence)return;const time=audio.currentTime;if(time>=queue.at(-1).end){finish();return;}const item=queue.find(s=>time>=s.start&&time<s.end);const row=item?.row||null;if(row!==currentRow){currentRow=row;audioUI();}};
  audioUI();if(!held)await audio.play();
 }catch(error){if(token!==sequence)return;stopAudio();notify(error.message+' 可切换合成语音。');}
}
async function playItem(token){
 if(token!==sequence||!queue[queueIndex])return;
 generating=true;currentRow=null;audio.pause();audioUI();
 try{
  const item=queue[queueIndex],voice=$('#voice').value;
  const url=await speechURL(item.text,voice);if(token!==sequence)return;
  audio=bufferedAudio(url);audio.currentTime=0;audio.onended=()=>{if(token===sequence)advanceAudio();};audio.onerror=()=>{if(token===sequence)audioError();};audio.playbackRate=Number($('#speed').value);generating=false;currentRow=item.row;audioUI();
  if(!held)await audio.play();
  if(token!==sequence)return;
  const next=queue[queueIndex+1];if(next)speechURL(next.text,voice).catch(()=>{});
 }catch(error){if(token!==sequence)return;pauseSynthesis();generating=false;audioUI();notify(error.message||'音频播放失败，点击继续重试。');}
}
function startQueue(items){stopAudio();queue=items;queueIndex=0;if(queue.length)playItem(sequence);}
function playRows(rows){if(useOriginal())playOriginal(rows);else startQueue(rows.map(row=>({text:row.dataset.text,row})));}
function playText(text){startQueue([{text,row:null}]);}
$('#read').addEventListener('click',()=>playRows([...document.querySelectorAll('.sentence-row')]));
$('#stop').setAttribute('aria-label','暂停或继续朗读');
$('#stop').addEventListener('click',async()=>{if(!held){pauseSynthesis();return;}held=false;shadowPlayer.stop();if(!generating){if(!audio.getAttribute('src'))playItem(sequence);else try{await audio.play();}catch{held=true;notify('继续播放失败，请重新朗读。');}}audioUI();});
function advanceAudio(){if(queueIndex+1<queue.length){queueIndex++;playItem(sequence);}else{queue=[];currentRow=null;audioUI();}}
function audioError(){if(queue.length){held=true;audioUI();notify('音频载入失败，请重新点击句子。');}}
$('#voice').addEventListener('change',()=>{stopAudio();if(material())prepareArticleAudio(material());});$('#speed').addEventListener('change',()=>audio.playbackRate=Number($('#speed').value));
window.addEventListener('pagehide',stopAudio);
$('.audio-copy').replaceChildren();const audioStatus=el('span','','audio-status');audioStatus.id='audio-status';audioStatus.setAttribute('role','status');$('.audio-copy').append(audioStatus);
const cacheStatus=button('准备本篇音频',()=>{if(material())prepareArticleAudio(material(),true);});cacheStatus.id='cache-status';cacheStatus.className='cache-status';$('.voice-controls>span').replaceWith(cacheStatus);$('.audio-card').append($('.voice-controls'));audioUI();
function download(name,value,type='application/json'){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function fileInput(accept,handler){const input=el('input');input.type='file';input.accept=accept;input.hidden=true;input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;try{if(file.size>10000000)throw Error('请选择小于 10 MB 的文件。');await handler(await file.text(),file.name);}catch(e){notify(e.message);}input.remove();});document.body.append(input);input.click();}
async function addMaterials(list){const ids=new Set(state.materials.map(m=>m.id));for(const m of list){if(ids.has(m.id))m.id=crypto.randomUUID();ids.add(m.id);state.materials.push(m);}const persisted=await save();await openMaterial(list[0].id);notify(persisted?'材料已导入并保存。':'材料已载入，但本地保存失败，请导出备份。');}
function importFile(){fileInput('.json,.srt,.vtt,.txt',async(text,name)=>{if(/\.(srt|vtt)$/i.test(name))addMaterials([parseSubtitles(text,name.replace(/\.[^.]+$/,''))]);else if(/\.txt$/i.test(name))addMaterials([validateMaterial({title:name.replace(/\.txt$/i,''),paragraphs:text.split(/\n\s*\n/).filter(p=>p.trim()).map(text=>({text})),sourceNote:'纯文本导入；暂无翻译与表达讲解。'})]);else{const v=JSON.parse(text);addMaterials((Array.isArray(v)?v:[v]).map(validateMaterial));}});}
function renderLibrary(){panel.replaceChildren();panel.append(el('div','YOUR LIBRARY','eyebrow'),el('h1','材料库'));const toolbar=el('div',undefined,'toolbar');toolbar.append(button('＋ 导入材料',importFile),button('载入 402 词入门练习',async()=>{try{const response=await fetch('starter-material.json');if(!response.ok)throw Error('示例读取失败');addMaterials([validateMaterial(await response.json())]);}catch(e){notify(e.message);}}),button('下载材料模板',()=>download('tutorduo-template.json',{...sample,id:undefined})),button('导出完整备份',()=>download('tutorduo-backup.json',state)),button('恢复备份',()=>fileInput('.json',async text=>{const restored=validateBackup(JSON.parse(text));if(!confirm(`将用备份替换当前 ${state.materials.length} 篇材料和 ${state.words.length} 条词库记录。建议先导出当前备份。继续恢复？`))return;state=restored;selected.clear();const persisted=await save();renderLibrary();updateCount();notify(persisted?'备份已恢复并保存。':'备份已载入，但本地保存失败，请导出备份。');})));toolbar.prepend(button('同步最新材料',async()=>{await refreshShared(true);}));panel.append(toolbar,el('p','在对话中发 YouTube 链接，我会直接把整理好的材料放到这里。页面会自动发现新材料；文件导入与备份作为备用。','help'));const area=el('textarea');area.placeholder='也可以在这里粘贴材料 JSON 或普通英文文章……';area.rows=5;area.setAttribute('aria-label','粘贴学习材料');const title=el('input');title.placeholder='纯文本材料标题';title.setAttribute('aria-label','材料标题');panel.append(title,area,button('导入粘贴内容',()=>{try{const text=area.value.trim();if(!text)throw Error('请先粘贴内容。');if(text.startsWith('{')||text.startsWith('[')){const v=JSON.parse(text);addMaterials((Array.isArray(v)?v:[v]).map(validateMaterial));}else addMaterials([validateMaterial({title:title.value||'未命名材料',paragraphs:text.split(/\n\s*\n/).map(text=>({text}))})]);}catch(e){notify(e.message);}}));const trash=el('details');trash.append(el('summary',`已删除（${state.materials.filter(m=>m.archived).length}）`));for(const m of state.materials.filter(m=>m.archived)){const row=el('p',m.title+' ');row.append(button('恢复',async()=>{delete m.archived;await save();renderLibrary();}));trash.append(row);}panel.append(trash);if(state.temporary)panel.append(button('查看上次 REPHRASE：'+state.temporary.title,()=>openMaterial(state.temporary.id)));for(const m of state.materials.filter(m=>!m.archived)){const card=el('section',undefined,'material-card');card.append(el('span',m.topic||'英语学习','tiny-label'),el('h2',m.title),el('p',m.sourceNote||'导入学习材料','help'),button('开始学习 →',()=>openMaterial(m.id)),button('导出给对话补充讲解',()=>download('material.json',m)),button('删除',async()=>{m.archived=true;if(state.current===m.id)state.current=state.materials.find(v=>!v.archived)?.id;await save();renderLibrary();notify('材料已移至“已删除”，可随时恢复；词库保留。');}));panel.append(card);}}
function wordContext(w){return sentenceParts(w.sentence||'').find(s=>s.text.includes(w.annotation.text))?.text.trim()||w.sentence||w.annotation.text;}
let reviewHideChinese=true;
function renderWords(filter='active'){panel.replaceChildren();panel.append(el('div','WORDS IN CONTEXT','eyebrow'),el('h1','词库与复习'));const toolbar=el('div',undefined,'toolbar');for(const [key,label]of [['active','待复习'],['focus','重点'],['passed','已掌握']])toolbar.append(button(label,()=>renderWords(key)));if(state.temporary)toolbar.append(button('查看上次 REPHRASE',()=>openMaterial(state.temporary.id)));const testMode=button(reviewHideChinese?'自测：隐藏中文 ✓':'自测：隐藏中文',()=>{reviewHideChinese=!reviewHideChinese;renderWords(filter);});testMode.setAttribute('aria-pressed',String(reviewHideChinese));toolbar.append(testMode);toolbar.append(button('清空勾选',()=>{selected.clear();save();renderWords(filter);}),button('准备 REPHRASE',async()=>{try{const words=reviewSelection(state.words,[...selected]);const prompt=reviewPrompt(words);selected=new Set(words.map(w=>w.key));if(!await save())return;const response=await fetch('/api/rephrase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:revision,keys:[...selected],prompt})});const data=await response.json();if(!response.ok)throw Error(data.error||'保存复习请求失败');renderWords(filter);notify(`已准备 ${words.length} 个表达。回到对话说：用刚选的词生成复习材料。`);}catch(e){notify(e.message);}}),button('备用：导出请求',()=>{try{const words=reviewSelection(state.words,[...selected]);download('REPHRASE-request.txt',reviewPrompt(words),'text/plain;charset=utf-8');}catch(e){notify(e.message);}}),button('导入复习文章',importFile));panel.append(toolbar,el('p','可勾选 1—20 个表达；未勾选时默认取最多 10 个待复习表达，重点优先，再按最久未更新排序。点击准备 REPHRASE，再回到对话说“用刚选的词生成复习材料”。结果保留为最近一次 REPHRASE，关闭网页仍可查看；新结果才会覆盖，需要时可另存副本。','help'));const count=el('p',selected.size?`已选择 ${selected.size} / 20 个表达`:`未勾选：默认复习 ${reviewSelection(state.words).length} 个表达`,'help');panel.append(count);const words=state.words.filter(w=>filter==='passed'?w.status==='passed':filter==='focus'?w.status==='focus':w.status!=='passed');if(!words.length)panel.append(el('p','这里还没有表达。阅读时点击下划线，再点收藏。','empty'));for(const w of words){const card=el('section',undefined,'word-card');const check=el('input');check.type='checkbox';check.disabled=w.status==='passed';check.checked=selected.has(w.key);check.setAttribute('aria-label','选择 '+(w.annotation.term||w.annotation.text));check.addEventListener('change',()=>{if(check.checked&&selected.size>=20){check.checked=false;notify('最多选择 20 个。');return;}check.checked?selected.add(w.key):selected.delete(w.key);count.textContent=selected.size?`已选择 ${selected.size} / 20 个表达`:`未勾选：默认复习 ${reviewSelection(state.words).length} 个表达`;save();});const meaning=el('p',w.annotation.meaning,'review-answer');meaning.hidden=reviewHideChinese;meaning.id='review-answer-'+words.indexOf(w);const reveal=button('显示中文',()=>{meaning.hidden=!meaning.hidden;reveal.textContent=meaning.hidden?'显示中文':'隐藏中文';reveal.setAttribute('aria-expanded',String(!meaning.hidden));});reveal.className='reveal-answer';reveal.hidden=!reviewHideChinese;reveal.setAttribute('aria-controls',meaning.id);reveal.setAttribute('aria-expanded','false');card.append(check,el('h2',w.annotation.term||w.annotation.text),reveal,meaning,el('p',wordContext(w),'context'),el('small',w.sourceTitle,'help'));const actions=el('div',undefined,'toolbar');for(const [status,label]of [['saved','待复习'],['focus','重点'],['passed','已掌握']])actions.append(button(w.status===status?'✓ '+label:label,async()=>{w.status=status;if(status==='passed')selected.delete(w.key);w.updated=new Date().toISOString();await save();updateCount();renderWords(filter);}));actions.append(button('▶ 听原句',()=>playText(wordContext(w))));if(w.status==='focus'){const reason=el('select');for(const [value,text]of [['meaning','意思不熟'],['sound','听不出来'],['use','自己不会用']]){const o=el('option',text);o.value=value;reason.append(o);}reason.value=w.reason;reason.addEventListener('change',()=>{w.reason=reason.value;save();});actions.append(reason);}card.append(actions);panel.append(card);}}
async function refreshShared(manual=false){
 if(pendingSaves||!writable){if(manual)notify('有未保存内容，请先导出备份；刷新页面会读取本机最新记录。');return;}
 try{
  const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw Error('同步失败');const disk=await response.json();if(pendingSaves)return;
  if(disk.revision>revision&&disk.state){const oldPractice=state.temporary?.id;state=normalizeState(disk.state);revision=disk.revision;selected=new Set(state.reviewKeys||[]);currentAnnotation=null;updateCount();
   if(state.temporary?.id&&state.temporary.id!==oldPractice)switchView('rephrase');else if(view==='reading'||view==='rephrase')renderReading();else if(view==='library')renderLibrary();else renderWords();
   notify('已同步本机最新材料与学习记录。');
  }else if(manual)notify('已经是最新内容。');
 }catch(e){if(manual)notify(e.message);}
}
setInterval(()=>{if(document.visibilityState==='visible')refreshShared();},5000);
window.addEventListener('focus',()=>refreshShared());
$('.profile small').textContent='本机共享保存 · 可备份';
$('.draft-badge').textContent=writable?'已保存到本机':'保存未连接';
updateCount();switchView('reading');if(storageError)notify(storageError);

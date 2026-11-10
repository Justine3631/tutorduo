export function validateMaterial(value) {
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || !value.title.trim()) throw Error('材料缺少标题 title。');
  if (!Array.isArray(value.paragraphs) || !value.paragraphs.length || value.paragraphs.length > 2000) throw Error('paragraphs 必须包含 1—2000 个段落。');
  const str = (s) => typeof s === 'string' ? s : '';
  const paragraphs = value.paragraphs.map((p, i) => {
    if (!p || typeof p.text !== 'string' || !p.text.trim() || p.text.length > 20000) throw Error(`第 ${i + 1} 段正文无效。`);
    const annotations = (Array.isArray(p.annotations) ? p.annotations : []).map(a => {
      if (!a || !str(a.text).trim() || !str(a.meaning).trim() || !p.text.includes(a.text)) throw Error(`第 ${i + 1} 段标注必须有 text、meaning，且 text 出现在原文中。`);
      return Object.fromEntries(['text','term','meaning','type','form','context','example','zh','tip','usage'].map(k => [k, str(a[k])]));
    });
    let sentenceTranslations;if(p.sentenceTranslations!==undefined){if(!Array.isArray(p.sentenceTranslations)||p.sentenceTranslations.some(s=>!s||typeof s.text!=='string'||!s.text.trim()||typeof s.zh!=='string'||!s.zh.trim())||p.sentenceTranslations.map(s=>s.text.trim()).join(' ').replace(/\s+/g,' ')!==p.text.trim().replace(/\s+/g,' '))throw Error(`第 ${i+1} 段逐句翻译与英文不匹配。`);sentenceTranslations=p.sentenceTranslations.map(s=>({text:s.text.trim(),zh:s.zh.trim()}));}
    return {...(sentenceTranslations?{sentenceTranslations}:{}),text:p.text, zh:str(p.zh), start:Number.isFinite(p.start) && p.start >= 0 ? p.start : null, end:Number.isFinite(p.end) && p.end > (p.start || 0) ? p.end : null, annotations};
  });
  let clipFields={};
  if(value.clips!==undefined){
    if(!Array.isArray(value.clips)||value.clips.length>2000)throw Error('跟读片段列表无效。');
    clipFields={clips:value.clips.map(c=>{if(!c||typeof c.text!=='string'||!c.text.trim()||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start)throw Error('跟读片段需有正文和有效起止时间。');return {text:c.text,start:c.start,end:c.end};})};
  }
  return {...clipFields,...(value.archived?{archived:true}:{}),id:str(value.id) || crypto.randomUUID(), title:value.title.trim(), subtitle:str(value.subtitle), topic:str(value.topic), sourceUrl:str(value.sourceUrl), sourceNote:str(value.sourceNote), prompt:str(value.prompt), paragraphs};
}
export function expressionKey(a) { return JSON.stringify([(a.term || a.text).toLowerCase().trim(), a.meaning.trim()]); }
export function segments(text, annotations) {
  const matches = [];
  for (const a of annotations) {
    let pos = text.indexOf(a.text);
    while (pos !== -1) { matches.push({start:pos,end:pos+a.text.length,annotation:a}); pos=text.indexOf(a.text,pos+a.text.length); }
  }
  matches.sort((a,b)=>a.start-b.start || b.end-a.end);
  const result=[]; let end=0;
  for (const m of matches) { if(m.start<end) continue; if(m.start>end) result.push({text:text.slice(end,m.start)}); result.push({text:text.slice(m.start,m.end),annotation:m.annotation}); end=m.end; }
  if(end<text.length) result.push({text:text.slice(end)});
  return result;
}
export function parseSubtitles(text,title) {
  const paragraphs=[];
  for (const block of text.replace(/\r/g,'').split(/\n\s*\n/)) {
    const lines=block.split('\n'); const idx=lines.findIndex(l=>l.includes('-->'));
    if(idx<0) continue;
    const stamp=lines[idx].match(/(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->/);
    if(!stamp) continue;
    const body=lines.slice(idx+1).join(' ').replace(/<[^>]*>/g,'').trim();
    if(body) paragraphs.push({text:body,start:Number(stamp[1]||0)*3600+Number(stamp[2])*60+Number(stamp[3])+Number(stamp[4])/1000});
  }
  return validateMaterial({title, paragraphs, sourceNote:'导入字幕原文；尚未添加中文和表达讲解。'});
}
export function validateBackup(v) {
  if(!v || v.version!==1 || !Array.isArray(v.materials) || !Array.isArray(v.words)) throw Error('不是受支持的 Tutorduo 备份。');
  const materials=v.materials.map(validateMaterial);
  const words=v.words.map(w=>{
    if(!w || !w.annotation || typeof w.annotation.meaning!=='string' || !(w.annotation.term || w.annotation.text) || !['saved','focus','passed'].includes(w.status)) throw Error('备份中的词库记录无效。');
    const annotation=validateMaterial({title:'检查',paragraphs:[{text:w.annotation.text || w.annotation.term,annotations:[{...w.annotation,text:w.annotation.text || w.annotation.term}]}]}).paragraphs[0].annotations[0];
    return {key:expressionKey(annotation),annotation,status:w.status,reason:['meaning','sound','use'].includes(w.reason)?w.reason:'meaning',sentence:typeof w.sentence==='string'?w.sentence:'',sourceTitle:typeof w.sourceTitle==='string'?w.sourceTitle:'',sourceUrl:typeof w.sourceUrl==='string'?w.sourceUrl:'',updated:typeof w.updated==='string'?w.updated:''};
  });
  const temporary=v.temporary?validateMaterial(v.temporary):null;return {version:1,materials,words,...(temporary?{temporary}:{}),current:[...materials,...(temporary?[temporary]:[])].some(m=>m.id===v.current)?v.current:materials[0]?.id};
}
export function reviewPrompt(words) {
  if(!words.length || words.length>20) throw Error('请选择 1—20 个表达。');
  return `请为六级 / 雅思 6.5、侧重口语和听力的学习者生成一篇 400—600 词的心理学、脑科学或个人成长英文短文，也可按我的要求改为双人对话。以下表达使用指定含义，自然融入，不强塞；区分研究事实和虚构情境，不编造研究。给出逐句对应中文（paragraphs[].sentenceTranslations，每项为 {text,zh}，按原文顺序覆盖全段）、语境解释、自然口语例句和一个 30—60 秒复述提示。输出符合 Tutorduo 材料格式的 JSON，annotations.text 必须与该段原文逐字一致。不要仅给词汇清单。\n\n目标表达：\n${words.map(w=>`${w.annotation.term || w.annotation.text}: ${w.annotation.meaning}`).join('\n')}\n\n格式：${JSON.stringify({title:'标题',topic:'个人成长',sourceNote:'AI 生成复习材料',prompt:'复述提示',paragraphs:[{text:'英文段落',zh:'中文',annotations:[{text:'原文表达',term:'词典形式',meaning:'本句含义',usage:'什么情境可以说',example:'英文例句',zh:'例句中文',tip:'记忆提示'}]}]})}`;
}

export function reviewSelection(words,keys=[]) {
 const active=words.filter(w=>w.status!=='passed');
 const chosen=active.filter(w=>keys.includes(w.key));
 return chosen.length?chosen:active.toSorted((a,b)=>(b.status==='focus')-(a.status==='focus')||(a.updated||'').localeCompare(b.updated||'')).slice(0,10);
}

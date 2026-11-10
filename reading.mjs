import {segments} from './core.mjs';
export function sentenceParts(text,annotations=[]) {
  const spans=[];let offset=0;
  for(const part of segments(text,annotations)){spans.push({...part,start:offset,end:offset+part.text.length});offset+=part.text.length;}
  const sentences=[];
  for(const current of new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)){
    const previous=sentences.at(-1);
    if(previous&&/(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr)\.\s*$/.test(previous.segment))previous.segment+=current.segment;
    else sentences.push({segment:current.segment,index:current.index});
  }
  return sentences.map(({segment,index})=>({text:segment,parts:spans.filter(p=>p.end>index&&p.start<index+segment.length).map(p=>({text:text.slice(Math.max(index,p.start),Math.min(index+segment.length,p.end)),annotation:p.annotation}))}));
}

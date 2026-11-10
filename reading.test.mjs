import test from 'node:test';
import assert from 'node:assert/strict';
import {sentenceParts} from './reading.mjs';
test('splits sentence rows without losing original text',()=>{const text='Dr. Smith is here. Is that okay? Yes, it is!';const rows=sentenceParts(text);assert.equal(rows.map(r=>r.text).join(''),text);assert.equal(rows.length,3);});
test('annotations survive a sentence boundary',()=>{const text='Try this. Then try that.';const annotation={text,meaning:'a long passage'};const rows=sentenceParts(text,[annotation]);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.parts[0].annotation===annotation));assert.equal(rows.flatMap(r=>r.parts.map(p=>p.text)).join(''),text);});
test('phrase links stay attached to the right sentence',()=>{const text='Take a break. Think it through.';const annotation={text:'Think it through',meaning:'想清楚'};const rows=sentenceParts(text,[annotation]);assert.ok(!rows[0].parts.some(p=>p.annotation));assert.ok(rows[1].parts.some(p=>p.annotation===annotation));});

import {reviewSelection,validateMaterial} from './core.mjs';
test('review defaults prioritize focus and oldest active words, never passed',()=>{
 const words=Array.from({length:12},(_,i)=>({key:String(i),status:i===11?'focus':i===0?'passed':'saved',updated:String(i).padStart(2,'0')}));
 assert.deepEqual(reviewSelection(words).map(w=>w.key),['11','1','2','3','4','5','6','7','8','9']);
 assert.deepEqual(reviewSelection(words,['3','0']).map(w=>w.key),['3']);
 assert.deepEqual(reviewSelection([]),[]);
});
test('deleted materials retain content and recoverable status through normalization',()=>{
 const m=validateMaterial({id:'test',title:'Test',archived:true,paragraphs:[{text:'Keep this content.'}]});
 assert.equal(m.archived,true);assert.equal(m.paragraphs[0].text,'Keep this content.');
 delete m.archived;assert.equal(validateMaterial(m).archived,undefined);
});

import {validateBackup} from './core.mjs';
test('sentence translations and latest temporary practice survive backup',()=>{
 const m={id:'practice',title:'Practice',paragraphs:[{text:'Try again. Be kind.',sentenceTranslations:[{text:'Try again.',zh:'再试一次。'},{text:'Be kind.',zh:'友善一点。'}]}]};
 const backup=validateBackup({version:1,materials:[],words:[],temporary:m,current:'practice'});
 assert.equal(backup.temporary.paragraphs[0].sentenceTranslations[1].zh,'友善一点。');assert.equal(backup.current,'practice');assert.equal(backup.materials.length,0);
 assert.throws(()=>validateMaterial({...m,paragraphs:[{text:'Try again.',sentenceTranslations:[{text:'Wrong.',zh:'错误。'}]}]}),/不匹配/);
});

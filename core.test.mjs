import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMaterial,validateBackup,expressionKey,segments,parseSubtitles,reviewPrompt} from './core.mjs';
const a={text:'think it through',term:'think it through',meaning:'想清楚'};
const m={id:'m1',title:'Test',paragraphs:[{text:'Please think it through.',annotations:[a]}]};
test('reject broken annotations before import',()=>{assert.throws(()=>validateMaterial({...m,paragraphs:[{text:'hello',annotations:[a]}]}));assert.throws(()=>validateMaterial({title:'a',paragraphs:[]}));});
test('same term different senses stay separate',()=>{assert.notEqual(expressionKey(a),expressionKey({...a,meaning:'另一种含义'}));});
test('overlapping phrases preserve complete original text',()=>{const text='think it through, think it through';const chunks=segments(text,[a,{text:'think',meaning:'想'}]);assert.equal(chunks.map(c=>c.text).join(''),text);assert.equal(chunks.filter(c=>c.annotation).length,2);});
test('SRT and VTT timestamps are retained',()=>{for(const sep of [',','.']){const result=parseSubtitles(`1\n00:01:02${sep}500 --> 00:01:04${sep}000\nHello there.\n`,'test');assert.equal(result.paragraphs[0].start,62.5);}});
test('PASS and reason persist through JSON backup round trip',()=>{const state={version:1,materials:[m],current:'m1',words:[{annotation:a,status:'passed',reason:'sound',sentence:'Please think it through.'}]};const copy=validateBackup(JSON.parse(JSON.stringify(state)));assert.equal(copy.words[0].status,'passed');assert.equal(copy.words[0].reason,'sound');assert.equal(copy.words[0].key,expressionKey(a));assert.throws(()=>validateBackup({...state,words:[{annotation:a,status:'invalid'}]}));});
test('REPRASE enforces count and retains target senses',()=>{assert.throws(()=>reviewPrompt([]));assert.throws(()=>reviewPrompt(Array(21).fill({annotation:a})));assert.match(reviewPrompt([{annotation:a}]),/想清楚/);});
test('untrusted markup remains literal text in import model',()=>{assert.equal(validateMaterial({title:'<img onerror=alert(1)>',paragraphs:[{text:'<script>oops</script>'}]}).paragraphs[0].text,'<script>oops</script>');});

test('original audio preserves exact text and rejects invalid or overlapping timing',()=>{
 const value={title:'Original',paragraphs:[{text:'Hello. Try again.'}],originalAudio:{url:'audio/original/demo.mp3',sentences:[{text:'Hello.',start:2,end:3},{text:'Try again.',start:3.2,end:5}]}};
 const m=validateMaterial(value);
 assert.deepEqual(validateBackup({version:1,materials:[m],words:[]}).materials[0].originalAudio,value.originalAudio);
 for(const originalAudio of [
  {...value.originalAudio,url:'https://example.com/a.mp3'},
  {...value.originalAudio,url:'audio/original/../data/state.json'},
  {...value.originalAudio,sentences:[{text:'Hello.',start:2,end:3}]},
  {...value.originalAudio,sentences:[{text:'Hello.',start:2,end:4},{text:'Try again.',start:3,end:5}]},
 ])assert.throws(()=>validateMaterial({...value,originalAudio}));
});

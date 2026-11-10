import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeId,validateRange} from './shadowing-core.mjs';
import {validateMaterial} from './core.mjs';
test('only real YouTube hosts yield video ids',()=>{assert.equal(youtubeId('https://www.youtube.com/watch?v=K8K09g9XR4s'),'K8K09g9XR4s');assert.equal(youtubeId('https://youtu.be/K8K09g9XR4s?t=3'),'K8K09g9XR4s');assert.equal(youtubeId('https://youtube.com.evil.test/watch?v=K8K09g9XR4s'),null);assert.equal(youtubeId('javascript:alert(1)'),null);});
test('reject reversed empty negative or beyond-duration ranges',()=>{for(const range of [[10,5,100],[0,0,10],[-1,2,10],[0,11,10],[NaN,4,10]])assert.throws(()=>validateRange(...range));assert.deepEqual(validateRange(1.2,5.7,20),{a:1.2,b:5.7});});
test('clip timing survives import normalization and rejects invalid clips',()=>{const data={title:'A',paragraphs:[{text:'Hello'}],clips:[{text:'Hello',start:0,end:5}]};assert.deepEqual(validateMaterial(data).clips,data.clips);assert.throws(()=>validateMaterial({...data,clips:[{text:'Hello',start:5,end:3}]}));});

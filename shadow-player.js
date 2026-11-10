import {youtubeId} from './shadowing-core.mjs';
let apiPromise;
function playerAPI(){
  if(window.YT?.Player)return Promise.resolve();
  if(apiPromise)return apiPromise;
  apiPromise=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{apiPromise=null;reject(Error('播放控制连接超时，可直接使用视频内的播放按钮。'));},15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);resolve();};
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>{clearTimeout(timeout);apiPromise=null;script.remove();reject(Error('播放控制未连接，可直接使用视频内的播放按钮。'));};
    document.head.append(script);
  });
  return apiPromise;
}
const node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
export function createShadowPlayer(anchor,{stopSynthesis}){
  const root=node('section');root.className='shadow-panel';anchor.after(root);
  const heading=node('h3','视频原声 · 跟着说');
  const controls=node('div');controls.className='shadow-controls';
  const load=node('button','加载原视频');
  controls.append(load);
  const box=node('div');box.className='shadow-video';box.hidden=true;
  const status=node('p','加载后播放完整视频，跟不上时随时暂停。');status.className='help';status.setAttribute('role','status');
  const fallback=node('a','在 YouTube 打开 ↗');fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.className='video-fallback';
  root.append(heading,controls,box,status,fallback);
  let materialId=null,id=null,player=null,frame=null,ready=false,loading=false,generation=0,readyTimeout=null;
  function enabled(){load.disabled=loading;}
  function stop(){if(ready)player.pauseVideo();}
  function reset(){generation++;clearTimeout(readyTimeout);stop();ready=false;loading=false;player?.destroy();player=null;frame=null;box.replaceChildren();box.hidden=true;enabled();}
  async function initialize(){
    if(loading||!id)return;reset();stopSynthesis();loading=true;enabled();const token=generation;
    // Render the native player first, so script-loading failure cannot leave an empty panel.
    frame=node('iframe');frame.title='YouTube 原视频';frame.src=`https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}&playsinline=1&autoplay=0`;
    frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';box.append(frame);box.hidden=false;
    status.textContent='正在加载原视频…也可以直接点击视频中的播放按钮。';
    try{
      await playerAPI();if(token!==generation)return;
      player=new window.YT.Player(frame,{events:{
        onReady:()=>{if(token!==generation)return;clearTimeout(readyTimeout);ready=true;loading=false;load.textContent='重新加载原视频';status.textContent='原视频已就绪。使用视频自带的播放和暂停按钮。';enabled();},
        onError:event=>{if(token!==generation)return;clearTimeout(readyTimeout);ready=false;loading=false;status.textContent=`原视频暂时无法嵌入（${event.data}）。请点击下方链接在 YouTube 播放。`;enabled();},
        onAutoplayBlocked:()=>{if(token!==generation)return;status.textContent='浏览器阻止了播放，请直接点击视频里的播放按钮。';},
        onStateChange:event=>{if(token!==generation)return;if(event.data===1){stopSynthesis();status.textContent='原声播放中，跟着说；需要时在视频中暂停。';}else if(event.data===2)status.textContent='已暂停，点击视频继续。';else if(event.data===0)status.textContent='视频播放结束。';}
      }});
      readyTimeout=setTimeout(()=>{if(token!==generation||ready)return;loading=false;status.textContent='播放控制连接较慢。请使用视频自带控件；若视频也打不开，请在 YouTube 播放。';enabled();},15000);
    }catch(e){if(token!==generation)return;loading=false;status.textContent=e.message;enabled();}
  }
  load.addEventListener('click',initialize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
  enabled();
  return {stop,update(m){if(m.id===materialId)return;reset();materialId=m.id;id=youtubeId(m.sourceUrl);root.hidden=!id;if(!id)return;fallback.href=`https://www.youtube.com/watch?v=${id}`;load.textContent='加载原视频';status.textContent='加载后播放完整视频，跟不上时随时暂停。';}};
}

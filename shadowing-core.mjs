export function youtubeId(source) {
  try {
    const u=new URL(source);
    if(!['https:','http:'].includes(u.protocol))return null;
    const id=u.hostname==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)?(u.searchParams.get('v')||u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]):null;
    return /^[\w-]{11}$/.test(id||'')?id:null;
  } catch {return null;}
}
export function validateRange(a,b,duration=Infinity) {
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||b>duration)throw Error('请设置有效范围：0 ≤ A < B，且 B 不超过视频时长。');
  return {a,b};
}
export function stamp(seconds) {return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}

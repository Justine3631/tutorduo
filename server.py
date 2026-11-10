"""Tutorduo local server. Run: python3 server.py"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import hashlib, json, subprocess, tempfile, os, sqlite3
from urllib.parse import urlsplit, parse_qs
from datetime import datetime, timezone
from state_store import StateStore, Conflict

STORE = StateStore(Path(__file__).resolve().parent / "data")

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / 'audio' / 'generated'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        if self.path == '/api/state':
            try: self.respond(200, STORE.read())
            except (OSError, ValueError): self.respond(500, {'error':'本机数据读取失败。请保留文件并检查 data/state.json，勿重新初始化。'})
        elif self.path == '/api/rephrase':
            path = STORE.directory / 'rephrase-request.json'
            self.respond(200, json.loads(path.read_text()) if path.exists() else None)
        elif self.path in ('/api/practice','/api/context'):
            name='context-request.json' if self.path=='/api/context' else None
            value=json.loads((STORE.directory/name).read_text()) if name and (STORE.directory/name).exists() else (STORE.read().get('state') or {}).get('temporary') if not name else None
            self.respond(200,value)
        elif self.path.startswith('/api/dictionary?'):
            word=parse_qs(urlsplit(self.path).query).get('word',[''])[0].strip().lower()
            if not word or len(word)>80: self.respond(400,{'error':'请选择一个词或短语。'}); return
            candidates=[word]+([word[:-1]] if word.endswith('s') else [])+([word[:-2],word[:-1]] if word.endswith('ed') else [])+([word[:-3],word[:-3]+'e'] if word.endswith('ing') else [])
            try:
                with sqlite3.connect(ROOT/'dictionaries'/'ecdict.sqlite') as db:
                    row=None
                    for candidate in candidates:
                        row=db.execute('SELECT word,phonetic,translation,definition FROM entries WHERE word=?',(candidate,)).fetchone()
                        if row: break
                self.respond(200,dict(zip(['word','phonetic','translation','definition'],row)) if row else None)
            except sqlite3.Error: self.respond(503,{'error':'本地词典尚未准备好。'})
        elif self.path.startswith('/data/'):
            self.send_error(403)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path in ('/api/state', '/api/materials', '/api/rephrase', '/api/rephrase/status', '/api/practice', '/api/context'):
            self.shared_write(); return
        if self.path != '/api/tts':
            self.send_error(404); return
        if self.headers.get('Origin') not in (None, 'http://127.0.0.1:8766', 'http://localhost:8766') or self.headers.get('Content-Type','').split(';')[0] != 'application/json':
            self.send_error(403); return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 30000: raise ValueError('请求太大。')
            payload = json.loads(self.rfile.read(size))
            text, voice = payload.get('text'), payload.get('voice')
            if not isinstance(text,str) or not text.strip() or len(text)>12000: raise ValueError('朗读文本需为 1—12000 字符。')
            voices = {'jenny':'en-US-JennyNeural', 'guy':'en-US-GuyNeural'}
            if voice not in voices: raise ValueError('音色无效。')
            CACHE.mkdir(parents=True, exist_ok=True)
            name = hashlib.sha256((voice+'\0'+text).encode()).hexdigest()+'.mp3'
            dest = CACHE / name
            if not dest.exists():
                fd, temp = tempfile.mkstemp(suffix='.mp3', dir=CACHE); os.close(fd)
                try:
                    subprocess.run(['edge-tts','--voice',voices[voice],'--rate=-8%','--text',text,'--write-media',temp],check=True,timeout=90,capture_output=True)
                    if Path(temp).stat().st_size == 0: raise ValueError('语音服务返回空音频。')
                    os.replace(temp,dest)
                finally:
                    Path(temp).unlink(missing_ok=True)
            self.respond(200, {'url':'audio/generated/'+name})
        except (ValueError, json.JSONDecodeError) as e: self.respond(400, {'error':str(e)})
        except (subprocess.SubprocessError, OSError): self.respond(502, {'error':'语音生成失败，请检查网络与 edge-tts。已缓存音频仍可播放。'})
    def shared_write(self):
        if self.headers.get('Origin') not in (None, 'http://127.0.0.1:8766', 'http://localhost:8766') or self.headers.get('Content-Type','').split(';')[0] != 'application/json':
            self.send_error(403); return
        try:
            size = int(self.headers.get('Content-Length','0'))
            if not 0 < size <= 10000000: raise ValueError('请求大小需在 10 MB 以内。')
            payload = json.loads(self.rfile.read(size))
            with STORE.lock:
                if self.path == '/api/state':
                    self.respond(200, STORE.save(payload.get('expectedRevision'),payload.get('state')))
                elif self.path == '/api/context':
                    text=payload.get('text','');context=payload.get('context','')
                    if not isinstance(text,str) or not text.strip() or len(text)>20000 or not isinstance(context,str) or len(context)>20000: raise ValueError('选词或原句无效。')
                    value={'text':text,'context':context,'sourceTitle':payload.get('sourceTitle',''),'created':datetime.now(timezone.utc).isoformat(),'status':'pending'}
                    STORE.write_json('context-request.json',value);self.respond(200,value)
                elif self.path == '/api/practice':
                    old=STORE.read()
                    if old['state'] is None: raise ValueError('请先打开网页。')
                    state=old['state'];state['temporary']=payload.get('material')
                    result=STORE.save(payload.get('expectedRevision'),state);self.respond(200,result)
                elif self.path == '/api/materials':
                    old = STORE.read()
                    if old['state'] is None: raise ValueError('请先打开学习网页，完成旧数据迁移。')
                    items = payload.get('materials')
                    if not isinstance(items,list) or not items: raise ValueError('请提供材料列表。')
                    state = old['state']
                    state['materials'].extend(items)
                    self.respond(200,STORE.save(payload.get('expectedRevision'),state))
                elif self.path == '/api/rephrase/status':
                    path = STORE.directory / 'rephrase-request.json'
                    if not path.exists(): raise ValueError('没有复习请求。')
                    current = json.loads(path.read_text())
                    if payload.get('id') != current['id']: raise Conflict('复习请求已变化，未修改新请求。')
                    if payload.get('status') not in ('completed','cancelled'): raise ValueError('请求状态无效。')
                    if payload['status'] == 'completed':
                        ids = payload.get('materialIds',[])
                        saved_state=STORE.read()['state']
                        available = {m['id'] for m in saved_state['materials']}
                        if saved_state.get('temporary'): available.add(saved_state['temporary']['id'])
                        if not ids or any(i not in available for i in ids): raise ValueError('完成请求前必须写回有效材料。')
                        current['materialIds'] = ids
                    current['status'] = payload['status']
                    STORE.write_json('rephrase-request.json', current)
                    self.respond(200,current)
                else:
                    old = STORE.read()
                    if old['state'] is None: raise ValueError('请先完成数据迁移。')
                    if payload.get('expectedRevision') != old['revision']: raise Conflict('学习记录已更新，请再点一次准备 REPHRASE。')
                    keys = payload.get('keys',[])
                    if not isinstance(keys,list) or not 1 <= len(keys) <= 20 or len(set(keys)) != len(keys): raise ValueError('请选择 1—20 个不同表达。')
                    words = {w['key']:w for w in old['state']['words']}
                    if any(k not in words for k in keys): raise ValueError('选择的表达已变化，请重新选择。')
                    request = {'id':datetime.now(timezone.utc).isoformat(),'status':'pending','keys':keys,'words':[words[k] for k in keys],'preferences':{'level':'CET6 / IELTS 6.5','words':'400—600','topics':['心理学','脑科学','个人成长'],'focus':['口语','听力']},'prompt':payload.get('prompt','')}
                    previous = STORE.directory / 'rephrase-request.json'
                    if previous.exists(): STORE.write_json('rephrase-request.previous.json', json.loads(previous.read_text()))
                    STORE.write_json('rephrase-request.json', request)
                    self.respond(200,request)
        except Conflict as e: self.respond(409,{'error':str(e)})
        except (ValueError, TypeError, KeyError) as e: self.respond(400,{'error':str(e)})
        except OSError: self.respond(500,{'error':'本机文件保存失败。请导出备份，保留现有文件。'})

    def respond(self, status, body):
        data=json.dumps(body,ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)

if __name__ == '__main__':
    print('Tutorduo: http://127.0.0.1:8766', flush=True)
    ThreadingHTTPServer(('127.0.0.1',8766),Handler).serve_forever()

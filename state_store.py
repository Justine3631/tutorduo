"""Revision-checked, atomic local storage shared by the page and chat tools."""
import json, os, tempfile, threading
from pathlib import Path

class Conflict(Exception):
    pass

class StateStore:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.lock = threading.RLock()

    def read(self):
        with self.lock:
            path = self.directory / 'state.json'
            return json.loads(path.read_text()) if path.exists() else {'revision':0,'state':None}

    def write_json(self, name, value):
        self.directory.mkdir(parents=True, exist_ok=True)
        fd, name_tmp = tempfile.mkstemp(dir=self.directory, suffix='.tmp')
        try:
            with os.fdopen(fd, 'w') as f:
                json.dump(value, f, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            os.replace(name_tmp, self.directory / name)
        finally:
            Path(name_tmp).unlink(missing_ok=True)

    def save(self, expected, state):
        with self.lock:
            old = self.read()
            if type(expected) is not int or expected != old['revision']:
                raise Conflict('记录已更新，请同步最新内容后再操作；你的旧数据没有覆盖新记录。')
            self.validate(state)
            if old['state'] is None:
                self.write_json('browser-migration-backup.json', state)
            else:
                self.write_json('state.previous.json', old)
            result = {'revision':old['revision']+1,'state':state}
            self.write_json('state.json', result)
            return result

    @staticmethod
    def validate(state):
        if not isinstance(state,dict) or state.get('version') != 1 or not isinstance(state.get('materials'),list) or not isinstance(state.get('words'),list):
            raise ValueError('学习数据格式无效。')
        ids = []
        for m in state['materials'] + ([state['temporary']] if state.get('temporary') else []):
            if not isinstance(m,dict) or not isinstance(m.get('id'),str) or not isinstance(m.get('title'),str) or not isinstance(m.get('paragraphs'),list) or not m['paragraphs']:
                raise ValueError('材料格式无效。')
            ids.append(m['id'])
            for p in m['paragraphs']:
                if not isinstance(p,dict) or not isinstance(p.get('text'),str) or not p['text'].strip(): raise ValueError('材料段落无效。')
                for a in p.get('annotations',[]):
                    if not isinstance(a,dict) or not isinstance(a.get('text'),str) or not a['text'] or a['text'] not in p['text'] or not isinstance(a.get('meaning'),str) or not a['meaning'].strip(): raise ValueError('材料标注无效。')
        if len(ids) != len(set(ids)): raise ValueError('材料 ID 重复。')
        for w in state['words']:
            if not isinstance(w,dict) or not isinstance(w.get('key'),str) or w.get('status') not in ('saved','focus','passed') or not isinstance(w.get('annotation'),dict): raise ValueError('词库记录无效。')
        if not isinstance(state.get('reviewKeys',[]),list): raise ValueError('复习选择格式无效。')

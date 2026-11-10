"""Build local lookup index from ECDICT's MIT-licensed CSV."""
import csv, sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'dictionaries'
with sqlite3.connect(root/'ecdict.sqlite') as db:
    db.execute('CREATE TABLE IF NOT EXISTS entries (word TEXT PRIMARY KEY, phonetic TEXT, translation TEXT, definition TEXT)')
    with (root/'ecdict.csv').open(newline='',encoding='utf-8-sig') as source:
        rows=csv.DictReader(source)
        db.executemany('INSERT OR REPLACE INTO entries VALUES (?,?,?,?)',((r['word'].lower(),r['phonetic'],r['translation'],r['definition']) for r in rows if r['word']))
    print('Dictionary entries:',db.execute('SELECT COUNT(*) FROM entries').fetchone()[0])

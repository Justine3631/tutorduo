import json, tempfile, threading, unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
import server
from state_store import StateStore

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.original=server.STORE;server.STORE=StateStore(self.tmp.name)
        self.http=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        self.base='http://127.0.0.1:'+str(self.http.server_port)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True);self.thread.start()
    def tearDown(self):
        self.http.shutdown();self.http.server_close();self.thread.join();server.STORE=self.original
    def call(self,path,payload=None):
        req=Request(self.base+path,data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
        with urlopen(req) as r:return json.load(r)
    def test_shared_round_trip(self):
        word={'key':'x','annotation':{'text':'hello','meaning':'你好'},'status':'focus','reason':'sound'}
        original={'version':1,'materials':[{'id':'old','title':'Old','paragraphs':[{'text':'hello'}]}],'words':[word],'current':'old','reviewKeys':['x']}
        self.call('/api/state',{'expectedRevision':0,'state':original})
        review=self.call('/api/rephrase',{'expectedRevision':1,'keys':['x'],'prompt':'test'})
        self.assertEqual(self.call('/api/rephrase')['words'],[word])
        new={'id':'new','title':'New','paragraphs':[{'text':'new lesson'}]}
        updated=self.call('/api/materials',{'expectedRevision':1,'materials':[new]})
        self.assertEqual(updated['state']['words'],[word]);self.assertEqual(updated['state']['current'],'old');self.assertEqual(updated['state']['reviewKeys'],['x'])
        with self.assertRaises(HTTPError) as err:self.call('/api/state',{'expectedRevision':1,'state':original})
        self.assertEqual(err.exception.code,409)
        self.assertEqual(len(self.call('/api/state')['state']['materials']),2)
        complete=self.call('/api/rephrase/status',{'id':review['id'],'status':'completed','materialIds':['new']})
        self.assertEqual(complete['status'],'completed')
        with self.assertRaises(HTTPError):self.call('/api/rephrase/status',{'id':'stale','status':'cancelled'})

    def test_temporary_practice_and_context_keep_library(self):
        original={'version':1,'materials':[{'id':'old','title':'Old','paragraphs':[{'text':'Hello.'}]}],'words':[],'current':'old'}
        self.call('/api/state',{'expectedRevision':0,'state':original})
        material={'id':'practice','title':'Practice','paragraphs':[{'text':'Try again.','sentenceTranslations':[{'text':'Try again.','zh':'再试一次。'}]}]}
        updated=self.call('/api/practice',{'expectedRevision':1,'material':material})
        self.assertEqual(updated['state']['materials'],original['materials'])
        self.assertEqual(updated['state']['current'],'old')
        self.assertEqual(self.call('/api/practice'),material)
        newer={**material,'id':'practice2'}
        self.call('/api/practice',{'expectedRevision':2,'material':newer})
        self.assertEqual(self.call('/api/practice')['id'],'practice2')
        self.assertEqual(self.call('/api/state')['state']['current'],'old')
        self.assertEqual(len(self.call('/api/state')['state']['materials']),1)
        self.call('/api/context',{'text':'Try','context':'Try again.','sourceTitle':'Practice'})
        self.assertEqual(self.call('/api/context')['context'],'Try again.')

if __name__=='__main__' :unittest.main()

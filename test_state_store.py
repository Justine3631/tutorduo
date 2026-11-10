import unittest, tempfile, json
from pathlib import Path
from state_store import StateStore, Conflict

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = StateStore(self.temp.name)
        self.state = {'version':1,'materials':[{'id':'a','title':'A','paragraphs':[{'text':'hello','annotations':[]}]}],'words':[],'current':'a','reviewKeys':[]}
    def test_migration_and_revision(self):
        self.assertIsNone(self.store.read()['state'])
        result=self.store.save(0,self.state)
        self.assertEqual(result['revision'],1)
        self.assertEqual(json.loads(Path(self.temp.name,'browser-migration-backup.json').read_text()),self.state)
        with self.assertRaises(Conflict): self.store.save(0,self.state)
        self.assertEqual(self.store.read(),result)
    def test_previous_copy_and_unrelated_data(self):
        self.store.save(0,self.state)
        updated=json.loads(json.dumps(self.state));updated['materials'].append({'id':'b','title':'B','paragraphs':[{'text':'new'}]})
        self.store.save(1,updated)
        old=json.loads(Path(self.temp.name,'state.previous.json').read_text())
        self.assertEqual(old['state'],self.state)
        self.assertEqual(self.store.read()['state']['materials'][0],self.state['materials'][0])
    def test_invalid_write_cannot_change_existing_state(self):
        before=self.store.save(0,self.state)
        bad=json.loads(json.dumps(self.state));bad['materials'][0]['paragraphs'][0]['annotations']=[{'text':'missing','meaning':'x'}]
        with self.assertRaises(ValueError):self.store.save(1,bad)
        self.assertEqual(self.store.read(),before)

if __name__=='__main__': unittest.main()

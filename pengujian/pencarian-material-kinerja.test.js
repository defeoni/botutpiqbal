const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(){const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../aplikasi/UtpDomain.gs'),'utf8'),c);return c;}
test('broad catalog search clones only the visible page, without mutating master rows',()=>{
  const c=setup(),items=Array.from({length:30000},(_,i)=>({code:String(i).padStart(8,'0'),name:'Barang '+i,brand:'AUX',unit:'unit'}));let clones=0;const copy=c.utpClone_;c.utpClone_=value=>{clones++;return copy(value);};
  const result=c.utpSearchItems_(items,{limit:50,offset:50},[]);assert.equal(result.total,30000);assert.equal(result.items.length,50);assert.equal(clones,50);assert.equal(items[0].approved,undefined);
});
test('relevance puts exact code/name and literal names ahead of fuzzy approved matches; explicit sorts still win',()=>{
  const c=setup(),items=[{code:'01',name:'Adaptar',brand:'AUX',favorite:true},{code:'02',name:'Adaptor',brand:'KIIP'},{code:'03',name:'Adaptor Daya',brand:'KIIP'},{code:'04',name:'Kabel Adaptor',brand:'KIIP'},{code:'adaptor',name:'Kode cocok',brand:'KIIP'}];
  const approvals=[{id:'a',status:'APPROVED',brand:'AUX',material:'Adaptar',types:[]}];
  const filters={query:'adaptor',fuzzy:true,relevance:true};
  assert.equal(c.utpSearchItems_(items,filters,approvals).items.map(i=>i.code).join(','),'adaptor,02,03,04,01');
  assert.equal(c.utpSearchItems_(items,{...filters,sortBy:'code'},approvals).items[0].code,'01');
  assert.equal(c.utpSearchItems_(items,{...filters,approvedOnly:true},approvals).items[0].code,'01');
  assert.equal(c.utpSearchItems_(items,{query:'daya adaptor',relevance:true},[]).items[0].code,'03');
  assert.equal(items[0].name,'Adaptar');
  const source=fs.readFileSync(path.join(__dirname,'../aplikasi/UtpClient.html'),'utf8');
  c.state={data:{catalog:items}};c.norm=c.utpNorm_;c.itemClassification=c.utpItemClassification_;c.approvalFor=item=>c.utpFindApproval_(item,approvals);c.searchWord=c.utpSearchWord_;
  vm.runInContext(source.match(/  function compareCatalogItems\(a,b,filters\) \{[\s\S]*?\n  \}/)[0]+source.match(/  function previewSearch\(filters\) \{[\s\S]*?\n  \}/)[0],c);
  assert.equal(c.previewSearch(filters).items.map(i=>i.code).join(','),'adaptor,02,03,04,01');
});
test('indexed approval matching preserves first exact match, generic classification and brand boundaries',()=>{
  const c=setup(),items=[{code:'0001',name:'Pipa',brand:'AUX',model:'A1'},{code:'0002',name:'Pipa',brand:'',brandStatus:'GENERIC'},{code:'0003',name:'Pipa',brand:'',brandStatus:'UNKNOWN'}];
  const approvals=[{id:'rejected',status:'REJECTED',brand:'AUX',material:'Pipa'},{id:'first',status:'APPROVED',brand:' AUX ; KIIP',material:'Pipa',authority:'MK',types:['A1']},{id:'second',status:'APPROVED',brand:'AUX',material:'Pipa',types:[]},{id:'generic',status:'APPROVED',generic:true,material:'Pipa',types:[]}];
  const result=c.utpSearchItems_(items,{limit:50},approvals),byCode=Object.fromEntries(result.items.map(i=>[i.code,i]));assert.equal(byCode['0001'].approvalId,'first');assert.equal(byCode['0002'].approvalId,'generic');assert.equal(byCode['0003'].approved,false);
  assert.equal(c.utpSearchItems_(items,{approvedOnly:true},approvals).total,2);assert.equal(c.utpSearchItems_(items,{query:'0001'},approvals).items[0].code,'0001');
});
test('brand checkboxes combine by union, unknown is not generic, empty selection means all',()=>{
  const c=setup(),items=[{code:'01',name:'Barang',brand:'AUX'},{code:'02',name:'Barang',brandStatus:'GENERIC'},{code:'03',name:'Barang',brandStatus:'unknown'}];
  assert.equal(c.utpSearchItems_(items,{brandClasses:[]},[]).total,3);
  assert.equal(c.utpSearchItems_(items,{brandClasses:['GENERIC']},[]).items[0].code,'02');
  assert.equal(c.utpSearchItems_(items,{brandClasses:['BRANDED','UNKNOWN']},[]).total,2);
  assert.throws(()=>c.utpSearchItems_(items,{brandClasses:'BRANDED'},[]),/Filter/);
});
test('fuzzy names allow one letter edit, never fuzzy codes, brands or short specifications; preview agrees',()=>{
  const c=setup(),source=fs.readFileSync(path.join(__dirname,'../aplikasi/UtpClient.html'),'utf8');
  vm.runInContext(source.match(/  function searchWord\(term, word\) \{[\s\S]*?\n  \}/)[0],c);
  for(const [term,word,expected] of [['adaptar','adaptor',true],['adptor','adaptor',true],['adapttor','adaptor',true],['pompa','pampa',true],['pmp','pompa',false],['12','24',false],['ab123','ab124',false],['adxxptor','adaptor',false]]){
    assert.equal(c.utpSearchWord_(term,word),expected);assert.equal(c.searchWord(term,word),expected);
  }
  const items=[{code:'0001',name:'Adaptor Daya 12 V, AUX',brand:'AUX',model:'ABC123'}];
  assert.equal(c.utpSearchItems_(items,{query:'adaptar 12',fuzzy:true},[]).total,1);
  assert.equal(c.utpSearchItems_(items,{query:'adaptar'},[]).total,0);
  assert.equal(c.utpSearchItems_(items,{query:'0002',fuzzy:true},[]).total,0);
  assert.equal(c.utpSearchItems_(items,{query:'adaptar',fuzzy:true,brand:'AUY'},[]).total,0);
  assert.equal(items[0].name,'Adaptor Daya 12 V, AUX');
});

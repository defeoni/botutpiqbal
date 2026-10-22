const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(){const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../aplikasi/UtpDomain.gs'),'utf8'),c);return c;}
test('broad catalog search clones only the visible page, without mutating master rows',()=>{
  const c=setup(),items=Array.from({length:30000},(_,i)=>({code:String(i).padStart(8,'0'),name:'Barang '+i,brand:'AUX',unit:'unit'}));let clones=0;const copy=c.utpClone_;c.utpClone_=value=>{clones++;return copy(value);};
  const result=c.utpSearchItems_(items,{limit:50,offset:50},[]);assert.equal(result.total,30000);assert.equal(result.items.length,50);assert.equal(clones,50);assert.equal(items[0].approved,undefined);
});
test('indexed approval matching preserves first exact match, generic classification and brand boundaries',()=>{
  const c=setup(),items=[{code:'0001',name:'Pipa',brand:'AUX',model:'A1'},{code:'0002',name:'Pipa',brand:'',brandStatus:'GENERIC'},{code:'0003',name:'Pipa',brand:'',brandStatus:'UNKNOWN'}];
  const approvals=[{id:'rejected',status:'REJECTED',brand:'AUX',material:'Pipa'},{id:'first',status:'APPROVED',brand:' AUX ; KIIP',material:'Pipa',authority:'MK',types:['A1']},{id:'second',status:'APPROVED',brand:'AUX',material:'Pipa',types:[]},{id:'generic',status:'APPROVED',generic:true,material:'Pipa',types:[]}];
  const result=c.utpSearchItems_(items,{limit:50},approvals),byCode=Object.fromEntries(result.items.map(i=>[i.code,i]));assert.equal(byCode['0001'].approvalId,'first');assert.equal(byCode['0002'].approvalId,'generic');assert.equal(byCode['0003'].approved,false);
  assert.equal(c.utpSearchItems_(items,{approvedOnly:true},approvals).total,2);assert.equal(c.utpSearchItems_(items,{query:'0001'},approvals).items[0].code,'0001');
});

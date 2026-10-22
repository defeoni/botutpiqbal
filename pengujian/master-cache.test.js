const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
function setup(rows=[['0001','Barang','AUX','','explicit','','unit','Grup','Family']]){
  const cache=new Map(),props=new Map();let reads=0,modified=1,favorites=[],available=true;
  const blob=data=>({getBytes:()=>Array.from(Buffer.from(data)),getDataAsString:()=>Buffer.from(data).toString()});
  const sheet={getLastRow:()=>rows.length+1,getSheetId:()=>10,getParent:()=>({getId:()=> 'source'}),getRange:()=>({getDisplayValues:()=>{reads++;return rows;}})};
  const c=vm.createContext({CacheService:{getScriptCache:()=>{if(!available)throw Error('Cache unavailable');return {get:k=>cache.get(k)||null,getAll:keys=>Object.fromEntries(keys.filter(k=>cache.has(k)).map(k=>[k,cache.get(k)])),putAll:data=>Object.entries(data).forEach(([k,v])=>{assert.ok(Buffer.byteLength(v)<=80000);cache.set(k,v);}),put:(k,v)=>cache.set(k,v)};}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null})},DriveApp:{getFileById:()=>({getLastUpdated:()=>new Date(modified)})},Utilities:{newBlob:blob,gzip:b=>blob(zlib.gzipSync(Buffer.from(b.getBytes()))),ungzip:b=>blob(zlib.gunzipSync(Buffer.from(b.getBytes()))),base64Encode:b=>Buffer.from(b).toString('base64'),base64Decode:s=>Array.from(Buffer.from(s,'base64'))}});
  for(const file of ['UtpDomain.gs','Utp.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../aplikasi',file),'utf8'),c);
  c.utpMasterSheet_=()=>sheet;c.utpGet_=()=>({favorites});
  return {c,cache,props,get reads(){return reads;},modify(){modified++;},setFavorites:value=>favorites=value,disable(){available=false;}};
}
test('warm catalog cache avoids a bulk Sheet reread while preserving string codes and fresh favorites',()=>{
  const e=setup();assert.equal(e.c.utpMaster_()[0].code,'0001');assert.equal(e.reads,1);e.setFavorites(['0001']);const result=e.c.utpMaster_();assert.equal(e.reads,1);assert.equal(result[0].favorite,true);
  result[0].brand='Changed client';assert.equal(e.c.utpMaster_()[0].brand,'AUX');
});
test('master file revision and import epoch invalidate cached rows',()=>{
  const e=setup();e.c.utpMaster_();e.modify();e.c.utpMaster_();assert.equal(e.reads,2);e.props.set('UTP_MASTER_CACHE_REVISION','import-2');e.c.utpMaster_();assert.equal(e.reads,3);
});
test('evicted catalog chunk and unavailable cache fall back to authoritative Sheets',()=>{
  const rows=Array.from({length:1400},(_,i)=>[String(i).padStart(8,'0'),crypto.createHash('sha512').update(String(i)).digest('hex').repeat(2),'','','unknown','','unit','G','F']);
  const e=setup(rows);e.c.utpMaster_();const [key,value]=[...e.cache].find(([,v])=>v.startsWith('{'));assert.ok(JSON.parse(value).chunks>=2);e.cache.delete(key+'.0');assert.equal(e.c.utpMaster_().length,1400);assert.equal(e.reads,2);
  e.disable();assert.equal(e.c.utpMaster_().length,1400);assert.equal(e.reads,3);
});

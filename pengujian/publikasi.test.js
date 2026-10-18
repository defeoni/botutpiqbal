const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const domain=require('../aplikasi/UtpDomain.gs');
const dir=path.join(__dirname,'../aplikasi');
const source=name=>fs.readFileSync(path.join(dir,name),'utf8');
test('all application scripts parse before upload',()=>{
  for(const name of fs.readdirSync(dir)){
    if(name.endsWith('.gs'))new vm.Script(source(name),{filename:name});
    if(name.endsWith('.html'))for(const match of source(name).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1],{filename:name});
  }
});
test('pagination exposes all matching materials once, including last and empty page',()=>{
  const items=Array.from({length:1535},(_,i)=>({code:String(i).padStart(5,'0'),name:'Material',unit:'pcs'}));
  const codes=[];
  for(let offset=0;offset<items.length;offset+=50){const r=domain.searchItems(items,{limit:50,offset},[]);assert.equal(r.offset,offset);assert.equal(r.total,1535);codes.push(...r.items.map(x=>x.code));}
  assert.equal(new Set(codes).size,1535);
  assert.equal(domain.searchItems(items,{limit:50,offset:99999},[]).offset,1500);
  assert.equal(domain.searchItems(items,{limit:50,offset:1500},[]).hasMore,false);
  assert.equal(domain.searchItems(items,{limit:50,query:'no-match',offset:100},[]).offset,0);
  for(const offset of [-1,1.5,Infinity,'bad'])assert.throws(()=>domain.searchItems(items,{offset},[]));
});
function blob(text,name){return {getName:()=>name,getDataAsString:()=>text,copyBlob(){return this;},setContentType(){return this;}};}
test('template filling preserves styles, logos, formulas and untouched cells; text cannot inject XML',()=>{
  let zipped;
  const parts=[blob('<worksheet><sheetData><row r="4"><c r="D4" s="14"/><c r="E4" s="15"/></row><row r="19"><c r="F19" s="2"><f>SUM(F10:F18)</f><v>0</v></c></row></sheetData><mergeCells><mergeCell ref="D4:E4"/></mergeCells></worksheet>','xl/worksheets/sheet1.xml'),blob('original-logo-bytes','xl/media/image1.jpg')];
  const env=vm.createContext({Utilities:{unzip:()=>parts,newBlob:(text,type,name)=>blob(text,name),zip:parts=>{zipped=parts;return blob('zip','out');}}});
  vm.runInContext(source('DocumentExports.gs'),env);
  env.documentFillXlsx_(blob('src','src'),{D4:'A<&B',F19:{cached:20}},false,false);
  const xml=zipped[0].getDataAsString();assert.match(xml,/r="D4" s="14" t="inlineStr"/);assert.match(xml,/A&lt;&amp;B/);assert.match(xml,/<f>SUM\(F10:F18\)<\/f><v>20<\/v>/);assert.match(xml,/mergeCell ref="D4:E4"/);assert.equal(zipped[1],parts[1]);
  assert.throws(()=>env.documentFillXlsx_(blob('src','src'),{D4:{cached:20}},false,false),/Rumus/);
});
test('RPD sample signature is removed while original logo is kept',()=>{
  const env=vm.createContext({Utilities:{newBlob:(text,type,name)=>blob(text,name)}});vm.runInContext(source('DocumentExports.gs'),env);
  const logo=blob('logo','xl/media/image1.jpg');
  const result=env.documentRemoveSampleSignature_([logo,blob('signature','xl/media/image2.jpg'),blob('<root><xdr:oneCellAnchor><pic name="image1.jpg"/></xdr:oneCellAnchor><xdr:oneCellAnchor><pic name="image2.jpg"/></xdr:oneCellAnchor></root>','xl/drawings/drawing1.xml'),blob('<Relationships><Relationship Id="a" Target="../media/image1.jpg"/><Relationship Id="b" Target="../media/image2.jpg"/></Relationships>','xl/drawings/_rels/drawing1.xml.rels')]);
  assert.equal(result[0],logo);assert.ok(!result.some(x=>x.getName()==='xl/media/image2.jpg'));assert.ok(!result.find(x=>x.getName().includes('drawing1.xml')).getDataAsString().includes('image2.jpg'));
});
test('export endpoints reject unauthorized callers before cloud reads',()=>{
  const env=vm.createContext({requireAuthorized_(){throw new Error('Unauthorized');}});vm.runInContext(source('DocumentExports.gs'),env);
  assert.throws(()=>env.apiDocumentExport('requests','id',1,'initial','bad',{}),/Unauthorized/);assert.throws(()=>env.apiDocumentExportHistory('requests','id','bad'),/Unauthorized/);
});
test('Telegram maintenance deduplicates triggers, registers automatically and never claims a failed registration',()=>{
  const props=new Map([['TELEGRAM_BOT_TOKEN','secret'],['OWNER_TELEGRAM_ID','owner']]),triggers=[],lock={tryLock:()=>true,releaseLock(){}};
  let registered=false,attempts=0;
  const env=vm.createContext({requireAuthorized_(token){if(token!=='owner')throw new Error('Unauthorized');},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},LockService:{getScriptLock:()=>lock},Utilities:{getUuid:()=> 'uuid'},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:handler=>({timeBased(){return this;},everyHours(){return this;},create(){triggers.push({getHandlerFunction:()=>handler});}}),deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1)},getTelegramStatus_:()=>({webhookActive:registered}),setTelegramWebhook_(){attempts++;}});
  vm.runInContext(source('TelegramConnection.gs'),env);
  assert.throws(()=>env.apiEnsureTelegramConnection('bad'),/Unauthorized/);
  assert.equal(env.apiEnsureTelegramConnection('owner').webhookActive,false);assert.equal(attempts,1);assert.equal(triggers.length,1);
  registered=true;props.delete('TELEGRAM_CONNECTION_NEXT_CHECK');assert.equal(env.apiEnsureTelegramConnection('owner').webhookActive,true);assert.equal(triggers.length,1);
  props.delete('TELEGRAM_BOT_TOKEN');assert.equal(env.apiEnsureTelegramConnection('owner').configured,false);
});

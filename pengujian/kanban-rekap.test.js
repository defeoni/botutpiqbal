const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),domain=require('../aplikasi/UtpDomain.gs');
const source=name=>fs.readFileSync(path.join(__dirname,'../aplikasi',name),'utf8');
function exportsEnv(extra={}){const env=vm.createContext(extra);vm.runInContext(source('DocumentExports.gs'),env);return env;}
test('recap includes all records, clears samples and preserves authority without inventing data',()=>{
 const env=exportsEnv(),records=Array.from({length:23},(_,i)=>({id:'a'+i,material:'Material '+i,status:i===0?'APPROVED':i===1?'REJECTED':i===2?'OWNER':'COMPARE',authority:i===0?'PM':'HO',brand:'',generic:i===3,types:['AW'],brochureId:i===0?'file-1':'',createdAt:'2026-01-01'}));records.push({archived:true,material:'Archived'});
 const pages=env.buildApprovalRecapPages(records,'Proyek uji');assert.equal(pages.length,3);assert.equal(pages[2].partCount,3);assert.equal(pages[2].cells.A20,23);assert.equal(pages[0].cells.L16,'✓');assert.equal(pages[0].cells.M18,'✓');assert.equal(pages[0].cells.L20,'');assert.equal(pages[0].cells.M20,'');assert.match(pages[0].cells.N16,/PM.*Bukan otomatis persetujuan HO/);assert.match(pages[0].cells.N16,/file-1/);assert.equal(pages[0].cells.H16,'');assert.equal(pages[0].cells.E16,'');assert.equal(pages[0].cells.C17,'');assert.match(pages[0].cells.G16,/belum diketahui/);assert.match(pages[0].cells.G22,/Generik/);assert.equal(pages[0].cells.E2,'Proyek uji');assert.equal(env.buildApprovalRecapPages([], 'P').length,0);assert.equal(records[0].brand,'');
});
test('recap archive history is authenticated and independent of any individual approval record',()=>{
 const env=exportsEnv({requireAuthorized_(token){if(token!=='owner')throw Error('Unauthorized');},utpRead_:()=>[{entity:'approvalRecap',recordId:'all',createdAt:'2026-01-01',outputs:{files:[]}},{entity:'approvals',recordId:'a1'},{entity:'approvalRecap',recordId:'all',archived:true,createdAt:'2026-01-02'}]});
 assert.throws(()=>env.apiDocumentExportHistory('approvalRecap','all','bad'),/Unauthorized/);assert.equal(env.apiDocumentExportHistory('approvalRecap','all','owner').length,1);
});
test('fulfillment requires final snapshot and explicit confirmation; review invalidates earlier fulfillment',()=>{
 const item={id:'i',code:'001',name:'Pipa',brand:'Rucika',model:'AW',unit:'batang',quantity:2,classification:'BRANDED',isTemporary:false,requiredAuthority:'PM',decisions:{PM:{status:'APPROVED'},MK:{status:'PENDING'},HO:{status:'PENDING'}},exceptionReason:'',note:'',finalFileId:'',supplyConfirmed:false};
 const r={id:'r',version:1,itemContractVersion:1,title:'Permintaan',number:'',date:'2026-10-19',status:'FINAL',revision:1,items:[item],files:[],history:[],revisions:[],initialSnapshot:{items:[item]},finalSnapshot:{items:[item]},finalItemIds:['i'],arrived:false};
 const ctx={now:'2026-10-19T08:00:00Z',party:'PM',reason:'Konfirmasi supplier',confirmed:true,approvals:[{id:'a',material:'Pipa',brand:'Rucika',status:'APPROVED',authority:'PM',itemCodes:['001'],types:['AW']}]};
 assert.throws(()=>domain.materialCommand('FULFILLMENT',null,{...r,status:'REVIEW'},ctx),/daftar final/);assert.throws(()=>domain.materialCommand('FULFILLMENT',null,r,{...ctx,confirmed:false}),/eksplisit/);assert.throws(()=>domain.materialCommand('FULFILLMENT',null,r,{...ctx,reason:''}),/konfirmasi/);
 const supplied=domain.materialCommand('FULFILLMENT',null,r,ctx);assert.equal(supplied.fulfillmentConfirmed,true);assert.equal(r.fulfillmentConfirmed,undefined);assert.equal(supplied.arrived,false);assert.throws(()=>domain.materialCommand('FULFILLMENT',null,supplied,ctx),/sudah/);
 const edited=domain.materialCommand('SAVE',{...supplied,note:'Perubahan review'},supplied,ctx);assert.equal(edited.fulfillmentConfirmed,false);assert.equal(edited.finalSnapshot,null);assert.equal(edited.status,'REVIEW');
 const arrived=domain.materialCommand('ARRIVAL',null,supplied,{...ctx,arrivalDate:'2026-10-18'});assert.equal(arrived.arrivalDate,'2026-10-18');assert.equal(arrived.arrivedAt,ctx.now);assert.throws(()=>domain.materialCommand('ARRIVAL',null,supplied,{...ctx,arrivalDate:'2026-02-30'}),/Tanggal/);
});
test('Telegram cached status states its age and redacts actual and encoded secrets',()=>{
 const props=new Map([['TELEGRAM_BOT_TOKEN','123:secret'],['BOT_WEBHOOK_KEY','x/y'],['TELEGRAM_CONNECTION_STATUS',JSON.stringify({webhookActive:true,checkedAt:'2020-01-01T00:00:00Z',message:'URL ?key=x%2Fy token 123:secret',lastError:'x/y'})]]);
 const env=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)})},Utilities:{formatDate:()=> '01-01-2020 07:00'}});vm.runInContext(source('TelegramConnection.gs'),env);
 const result=env.telegramConnectionSnapshot_();assert.equal(result.stale,true);assert.equal(result.cached,true);assert.match(result.message,/tersimpan.*ulang/);assert.ok(!JSON.stringify(result).includes('123:secret'));assert.ok(!JSON.stringify(result).includes('x/y'));assert.ok(!JSON.stringify(result).includes('x%2Fy'));
});


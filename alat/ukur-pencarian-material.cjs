// CPU benchmark on generated data; never reads the user's 30k-row master.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..'),base=process.argv[2]||'d07ebba';
function rules(text){const c=vm.createContext({});vm.runInContext(text,c);return c;}
const before=rules(execFileSync('git',['show',base+':aplikasi/UtpDomain.gs'],{cwd:root,encoding:'utf8'})),after=rules(fs.readFileSync(path.join(root,'aplikasi/UtpDomain.gs'),'utf8'));
const items=Array.from({length:30000},(_,i)=>({code:String(i).padStart(8,'0'),name:'Pipa ukuran '+(i%90)+' Material '+i,brand:i%4?'Merek '+(i%150):'',brandStatus:i%4?'CONFIRMED':i%8?'GENERIC':'UNKNOWN',model:'Tipe '+(i%20),unit:'batang',group:'Grup '+(i%6),family:'Pipa',favorite:i%97===0}));
const approvals=Array.from({length:100},(_,i)=>({id:'a'+i,status:i%9?'APPROVED':'REJECTED',brand:'Merek '+(i%150),material:'Pipa',types:[],generic:false,authority:'MK'}));
const cases=[{query:'',limit:50},{query:'Pipa 12',limit:50},{query:'00000001',limit:50},{query:'',brandClass:'UNKNOWN',offset:50},{approvedOnly:true,sortBy:'code',sortDirection:'desc',limit:50},{sortBy:'name',limit:50}];
for(const filter of cases){assert.equal(JSON.stringify(after.utpSearchItems_(items.slice(0,2000),filter,approvals)),JSON.stringify(before.utpSearchItems_(items.slice(0,2000),filter,approvals)),'Search contract changed');}
const timed=cases.slice(0,3).concat(cases[5]),times={before:[],after:[]};for(let run=0;run<3;run++)for(const [label,r] of [['before',before],['after',after]]){const t=performance.now();for(const filter of timed)r.utpSearchItems_(items,filter,approvals);times[label].push(performance.now()-t);}
const median=a=>a.sort((x,y)=>x-y)[1],old=median(times.before),now=median(times.after);
console.log(JSON.stringify({rows:items.length,approvals:approvals.length,parityCases:cases.length,timedCases:timed.length,equivalent:true,beforeMedianMs:Math.round(old),afterMedianMs:Math.round(now),speedup:Number((old/now).toFixed(2)),scope:'CPU lokal, bukan latency Sheets/Apps Script produksi'},null,2));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const port=19920+Math.floor(Math.random()*200),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slime-v030-'));
const child=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'NET001',EMPLOYEE_HASH_SECRET:'v030-test'},stdio:['ignore','pipe','pipe']});
let out='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>out+=x);
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<60;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return await r.json()}catch{}await sleep(100)}throw Error('server did not start\n'+out)}
async function post(url,obj){const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(obj)}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${url}: ${r.status} ${j.error||''}`);return j}
try{
 const health=await wait();if(health.version!=='0.4.1'||'trustProxy' in health||'port' in health)throw Error('health/version or data minimization mismatch');
 const a=await post('/api/register',{name:'网络测试',employeeId:'NET001',slimeColor:'mint',deviceLabel:'test'}),cred={userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,tabId:'v030'};
 const sync=await post('/api/sync/light',{...cred,section:'chat',roomId:'chat-general',presenceStatus:'online',activityLabel:'',since:Date.now(),includeUsers:true});if(!sync.ok||!Array.isArray(sync.users)||!sync.unread)throw Error('light sync failed');
 for(let i=0;i<25;i++)await post('/api/room/snapshot',{...cred,roomId:'chat-general'}); // > old shared 240/min pressure pattern is safe per user endpoint limit
 const diag=await post('/api/admin/diagnostics',cred);if(!diag.ok||!diag.memory||!diag.lastMinute||diag.proxy?.trustProxy!==true)throw Error('diagnostics payload failed');
 const server=fs.readFileSync(path.join(root,'local_server.js'),'utf8'),app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
 if(server.includes("rateLimit(req,'post',240,60000)"))throw Error('old global POST/IP limiter still present');
 if(!app.includes("post('/api/sync/light'")||app.includes('setInterval(pollFriendUnread,3000)'))throw Error('client background polling was not reduced');
 console.log('[OK] v0.3.1 light sync / user-scoped rate limit / diagnostics / proxy default / background sync retained');
}finally{child.kill('SIGTERM');await sleep(100);fs.rmSync(tmp,{recursive:true,force:true})}

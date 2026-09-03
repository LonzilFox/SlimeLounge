import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v023-wallet-'));
const port=18094;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let proc=null,logs='';
async function start(){logs='';proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'TW1001',EMPLOYEE_HASH_SECRET:'wallet-v023-test'},stdio:['ignore','pipe','pipe'],windowsHide:true});proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return}catch{}await sleep(80)}throw Error('wallet test server start timeout\n'+logs)}
async function stop(){if(proc&&!proc.killed)proc.kill('SIGTERM');await sleep(160);proc=null}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
try{
  await start();
  const reg=await post('/api/register',{name:'WalletTest',employeeId:'TW1001',slimeColor:'mint',deviceLabel:'wallet-test'});
  if(reg.profile?.chips!==2000)throw Error(`new wallet should be 2000, got ${reg.profile?.chips}`);
  const ck=await post('/api/wallet/checkin',{userId:reg.userId,deviceId:reg.deviceId,deviceToken:reg.deviceToken});
  if(ck.profile?.chips!==3000)throw Error(`check-in should reach 3000, got ${ck.profile?.chips}`);
  await stop();

  let data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json'),'utf8'));
  data.users[reg.userId].chips=0;
  data.users[reg.userId].chipsUpdatedAt=Date.now()-30*60*1000;
  fs.writeFileSync(path.join(tmp,'data.json'),JSON.stringify(data,null,2));
  await start();
  let auth=await post('/api/auth',{userId:reg.userId,deviceId:reg.deviceId,deviceToken:reg.deviceToken});
  if(auth.profile.chips<495||auth.profile.chips>510)throw Error(`30 min offline recovery expected ~500, got ${auth.profile.chips}`);
  await stop();

  data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json'),'utf8'));
  data.users[reg.userId].chips=2500;
  data.users[reg.userId].chipsUpdatedAt=Date.now()-12*60*60*1000;
  fs.writeFileSync(path.join(tmp,'data.json'),JSON.stringify(data,null,2));
  await start();
  auth=await post('/api/auth',{userId:reg.userId,deviceId:reg.deviceId,deviceToken:reg.deviceToken});
  if(auth.profile.chips!==2500)throw Error(`wallet above 2000 was altered/clamped: ${auth.profile.chips}`);
  const leaders=await post('/api/leaderboards',{userId:reg.userId,deviceId:reg.deviceId,deviceToken:reg.deviceToken});
  if(leaders.leaderboards?.chips?.find(x=>x.userId===reg.userId)?.chips!==2500)throw Error('chip leaderboard did not retain >2000 balance');
  console.log('[OK] v0.2.4 wallet: default 2000 / +1000 daily check-in / 1000-per-hour offline recovery / >2000 never clamped');
}finally{
  await stop().catch(()=>{});
  fs.rmSync(tmp,{recursive:true,force:true});
}

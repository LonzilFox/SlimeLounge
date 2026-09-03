import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v026-'));
const port=18106,origin=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'TTOWN6',EMPLOYEE_HASH_SECRET:'v026-test',SLIMELOUNGE_TRUST_PROXY:'1',SLIMELOUNGE_COOKIE_SECURE:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
async function wait(){for(let i=0;i<80;i++){try{if((await fetch(`${origin}/api/health`)).ok)return}catch{}await sleep(60)}throw Error('v0.2.6 server start timeout\n'+logs)}
async function req(p,{method='GET',body=null,headers={}}={}){const h={...headers};if(body!=null)h['content-type']='application/json';const r=await fetch(origin+p,{method,headers:h,body:body==null?undefined:JSON.stringify(body)}),text=await r.text();let j={};try{j=JSON.parse(text)}catch{}return {r,j,text}}
async function post(p,b,opt={}){const x=await req(p,{method:'POST',body:b,...opt});if(!x.r.ok)throw Error(`${p}: ${x.j.error||x.r.status}`);return x.j}
const cred=x=>({userId:x.userId,deviceId:x.deviceId,deviceToken:x.deviceToken});
const info=(installId,browser='Edge')=>({installId,platform:'Windows',platformVersion:'15.0.0',architecture:'x86',bitness:'64',browser,language:'zh-CN',timeZone:'Asia/Shanghai',screen:'1920x1080@1.00',hardwareConcurrency:16,deviceMemory:8,maxTouchPoints:0});
try{
  await wait();
  const owner=await post('/api/register',{name:'Owner6',employeeId:'TTOWN6',slimeColor:'mint',deviceLabel:'Windows · Edge',deviceInfo:info('install-owner')},{headers:{'x-forwarded-for':'2408:1234::99','user-agent':'UA-EDGE'}});
  const firstId=owner.deviceId;
  await post('/api/auth',{...cred(owner),deviceInfo:info('install-owner')},{headers:{'x-forwarded-for':'203.0.113.8','user-agent':'UA-EDGE-2'}});
  await sleep(260);
  let data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json'),'utf8')),d=data.devices[firstId];
  if(!d||Object.keys(data.devices).length!==1)throw Error('IP change created a new device');
  if(d.lastIp!=='203.0.113.8'||d.lastIpVersion!==4||d.platform!=='Windows'||d.browser!=='Edge'||!d.installIdHash)throw Error(`device diagnostics not persisted: ${JSON.stringify(d)}`);

  const recovery=await post('/api/admin/manage',{...cred(owner),action:'create_device_recovery',targetUserId:owner.userId,targetDeviceId:firstId});
  const recovered=await post('/api/device-link/redeem',{code:recovery.code,deviceLabel:'Windows · Edge 恢复',existingDeviceId:firstId,deviceInfo:info('install-owner')},{headers:{'x-forwarded-for':'2408:abcd::12'}});
  if(recovered.deviceId!==firstId||!recovered.reusedDevice)throw Error('device recovery code did not reuse original Device ID');
  await sleep(260);data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json'),'utf8'));if(Object.keys(data.devices).length!==1)throw Error('device recovery minted an extra device');

  const other=await post('/api/register',{name:'Dup',employeeId:'TTDUP6',slimeColor:'sky',deviceLabel:'Android · Chrome',deviceInfo:info('install-dup','Chrome')});
  await post('/api/admin/chips',{...cred(recovered),action:'set_user',targetUserId:owner.userId,chips:3500});
  await post('/api/admin/chips',{...cred(recovered),action:'set_user',targetUserId:other.userId,chips:6200});
  await post('/api/admin/manage',{...cred(recovered),action:'merge_user',sourceUserId:other.userId,targetUserId:owner.userId});
  const auth=await post('/api/auth',cred(recovered));if(auth.profile.chips!==6200)throw Error(`merged wallet should keep max(3500,6200)=6200, got ${auth.profile.chips}`);

  const css=fs.readFileSync(path.join(root,'public/styles-responsive.css'),'utf8');
  if(!css.includes('.hidden,.app.hidden,.auth-screen.hidden,#app.hidden,#authScreen.hidden{display:none!important}'))throw Error('mobile hidden override missing');
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');if(!html.includes('以前注册过？不要重新注册。'))throw Error('recovery-first auth UI missing');
  console.log('[OK] v0.2.6 device: IP-independent ID / detailed diagnostics / same-ID admin recovery');
  console.log('[OK] v0.2.6 mobile auth: hidden state wins / recovery-first login');
  console.log('[OK] v0.2.6 merge: duplicate wallets keep maximum instead of adding');
} finally {if(proc&&!proc.killed)proc.kill('SIGTERM');await sleep(100);fs.rmSync(tmp,{recursive:true,force:true})}

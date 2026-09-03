import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v025-identity-'));
const port=18097,origin=`http://127.0.0.1:${port}`,publicOrigin='https://slimelounge.tail-test.ts.net';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'TTOWN5',EMPLOYEE_HASH_SECRET:'v025-identity-test',SLIMELOUNGE_TRUST_PROXY:'1',SLIMELOUNGE_COOKIE_SECURE:'0',SLIMELOUNGE_PUBLIC_ORIGIN:publicOrigin},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
async function wait(){for(let i=0;i<80;i++){try{if((await fetch(`${origin}/api/health`)).ok)return}catch{}await sleep(60)}throw Error('v0.2.6 test server start timeout\n'+logs)}
async function req(p,{method='GET',body=null,cookie='',headers={}}={}){const h={...headers};if(body!=null)h['content-type']='application/json';if(cookie)h.cookie=cookie;const r=await fetch(origin+p,{method,headers:h,body:body==null?undefined:JSON.stringify(body),redirect:'manual'}),text=await r.text();let j={};try{j=JSON.parse(text)}catch{}return {r,j,text,cookie:r.headers.get('set-cookie')||''}}
async function post(p,b,opt={}){const x=await req(p,{method:'POST',body:b,...opt});if(!x.r.ok)throw Error(`${p}: ${x.j.error||x.r.status}`);return x}
const cred=x=>({userId:x.userId,deviceId:x.deviceId,deviceToken:x.deviceToken});
function hostRequest(pathname,host){return new Promise((resolve,reject)=>{const q=http.request({host:'127.0.0.1',port,path:pathname,method:'GET',headers:{host}},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body}))});q.on('error',reject);q.end()})}
try{
  await wait();
  const reg=(await post('/api/register',{name:'Owner5',employeeId:'TTOWN5',slimeColor:'mint',deviceLabel:'Chrome'}, {headers:{'x-forwarded-for':'1.1.1.1'}}));
  const me=reg.j,c1=reg.cookie.split(';')[0];if(!me.deviceId||!c1.includes('sl_session='))throw Error('registration did not issue stable device/session credentials');
  await post('/api/auth',cred(me),{headers:{'x-forwarded-for':'2.2.2.2','user-agent':'Different Network Browser'}});await sleep(260);
  let data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json'),'utf8'));if(Object.keys(data.devices).length!==1||!data.devices[me.deviceId])throw Error('IP change created/replaced device id');if(data.devices[me.deviceId].lastIp!=='2.2.2.2')throw Error('forwarded IP was not recorded as audit metadata');

  const s1=await req('/api/session',{cookie:c1});if(!s1.r.ok||s1.j.deviceId!==me.deviceId)throw Error('cookie recovery changed device id');
  const s2=await req('/api/session',{cookie:c1});if(!s2.r.ok||s2.j.deviceId!==me.deviceId)throw Error('older recovery cookie was invalidated by rotation/multi-tab race');

  const transfer=(await post('/api/origin-transfer/start',cred(me))).j;
  const moved=(await post('/api/origin-transfer/redeem',{transferToken:transfer.transferToken})).j;if(moved.deviceId!==me.deviceId||moved.userId!==me.userId)throw Error('origin migration minted a new device id');
  const redirect=await hostRequest('/games?x=1','150.109.71.66:8090');if(redirect.status!==307||!String(redirect.headers.location||'').startsWith('/origin-migrate.html?to='))throw Error(`legacy host did not enter identity migration: ${redirect.status} ${redirect.headers.location||''}`);
  const migrationAsset=await hostRequest('/origin-migrate.js','150.109.71.66:8090');if(migrationAsset.status!==200||!migrationAsset.body.includes('/api/origin-transfer/start'))throw Error('origin migration asset was redirected/broken');

  const local1=(await post('/api/local-admin/owner-session',{})).j,local2=(await post('/api/local-admin/owner-session',{})).j;if(local1.deviceId!==local2.deviceId)throw Error('localhost Owner fallback changed device id on every restore');

  await post('/api/wallet/checkin',cred(me));
  await post('/api/room/snapshot',{...cred(me),roomId:'poker-1',tabId:'p25'});
  let joined=(await post('/api/room/action',{...cred(me),roomId:'poker-1',tabId:'p25',message:{type:'game_action',action:{type:'join',seat:0,chips:1000}}})).j;
  let seat=joined.game.seats.find(x=>x?.userId===me.userId);if(seat?.chips!==1000||seat?.buyIn!==1000||seat?.walletAtBuyIn!==3000)throw Error(`selectable poker buy-in mismatch: ${JSON.stringify(seat)}`);
  const wallet=(await post('/api/auth',cred(me))).j.profile.chips;if(wallet!==3000)throw Error(`poker seat join incorrectly charged a per-hand fee: ${wallet}`);
  await post('/api/room/action',{...cred(me),roomId:'poker-1',tabId:'p25',message:{type:'game_action',action:{type:'leave'}}});
  await post('/api/room/snapshot',{...cred(me),roomId:'poker-2',tabId:'p25b'});
  joined=(await post('/api/room/action',{...cred(me),roomId:'poker-2',tabId:'p25b',message:{type:'game_action',action:{type:'join',seat:0,chips:3000}}})).j;seat=joined.game.seats.find(x=>x?.userId===me.userId);if(seat?.chips!==3000)throw Error('poker ALL did not mean the full pre-hand wallet');
  await post('/api/room/action',{...cred(me),roomId:'poker-2',tabId:'p25b',message:{type:'game_action',action:{type:'leave'}}});
  const forged=await req('/api/room/action',{method:'POST',body:{...cred(me),roomId:'poker-2',tabId:'p25b',message:{type:'game_action',action:{type:'join',seat:0,chips:3001}}}});if(forged.r.ok||!String(forged.j.error||'').includes('可带入'))throw Error('server accepted poker buy-in above real wallet');

  console.log('[OK] v0.2.6 identity: IP-independent device ID / multi-tab cookie / origin migration / local Owner reuse');
  console.log('[OK] v0.2.6 poker: selectable buy-in / ALL = total wallet / server-side upper bound');
} finally {
  if(proc&&!proc.killed)proc.kill('SIGTERM');await sleep(100);fs.rmSync(tmp,{recursive:true,force:true});
}

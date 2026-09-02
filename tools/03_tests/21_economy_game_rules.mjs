import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v023-chipgame-'));
const port=18095;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'TC1001',EMPLOYEE_HASH_SECRET:'chipgame-v023-test',SLIMELOUNGE_DISCONNECT_GRACE_MS:'300'},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
const room=(c,action,tabId='chipgame')=>post('/api/room/action',{...c,roomId:'blackjack-1',tabId,message:{type:'game_action',action}});
const snap=(c,tabId='chipgame')=>post('/api/room/snapshot',{...c,roomId:'blackjack-1',tabId});
try{
  let started=false;for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok){started=true;break}}catch{}await sleep(80)}if(!started)throw Error('chip-game test server start timeout\n'+logs);
  const a=await post('/api/register',{name:'ChipA',employeeId:'TC1001',slimeColor:'mint',deviceLabel:'A'}),b=await post('/api/register',{name:'ChipB',employeeId:'TC1002',slimeColor:'sky',deviceLabel:'B'});
  const ac={userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken},bc={userId:b.userId,deviceId:b.deviceId,deviceToken:b.deviceToken};
  await post('/api/admin/employee',{...ac,action:'verify',targetUserId:b.userId});
  await post('/api/wallet/checkin',ac); // A now owns 3000.
  await snap(ac);await snap(b);
  await room(ac,{type:'join',seat:0});await room(bc,{type:'join',seat:1});
  let s=await snap(ac);const aSeat=s.game.seats.find(x=>x?.userId===a.userId),bSeat=s.game.seats.find(x=>x?.userId===b.userId);if(aSeat?.chips!==3000||bSeat?.chips!==2000)throw Error(`blackjack seat join should not charge before a hand starts: A=${aSeat?.chips} B=${bSeat?.chips}`);
  await room(ac,{type:'ready'});await room(bc,{type:'ready'});await room(ac,{type:'start'});
  for(let guard=0;guard<16;guard++){s=await snap(ac);if(s.game.phase==='result')break;if(s.game.phase==='insurance'){for(const p of s.game.seats||[]){if(!p||p.insuranceResolved)continue;const c=p.userId===a.userId?ac:p.userId===b.userId?bc:null;if(c)await room(c,{type:'insurance_decline'})}continue}const i=s.game.turnSeat,p=s.game.seats?.[i];if(!p)throw Error('blackjack turn seat missing');const c=p.userId===a.userId?ac:p.userId===b.userId?bc:null;if(!c)throw Error('unexpected non-human on human table');await room(c,{type:'stand'});}s=await snap(ac);if(s.game.phase!=='result')throw Error('human blackjack hand did not finish');
  const aa=await post('/api/auth',ac),bb=await post('/api/auth',bc),sa=s.game.seats.find(x=>x?.userId===a.userId),sb=s.game.seats.find(x=>x?.userId===b.userId);if(aa.profile.chips!==sa.chips||bb.profile.chips!==sb.chips)throw Error(`human blackjack settlement did not persist: wallet/table A=${aa.profile.chips}/${sa.chips} B=${bb.profile.chips}/${sb.chips}`);
  const walletBeforeAi=aa.profile.chips;
  await room(bc,{type:'leave'});await room(ac,{type:'ready'}); // result -> waiting and A toggles ready
  s=await snap(ac);if(!s.game.seats[0]?.ready)await room(ac,{type:'ready'});
  await room(ac,{type:'add_bot',seat:1});await room(ac,{type:'start'});
  for(let guard=0;guard<80;guard++){await sleep(80);s=await snap(ac);if(s.game.phase==='result')break;if(s.game.phase==='insurance'&&!s.game.seats.find(x=>x?.userId===a.userId)?.insuranceResolved){await room(ac,{type:'insurance_decline'});continue}if(s.game.turnSeat!=null&&s.game.seats[s.game.turnSeat]?.userId===a.userId)await room(ac,{type:'stand'});}s=await snap(ac);if(s.game.phase!=='result')throw Error('AI practice blackjack hand did not finish');let afterAi;for(let i=0;i<12;i++){afterAi=await post('/api/auth',ac);if(afterAi.profile.chips===walletBeforeAi-3)break;await sleep(60)}if(afterAi.profile.chips!==walletBeforeAi-3)throw Error(`AI practice should only charge the per-hand AI fee: ${walletBeforeAi} -> ${afterAi.profile.chips}`);
  console.log('[OK] v0.2.4 chip games: >2000 wallet buy-in / human settlement persistence / AI wallet isolation');
}finally{
  if(proc&&!proc.killed)proc.kill('SIGTERM');await sleep(120);fs.rmSync(tmp,{recursive:true,force:true});
}

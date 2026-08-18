import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v024-server-'));
const port=18094;
let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'TTOWN1',EMPLOYEE_HASH_SECRET:'v024-server-test',SLIMELOUNGE_DISCONNECT_GRACE_MS:'350'},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return}catch{}await sleep(75)}throw Error('server start timeout\n'+logs)}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
const cred=s=>({userId:s.userId,deviceId:s.deviceId,deviceToken:s.deviceToken});
const room=(s,roomId,tabId)=>post('/api/room/snapshot',{...cred(s),roomId,tabId});
const act=(s,roomId,tabId,action)=>post('/api/room/action',{...cred(s),roomId,tabId,message:{type:'game_action',action}});
const auth=s=>post('/api/auth',cred(s));

try{
  await wait();
  const a=await post('/api/register',{name:'Owner',employeeId:'TTOWN1',slimeColor:'mint',deviceLabel:'A'});
  const b=await post('/api/register',{name:'HumanB',employeeId:'TTB002',slimeColor:'sky',deviceLabel:'B'});
  await post('/api/admin/employee',{...cred(a),action:'verify',targetUserId:b.userId});
  await post('/api/wallet/checkin',cred(a));

  // Server-authoritative poker buy-in: selectable, but never above the real wallet.
  await room(a,'poker-1','pk-a');
  let forgedRejected=false;try{await act(a,'poker-1','pk-a',{type:'join',seat:0,chips:99999999})}catch{forgedRejected=true}
  if(!forgedRejected)throw Error('client forged poker buy-in above wallet');
  let pk=await act(a,'poker-1','pk-a',{type:'join',seat:0,chips:2000});
  const pokerSeat=pk.game?.seats?.find(x=>x?.userId===a.userId);
  if(!pokerSeat||Math.floor(pokerSeat.chips)!==2000)throw Error(`selectable poker buy-in mismatch: ${pokerSeat?.chips}`);
  await act(a,'poker-1','pk-a',{type:'leave'});

  // Human board games are strict zero-sum: +50 / -50.
  await room(a,'gomoku-1','g-a');await room(b,'gomoku-1','g-b');
  await act(a,'gomoku-1','g-a',{type:'join',seat:0});await act(b,'gomoku-1','g-b',{type:'join',seat:1});
  await act(a,'gomoku-1','g-a',{type:'ready'});await act(b,'gomoku-1','g-b',{type:'ready'});
  const moves=[[b,0,0],[a,0,1],[b,1,0],[a,1,1],[b,2,0],[a,2,1],[b,3,0],[a,3,1],[b,4,0]];
  for(const [who,x,y] of moves)await act(who,'gomoku-1',who===a?'g-a':'g-b',{type:'place',x,y});
  const aa=await auth(a),bb=await auth(b);
  if(aa.profile.chips!==2930||bb.profile.chips!==2030)throw Error(`gomoku entry-fee + zero-sum mismatch A=${aa.profile.chips} B=${bb.profile.chips}`);
  let lb=await (await fetch(`http://127.0.0.1:${port}/api/leaderboards`)).json();
  const ga=lb.leaderboards.games.gomoku.human.find(x=>x.userId===a.userId),gb=lb.leaderboards.games.gomoku.human.find(x=>x.userId===b.userId);
  if(ga?.losses!==1||gb?.wins!==1)throw Error('gomoku human leaderboard result mismatch');

  // Single-human + AI is practice: leaving is not a loss and does not change wallet.
  const beforePractice=(await auth(a)).profile.chips;
  const beforeAiLoss=lb.leaderboards.games.gomoku.ai.find(x=>x.userId===a.userId)?.losses||0;
  await room(a,'gomoku-2','gp-a');await act(a,'gomoku-2','gp-a',{type:'join',seat:0});await act(a,'gomoku-2','gp-a',{type:'add_bot',seat:1});await act(a,'gomoku-2','gp-a',{type:'ready'});await act(a,'gomoku-2','gp-a',{type:'leave'});
  const afterPractice=(await auth(a)).profile.chips;lb=await (await fetch(`http://127.0.0.1:${port}/api/leaderboards`)).json();
  const afterAiLoss=lb.leaderboards.games.gomoku.ai.find(x=>x.userId===a.userId)?.losses||0;
  if(afterPractice!==beforePractice-8||afterAiLoss!==beforeAiLoss)throw Error('AI practice should charge only entry fee, not an extra loss penalty');

  // Two-human UNO: mid-game quitter becomes trustee and immediately receives a human loss.
  await room(a,'uno-1','u-a');await room(b,'uno-1','u-b');
  await act(a,'uno-1','u-a',{type:'join',seat:0});await act(b,'uno-1','u-b',{type:'join',seat:1});
  await act(a,'uno-1','u-a',{type:'ready'});await act(b,'uno-1','u-b',{type:'ready'});await act(a,'uno-1','u-a',{type:'start'});
  let uno=await act(a,'uno-1','u-a',{type:'leave'});
  const trustee=uno.game?.seats?.find(x=>x?.forfeitUserId===a.userId);
  if(!trustee?.isBot||trustee.forfeited!==true)throw Error('UNO PVP quitter did not become AI trustee');
  lb=await (await fetch(`http://127.0.0.1:${port}/api/leaderboards`)).json();
  if((lb.leaderboards.games.uno.human.find(x=>x.userId===a.userId)?.losses||0)!==1)throw Error('UNO PVP quitter was not immediately counted as human loss');
  await act(b,'uno-1','u-b',{type:'leave'});
  uno=await room(a,'uno-1','u-check');
  if((uno.game?.seats||[]).some(Boolean)||uno.game?.phase==='playing')throw Error('all-AI UNO table survived after last live human left');
  lb=await (await fetch(`http://127.0.0.1:${port}/api/leaderboards`)).json();
  if((lb.leaderboards.games.uno.human.find(x=>x.userId===b.userId)?.losses||0)!==1)throw Error('second UNO PVP quitter was not counted as human loss');

  console.log('[OK] v0.2.4 server authority / board zero-sum / practice leave / UNO trustee + all-AI guard');
} finally {
  if(proc&&!proc.killed)proc.kill('SIGTERM');
  await sleep(100);
  fs.rmSync(tmp,{recursive:true,force:true});
}

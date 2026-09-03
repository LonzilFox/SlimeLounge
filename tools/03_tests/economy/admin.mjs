import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v024-chipadmin-'));
const port=18096;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'TTCA01',EMPLOYEE_HASH_SECRET:'chip-admin-v024'},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
async function wait(){for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok)return}catch{}await sleep(80)}throw Error('chip admin test server timeout\n'+logs)}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
const cred=x=>({userId:x.userId,deviceId:x.deviceId,deviceToken:x.deviceToken});
const snap=(x,roomId,tabId)=>post('/api/room/snapshot',{...cred(x),roomId,tabId});
const act=(x,roomId,tabId,action)=>post('/api/room/action',{...cred(x),roomId,tabId,message:{type:'game_action',action}});
try{
  await wait();
  const owner=await post('/api/register',{name:'Owner',employeeId:'TTCA01',slimeColor:'mint',deviceLabel:'owner'});
  const p2=await post('/api/register',{name:'P2',employeeId:'TTCA02',slimeColor:'sky',deviceLabel:'p2'});
  await post('/api/admin/employee',{...cred(owner),action:'verify',targetUserId:p2.userId});

  let cfg=await post('/api/admin/chips',{...cred(owner),action:'get'});
  if(cfg.defaults?.chipFloor!==2000||cfg.defaults?.chipRecoverMs!==7200000||cfg.defaults?.dailyReward!==1000||cfg.defaults?.recoverPerHour!==1000)throw Error('chip economy defaults mismatch');

  const changed=await post('/api/admin/chips',{...cred(owner),action:'set_user',targetUserId:p2.userId,chips:4321});
  if(changed.before!==2000||changed.after!==4321)throw Error('manual user chip edit failed');
  const p2auth=await post('/api/auth',cred(p2));if(p2auth.profile?.chips!==4321)throw Error('manual user chip edit did not persist');

  cfg=await post('/api/admin/chips',{...cred(owner),action:'set_rules',gameRules:{
    gomoku:{stake:80},xiangqi:{stake:70},chess:{stake:60},go:{stake:90},
    blackjack:{minBet:25,defaultBet:40,maxBet:300},poker:{smallBlind:15,bigBlind:30},
    uno:{rankStep:65},mahjong:{pointsPerChip:200,forfeitPenalty:75}
  }});
  const r=cfg.economy?.gameRules;
  if(r?.gomoku?.stake!==80||r?.blackjack?.minBet!==25||r?.blackjack?.defaultBet!==40||r?.blackjack?.maxBet!==300||r?.poker?.smallBlind!==15||r?.poker?.bigBlind!==30||r?.uno?.rankStep!==65||r?.mahjong?.pointsPerChip!==200||r?.mahjong?.forfeitPenalty!==75)throw Error('game chip settings did not persist');

  // Configurable board zero-sum: 80 chips.
  await snap(owner,'gomoku-1','ga');await snap(p2,'gomoku-1','gb');
  await act(owner,'gomoku-1','ga',{type:'join',seat:0});await act(p2,'gomoku-1','gb',{type:'join',seat:1});
  await act(owner,'gomoku-1','ga',{type:'ready'});await act(p2,'gomoku-1','gb',{type:'ready'});
  const moves=[[p2,0,0],[owner,0,1],[p2,1,0],[owner,1,1],[p2,2,0],[owner,2,1],[p2,3,0],[owner,3,1],[p2,4,0]];
  for(const [who,x,y] of moves)await act(who,'gomoku-1',who===owner?'ga':'gb',{type:'place',x,y});
  const oa=await post('/api/auth',cred(owner)),pb=await post('/api/auth',cred(p2));
  if(oa.profile.chips!==1900||pb.profile.chips!==4381)throw Error(`configurable board entry-fee + stake failed: ${oa.profile.chips}/${pb.profile.chips}`);

  // Blackjack configured betting bounds/default.
  await snap(owner,'blackjack-2','bj');await act(owner,'blackjack-2','bj',{type:'join',seat:0});
  let bj=await snap(owner,'blackjack-2','bj');let seat=bj.game.seats.find(x=>x?.userId===owner.userId);
  if(seat?.bet!==40||bj.game.betMin!==25||bj.game.betMax!==300)throw Error('blackjack configured default/bounds missing');
  await act(owner,'blackjack-2','bj',{type:'bet',amount:1});bj=await snap(owner,'blackjack-2','bj');seat=bj.game.seats.find(x=>x?.userId===owner.userId);if(seat.bet!==25)throw Error('blackjack min bet configuration not enforced');
  await act(owner,'blackjack-2','bj',{type:'leave'});

  // Poker blind configuration applies on the next hand while keeping original one-human + AI start rule.
  await snap(owner,'poker-2','pk');await act(owner,'poker-2','pk',{type:'join',seat:0});await act(owner,'poker-2','pk',{type:'ready'});await act(owner,'poker-2','pk',{type:'start'});
  const pk=await snap(owner,'poker-2','pk');if(pk.game.smallBlind!==15||pk.game.bigBlind!==30||pk.game.currentBet!==30)throw Error('poker configured blinds not applied');

  const data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json'),'utf8'));
  if(!Array.isArray(data.chipLedger)||!data.chipLedger.some(x=>x.kind==='admin'&&x.deltas?.[p2.userId]===2321))throw Error('manual chip edit audit ledger missing');
  console.log('[OK] v0.2.4 chip admin: 2000 floor / manual balances / configurable game economy / audit ledger');
}finally{
  if(proc&&!proc.killed)proc.kill('SIGTERM');await sleep(120);fs.rmSync(tmp,{recursive:true,force:true});
}

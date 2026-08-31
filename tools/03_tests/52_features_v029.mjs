import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOM_DEFS,createGame,applyGameAction} from '../../shared/games.js';
import {DEFAULT_GAME_CHIP_RULES,migrateEconomyV029} from '../../server/economy.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ok=(v,m)=>{if(!v)throw Error(m)};

// Static coverage for the v0.2.9 UI/room changes.
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8')+fs.readFileSync(path.join(root,'public/music-ui.js'),'utf8')+fs.readFileSync(path.join(root,'public/chat-ui.js'),'utf8');
const appGames=fs.readFileSync(path.join(root,'public/app-games.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'public/admin-economy.js'),'utf8');
const diceUi=fs.readFileSync(path.join(root,'public/game-dice.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8')+fs.readFileSync(path.join(root,'public/styles-responsive.css'),'utf8')+fs.readFileSync(path.join(root,'public/styles-games.css'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/index.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const release=JSON.parse(fs.readFileSync(path.join(root,'release_notes/v0.2.9.json'),'utf8'));

ok(pkg.version==='0.4.1','package version is not 0.3.1');
ok(ROOM_DEFS.filter(r=>r.game==='dice').length===5,'dice room count is not 5');
ok(ROOM_DEFS.filter(r=>r.category==='music'&&r.style==='其他风格').length===1,'other-style music room missing');
ok(diceUi.includes('class="pip p')&&diceUi.includes('dicePips')&&!diceUi.includes('class="die-face">${n}'),'dice UI is not physical pip style');
ok(app.includes('Ctrl+Enter 换行')&&app.includes("payload.replyTo=state.chatReplyTo.messageId")&&app.includes('msg-reply-ref'),'chat Ctrl+Enter/reply UI missing');
ok(css.includes('.msg-text{white-space:pre-wrap')||css.includes('white-space:pre-wrap'),'chat multiline CSS missing');
ok(!appGames.includes('pixelFontDiag')&&!app.includes('pixelFontDiag'),'pixel font diagnostics still exposed');
ok(app.includes("MUSIC_VOLUME_KEY='slimelounge.musicVolume.v2'")&&app.includes('return .25')&&app.includes('data-music-seek')&&app.includes('data-music-volume'),'music 25%/seek/volume controls missing');
ok(app.includes('data-drag-handle')&&app.includes('setPointerCapture')&&css.includes('touch-action:none'),'draggable music dock missing');
ok(app.includes('这里是主要播放器')&&app.includes('同一 Lounge 账号')||app.includes('同一 SlimeLounge 账号'),'music main-player/account-sharing explanation missing');
ok(admin.includes('筹码经济 · 总设置')&&admin.includes('分游戏设置')&&admin.includes('玩家筹码修改 · 从高到低'),'admin economy hierarchy missing');
ok(admin.includes('aiEntryFee')&&admin.includes('sort((a,b)=>(Number(b.chips)||0)-(Number(a.chips)||0)'),'AI fee or descending player sorting missing');
ok(appGames.includes('paySingleRound')&&appGames.includes("$('#sudokuNew').onclick=async")&&appGames.includes("$('#mineNew').onclick=async")&&appGames.includes('await paySingleRound(def.game)')&&appGames.includes('await paySingleRound(state.room.game)'),'single-player per-round charging missing');
ok(worker.includes('/wallet/round-fee')&&worker.includes('/wallet/single-entry'),'Worker per-round charging routes missing');
ok(release.id==='v0.2.9'&&release.items?.length>=8,'v0.2.9 release note missing');
ok(fs.existsSync(path.join(root,'public/favicon.ico'))&&fs.existsSync(path.join(root,'public/favicon-32.png'))&&fs.existsSync(path.join(root,'public/icon-192.png')),'new favicon assets missing');

// Economy migration: preserve custom values, replace untouched v0.2.8 defaults, add AI fees.
const migrated=migrateEconomyV029({chipFloor:3000,dailyReward:777,recoverPerHour:500,gameRules:{gomoku:{stake:50,entryFee:30},xiangqi:{stake:123,entryFee:17}}});
ok(migrated.chipFloor===3000&&migrated.dailyReward===777&&migrated.gameRules.gomoku.entryFee===DEFAULT_GAME_CHIP_RULES.gomoku.entryFee,'v0.2.8 default fee migration failed');
ok(migrated.gameRules.gomoku.aiEntryFee===8,'AI entry fee migration missing');
ok(migrated.gameRules.xiangqi.stake===123&&migrated.gameRules.xiangqi.entryFee===17,'custom economy values were overwritten');

// Xiangqi: a checking move that would create the same position for the third time is forbidden.
{
  const s=createGame('xiangqi');
  s.board=Array.from({length:10},()=>Array(9).fill(null));
  s.board[0][4]='k';s.board[9][4]='K';s.board[2][3]='R';
  s.players=['u1','u2'];s.ready=[true,true];s.started=true;s.turn=0;s.turnStartedAt=Date.now();
  const target=s.board.map(r=>r.slice());target[2][4]=target[2][3];target[2][3]=null;
  const key=`${target.map(r=>r.map(x=>x||'.').join('')).join('/')}|1`;
  s.positionCounts={[key]:2};
  let denied=false;try{applyGameAction(s,'u1',{type:'move',x1:3,y1:2,x2:4,y2:2})}catch(e){denied=String(e.message).includes('禁止长将')}
  ok(denied,'xiangqi third repeated checking position was not rejected');
}

// Live local-server coverage: multiline + reply survives server cleaning, and AI board fee is charged only when a round starts.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v029-'));
const port=18109;
let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'V029OWN',EMPLOYEE_HASH_SECRET:'v029-feature-secret',SLIMELOUNGE_DISCONNECT_GRACE_MS:'900'},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(){for(let i=0;i<70;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return}catch{}await sleep(70)}throw Error('server start timeout\n'+logs)}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
const cred=s=>({userId:s.userId,deviceId:s.deviceId,deviceToken:s.deviceToken});
function waitMsg(ws,pred,timeout=3500,label='message'){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',fn);reject(Error('WS timeout: '+label))},timeout);const fn=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(pred(m)){clearTimeout(timer);ws.removeEventListener('message',fn);resolve(m)}};ws.addEventListener('message',fn)})}
async function openRoom(s,roomId,tabId){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/api/ws`),timer=setTimeout(()=>reject(Error('WS auth timeout')),3000);ws.onopen=()=>ws.send(JSON.stringify({type:'auth',...cred(s),roomId,tabId}));ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='init'){clearTimeout(timer);resolve(ws)}};ws.onerror=()=>{clearTimeout(timer);reject(Error('WS open error'))}})}
async function wsGame(ws,action,pred=()=>true){const p=waitMsg(ws,m=>m.type==='game_state'&&pred(m.state),4000,action.type);ws.send(JSON.stringify({type:'game_action',action}));return (await p).state}
try{
  await waitServer();
  const health=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();ok(health.version==='0.4.1','live server is not v0.4.1');
  const owner=await post('/api/register',{name:'V029',employeeId:'V029OWN',slimeColor:'mint',deviceLabel:'test'});

  const chat=await openRoom(owner,'chat-general','v029-chat');
  const firstP=waitMsg(chat,m=>m.type==='chat'&&m.message?.text==='第一行\n第二行',2500,'multiline create');
  chat.send(JSON.stringify({type:'chat',text:'第一行\n第二行'}));const first=(await firstP).message;
  const replyP=waitMsg(chat,m=>m.type==='chat'&&m.message?.reply?.messageId===first.id,2500,'chat reply');
  chat.send(JSON.stringify({type:'chat',text:'回复一\n回复二',replyTo:first.id}));const reply=(await replyP).message;
  ok(reply.text==='回复一\n回复二'&&reply.reply?.text==='第一行\n第二行','reply snapshot or multiline was flattened');
  const editP=waitMsg(chat,m=>m.type==='chat_update'&&m.message?.id===first.id,2500,'multiline edit');
  chat.send(JSON.stringify({type:'chat_edit',messageId:first.id,text:'编辑一\n编辑二'}));const edited=(await editP).message;
  ok(edited.text==='编辑一\n编辑二','edited multiline message was flattened');chat.close();

  const game=await openRoom(owner,'gomoku-1','v029-game');
  await wsGame(game,{type:'join',seat:0},s=>s.players?.[0]===owner.userId);
  let auth=await post('/api/auth',cred(owner));ok(auth.profile.chips===2000,'joining a seat incorrectly charged chips');
  await wsGame(game,{type:'add_bot',seat:1},s=>String(s.players?.[1]||'').startsWith('BOT:'));
  await wsGame(game,{type:'ready'},s=>s.started===true);
  await sleep(80);auth=await post('/api/auth',cred(owner));ok(auth.profile.chips===1992,'AI Gomoku round did not charge recommended 8 chips at start');
  await wsGame(game,{type:'reset'},s=>s.round===2&&!s.started);
  auth=await post('/api/auth',cred(owner));ok(auth.profile.chips===1992,'reset itself incorrectly charged a round fee');
  await wsGame(game,{type:'ready'},s=>s.started===true);
  await sleep(80);auth=await post('/api/auth',cred(owner));ok(auth.profile.chips===1984,'second AI round did not charge again');
  game.close();

  const single=await post('/api/game/entry',{...cred(owner),kind:'sudoku'});ok(single.fee===12&&single.profile?.chips===1972,'Sudoku per-new-puzzle fee mismatch');
  console.log('[OK] v0.2.9 chat multiline/reply / music UI / dice rooms+pips / economy per-round / Xiangqi long-check / favicon');
}finally{
  if(proc&&!proc.killed)proc.kill('SIGTERM');
  await sleep(120);
  fs.rmSync(tmp,{recursive:true,force:true});
}

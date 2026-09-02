import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRankingService} from '../../server/rankings.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v027-'));
const port=18107;
let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'V027OWN',EMPLOYEE_HASH_SECRET:'v027-regression-secret',SLIMELOUNGE_DISCONNECT_GRACE_MS:'900'},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(){for(let i=0;i<70;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return}catch{}await sleep(70)}throw Error('server start timeout\n'+logs)}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
const cred=s=>({userId:s.userId,deviceId:s.deviceId,deviceToken:s.deviceToken});
function waitMsg(ws,pred,timeout=3000,label='message'){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',fn);reject(Error('WS message timeout: '+label))},timeout);const fn=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(pred(m)){clearTimeout(timer);ws.removeEventListener('message',fn);resolve(m)}};ws.addEventListener('message',fn)})}
async function openRoom(s,roomId){return new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/api/ws`),timer=setTimeout(()=>reject(Error('WS auth timeout')),3000);ws.onopen=()=>ws.send(JSON.stringify({type:'auth',...cred(s),roomId,tabId:'v027-ws'}));ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='init'){clearTimeout(timer);resolve(ws)}};ws.onerror=()=>{clearTimeout(timer);reject(Error('WS open error'))}})}
async function wsAction(ws,action,pred=()=>true){const pending=waitMsg(ws,m=>m.type==='game_state'&&pred(m.state),3000,'action '+action.type);ws.send(JSON.stringify({type:'game_action',action}));return (await pending).state}

try{
  await waitServer();
  const health=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  const expectedVersion=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;if(health.version!==expectedVersion)throw Error(`expected v${expectedVersion}, got ${health.version}`);
  const owner=await post('/api/register',{name:'V027',employeeId:'V027OWN',slimeColor:'mint',deviceLabel:'test'});

  // Reproduce the reported path: human takes seat 1/white, AI takes seat 2/black (the first mover), then human presses Ready.
  // The asynchronous opening AI turn must never terminate the WebSocket/server.
  const ws=await openRoom(owner,'gomoku-1');
  await wsAction(ws,{type:'join',seat:0},s=>s.players?.[0]===owner.userId);
  await wsAction(ws,{type:'add_bot',seat:1},s=>String(s.players?.[1]||'').startsWith('BOT:'));
  await wsAction(ws,{type:'ready'},s=>s.started===true);
  const aiMove=await waitMsg(ws,m=>m.type==='game_state'&&m.state?.kind==='gomoku'&&m.state?.turn===0&&m.state?.board?.some(r=>r.some(Boolean)),3500,'gomoku AI opening move');
  if(!aiMove.state.started)throw Error('gomoku AI opening move did not keep game started');
  await sleep(300);
  if(ws.readyState!==WebSocket.OPEN)throw Error(`gomoku WS closed after AI start: ${ws.readyState}`);
  const alive=await fetch(`http://127.0.0.1:${port}/api/health`);if(!alive.ok)throw Error('server died after gomoku AI opening turn');
  ws.close();

  // Discord-like chat edits/deletes are server authoritative; announcement/changelog management remains staff-only.
  const chat=await openRoom(owner,'chat-general');
  const newMsgP=waitMsg(chat,m=>m.type==='chat'&&m.message?.text==='hello-v027',2000,'chat create');
  chat.send(JSON.stringify({type:'chat',text:'hello-v027'}));
  const newMsg=(await newMsgP).message;
  const editP=waitMsg(chat,m=>m.type==='chat_update'&&m.message?.id===newMsg.id&&m.message?.text==='edited-v027',2000,'chat edit');
  chat.send(JSON.stringify({type:'chat_edit',messageId:newMsg.id,text:'edited-v027'}));
  const edited=(await editP).message;if(!edited.editedAt)throw Error('chat editedAt missing');
  const delP=waitMsg(chat,m=>m.type==='chat_delete'&&m.messageId===newMsg.id,2000,'chat delete');
  chat.send(JSON.stringify({type:'chat_delete',messageId:newMsg.id}));await delP;chat.close();
  const ann=await openRoom(owner,'chat-announcements');
  const annNewP=waitMsg(ann,m=>m.type==='chat'&&m.message?.text==='notice-v027',2000,'announcement create');ann.send(JSON.stringify({type:'chat',text:'notice-v027'}));const annMsg=(await annNewP).message;
  const annEditP=waitMsg(ann,m=>m.type==='chat_update'&&m.message?.id===annMsg.id&&m.message?.text==='notice-edited-v027',2000,'announcement edit');ann.send(JSON.stringify({type:'chat_edit',messageId:annMsg.id,text:'notice-edited-v027'}));await annEditP;
  const annDelP=waitMsg(ann,m=>m.type==='chat_delete'&&m.messageId===annMsg.id,2000,'announcement delete');ann.send(JSON.stringify({type:'chat_delete',messageId:annMsg.id}));await annDelP;ann.close();

  // Voice presence distinguishes mic-on from actual speaking activity.
  const voice=await openRoom(owner,'voice-lounge');
  const micOnP=waitMsg(voice,m=>m.type==='presence'&&m.users?.some(u=>u.userId===owner.userId&&u.voiceOn),2000,'voice on');voice.send(JSON.stringify({type:'voice_toggle',enabled:true}));await micOnP;
  const speakingP=waitMsg(voice,m=>m.type==='presence'&&m.users?.some(u=>u.userId===owner.userId&&u.voiceSpeaking),2000,'voice speaking');voice.send(JSON.stringify({type:'voice_activity',speaking:true}));await speakingP;
  const quietP=waitMsg(voice,m=>m.type==='presence'&&m.users?.some(u=>u.userId===owner.userId&&!u.voiceSpeaking),2000,'voice quiet');voice.send(JSON.stringify({type:'voice_activity',speaking:false}));await quietP;voice.close();

  // UNO / riichi rankings are actual table placement counts, including seats occupied by AI.
  const data={users:{u:{userId:'u',name:'U',chips:2000}},rankings:{},rankingProcessed:{},chipLedger:[]};
  const svc=createRankingService({data,crypto,isBotId:id=>String(id||'').startsWith('BOT:'),refreshWallet:u=>u.chips,gameRankMode:()=> 'ai',gameHumanIds:st=>(st.seats||[]).filter(x=>x&&!x.isBot).map(x=>x.userId),gameChipRule:()=>({rankStep:50,pointsPerChip:100,forfeitPenalty:50}),scheduleSave:()=>{},hasBot:st=>(st.seats||[]).some(x=>x?.isBot),publicUser:u=>u});
  const unoBefore={kind:'uno',phase:'playing',seats:[{userId:'BOT:1',isBot:true},{userId:'BOT:2',isBot:true},{userId:'u'},{userId:'BOT:3',isBot:true}]};
  const unoAfter={...unoBefore,phase:'result',finishedAt:1,placements:[0,1,2,3],finishOrder:[0,1,2,3],forfeitUsers:{},forfeitRanked:{}};
  svc.recordGameResult('u-room',unoBefore,unoAfter);
  if(data.rankings.uno.u.ai.placements?.[2]!==1)throw Error('UNO actual third-place counter missing');
  const mjBefore={kind:'mahjong',matchEnded:false,seats:[{userId:'BOT:1',isBot:true},{userId:'BOT:2',isBot:true},{userId:'u'},{userId:'BOT:3',isBot:true}],points:[40000,30000,20000,10000]};
  const mjAfter={...mjBefore,matchEnded:true,finishedAt:2,forfeitUsers:{},forfeitRanked:{}};
  svc.recordGameResult('m-room',mjBefore,mjAfter);
  if(data.rankings.mahjong.u.ai.placements?.[2]!==1)throw Error('riichi actual third-place counter missing');

  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8'),games=fs.readFileSync(path.join(root,'public/app-games.js'),'utf8')+fs.readFileSync(path.join(root,'public/game-mahjong.js'),'utf8'),css=fs.readFileSync(path.join(root,'public/styles-responsive.css'),'utf8');
  if(/music-cookie-guide"\s+open/.test(app))throw Error('music cookie guide still defaults open');
  if(!games.includes('<th>一位</th><th>二位</th><th>三位</th><th>四位</th>'))throw Error('UNO/riichi placement table UI missing');
  if(!games.includes('当前无需响应')||games.includes('无鸣牌响应'))throw Error('riichi reaction placeholder wording not fixed');
  if(!css.includes('.chpiece{')||!css.includes('Segoe UI Symbol')||!css.includes('.discord-channels.open,.discord-members.open'))throw Error('chess/mobile Discord regression CSS missing');
  if(!css.includes('@media(min-width:761px)')||!css.includes('.mj-hidden-hand.top.has-melds'))throw Error('desktop riichi adaptive/meld layout CSS missing');
  const baseCss=fs.readFileSync(path.join(root,'public/styles.css'),'utf8'),readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
  if(!baseCss.includes("'Fusion Pixel 12px M zh_hans'")||!baseCss.includes('.msg-actions'))throw Error('square pixel font/chat edit UI missing');
  if(!app.includes('voice_activity')||!css.includes('.voice-channel-user.speaking')||!css.includes('.voice-toggle.speaking'))throw Error('active-speaker detection/highlight missing');
  if(!app.includes("classList.toggle('no-view-animation',def.category==='chat')"))throw Error('chat channel transition still animates');
  if(!readme.includes('v0.4.6')||readme.includes('## 更新日志'))throw Error('README should describe current v0.3.1 and contain no changelog section');

  console.log('[OK] v0.2.9 retained v0.2.7 regressions: chat edit/delete / staff announcements / active speaker / no channel animation / square pixel font / README baseline');
} finally {
  if(proc&&!proc.killed)proc.kill('SIGTERM');
  await sleep(120);
  fs.rmSync(tmp,{recursive:true,force:true});
}

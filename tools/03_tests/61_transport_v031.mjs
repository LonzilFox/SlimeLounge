import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const port=20120+Math.floor(Math.random()*250),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slime-v031-'));
const child=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'V031NET',EMPLOYEE_HASH_SECRET:'v031-test'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
const base=`http://127.0.0.1:${port}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return await r.json()}catch{}await sleep(80)}throw Error('server did not start\n'+logs)}
async function post(url,obj){const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(obj)}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${url}: ${r.status} ${j.error||''}`);return j}
const cred=s=>({userId:s.userId,deviceId:s.deviceId,deviceToken:s.deviceToken});
async function wsOpen(s,roomId){return await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/api/ws`),timer=setTimeout(()=>reject(Error('first-frame WS auth timeout')),3000);ws.onopen=()=>ws.send(JSON.stringify({type:'auth',...cred(s),roomId,tabId:'v031-ws'}));ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='init'){clearTimeout(timer);resolve({ws,init:m})}};ws.onerror=()=>{clearTimeout(timer);reject(Error('WS error'))}})}
try{
  const health=await wait();if(health.version!=='0.3.9')throw Error('wrong version');
  const owner=await post('/api/register',{name:'V031',employeeId:'V031NET',slimeColor:'mint',deviceLabel:'test'}),c={...cred(owner),tabId:'v031-lp'};

  // WebSocket must authenticate in the first frame, with no ticket/query string.
  const {ws,init}=await wsOpen(owner,'chat-general');if(init.room?.id!=='chat-general')throw Error('WS init room mismatch');ws.close();

  // Long poll should wait while idle, then wake immediately when the room changes.
  const snap=await post('/api/room/snapshot',{...c,roomId:'chat-general'}),start=Date.now();
  const pollPromise=post('/api/room/poll',{...c,roomId:'chat-general',sinceRevision:snap.revision});
  await sleep(120);
  await post('/api/room/action',{...c,roomId:'chat-general',message:{type:'chat',text:'long-poll wake'},clientActionId:'chat-wake-1'});
  const polled=await pollPromise,elapsed=Date.now()-start;
  if(elapsed>1800)throw Error(`long poll wake was too slow: ${elapsed}ms`);
  if(!polled.messages?.some(x=>x.text==='long-poll wake')||Number(polled.revision)<=Number(snap.revision))throw Error('long poll did not return changed room state');

  // Game action retries with the same action id must be idempotent.
  const gameBody={...c,roomId:'dice-1',message:{type:'game_action',action:{type:'join',seat:0}},clientActionId:'dice-join-idempotent'};
  const first=await post('/api/room/action',gameBody),second=await post('/api/room/action',gameBody);
  if(!second.duplicate||second.actionAck!=='dice-join-idempotent')throw Error('duplicate action was not ACKed idempotently');
  if((second.game?.seats||[]).filter(x=>x?.userId===owner.userId).length!==1)throw Error('duplicate action changed game state twice');

  // Per-user diagnostics must expose a user's own network events and live connection summary to staff.
  await post('/api/client/network-event',{...cred(owner),kind:'http-fallback-error',detail:'v031 synthetic diagnostic',roomId:'chat-general',transport:'http-long-poll',status:429});
  const diag=await post('/api/admin/diagnostics',{...cred(owner),targetUserId:owner.userId});
  if(!diag.selectedUser||diag.selectedUser.userId!==owner.userId)throw Error('selected user diagnostics missing');
  if(!diag.selectedUser.events?.some(x=>x.detail==='v031 synthetic diagnostic'))throw Error('per-user network event not retained');
  if(!diag.targetConnections||!Array.isArray(diag.targetConnections.devices))throw Error('per-user connection snapshot missing');

  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8'),musicUi=fs.readFileSync(path.join(root,'public/music-ui.js'),'utf8'),chatUi=fs.readFileSync(path.join(root,'public/chat-ui.js'),'utf8'),appGames=fs.readFileSync(path.join(root,'public/app-games.js'),'utf8'),css=fs.readFileSync(path.join(root,'public/styles-responsive.css'),'utf8'),server=fs.readFileSync(path.join(root,'local_server.js'),'utf8'),httpRoom=fs.readFileSync(path.join(root,'server/http_room_transport.js'),'utf8');
  if(app.includes('/api/ws?ticket=')||!app.includes("new WebSocket(`${proto}//${location.host}/api/ws`)"))throw Error('client still depends on WebSocket query ticket');
  if(!app.includes("'/api/room/poll'")||!httpRoom.includes('roomChanges.wait('))throw Error('long-poll fallback missing');
  if(!app.includes('serviceFailCount<3')||app.includes('renderActivityDock();if(!quiet)healthPing()'))throw Error('false-offline suppression missing');
  if(!appGames.includes("?'暂离':'离线'")||!appGames.includes('暂离仅表示页面切到后台'))throw Error('away/offline semantics not separated');
  if(!app.includes('scheduleWsRecovery(sess)')||!app.includes('HTTP兼容（自动恢复 WebSocket）'))throw Error('WebSocket background recovery missing');
  if(!chatUi.includes('function chatTimeLabel(')||!chatUi.includes('昨天 ${hm}')||!chatUi.includes('msg-reply-name'))throw Error('chat timestamp/reply UI missing');
  if(!musicUi.includes('music-volume-button')||!musicUi.includes('music-volume-range')||!css.includes('mobile music bottom sheet')||!css.includes('drawer-collapsed'))throw Error('mobile music drawer or refined volume UI missing');
  if(!appGames.includes('单用户网络日志')||!appGames.includes('data-diag-user'))throw Error('admin per-user network log UI missing');
  const icon=fs.statSync(path.join(root,'public/icon-192.png')).size;if(icon<20000)throw Error('high-quality pixel slime icon unexpectedly tiny');
  console.log(`[OK] v0.3.1 first-frame WS auth / immediate long poll (${elapsed}ms) / idempotent game action / per-user diagnostics / timestamps / mobile drawer / presence / pixel favicon`);
}finally{child.kill('SIGTERM');await sleep(120);fs.rmSync(tmp,{recursive:true,force:true})}

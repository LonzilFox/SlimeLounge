import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v023-'));
const port=18090;
let spawnError=null;
const proc=spawn(process.execPath,['local_server.js'],{
  cwd:root,
  env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,SLIMELOUNGE_DISCONNECT_GRACE_MS:'500',SLIMELOUNGE_UNREADY_SEAT_MS:'350',OWNER_EMPLOYEE_ID:'TA1001',EMPLOYEE_HASH_SECRET:'slimelounge-local-test-secret'},
  stdio:['ignore','pipe','pipe'],
  windowsHide:true
});
proc.on('error',e=>{spawnError=e});
let logs='';proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<50;i++){if(spawnError)throw Error(`server spawn failed: ${spawnError.message}\nroot=${root}\nnode=${process.execPath}`);try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return}catch{}await sleep(100)}throw Error('server start timeout '+logs)}

async function openRoom(session,roomId){
  return await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/api/ws`),timer=setTimeout(()=>reject(Error('ws auth timeout')),3000);ws.onopen=()=>ws.send(JSON.stringify({type:'auth',userId:session.userId,deviceId:session.deviceId,deviceToken:session.deviceToken,roomId,tabId:'test-local'}));ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='init'){clearTimeout(timer);ws._initial=m;resolve(ws)}};ws.onerror=()=>{clearTimeout(timer);reject(Error('ws open error'))}});
}
function waitMsg(ws,type,timeout=2500){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('ws message timeout '+type)),timeout);const fn=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type===type){clearTimeout(timer);ws.removeEventListener('message',fn);resolve(m)}};ws.addEventListener('message',fn)})}

async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
try{
  await wait();
  const health=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  if(health.version!=='0.4.8'||'port' in health||'trustProxy' in health)throw Error('health mismatch / sensitive fields exposed');
  const a=await post('/api/register',{name:'A',employeeId:'TA1001',slimeColor:'mint',deviceLabel:'PC-A'});
  const b=await post('/api/register',{name:'B',employeeId:'TB1002',slimeColor:'sky',deviceLabel:'PC-B'});
  if(a.profile?.chips!==2000||a.profile?.canChipCheckin!==true)throw Error('new-user chip wallet defaults failed');
  const directory=await post('/api/users/presence',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});if(!directory.users?.some(x=>x.userId===a.userId))throw Error('Discord member directory API failed');
  const checked=await post('/api/wallet/checkin',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});if(checked.reward!==1000||checked.profile?.chips!==3000||checked.profile?.canChipCheckin!==false)throw Error('daily +1000 chip check-in failed');
  const walletAuth=await post('/api/auth',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});if(walletAuth.profile?.chips!==3000)throw Error('chips above 2000 were clamped after auth');let duplicateCheckinDenied=false;try{await post('/api/wallet/checkin',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken})}catch{duplicateCheckinDenied=true}if(!duplicateCheckinDenied)throw Error('daily chip check-in could be claimed twice');
  const defaultFollows=await post('/api/chat/follows',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});if(!defaultFollows.followedChannels.includes('chat-announcements'))throw Error('new users do not follow announcements by default');
  const deviceLink=await post('/api/device-link/create',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});if(!deviceLink.code)throw Error('device link generation failed');const tolerantCode='  '+deviceLink.code.toLowerCase().replace(/-/g,'  ')+'  ';const linked=await post('/api/device-link/redeem',{code:tolerantCode,deviceLabel:'Phone-A'});if(linked.userId!==a.userId||linked.profile.role!=='owner')throw Error('device link did not preserve original owner identity');const linkedAuth=await post('/api/auth',{userId:linked.userId,deviceId:linked.deviceId,deviceToken:linked.deviceToken});if(linkedAuth.profile.userId!==a.userId||linkedAuth.profile.role!=='owner')throw Error('linked device credential auth failed');let reusedLink=false;try{await post('/api/device-link/redeem',{code:deviceLink.code,deviceLabel:'Attacker'})}catch{reusedLink=true}if(!reusedLink)throw Error('device link code was reusable');
  const neteaseSecret='TEST_MUSIC_U_V020_SECRET';
  const saveNetease=await post('/api/music/account',{...a,action:'save',provider:'netease',cookie:neteaseSecret});if(!saveNetease.account?.linked)throw Error('manual Netease cookie did not link');
  const qqSecret='uin=12345678; qm_keyst=TEST_QQ_V020_SECRET;';
  const saveQQ=await post('/api/music/account',{...a,action:'save',provider:'qq',cookie:qqSecret});if(!saveQQ.account?.linked)throw Error('manual QQ cookie did not link');
  const musicStatus=await post('/api/music/account',{...a,action:'status',provider:'netease'});if(!musicStatus.account?.linked)throw Error('Netease cookie status missing');
  const qqStatus=await post('/api/music/account',{...a,action:'status',provider:'qq'});if(!qqStatus.account?.linked)throw Error('QQ cookie status missing');
  const rawData=fs.readFileSync(path.join(tmp,'data.json'),'utf8');if(rawData.includes(neteaseSecret)||rawData.includes('TEST_QQ_V020_SECRET'))throw Error('manual music credential was stored in plaintext');
  await post('/api/music/account',{...a,action:'unlink',provider:'netease'});await post('/api/music/account',{...a,action:'unlink',provider:'qq'});

  let follows=await post('/api/chat/follow',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,roomId:'chat-general',follow:true});if(!follows.followedChannels.includes('chat-general'))throw Error('channel follow failed');
  const socialList=await post('/api/social/list',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});if(!socialList.social||!Array.isArray(socialList.social.friends))throw Error('friends API failed');
  await post('/api/social/request',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,otherUserId:b.userId});await post('/api/social/respond',{userId:b.userId,deviceId:b.deviceId,deviceToken:b.deviceToken,otherUserId:a.userId,accept:true});const remarked=await post('/api/social/remark',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,otherUserId:b.userId,remark:'老同事'});if(remarked.social?.friends?.find(x=>x.userId===b.userId)?.remark!=='老同事')throw Error('friend remark was not persisted');await post('/api/social/send',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,otherUserId:b.userId,text:'private hello'});let unread=await post('/api/social/unread',{userId:b.userId,deviceId:b.deviceId,deviceToken:b.deviceToken});if(unread.unread?.total!==1||unread.unread?.byUser?.[a.userId]!==1)throw Error('friend unread counter did not increment');const socialUnread=await post('/api/social/list',{userId:b.userId,deviceId:b.deviceId,deviceToken:b.deviceToken});if(socialUnread.social?.friends?.find(x=>x.userId===a.userId)?.unread!==1)throw Error('friend row unread counter missing');const dm=await post('/api/social/messages',{userId:b.userId,deviceId:b.deviceId,deviceToken:b.deviceToken,otherUserId:a.userId});if(!dm.messages?.some(x=>x.text==='private hello'))throw Error('friend direct message failed');if(dm.unread?.total!==0)throw Error('reading friend chat did not clear unread counter');unread=await post('/api/social/unread',{userId:b.userId,deviceId:b.deviceId,deviceToken:b.deviceToken});if(unread.unread?.total!==0)throw Error('friend unread counter remained after read');
  const leaderboard=await post('/api/leaderboards',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});const rankKinds=['dice','gomoku','xiangqi','chess','blackjack','poker','go','mahjong','uno','doudizhu'];if(!leaderboard.ok||!Array.isArray(leaderboard.leaderboards?.chips)||rankKinds.some(k=>!Array.isArray(leaderboard.leaderboards?.games?.[k]?.human)||!Array.isArray(leaderboard.leaderboards?.games?.[k]?.ai)))throw Error('chip + human/AI leaderboard API failed');if(leaderboard.leaderboards.chips.find(x=>x.userId===a.userId)?.chips!==3000)throw Error('chip leaderboard did not expose persistent balance');const repaired=await post('/api/admin/rankings/repair',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken});if(!repaired.ok||repaired.report?.kinds?.length!==rankKinds.length)throw Error('ranking repair API failed');
  const manualRank=await post('/api/admin/rankings/set',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,kind:'chess',mode:'human',loungeId:a.profile.loungeId,wins:2,losses:1,draws:1});const mr=manualRank.leaderboards?.games?.chess?.human?.find(x=>x.userId===a.userId);if(!mr||mr.games!==4||mr.wins!==2||mr.losses!==1||mr.draws!==1)throw Error('manual human ranking correction failed');await post('/api/admin/rankings/set',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,kind:'chess',mode:'human',loungeId:a.profile.loungeId,wins:0,losses:0,draws:0});
  let local=await (await fetch(`http://127.0.0.1:${port}/api/local-admin/users`)).json();
  if(local.users.length!==2||local.ownerUserId!==a.userId)throw Error('initial owner mismatch');
  await post('/api/local-admin/claim-owner',{targetUserId:b.userId});
  const ownerSession=await post('/api/local-admin/owner-session',{});
  if(ownerSession.userId!==b.userId||ownerSession.profile.role!=='owner')throw Error('local owner auto recovery failed');
  const auth=await post('/api/auth',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken});
  if(auth.profile.userId!==b.userId||auth.profile.role!=='owner')throw Error('auto owner credential auth failed');
  const recovery=await post('/api/local-admin/create-owner-recovery',{});if(!recovery.code||!recovery.expiresAt)throw Error('owner recovery code generation failed');
  const recovered=await post('/api/owner/recover',{employeeId:'TB1002',recoveryCode:recovery.code,deviceLabel:'Recovered PC'});if(recovered.userId!==b.userId||recovered.profile.role!=='owner'||!recovered.revokedOldDevices)throw Error('owner device recovery failed');
  let oldOwnerDeviceRejected=false;try{await post('/api/auth',{userId:b.userId,deviceId:b.deviceId,deviceToken:b.deviceToken})}catch{oldOwnerDeviceRejected=true}if(!oldOwnerDeviceRejected)throw Error('owner recovery did not revoke old browser device');
  const recoveredAuth=await post('/api/auth',{userId:recovered.userId,deviceId:recovered.deviceId,deviceToken:recovered.deviceToken});if(recoveredAuth.profile.userId!==b.userId)throw Error('recovered owner credential auth failed');
  let reused=false;try{await post('/api/owner/recover',{employeeId:'TB1002',recoveryCode:recovery.code,deviceLabel:'Attacker'})}catch{reused=true}if(!reused)throw Error('owner recovery code was reusable');
  let adm=await post('/api/admin/users',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken});
  const arow=adm.users.find(x=>x.userId===a.userId);if(!arow||arow.employeeId!=='TA1001'||!Array.isArray(arow.devices)||!arow.devices.length)throw Error('admin full employee/device inventory failed');
  await post('/api/admin/manage',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken,action:'update_user',targetUserId:a.userId,name:'A2',employeeId:'TA1009',employeeStatus:'verified'});
  adm=await post('/api/admin/users',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken});
  if(adm.users.find(x=>x.userId===a.userId)?.employeeId!=='TA1009')throw Error('admin user edit failed');
  await post('/api/admin/manage',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken,action:'update_device',targetUserId:a.userId,targetDeviceId:a.deviceId,label:'Renamed PC'});
  adm=await post('/api/admin/users',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken});
  if(adm.users.find(x=>x.userId===a.userId)?.devices?.find(x=>x.deviceId===a.deviceId)?.label!=='Renamed PC')throw Error('admin device edit failed');
  // 更新日志由 release_notes 首次自动追加，之后只允许 Owner/Admin 编辑/删除，重启不得覆盖。
  let changelog=await post('/api/room/snapshot',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken,roomId:'chat-changelog',tabId:'changelog-owner'});
  if(!changelog.messages?.some(x=>String(x.text||'').includes('SlimeLounge v0.2.9')))throw Error('v0.2.9 release note was not auto-appended');
  let memberChangelogDenied=false;try{await post('/api/room/action',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,roomId:'chat-changelog',tabId:'changelog-member',message:{type:'chat',text:'member should not post'}})}catch{memberChangelogDenied=true}
  if(!memberChangelogDenied)throw Error('non-admin could post to changelog');
  await post('/api/room/action',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken,roomId:'chat-changelog',tabId:'changelog-owner',message:{type:'chat',text:'v0.2.4 manual update'}});
  changelog=await post('/api/room/snapshot',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken,roomId:'chat-changelog',tabId:'changelog-owner'});
  if(!changelog.messages?.some(x=>x.text==='v0.2.4 manual update'))throw Error('owner manual changelog post failed');
  await post('/api/room/disconnect',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken,roomId:'chat-changelog',tabId:'changelog-owner'});
  await post('/api/presence/offline',{userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken,tabId:'changelog-owner'});
  await post('/api/room/disconnect',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,roomId:'chat-changelog',tabId:'changelog-member'}).catch(()=>{});
  await post('/api/presence/offline',{userId:a.userId,deviceId:a.deviceId,deviceToken:a.deviceToken,tabId:'changelog-member'}).catch(()=>{});
  // v0.2.3: 游戏房 WebSocket 语音状态与信令可在开麦者和仅收听者之间转发。
  const voiceOwner=await openRoom(ownerSession,'gomoku-5'),voiceMember=await openRoom(a,'gomoku-5');
  await sleep(80);
  const voicePresenceWait=waitMsg(voiceMember,'presence');voiceOwner.send(JSON.stringify({type:'voice_toggle',enabled:true}));
  const voicePresence=await voicePresenceWait;if(!voicePresence.users?.find(x=>x.userId===ownerSession.userId)?.voiceOn)throw Error('voice-open presence badge state missing');
  const voiceSignalWait=waitMsg(voiceMember,'voice_signal');voiceOwner.send(JSON.stringify({type:'voice_signal',target:a.userId,signal:{kind:'candidate',candidate:{candidate:'test'}}}));
  const relayedVoice=await voiceSignalWait;if(relayedVoice.from!==ownerSession.userId||relayedVoice.signal?.kind!=='candidate')throw Error('voice WebRTC signaling relay failed');
  voiceOwner.send(JSON.stringify({type:'voice_toggle',enabled:false}));voiceOwner.close();voiceMember.close();await sleep(80);
  const chatVoiceOwner=await openRoom(ownerSession,'voice-lounge'),chatVoiceMember=await openRoom(a,'voice-lounge');await sleep(80);const chatVoicePresenceWait=waitMsg(chatVoiceMember,'presence');chatVoiceOwner.send(JSON.stringify({type:'voice_toggle',enabled:true}));const chatVoicePresence=await chatVoicePresenceWait;if(!chatVoicePresence.users?.find(x=>x.userId===ownerSession.userId)?.voiceOn)throw Error('chat voice-channel microphone presence failed');const chatVoiceSignalWait=waitMsg(chatVoiceMember,'voice_signal');chatVoiceOwner.send(JSON.stringify({type:'voice_signal',target:a.userId,signal:{kind:'candidate',candidate:{candidate:'chat-test'}}}));const chatRelay=await chatVoiceSignalWait;if(chatRelay.from!==ownerSession.userId)throw Error('chat voice-channel WebRTC signaling failed');chatVoiceOwner.close();chatVoiceMember.close();await sleep(80);
  await post('/api/local-admin/merge',{sourceUserId:a.userId,targetUserId:b.userId});
  local=await (await fetch(`http://127.0.0.1:${port}/api/local-admin/users`)).json();
  if(local.users.length!==1||local.ownerUserId!==b.userId)throw Error('merge failed');
  const net=await (await fetch(`http://127.0.0.1:${port}/api/network/info`)).json();
  if(!net.ok||net.port!==port)throw Error('network info failed');
  const badAudio=await fetch(`http://127.0.0.1:${port}/api/music/audio?id=bad`);if(badAudio.status!==401)throw Error('anonymous music audio proxy was not blocked');
  const badProbe=await fetch(`http://127.0.0.1:${port}/api/music/probe?id=bad`);if(badProbe.status!==401)throw Error('anonymous music audio probe was not blocked');
  // Presence is tab-aware: closing one tab must not mark the same user offline while another tab is alive.
  const ownerCred={userId:ownerSession.userId,deviceId:ownerSession.deviceId,deviceToken:ownerSession.deviceToken};
  // Earlier WebSocket tests used a shared synthetic tab id; explicitly close that synthetic page before testing new tabs.
  await post('/api/presence/offline',{...ownerCred,tabId:'test-local'});
  // Unready cleanup is now player-count aware and unit-tested in 62_ui_performance; keep this server test focused on join/leave integration.
  await post('/api/room/snapshot',{...ownerCred,roomId:'go-3',tabId:'unready-tab'});
  await post('/api/room/action',{...ownerCred,roomId:'go-3',tabId:'unready-tab',message:{type:'game_action',action:{type:'join',seat:0}}});
  await post('/api/room/action',{...ownerCred,roomId:'go-3',tabId:'unready-tab',message:{type:'game_action',action:{type:'leave'}}});
  const unreadyGone=await post('/api/room/snapshot',{...ownerCred,roomId:'go-3',tabId:'unready-tab'});
  if((unreadyGone.game?.players||[]).includes(ownerSession.userId))throw Error('unready seat leave integration failed');
  await post('/api/room/disconnect',{...ownerCred,roomId:'go-3',tabId:'unready-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'unready-tab'});
  // v0.1.8: human-vs-AI completed games count for the human leaderboard; AI itself never appears.
  await post('/api/room/snapshot',{...ownerCred,roomId:'gomoku-5',tabId:'rank-ai-tab'});
  await post('/api/room/action',{...ownerCred,roomId:'gomoku-5',tabId:'rank-ai-tab',message:{type:'game_action',action:{type:'join',seat:0}}});
  await post('/api/room/action',{...ownerCred,roomId:'gomoku-5',tabId:'rank-ai-tab',message:{type:'game_action',action:{type:'add_bot',seat:1}}});
  await post('/api/room/action',{...ownerCred,roomId:'gomoku-5',tabId:'rank-ai-tab',message:{type:'game_action',action:{type:'ready'}}});
  await post('/api/room/action',{...ownerCred,roomId:'gomoku-5',tabId:'rank-ai-tab',message:{type:'game_action',action:{type:'resign'}}});
  const rankAfterAi=await post('/api/leaderboards',ownerCred);
  const aiHumanRow=rankAfterAi.leaderboards?.games?.gomoku?.ai?.find(x=>x.userId===ownerSession.userId);
  if(!aiHumanRow||aiHumanRow.losses<1||aiHumanRow.games<1||rankAfterAi.leaderboards.games.gomoku.ai.some(x=>String(x.userId||'').startsWith('BOT:'))||rankAfterAi.leaderboards.games.gomoku.human.some(x=>x.userId===ownerSession.userId&&x.losses>0))throw Error('AI-game split ranking failed');
  await post('/api/room/disconnect',{...ownerCred,roomId:'gomoku-5',tabId:'rank-ai-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'rank-ai-tab'});await sleep(650);
  // Public-IP HTTP compatibility transport: rooms must remain usable even when WebSocket Upgrade is blocked/reset.
  let snap=await post('/api/room/snapshot',{...ownerCred,roomId:'chat-general',tabId:'http-room-tab'});
  if(snap.transport!=='http-long-poll'||snap.room?.id!=='chat-general'||!snap.users.some(x=>x.userId===ownerSession.userId))throw Error('HTTP room snapshot transport failed');
  await post('/api/room/action',{...ownerCred,roomId:'chat-general',tabId:'http-room-tab',message:{type:'chat',text:'http fallback hello'}});
  snap=await post('/api/room/snapshot',{...ownerCred,roomId:'chat-general',tabId:'http-room-tab'});
  if(!snap.messages.some(x=>x.text==='http fallback hello'))throw Error('HTTP room action transport failed');
  await post('/api/room/disconnect',{...ownerCred,roomId:'chat-general',tabId:'http-room-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'http-room-tab'});
  let gs=await post('/api/room/snapshot',{...ownerCred,roomId:'gomoku-1',tabId:'http-game-tab'});
  await post('/api/room/action',{...ownerCred,roomId:'gomoku-1',tabId:'http-game-tab',message:{type:'game_action',action:{type:'join'}}});
  gs=await post('/api/room/snapshot',{...ownerCred,roomId:'gomoku-1',tabId:'http-game-tab'});
  if(!gs.game.players.includes(ownerSession.userId))throw Error('HTTP game action did not join seat');
  await post('/api/room/disconnect',{...ownerCred,roomId:'gomoku-1',tabId:'http-game-tab'});await sleep(900);
  gs=await post('/api/room/snapshot',{...ownerCred,roomId:'gomoku-1',tabId:'http-game-check'});
  if(gs.game.players.includes(ownerSession.userId))throw Error('HTTP room disconnect ghost-seat cleanup failed');
  await post('/api/room/disconnect',{...ownerCred,roomId:'gomoku-1',tabId:'http-game-check'});await post('/api/presence/offline',{...ownerCred,tabId:'http-game-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'http-game-check'});
  let go=await post('/api/room/snapshot',{...ownerCred,roomId:'go-1',tabId:'http-go-tab'});if(go.game?.kind!=='go')throw Error('extra game state missing from HTTP room');await post('/api/room/action',{...ownerCred,roomId:'go-1',tabId:'http-go-tab',message:{type:'game_action',action:{type:'join',seat:0}}});await post('/api/room/action',{...ownerCred,roomId:'go-1',tabId:'http-go-tab',message:{type:'game_action',action:{type:'add_bot',seat:1}}});await post('/api/room/action',{...ownerCred,roomId:'go-1',tabId:'http-go-tab',message:{type:'game_action',action:{type:'ready'}}});go=await post('/api/room/snapshot',{...ownerCred,roomId:'go-1',tabId:'http-go-tab'});if(!go.game?.started)throw Error('extra game did not start through HTTP transport');await post('/api/room/action',{...ownerCred,roomId:'go-1',tabId:'http-go-tab',message:{type:'chat',text:'GAME_CHAT_SHOULD_CLEAR'}});go=await post('/api/room/snapshot',{...ownerCred,roomId:'go-1',tabId:'http-go-tab'});if(!go.messages?.some(x=>x.text==='GAME_CHAT_SHOULD_CLEAR'))throw Error('game room chat test message missing');await post('/api/room/disconnect',{...ownerCred,roomId:'go-1',tabId:'http-go-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'http-go-tab'});await sleep(900);go=await post('/api/room/snapshot',{...ownerCred,roomId:'go-1',tabId:'http-go-check'});if((go.game?.players||[]).some(Boolean))throw Error('empty game room kept AI/human seats');if((go.messages||[]).length)throw Error('empty game room chat was not cleared');await post('/api/room/disconnect',{...ownerCred,roomId:'go-1',tabId:'http-go-check'});await post('/api/presence/offline',{...ownerCred,tabId:'http-go-check'});const mainChatCheck=await post('/api/room/snapshot',{...ownerCred,roomId:'chat-general',tabId:'main-chat-retain'});if(!mainChatCheck.messages?.some(x=>x.text==='http fallback hello'))throw Error('main chat was incorrectly cleared when game rooms emptied');await post('/api/room/disconnect',{...ownerCred,roomId:'chat-general',tabId:'main-chat-retain'});await post('/api/presence/offline',{...ownerCred,tabId:'main-chat-retain'});
  // Human board moves must be acknowledged before AI thinking completes, so UI can animate immediately.
  await post('/api/room/snapshot',{...ownerCred,roomId:'xiangqi-1',tabId:'xq-fast-tab'});
  await post('/api/room/action',{...ownerCred,roomId:'xiangqi-1',tabId:'xq-fast-tab',message:{type:'game_action',action:{type:'join',seat:0}}});
  await post('/api/room/action',{...ownerCred,roomId:'xiangqi-1',tabId:'xq-fast-tab',message:{type:'game_action',action:{type:'add_bot',seat:1}}});
  await post('/api/room/action',{...ownerCred,roomId:'xiangqi-1',tabId:'xq-fast-tab',message:{type:'game_action',action:{type:'ready'}}});
  const humanMoveAt=Date.now(),xqAck=await post('/api/room/action',{...ownerCred,roomId:'xiangqi-1',tabId:'xq-fast-tab',message:{type:'game_action',action:{type:'move',x1:0,y1:6,x2:0,y2:5}}});
  if(xqAck.game?.turn!==1||xqAck.game?.last?.x2!==0||xqAck.game?.last?.y2!==5)throw Error('HTTP action did not return human move before AI');
  if(Date.now()-humanMoveAt>400)throw Error('human move acknowledgement waited for AI thinking');
  await sleep(1900);let xqAfter=await post('/api/room/snapshot',{...ownerCred,roomId:'xiangqi-1',tabId:'xq-fast-tab'});if(xqAfter.game?.started&&xqAfter.game?.turn!==0)throw Error('xiangqi AI did not move asynchronously');
  await post('/api/room/disconnect',{...ownerCred,roomId:'xiangqi-1',tabId:'xq-fast-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'xq-fast-tab'});await sleep(900);
  // Riichi must start normally over the same public-IP HTTP transport instead of falling into reconnect UI.
  await post('/api/room/snapshot',{...ownerCred,roomId:'mahjong-1',tabId:'mj-http-tab'});
  await post('/api/room/action',{...ownerCred,roomId:'mahjong-1',tabId:'mj-http-tab',message:{type:'game_action',action:{type:'join',seat:0}}});
  for(const seat of [1,2,3])await post('/api/room/action',{...ownerCred,roomId:'mahjong-1',tabId:'mj-http-tab',message:{type:'game_action',action:{type:'add_bot',seat}}});
  await post('/api/room/action',{...ownerCred,roomId:'mahjong-1',tabId:'mj-http-tab',message:{type:'game_action',action:{type:'ready'}}});
  const mjStart=await post('/api/room/action',{...ownerCred,roomId:'mahjong-1',tabId:'mj-http-tab',message:{type:'game_action',action:{type:'start'}}});
  if(mjStart.game?.kind!=='mahjong'||mjStart.game?.phase!=='playing'||mjStart.game?.mySeat!==0||!mjStart.game?.seats?.[0]?.hand?.length)throw Error('riichi HTTP start failed');
  await post('/api/room/disconnect',{...ownerCred,roomId:'mahjong-1',tabId:'mj-http-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'mj-http-tab'});await sleep(900);
  // Four-seat tables must also reset instead of turning the last human into an endless all-AI game.
  let uno=await post('/api/room/snapshot',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-guard'});await post('/api/room/action',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-guard',message:{type:'game_action',action:{type:'join',seat:0}}});for(const seat of [1,2,3])await post('/api/room/action',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-guard',message:{type:'game_action',action:{type:'add_bot',seat}}});await post('/api/room/action',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-guard',message:{type:'game_action',action:{type:'ready'}}});await post('/api/room/action',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-guard',message:{type:'game_action',action:{type:'start'}}});await post('/api/room/disconnect',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-guard'});await post('/api/presence/offline',{...ownerCred,tabId:'uno-ai-guard'});await sleep(900);uno=await post('/api/room/snapshot',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-check'});if((uno.game?.seats||[]).some(Boolean))throw Error('all-AI UNO table was not reset after last human left');await post('/api/room/disconnect',{...ownerCred,roomId:'uno-1',tabId:'uno-ai-check'});await post('/api/presence/offline',{...ownerCred,tabId:'uno-ai-check'});
  const rooms=await (await fetch(`http://127.0.0.1:${port}/api/rooms`)).json();const sudoku=rooms.rooms.find(x=>x.id==='sudoku-1');if(!sudoku?.single||sudoku.mode!=='single')throw Error('single-player room metadata missing');
  await post('/api/presence/ping',{...ownerCred,tabId:'test-tab-1',section:'chat',roomId:'',presenceStatus:'away',activityLabel:'页面在后台'});
  let onlineRows=await post('/api/admin/users',ownerCred);let prow=onlineRows.users.find(x=>x.userId===ownerSession.userId);if(!prow?.online||prow.presenceStatus!=='away')throw Error('background tab did not become away');
  await post('/api/presence/ping',{...ownerCred,tabId:'test-tab-1',section:'chat',roomId:'',presenceStatus:'online',activityLabel:''});
  await post('/api/presence/ping',{...ownerCred,tabId:'test-tab-2',section:'chat',roomId:'',presenceStatus:'online',activityLabel:''});
  onlineRows=await post('/api/admin/users',ownerCred);if(!onlineRows.users.find(x=>x.userId===ownerSession.userId)?.online)throw Error('tab presence did not mark user online');
  await post('/api/presence/offline',{...ownerCred,tabId:'test-tab-1'});
  onlineRows=await post('/api/admin/users',ownerCred);if(!onlineRows.users.find(x=>x.userId===ownerSession.userId)?.online)throw Error('closing one of two tabs marked user offline');
  await post('/api/presence/offline',{...ownerCred,tabId:'test-tab-2'});
  onlineRows=await post('/api/admin/users',ownerCred);prow=onlineRows.users.find(x=>x.userId===ownerSession.userId);if(prow?.online||prow?.presenceStatus!=='offline')throw Error('last tab close did not mark user offline');
  // Empty music rooms must discard current song and queue rather than playing forever with nobody inside.
  let music=await post('/api/room/snapshot',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab'});
  await post('/api/room/action',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab',message:{type:'music_add',trackId:'123456',title:'test track',duration:120000}});
  music=await post('/api/room/snapshot',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab'});if(!music.music?.trackId||music.music.playing!==true)throw Error('music test item missing or did not enter shared playback state');
  const musicRev=music.music.revision||0;await sleep(80);
  await post('/api/room/action',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab',message:{type:'music_control',trackId:'123456',action:'pause'}});
  music=await post('/api/room/snapshot',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab'});if(music.music?.playing!==false||(music.music?.positionMs||0)<20||(music.music?.revision||0)<=musicRev)throw Error('music shared pause/timeline sync failed');
  await post('/api/room/action',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab',message:{type:'music_control',trackId:'123456',action:'seek',positionMs:42000}});
  music=await post('/api/room/snapshot',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab'});if(Math.abs((music.music?.positionMs||0)-42000)>2||music.music?.playing!==false)throw Error('music shared seek sync failed');
  await post('/api/room/action',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab',message:{type:'music_control',trackId:'123456',action:'play'}});
  music=await post('/api/room/snapshot',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab'});if(music.music?.playing!==true)throw Error('music shared resume sync failed');
  await post('/api/room/disconnect',{...ownerCred,roomId:'music-cn-1',tabId:'music-clear-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'music-clear-tab'});await sleep(750);
  music=await post('/api/room/snapshot',{...ownerCred,roomId:'music-cn-1',tabId:'music-check-tab'});if(music.music?.trackId||(music.music?.queue||[]).length)throw Error('empty music room did not clear queue');
  await post('/api/room/disconnect',{...ownerCred,roomId:'music-cn-1',tabId:'music-check-tab'});await post('/api/presence/offline',{...ownerCred,tabId:'music-check-tab'});
  // A browser close must not leave an offline ghost occupying a game seat forever.
  const ws1=await openRoom(ownerSession,'gomoku-1');
  ws1.send(JSON.stringify({type:'game_action',action:{type:'join'}}));await waitMsg(ws1,'game_state');ws1.close();
  await sleep(900);
  const ws2=await openRoom(ownerSession,'gomoku-1');const init2=ws2._initial;
  if(init2.game.players.includes(ownerSession.userId))throw Error('ghost player seat cleanup failed');ws2.close();
  console.log('[OK] v0.2.4 Owner / devices / daily chips / Discord directory+voice / split rankings / music sync / HTTP fallback / riichi / presence / ghost-seat cleanup');
} finally {
  if(proc && !proc.killed) proc.kill('SIGTERM');
  await sleep(100);
  fs.rmSync(tmp,{recursive:true,force:true});
}

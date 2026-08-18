import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOM_DEFS,ROOM_MAP,roomInitialState,applyGameAction,publicGameState,addBotToGame,removeBotFromGame,advanceBots,hasBot,isBotId} from './shared/games.js';

const __filename=fileURLToPath(import.meta.url),ROOT=path.dirname(__filename),PUBLIC=path.join(ROOT,'public');
try{if(typeof process.loadEnvFile==='function'&&fs.existsSync(path.join(ROOT,'.dev.vars')))process.loadEnvFile(path.join(ROOT,'.dev.vars'))}catch(e){console.warn('[WARN] .dev.vars:',e.message)}
const APP='SlimeLounge',VERSION='0.0.3',HOST='0.0.0.0',PORT=Number(process.env.PORT||8790);
const DATA_DIR=process.env.SLIMELOUNGE_DATA_DIR||(process.platform==='win32'?path.join(process.env.LOCALAPPDATA||process.env.APPDATA||os.homedir(),'SlimeLounge'):path.join(os.homedir(),'.slimelounge'));
fs.mkdirSync(DATA_DIR,{recursive:true});const DATA_FILE=path.join(DATA_DIR,'data.json');
const SLIME_COLORS=new Set(['mint','sky','peach','lemon','lilac','milk','cocoa','rose','aqua','lime']);
const clients=new Set(),tickets=new Map();let saveTimer=null;

const blank=()=>({schemaVersion:3,salt:crypto.randomBytes(24).toString('hex'),ownerUserId:null,users:{},devices:{},employeeIndex:{},employeeHistory:[],employeeChangeRequests:[],friendships:[],roomMessages:{},roomMusic:{},roomGames:{},rankings:{},rankingProcessed:{}});
function load(){try{if(!fs.existsSync(DATA_FILE))return blank();const d={...blank(),...JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))};d.users||={};d.devices||={};d.employeeIndex||={};d.employeeHistory||=[];d.employeeChangeRequests||=[];d.friendships||=[];d.roomMessages||={};d.roomMusic||={};d.roomGames||={};d.rankings||={};d.rankingProcessed||={};for(const k of ['gomoku','xiangqi','chess','blackjack','poker'])d.rankings[k]||={};return d}catch(e){console.warn('[WARN] data load failed:',e.message);return blank()}}
let data=load();
function save(){clearTimeout(saveTimer);saveTimer=null;const tmp=DATA_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,DATA_FILE)}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,200)}
const clean=(v,n=32)=>String(v??'').replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const secretHash=v=>sha(`${data.salt}:${v}`);
const token=()=>crypto.randomBytes(32).toString('base64url');
function normalizeEmployee(v){return clean(v,24).replace(/\s+/g,'').toUpperCase()}
function validEmployee(v){return /^[A-Z0-9]{4,16}$/.test(v)}
function maskEmployee(v){if(v.length<=4)return '*'.repeat(v.length);return '*'.repeat(Math.max(2,v.length-4))+v.slice(-4)}
function makeLoungeId(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let id;do{id='SL-';for(let i=0;i<7;i++)id+=chars[crypto.randomInt(chars.length)]}while(Object.values(data.users).some(u=>u.loungeId===id));return id}
function migrateData(){
  const oldSchema=Number(data.schemaVersion||1);data.schemaVersion=3;data.employeeChangeRequests||=[];data.rankings||={};for(const k of ['gomoku','xiangqi','chess','blackjack','poker'])data.rankings[k]||={};if(oldSchema<3)data.roomGames={};
  const configured=normalizeEmployee(process.env.OWNER_EMPLOYEE_ID||'');let owner=null;
  if(configured&&validEmployee(configured)){const h=secretHash(configured);owner=Object.values(data.users).find(u=>u.employeeHash===h)||null}else owner=Object.values(data.users).find(u=>u.role==='owner')||Object.values(data.users).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))[0]||null;
  for(const u of Object.values(data.users))if(u.role==='owner'&&u.userId!==owner?.userId)u.role='member';
  if(owner){owner.role='owner';owner.employeeStatus='verified';data.ownerUserId=owner.userId}else data.ownerUserId=null;
  for(const u of Object.values(data.users)){u.presenceStatus=u.presenceStatus||'online';u.statusMessage=u.statusMessage||'';u.employeeStatus=u.employeeStatus||(u.userId===data.ownerUserId?'verified':'pending');u.lastSeenAt=u.lastSeenAt||0;u.currentSection=u.currentSection||'';u.currentRoomId=u.currentRoomId||'';}
  save();
}
migrateData();
function publicUser(u){return {userId:u.userId,loungeId:u.loungeId,name:u.name,slimeColor:u.slimeColor,bio:u.bio||'',role:u.role||'member',presenceStatus:u.presenceStatus||'online',statusMessage:u.statusMessage||'',employeeStatus:u.employeeStatus||'pending',createdAt:u.createdAt}}
function auth(userId,deviceId,deviceToken){const u=data.users[String(userId||'')],d=data.devices[String(deviceId||'')];if(!u||!d||d.userId!==u.userId||d.tokenHash!==sha(deviceToken||''))return null;const now=Date.now();d.lastSeenAt=now;u.lastSeenAt=now;scheduleSave();return {u,d}}
function json(res,status,obj){const body=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});res.end(body)}
function body(req,max=65536){return new Promise((resolve,reject)=>{let size=0,ch=[];req.on('data',c=>{size+=c.length;if(size>max){reject(Error('too large'));req.destroy();return}ch.push(c)});req.on('end',()=>{try{resolve(ch.length?JSON.parse(Buffer.concat(ch).toString('utf8')):{})}catch{reject(Error('invalid json'))}});req.on('error',reject)})}
function contentType(f){return ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'}
function friendRel(a,b){return data.friendships.find(f=>((f.a===a&&f.b===b)||(f.a===b&&f.b===a))&&f.state!=='removed')}
function onlineInfo(u){const online=Date.now()-(u.lastSeenAt||0)<45000;return {online,lastSeenAt:u.lastSeenAt||0,currentSection:online?(u.currentSection||''):null,currentRoomId:online?(u.currentRoomId||''):null}}
function social(userId){const friends=[],incoming=[],outgoing=[];for(const f of data.friendships){if(f.state==='removed'||(f.a!==userId&&f.b!==userId))continue;const other=f.a===userId?f.b:f.a,u=data.users[other];if(!u)continue;const e={...publicUser(u),...onlineInfo(u)};if(f.state==='accepted')friends.push(e);else if(f.b===userId)incoming.push(e);else outgoing.push(e)}return {friends,incoming,outgoing}}
function roomData(id){const def=ROOM_MAP[id];if(!def)return null;if(!data.roomMessages[id])data.roomMessages[id]=[];if(def.category==='music'&&!data.roomMusic[id])data.roomMusic[id]={trackId:'',title:'',setBy:'',updatedAt:0};if(def.game){const gs=data.roomGames[id];const stale=!gs||gs.kind!==def.game||(['gomoku','xiangqi','chess'].includes(def.game)&&(!Array.isArray(gs.ready)||typeof gs.started!=='boolean'));if(stale)data.roomGames[id]=roomInitialState(def).game;}return def}
function roomClients(roomId){return [...clients].filter(c=>c.roomId===roomId&&!c.closed)}
function occupancy(){const counts={};for(const u of Object.values(data.users)){if(Date.now()-(u.lastSeenAt||0)<45000&&u.currentRoomId)counts[u.currentRoomId]=(counts[u.currentRoomId]||0)+1;}return ROOM_DEFS.map(r=>({...r,online:counts[r.id]||0}))}
function isStaff(u){return u&&['owner','admin'].includes(u.role)}
function rankStat(kind,userId){data.rankings[kind]||={};return data.rankings[kind][userId]||=( {games:0,wins:0,losses:0,draws:0,updatedAt:0} )}
function recordGameResult(roomId,before,after){
  if(!after||hasBot(after))return;
  if(['gomoku','xiangqi','chess'].includes(after.kind)){
    const ended=!!after.winner||!!after.result;if(!ended||before?.winner===after.winner&&before?.result===after.result)return;
    const humans=after.players.filter(x=>x&&!isBotId(x));if(humans.length!==2)return;
    for(const uid of humans){const st=rankStat(after.kind,uid);st.games++;if(after.winner===uid)st.wins++;else if(after.winner)st.losses++;else st.draws++;st.updatedAt=Date.now()}scheduleSave();return;
  }
  if(['blackjack','poker'].includes(after.kind)&&after.handNo>(before?.handNo||after.handNo)){
    if(after.practice)return;for(const p of after.seats){if(!p||isBotId(p.userId)||p.isBot)continue;const st=rankStat(after.kind,p.userId);st.games++;const r=String(p.result||'');if(r.includes('胜'))st.wins++;else if(r.includes('平'))st.draws++;else st.losses++;st.updatedAt=Date.now()}scheduleSave();
  }
}
function leaderboardPayload(){
  const out={};for(const kind of ['gomoku','xiangqi','chess','blackjack','poker']){out[kind]=Object.entries(data.rankings[kind]||{}).map(([userId,st])=>{const u=data.users[userId];return {...st,userId,name:u?.name||'已离开用户',slimeColor:u?.slimeColor||'mint',loungeId:u?.loungeId||''}}).sort((a,b)=>b.wins-a.wins||b.games-a.games).slice(0,50)}
  const all={};for(const kind of Object.keys(out))for(const r of out[kind]){const a=all[r.userId]||=( {userId:r.userId,name:r.name,slimeColor:r.slimeColor,loungeId:r.loungeId,games:0,wins:0,losses:0,draws:0} );a.games+=r.games;a.wins+=r.wins;a.losses+=r.losses;a.draws+=r.draws}out.overall=Object.values(all).sort((a,b)=>b.wins-a.wins||b.games-a.games).slice(0,50);return out;
}
const musicCache=new Map();
async function searchNetease(q){
  const query=clean(q,80);if(!query)return [];const key=query.toLowerCase(),hit=musicCache.get(key);if(hit&&Date.now()-hit.at<300000)return hit.results;
  const base=String(process.env.NETEASE_SEARCH_BASE||'').replace(/\/$/,'');const urls=base?[`${base}/search?keywords=${encodeURIComponent(query)}&limit=12`]:[`https://music.163.com/api/search/get/web?csrf_token=hlpretag=&hlposttag=&s=${encodeURIComponent(query)}&type=1&offset=0&total=true&limit=12`,`https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=12&offset=0`];
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),2500);const attempt=async u=>{const r=await fetch(u,{signal:ctrl.signal,headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36','referer':'https://music.163.com/','accept':'application/json,text/plain,*/*'}});if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json(),songs=j?.result?.songs||[];if(!songs.length)throw Error('没有搜索结果');return songs.map(x=>({id:String(x.id),name:x.name||'未知歌曲',artists:(x.artists||x.ar||[]).map(a=>a.name).filter(Boolean),album:x.album?.name||x.al?.name||'',duration:x.duration||x.dt||0}))};
  try{const results=await Promise.any(urls.map(attempt));musicCache.set(key,{at:Date.now(),results});return results}catch(e){if(ctrl.signal.aborted)throw Error('网易云搜索超时（2.5 秒）：当前网络无法访问音乐搜索源');const first=e?.errors?.[0]||e;throw Error('网易云搜索失败：'+(first?.message||'网络不可达'))}finally{clearTimeout(timer)}
}

const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(url.pathname==='/api/health')return json(res,200,{ok:true,app:APP,version:VERSION});
  if(url.pathname==='/api/rooms')return json(res,200,{ok:true,rooms:occupancy()});
  if(req.method==='GET'&&url.pathname==='/api/music/search'){try{return json(res,200,{ok:true,results:await searchNetease(url.searchParams.get('q')||'')})}catch(e){return json(res,502,{ok:false,error:e.message})}}
  if(req.method==='GET'&&url.pathname==='/api/leaderboards')return json(res,200,{ok:true,leaderboards:leaderboardPayload()});
  if(req.method==='POST'&&url.pathname==='/api/register'){
    const b=await body(req),name=clean(b.name,16),emp=normalizeEmployee(b.employeeId),slimeColor=SLIME_COLORS.has(b.slimeColor)?b.slimeColor:'mint';if(!name)return json(res,400,{ok:false,error:'请输入昵称'});if(!validEmployee(emp))return json(res,400,{ok:false,error:'工号格式仅接受 4~16 位字母或数字'});const eh=secretHash(emp);if(data.employeeIndex[eh])return json(res,409,{ok:false,error:'该工号已被占用，不能自行覆盖。请联系 Owner 核验并释放冲突工号'});
    const now=Date.now(),userId=crypto.randomUUID(),deviceId=crypto.randomUUID(),deviceToken=token(),isFirst=Object.keys(data.users).length===0,configuredOwner=normalizeEmployee(process.env.OWNER_EMPLOYEE_ID||''),ownerClaim=!data.ownerUserId&&(configuredOwner?emp===configuredOwner:isFirst),u={userId,loungeId:makeLoungeId(),name,slimeColor,bio:'',role:ownerClaim?'owner':'member',employeeHash:eh,employeeMasked:maskEmployee(emp),employeeStatus:ownerClaim?'verified':'pending',presenceStatus:'online',statusMessage:'',lastSeenAt:now,currentSection:'chat',currentRoomId:'',createdAt:now,updatedAt:now};data.users[userId]=u;if(ownerClaim)data.ownerUserId=userId;data.devices[deviceId]={deviceId,userId,label:clean(b.deviceLabel,32)||'当前设备',tokenHash:sha(deviceToken),createdAt:now,lastSeenAt:now};data.employeeIndex[eh]=userId;save();return json(res,201,{ok:true,userId,deviceId,deviceToken,profile:publicUser(u),employeeMasked:u.employeeMasked});
  }
  if(req.method==='POST'&&url.pathname==='/api/auth'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a)return json(res,401,{ok:false,error:'设备身份无效'});return json(res,200,{ok:true,profile:publicUser(a.u),employeeMasked:a.u.employeeMasked,deviceLabel:a.d.label,social:social(a.u.userId)});
  }
  if(req.method==='POST'&&url.pathname==='/api/presence/ping'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a)return json(res,401,{ok:false,error:'设备身份无效'});a.u.lastSeenAt=Date.now();a.u.currentSection=clean(b.section,24);a.u.currentRoomId=clean(b.roomId,48);if(['online','busy','focus','meeting','away','gaming','listening'].includes(b.presenceStatus))a.u.presenceStatus=b.presenceStatus;save();return json(res,200,{ok:true,profile:publicUser(a.u)});
  }
  if(req.method==='POST'&&url.pathname==='/api/profile'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a)return json(res,401,{ok:false,error:'设备身份无效'});const name=clean(b.name,16);if(!name)return json(res,400,{ok:false,error:'昵称不能为空'});a.u.name=name;a.u.bio=clean(b.bio,80);a.u.statusMessage=clean(b.statusMessage,48);if(['online','busy','focus','meeting','away','gaming','listening'].includes(b.presenceStatus))a.u.presenceStatus=b.presenceStatus;if(SLIME_COLORS.has(b.slimeColor))a.u.slimeColor=b.slimeColor;a.u.updatedAt=Date.now();a.u.lastSeenAt=Date.now();save();broadcastAll({type:'profile_update',profile:publicUser(a.u)});return json(res,200,{ok:true,profile:publicUser(a.u)});
  }
  if(req.method==='POST'&&url.pathname==='/api/employee/change'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a)return json(res,401,{ok:false,error:'设备身份无效'});const emp=normalizeEmployee(b.employeeId);if(!validEmployee(emp))return json(res,400,{ok:false,error:'工号格式仅接受 4~16 位字母或数字'});const nh=secretHash(emp),owner=data.employeeIndex[nh];if(owner&&owner!==a.u.userId)return json(res,409,{ok:false,error:'该工号已被其他身份占用，请联系管理员处理冲突'});if(a.u.role==='owner'){const old=a.u.employeeHash;delete data.employeeIndex[old];data.employeeIndex[nh]=a.u.userId;a.u.employeeHash=nh;a.u.employeeMasked=maskEmployee(emp);a.u.employeeStatus='verified';data.employeeHistory.push({userId:a.u.userId,oldHash:old,newHash:nh,changedAt:Date.now(),approvedBy:a.u.userId});save();return json(res,200,{ok:true,employeeMasked:a.u.employeeMasked,employeeStatus:'verified'});}const reqId=crypto.randomUUID();data.employeeChangeRequests=data.employeeChangeRequests.filter(x=>x.userId!==a.u.userId||x.state!=='pending');data.employeeChangeRequests.push({id:reqId,userId:a.u.userId,newHash:nh,newMasked:maskEmployee(emp),state:'pending',createdAt:Date.now()});save();return json(res,202,{ok:true,pending:true,error:'工号变更已提交，等待管理员核验'});
  }
  if(req.method==='POST'&&url.pathname==='/api/ticket'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a)return json(res,401,{ok:false,error:'设备身份无效'});const roomId=String(b.roomId||'');if(!roomData(roomId))return json(res,404,{ok:false,error:'房间不存在'});const t=token();tickets.set(sha(t),{userId:a.u.userId,deviceId:a.d.deviceId,roomId,exp:Date.now()+60000});return json(res,200,{ok:true,ticket:t});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/users'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a||!isStaff(a.u))return json(res,403,{ok:false,error:'无管理员权限'});const users=Object.values(data.users).map(u=>({...publicUser(u),...onlineInfo(u),employeeMasked:u.employeeMasked||'',deviceCount:Object.values(data.devices).filter(d=>d.userId===u.userId).length})).sort((x,y)=>(Number(y.online)-Number(x.online))||x.createdAt-y.createdAt);return json(res,200,{ok:true,ownerUserId:data.ownerUserId,users,employeeRequests:data.employeeChangeRequests.filter(x=>x.state==='pending').map(x=>({...x,user:publicUser(data.users[x.userId]||{})}))});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/role'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a||a.u.userId!==data.ownerUserId||a.u.role!=='owner')return json(res,403,{ok:false,error:'只有唯一 Owner 可以调整管理员'});const target=data.users[String(b.targetUserId||'')];if(!target||target.userId===a.u.userId)return json(res,400,{ok:false,error:'目标用户无效'});const role=b.role==='admin'?'admin':'member';if(target.role==='owner'||target.userId===data.ownerUserId)return json(res,403,{ok:false,error:'不能修改 Owner'});target.role=role;target.updatedAt=Date.now();save();broadcastAll({type:'profile_update',profile:publicUser(target)});return json(res,200,{ok:true,profile:publicUser(target)});
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/employee'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a||!isStaff(a.u))return json(res,403,{ok:false,error:'无管理员权限'});const action=String(b.action||'');if(action==='verify'){const target=data.users[String(b.targetUserId||'')];if(!target)return json(res,404,{ok:false,error:'用户不存在'});target.employeeStatus='verified';target.updatedAt=Date.now();save();return json(res,200,{ok:true});}if(action==='reject'){const target=data.users[String(b.targetUserId||'')];if(!target||target.role==='owner')return json(res,400,{ok:false,error:'目标无效'});if(target.employeeHash)delete data.employeeIndex[target.employeeHash];target.employeeHash=null;target.employeeMasked='未绑定';target.employeeStatus='rejected';target.updatedAt=Date.now();save();return json(res,200,{ok:true});}if(action==='approve_change'){const r=data.employeeChangeRequests.find(x=>x.id===b.requestId&&x.state==='pending');if(!r)return json(res,404,{ok:false,error:'变更申请不存在'});const target=data.users[r.userId];if(!target)return json(res,404,{ok:false,error:'用户不存在'});const conflict=data.employeeIndex[r.newHash];if(conflict&&conflict!==target.userId)return json(res,409,{ok:false,error:'新工号已被其他身份占用'});if(target.employeeHash)delete data.employeeIndex[target.employeeHash];data.employeeIndex[r.newHash]=target.userId;target.employeeHash=r.newHash;target.employeeMasked=r.newMasked;target.employeeStatus='verified';r.state='approved';r.approvedBy=a.u.userId;r.updatedAt=Date.now();save();return json(res,200,{ok:true});}if(action==='reject_change'){const r=data.employeeChangeRequests.find(x=>x.id===b.requestId&&x.state==='pending');if(!r)return json(res,404,{ok:false,error:'变更申请不存在'});r.state='rejected';r.approvedBy=a.u.userId;r.updatedAt=Date.now();save();return json(res,200,{ok:true});}if(action==='release_conflict'){const emp=normalizeEmployee(b.employeeId);if(!validEmployee(emp))return json(res,400,{ok:false,error:'工号格式无效'});const h=secretHash(emp),uid=data.employeeIndex[h],target=data.users[uid];if(!target)return json(res,404,{ok:false,error:'该工号当前未被占用'});if(target.role==='owner')return json(res,403,{ok:false,error:'不能释放 Owner 工号'});delete data.employeeIndex[h];target.employeeHash=null;target.employeeMasked='未绑定';target.employeeStatus='rejected';target.updatedAt=Date.now();save();return json(res,200,{ok:true,releasedUserId:uid});}return json(res,400,{ok:false,error:'未知管理员工号操作'});
  }
  if(req.method==='POST'&&url.pathname==='/api/social/search'){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a)return json(res,401,{ok:false,error:'设备身份无效'});const id=clean(b.loungeId,16).toUpperCase(),u=Object.values(data.users).find(x=>x.loungeId===id);if(!u)return json(res,404,{ok:false,error:'没有找到该 Lounge ID'});return json(res,200,{ok:true,profile:publicUser(u),relation:friendRel(a.u.userId,u.userId)?.state||'none'});
  }
  if(req.method==='POST'&&url.pathname.startsWith('/api/social/')){
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken);if(!a)return json(res,401,{ok:false,error:'设备身份无效'});const me=a.u.userId;
    if(url.pathname==='/api/social/list')return json(res,200,{ok:true,social:social(me)});
    if(url.pathname==='/api/social/request'){const other=String(b.otherUserId||'');if(!data.users[other]||other===me)return json(res,400,{ok:false,error:'用户无效'});let f=friendRel(me,other);if(f){if(f.state==='pending'&&f.b===me){f.state='accepted';f.updatedAt=Date.now();save();return json(res,200,{ok:true,social:social(me)})}return json(res,409,{ok:false,error:'关系已存在'})}data.friendships.push({a:me,b:other,state:'pending',createdAt:Date.now(),updatedAt:Date.now()});save();return json(res,200,{ok:true,social:social(me)});}
    if(url.pathname==='/api/social/respond'){const other=String(b.otherUserId||''),f=friendRel(me,other);if(!f||f.state!=='pending'||f.b!==me)return json(res,404,{ok:false,error:'申请不存在'});f.state=b.accept?'accepted':'removed';f.updatedAt=Date.now();save();return json(res,200,{ok:true,social:social(me)});}
    if(url.pathname==='/api/social/remove'){const other=String(b.otherUserId||''),f=friendRel(me,other);if(!f||f.state!=='accepted')return json(res,404,{ok:false,error:'好友不存在'});f.state='removed';f.updatedAt=Date.now();save();return json(res,200,{ok:true,social:social(me)});}
  }
  if(url.pathname.startsWith('/api/'))return json(res,404,{ok:false,error:'Not found'});
  let p=decodeURIComponent(url.pathname);if(p==='/')p='/index.html';const file=path.normalize(path.join(PUBLIC,p));if(!file.startsWith(PUBLIC))return json(res,403,{ok:false,error:'Forbidden'});fs.stat(file,(e,st)=>{const f=!e&&st.isFile()?file:path.join(PUBLIC,'index.html');res.writeHead(200,{'content-type':contentType(f),'cache-control':'no-store'});fs.createReadStream(f).pipe(res)});
}catch(e){console.error(e);if(!res.headersSent)json(res,500,{ok:false,error:e.message||'server error'});else res.end()}});

function wsAccept(k){return crypto.createHash('sha1').update(k+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')}
function frame(text,opcode=1){const p=Buffer.from(text),l=p.length;let h;if(l<126){h=Buffer.alloc(2);h[1]=l}else if(l<65536){h=Buffer.alloc(4);h[1]=126;h.writeUInt16BE(l,2)}else{h=Buffer.alloc(10);h[1]=127;h.writeBigUInt64BE(BigInt(l),2)}h[0]=0x80|opcode;return Buffer.concat([h,p])}
function send(c,o){if(!c.closed&&!c.socket.destroyed)try{c.socket.write(frame(JSON.stringify(o)))}catch{}}
function broadcast(roomId,o,except=null){for(const c of clients)if(c.roomId===roomId&&c!==except)send(c,o)}
function broadcastAll(o){for(const c of clients)send(c,o)}
function sendGame(roomId){const st=data.roomGames[roomId];for(const c of roomClients(roomId))send(c,{type:'game_state',state:publicGameState(st,c.userId)});scheduleSave()}
function remove(c){if(c.closed)return;c.closed=true;clients.delete(c);const u=data.users[c.userId];if(u){u.lastSeenAt=Date.now();scheduleSave();}broadcast(c.roomId,{type:'presence',users:roomClients(c.roomId).map(x=>publicUser(data.users[x.userId]))});}
function parse(c,chunk){c.buf=Buffer.concat([c.buf,chunk]);while(c.buf.length>=2){let b0=c.buf[0],b1=c.buf[1],op=b0&15,len=b1&127,off=2;if(len===126){if(c.buf.length<4)return;len=c.buf.readUInt16BE(2);off=4}else if(len===127){if(c.buf.length<10)return;len=Number(c.buf.readBigUInt64BE(2));off=10}let mask;if(b1&128){if(c.buf.length<off+4)return;mask=c.buf.subarray(off,off+4);off+=4}if(c.buf.length<off+len)return;let p=Buffer.from(c.buf.subarray(off,off+len));c.buf=c.buf.subarray(off+len);if(mask)for(let i=0;i<p.length;i++)p[i]^=mask[i%4];if(op===8){remove(c);try{c.socket.write(frame(p,8),()=>c.socket.end())}catch{try{c.socket.destroy()}catch{}}return}if(op===9){try{c.socket.write(frame(p,10))}catch{}continue}if(op===1)message(c,p.toString())}}
function message(c,raw){if(raw.length>16384)return;let m;try{m=JSON.parse(raw)}catch{return}const def=ROOM_MAP[c.roomId],u=data.users[c.userId];try{
  if(m.type==='heartbeat'){if(u){u.lastSeenAt=Date.now();u.currentRoomId=c.roomId;scheduleSave();}send(c,{type:'heartbeat_ack',at:Date.now()});return}
  if(m.type==='chat'){const text=clean(m.text,300);if(!text)return;if(def.adminOnlyPost&&!isStaff(u))throw Error('该讨论区仅管理员可以发言');const msg={id:crypto.randomUUID(),userId:c.userId,name:u.name,slimeColor:u.slimeColor,role:u.role||'member',text,at:Date.now()};const arr=data.roomMessages[c.roomId]||(data.roomMessages[c.roomId]=[]);arr.push(msg);while(arr.length>100)arr.shift();scheduleSave();broadcast(c.roomId,{type:'chat',message:msg});return}
  if(m.type==='music_set'&&def.category==='music'){const id=String(m.trackId||'').match(/\d{3,20}/)?.[0];if(!id)throw Error('请输入网易云歌曲 ID 或歌曲链接');const ms=data.roomMusic[c.roomId]={trackId:id,title:clean(m.title,80)||`网易云歌曲 ${id}`,setBy:u.name,updatedAt:Date.now()};scheduleSave();broadcast(c.roomId,{type:'music_state',music:ms});return}
  if(m.type==='game_action'&&def.game){const st=data.roomGames[c.roomId],before=JSON.parse(JSON.stringify(st)),a=m.action||{};if(a.type==='add_bot')addBotToGame(st,Number.isInteger(a.seat)?a.seat:null);else if(a.type==='remove_bot')removeBotFromGame(st,Number.isInteger(a.seat)?a.seat:null);else applyGameAction(st,c.userId,a);advanceBots(st);recordGameResult(c.roomId,before,st);sendGame(c.roomId);return}
}catch(e){send(c,{type:'error',error:e.message})}}

server.on('upgrade',(req,socket)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname!=='/api/ws')return socket.destroy();const th=sha(String(url.searchParams.get('ticket')||'')),g=tickets.get(th),key=req.headers['sec-websocket-key'];tickets.delete(th);if(!g||g.exp<Date.now()||!key)return socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');const def=roomData(g.roomId),u=data.users[g.userId];if(!def||!u)return socket.destroy();socket.write(['HTTP/1.1 101 Switching Protocols','Upgrade: websocket','Connection: Upgrade',`Sec-WebSocket-Accept: ${wsAccept(key)}`,'',''].join('\r\n'));socket.setKeepAlive?.(true,10000);socket.setNoDelay?.(true);const c={socket,buf:Buffer.alloc(0),closed:false,userId:g.userId,roomId:g.roomId};clients.add(c);u.lastSeenAt=Date.now();u.currentRoomId=g.roomId;scheduleSave();send(c,{type:'init',room:def,profile:publicUser(u),users:roomClients(g.roomId).map(x=>publicUser(data.users[x.userId])),messages:(data.roomMessages[g.roomId]||[]).slice(-60),music:data.roomMusic[g.roomId]||null,game:def.game?publicGameState(data.roomGames[g.roomId],g.userId):null});broadcast(g.roomId,{type:'presence',users:roomClients(g.roomId).map(x=>publicUser(data.users[x.userId]))});socket.on('data',ch=>parse(c,ch));socket.on('close',()=>remove(c));socket.on('end',()=>remove(c));socket.on('error',()=>remove(c))}catch(e){console.error('[WS]',e);socket.destroy()}});

function open(url){if(process.env.AUTO_OPEN==='0')return;try{const [cmd,args]=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];spawn(cmd,args,{detached:true,stdio:'ignore'}).unref()}catch{}}
server.on('error',e=>{console.error(e);process.exitCode=1});server.keepAliveTimeout=65000;server.headersTimeout=70000;server.listen(PORT,HOST,()=>{const url=`http://localhost:${PORT}`;const lan=[];for(const list of Object.values(os.networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal)lan.push(`http://${n.address}:${PORT}`);console.log(`\n${APP} v${VERSION}\nLocal: ${url}${lan.length?`\nLAN:   ${lan.join('  ')}`:''}\nData: ${DATA_FILE}\n`);setTimeout(()=>open(url),250)});process.on('SIGINT',()=>{try{save()}catch{}process.exit(0)});

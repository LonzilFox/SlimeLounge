import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw Error(m)};
const app=read('public/app.js'),games=read('public/app-games.js'),leisureUi=read('public/leisure-ui.js'),progUi=read('public/progression-ui.js'),leisure=read('server/leisure_service.js'),rankings=read('server/rankings.js'),rankHttp=read('server/leaderboard_http.js'),staticSvc=read('server/static_service.js'),css=read('public/styles.css')+'\n'+read('public/styles-responsive.css')+'\n'+read('public/ui-overrides.css');

const rankDecl=(app.match(/const RANK_NAMES=\{[^\n]+/)||[''])[0];
const rankPos=k=>rankDecl.indexOf(`${k}:`);
ok(rankPos('chips')>=0&&rankPos('market')>rankPos('chips')&&rankPos('fishing')>rankPos('market')&&rankPos('dice')>rankPos('fishing'),'market/fishing rank order missing');
ok(app.includes("['dice','gomoku','xiangqi','chess','go','blackjack','poker','uno','mahjong','doudizhu']"),'斗地主未移动到日麻下面');
ok(app.includes("if(typeof stopLeisureActivity==='function')stopLeisureActivity()"),'normal navigation does not stop leisure page lifecycle');
ok(leisureUi.includes('leisureEpoch')&&leisureUi.includes("leisureActive('market',epoch)")&&leisureUi.includes('stopLeisureActivity()'),'market async/timer page-instance guard missing');
ok(leisureUi.includes('<small>可用筹码</small>')&&leisureUi.includes('<small>总盈亏</small>')&&leisureUi.includes('<small>持股实时盈亏</small>')&&leisureUi.includes('<small>交易成本</small>')&&leisureUi.includes('<small>刷新</small>'),'market summary fields not consolidated');
ok(leisureUi.includes('data-market-user-save')&&leisureUi.includes('玩家虚拟交易数据'),'market per-user admin UI missing');
ok(progUi.includes('账号经验排行')&&progUi.includes('史莱姆经验排行')&&progUi.includes('accountRank')&&progUi.includes('petRank'),'account/slime XP rankings missing');
ok(games.includes("isMarket=tab==='market'")&&games.includes('已实现盈亏')&&games.includes("post('/api/leaderboards',creds()"),'market leaderboard/authenticated client load missing');
ok(rankings.includes('const market=Object.values(data.users)')&&rankings.includes('profit:Math.round(Number(u.market?.realized)||0)'),'server market leaderboard missing');
ok(rankHttp.includes("req.method!=='POST'")&&rankHttp.includes('verifiedOnly')&&rankHttp.includes("limitUser(a,'leaderboards',30,60000"),'leaderboard auth/rate boundary missing');
ok(staticSvc.includes('path.relative(publicDir,requested)')&&staticSvc.includes("rel==='..'")&&staticSvc.includes('path.isAbsolute(rel)')&&staticSvc.includes("res.writeHead(403"),'static path boundary traversal guard missing');
ok(leisure.includes('tradeCooldownMs')&&leisure.includes('maxTrades10m')&&leisure.includes("action==='market-user-set'")&&leisure.includes('marketAdminUsers()'),'market security/admin service missing');
ok(css.includes('.market-summary')&&css.includes('.growth-rank-grid')&&css.includes('.market-admin-holding')&&css.includes('.page:not(.hidden)'),'v0.4.6 layout consistency styles missing');

const leakDir=path.join(root,`public-leak-v040-${process.pid}`),leakName=path.basename(leakDir);fs.mkdirSync(leakDir,{recursive:true});fs.writeFileSync(path.join(leakDir,'secret.txt'),'SLIME_STATIC_LEAK_TEST');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slime-v040-')),port=20100+Math.floor(Math.random()*150);
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'V04001',EMPLOYEE_HASH_SECRET:'v040-test'},stdio:['ignore','pipe','pipe']});
let logs='';proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const base=`http://127.0.0.1:${port}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return r.json()}catch{}await sleep(80)}throw Error('server start timeout '+logs)}
async function req(p,{method='GET',body}={}){const r=await fetch(base+p,{method,headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json().catch(()=>({}));return {r,j}}
async function post(p,b){const q=await req(p,{method:'POST',body:b});if(!q.r.ok)throw Error(`${p}: ${q.r.status} ${q.j.error||''}`);return q.j}
try{
  const health=await wait();ok(health.version==='0.4.6','wrong live version');
  let tr=await fetch(`${base}/..%2f${encodeURIComponent(leakName)}%2fsecret.txt`);const trText=await tr.text();ok(tr.status===403&&!trText.includes('SLIME_STATIC_LEAK_TEST'),'encoded static path traversal escaped public directory');
  let q=await req('/api/leaderboards');ok(q.r.status===405,'public GET leaderboard still accessible');
  q=await req('/api/leaderboards',{method:'POST',body:{}});ok(q.r.status===401,'unauthenticated leaderboard POST accepted');
  const u=await post('/api/register',{name:'V040Owner',employeeId:'V04001',slimeColor:'mint',deviceLabel:'test'}),cred={userId:u.userId,deviceId:u.deviceId,deviceToken:u.deviceToken};
  let lb=await post('/api/leaderboards',cred);ok(Array.isArray(lb.leaderboards?.market),'market leaderboard payload missing');
  let admin=await post('/api/leisure/admin',{...cred,action:'get'});ok(Array.isArray(admin.users)&&admin.users.some(x=>x.userId===u.userId),'admin market users missing');
  await post('/api/leisure/admin',{...cred,action:'market-user-set',targetUserId:u.userId,holdings:{SLM:12},avgCost:{SLM:101.25},realized:500});
  admin=await post('/api/leisure/admin',{...cred,action:'get'});const me=admin.users.find(x=>x.userId===u.userId);ok(me?.market?.holdings?.SLM===12&&Math.abs(me.market.avgCost.SLM-101.25)<.001&&me.market.realized===500,'admin market holdings edit failed');
  lb=await post('/api/leaderboards',cred);ok(lb.leaderboards.market[0]?.userId===u.userId&&lb.leaderboards.market[0]?.profit===500,'market P/L leaderboard not derived from server state');
  q=await req('/api/leisure/market/trade',{method:'POST',body:{...cred,assetId:'SLM',side:'sell',qty:1}});ok(q.r.ok,'first market trade failed');
  q=await req('/api/leisure/market/trade',{method:'POST',body:{...cred,assetId:'SLM',side:'sell',qty:1}});ok(q.r.status===429,'rapid market trade was not rate limited');
  console.log('[OK] v0.4.6 market admin / XP rankings / navigation lifecycle / leaderboard security / trade rate limit / static path boundary');
}finally{proc.kill('SIGTERM');await sleep(120);fs.rmSync(tmp,{recursive:true,force:true});fs.rmSync(leakDir,{recursive:true,force:true})}

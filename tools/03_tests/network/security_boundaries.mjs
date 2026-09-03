import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeLeisureConfig,DEFAULT_LEISURE_CONFIG} from '../../../server/leisure_service.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const ok=(v,m)=>{if(!v)throw Error(m)};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const input=read('server/input_validation.js'),http=read('server/http_security.js'),local=read('local_server.js'),leisure=read('server/leisure_service.js'),leisureUi=read('public/leisure-ui.js'),games=read('shared/games.js'),gameUi=read('public/app-games.js'),ui=read('public/ui-enhancements.js'),css=read('public/styles.css')+'\n'+read('public/styles-responsive.css')+'\n'+read('public/ui-overrides.css');

// Static security invariants: untrusted client input must hit a server-side boundary.
ok(input.includes('directLoopbackOnly')&&input.includes("x-forwarded-for")&&local.includes("url.pathname.startsWith('/api/local-admin/')")&&local.includes('directLoopbackOnly(req)'),'local-admin direct-loopback guard missing');
ok(local.includes('validateRoomMessage')&&input.includes('GAME_ACTIONS')&&input.includes('BAD_KEYS'),'room-action schema/prototype validation missing');
ok(http.includes("'__proto__'")&&http.includes("'prototype'")&&http.includes("'constructor'")&&http.includes('65536'),'global JSON shape/body limits missing');
ok(local.includes("raw.length>16384")&&local.includes("c.msgTimes.length>=120"),'WebSocket message size/rate guard missing');
ok(local.includes("version:VERSION})")&&!local.includes("version:VERSION,port:PORT"),'health endpoint exposes unnecessary network configuration');

// Fishing must never settle from a client-provided score.
ok(leisure.includes("'/api/leisure/fishing/input'")&&leisure.includes('minPlayMs')&&leisure.includes('maxCatches10m'),'server fishing anti-cheat telemetry/cooldown missing');
ok(!/b\.score/.test(leisure)&&!leisure.includes('score:clamp(Number(b.score'),'server still trusts client fishing score');
ok(leisure.includes('x.samples<4')&&leisure.includes('elapsed<cfg.fishing.minPlayMs'),'fishing minimum play/input proof missing');

// v1 -> v2 migration changes only untouched defaults; Owner custom values survive.
const old={version:1,fishing:{...DEFAULT_LEISURE_CONFIG.fishing,fish:DEFAULT_LEISURE_CONFIG.fishing.fish.map(x=>({...x,basePrice:x.id==='sardine'?1775:(x.id==='anchovy'?90:x.basePrice)}))},market:{...DEFAULT_LEISURE_CONFIG.market,tickSeconds:45}};
const migrated=normalizeLeisureConfig(old);
ok(migrated.version===8&&migrated.fishing.fish.find(x=>x.id==='sardine')?.basePrice===1775,'custom fish price overwritten');
ok(migrated.fishing.fish.find(x=>x.id==='anchovy')?.basePrice===50,'untouched old fish price was not softly migrated');
ok(migrated.market.tickSeconds===30,'default market tick did not migrate to 30 seconds');
const customTick=normalizeLeisureConfig({...migrated,market:{...migrated.market,tickSeconds:37}});ok(customTick.market.tickSeconds===37,'custom market tick was overwritten');
const noSardine=normalizeLeisureConfig({...migrated,fishing:{...migrated.fishing,fish:migrated.fishing.fish.filter(x=>x.id!=='sardine')}});ok(!noSardine.fishing.fish.some(x=>x.id==='sardine'),'deleted fish was resurrected');

// Blackjack: cryptographic server shuffle, natural auto-resolution, re-split support and any-suit same-rank pair side bet.
ok(games.includes('crypto')&&games.includes('getRandomValues')&&games.includes('function secureRandom'),'server CSPRNG shuffle missing');
ok(games.includes("!h.blackjack")&&games.includes("h.result='Blackjack · 3:2';mult=2.5"),'natural Blackjack auto-skip/3:2 settlement missing');
ok(games.includes('maxHands:4')&&games.includes('bjSplitRank(h.cards[0])!==bjSplitRank(h.cards[1])'),'Blackjack split/re-split rules missing');
ok(games.includes("cards[0].r===cards[1].r?'pair':''")&&games.includes("kind==='pair'?12:0")&&gameUi.includes('花色不限'),'same-rank any-suit pair side bet missing');
ok(leisureUi.includes('nextTickAt')&&leisureUi.includes('marketCountdown')&&leisureUi.includes("Math.floor(sec/60)"),'30-second market countdown missing');

// Admin expansion should not refetch all users or repeatedly scan the whole app tree.
ok(gameUi.includes("if(['users','employee','games'].includes(state.adminTab))")&&gameUi.includes("post('/api/admin/users'"),'admin user fetch was not scoped to relevant tabs');
ok(ui.includes('for(const n of v038Added.splice(0))v038AddPrimaryTitles(n)')&&!ui.includes('v038Observer.observe(document.documentElement'),'admin/global MutationObserver regression');
ok(css.includes('content-visibility:auto')&&css.includes('contain-intrinsic-size'),'admin long-list rendering containment missing');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slime-v039-sec-')),port=19840+Math.floor(Math.random()*120);
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'SEC039',EMPLOYEE_HASH_SECRET:'security-test',SLIMELOUNGE_TRUST_PROXY:'1'},stdio:['ignore','pipe','pipe']});
let logs='';proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const base=`http://127.0.0.1:${port}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return r.json()}catch{}await sleep(80)}throw Error('server start timeout '+logs)}
async function req(p,{method='GET',body,headers={}}={}){const r=await fetch(base+p,{method,headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...headers},body:body===undefined?undefined:(typeof body==='string'?body:JSON.stringify(body))});const j=await r.json().catch(()=>({}));return {r,j}}
async function post(p,b){const {r,j}=await req(p,{method:'POST',body:b});if(!r.ok)throw Error(`${p}: ${r.status} ${j.error||''}`);return j}
try{
  const health=await wait();ok(health.version==='0.4.7'&&!('port' in health)&&!('trustProxy' in health),'health data minimization/version failed');
  let q=await req('/api/local-admin/users',{headers:{'x-forwarded-for':'203.0.113.8','x-forwarded-host':'example.com'}});ok(q.r.status===403,'proxied public local-admin/users was exposed');
  q=await req('/api/network/info',{headers:{'x-forwarded-for':'203.0.113.8'}});ok(q.r.status===403,'proxied network info was exposed');
  q=await req('/api/auth',{method:'POST',body:'{"constructor":{"prototype":{"polluted":true}}}'});ok(q.r.status===400,'dangerous JSON object keys were accepted');
  q=await req('/api/register',{method:'POST',body:JSON.stringify({name:'x'}) ,headers:{'content-type':'text/plain'}});ok(q.r.status===415,'non-JSON POST content type was accepted');

  const u=await post('/api/register',{name:'SecurityOwner',employeeId:'SEC039',slimeColor:'mint',deviceLabel:'test'}),cred={userId:u.userId,deviceId:u.deviceId,deviceToken:u.deviceToken};
  q=await req('/api/room/action',{method:'POST',body:{...cred,roomId:'chat-general',tabId:'sec',message:{type:'definitely_not_allowed'}}});ok(q.r.status===400,'unknown room action type was accepted');
  q=await req('/api/room/action',{method:'POST',body:{...cred,roomId:'gomoku-5',tabId:'sec',message:{type:'game_action',action:{type:'definitely_not_allowed'}}}});ok(q.r.status===400,'unknown game action type was accepted');

  await post('/api/leisure/admin',{...cred,action:'save-core',config:{fishing:{castCooldownMs:0,minPlayMs:1500,heartbeatMs:200,minCatchScore:20}}});
  let cast=await post('/api/leisure/fishing/cast',cred);
  q=await req('/api/leisure/fishing/catch',{method:'POST',body:{...cred,token:cast.token,score:100}});ok(q.r.status===409,'instant forged fishing score bypassed gameplay');
  await post('/api/leisure/fishing/abort',{...cred,token:cast.token});
  cast=await post('/api/leisure/fishing/cast',cred);
  for(let i=0;i<7;i++){await post('/api/leisure/fishing/input',{...cred,token:cast.token,hold:i%2===0});await sleep(260)}
  const caught=await post('/api/leisure/fishing/catch',{...cred,token:cast.token,score:-999999});ok(caught.caught===true&&caught.fish?.score>=20,'valid server-observed fishing did not settle independently of client score');
  q=await req('/api/leisure/fishing/catch',{method:'POST',body:{...cred,token:cast.token,score:100}});ok(q.r.status===410,'fishing token was reusable');

  console.log('[OK] v0.4.7 security boundaries / authoritative fishing / Blackjack rules+RNG / market countdown / admin rendering');
}finally{proc.kill('SIGTERM');await sleep(120);fs.rmSync(tmp,{recursive:true,force:true})}

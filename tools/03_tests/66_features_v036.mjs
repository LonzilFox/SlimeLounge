import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createGame,applyGameAction,addBotToGame} from '../../shared/games.js';
import {DEFAULT_PROGRESSION_CONFIG,normalizeProgressionConfig} from '../../server/progression.js';
import {DEFAULT_LEISURE_CONFIG,normalizeLeisureConfig} from '../../server/leisure_service.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ok=(v,m)=>{if(!v)throw Error(m)};
const games=fs.readFileSync(path.join(root,'shared/games.js'),'utf8');
const bjUi=fs.readFileSync(path.join(root,'public/app-games.js'),'utf8');
const pokerUi=fs.readFileSync(path.join(root,'public/game-poker.js'),'utf8');
const leisureUi=fs.readFileSync(path.join(root,'public/leisure-ui.js'),'utf8');
const leisureSvc=fs.readFileSync(path.join(root,'server/leisure_service.js'),'utf8');
const progression=fs.readFileSync(path.join(root,'server/progression.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

// Upgrade is patch/merge, never a reset of the Owner's current values.
const old={version:2,account:{...DEFAULT_PROGRESSION_CONFIG.account,levelXpBase:987},pet:{...DEFAULT_PROGRESSION_CONFIG.pet,feedXp:77},shop:{accessories:[{...DEFAULT_PROGRESSION_CONFIG.shop.accessories[0],price:54321},{id:'acc_owner_custom',name:'自定义',price:87654,slot:'head',asset:'/accessories/bow.svg',enabled:true}],food:[{...DEFAULT_PROGRESSION_CONFIG.shop.food[0],price:4321}],titles:[{...DEFAULT_PROGRESSION_CONFIG.shop.titles[0],price:65432}]},achievements:DEFAULT_PROGRESSION_CONFIG.achievements.filter(x=>!x.id.startsWith('fish_')&&!x.id.startsWith('market_'))};
const migrated=normalizeProgressionConfig(old);
ok(migrated.version===8&&migrated.account.levelXpBase===987&&migrated.pet.feedXp===77,'custom growth values were overwritten');
ok(migrated.shop.accessories.find(x=>x.id==='acc_bow')?.price===54321&&migrated.shop.accessories.some(x=>x.id==='acc_owner_custom'),'custom shop values/items were overwritten');
ok(migrated.shop.food.find(x=>x.id==='food_jelly')?.price===4321&&migrated.shop.titles.find(x=>x.id==='title_lounge_regular')?.price===65432,'custom food/title price was overwritten');
ok(migrated.achievements.some(x=>x.id==='fish_1')&&migrated.achievements.some(x=>x.id==='market_1'),'new achievement defaults were not appended');
const afterDelete=normalizeProgressionConfig({...migrated,shop:{...migrated.shop,accessories:migrated.shop.accessories.filter(x=>x.id!=='acc_leaf')}});
ok(!afterDelete.shop.accessories.some(x=>x.id==='acc_leaf'),'v3 admin deletion was resurrected by normalization');

const leisure=normalizeLeisureConfig({});
ok(leisure.fishing.fish.length>=12&&leisure.market.assets.length>=5,'leisure defaults missing');
const fishDeleted=normalizeLeisureConfig({...leisure,fishing:{...leisure.fishing,fish:leisure.fishing.fish.filter(x=>x.id!=='sardine')}});
ok(!fishDeleted.fishing.fish.some(x=>x.id==='sardine'),'leisure admin deletion was resurrected');

ok(pokerUi.includes('老板模式')&&pokerUi.includes('slimelounge.pokerBossMode.v1')&&pokerUi.includes('boss-token')&&pokerUi.includes('数据协作'),'poker boss mode missing');
ok(games.includes("function bjPairKind(cards){return cards?.length===2&&cards[0].r===cards[1].r?'pair':''}")&&games.includes("kind==='pair'?12:0"),'same-rank any-suit pair side bet missing');
ok(games.includes("h.result='Blackjack · 3:2';mult=2.5")&&games.includes("h.surrendered")&&games.includes('p.insurance*3'),'blackjack 3:2/surrender/insurance settlement missing');
ok(games.includes('maxBoxes:3')&&games.includes('maxHands:4')&&bjUi.includes('支持 1～3 个下注门'),'blackjack multi-box/split support missing');
ok(bjUi.includes('对子边注')&&bjUi.includes('花色不限')&&bjUi.includes('投降（输半注）')&&bjUi.includes('AI 练习'),'formal blackjack UI missing');

// A dealer-only 1v1 is real-chip mode; adding any AI switches the hand to practice mode.
{
  const s=createGame('blackjack');applyGameAction(s,'U1',{type:'join',seat:0,chips:2000});applyGameAction(s,'U1',{type:'ready'});applyGameAction(s,'U1',{type:'start'});ok(s.practice===false,'single player vs dealer incorrectly became practice mode');
}
{
  const s=createGame('blackjack');applyGameAction(s,'U1',{type:'join',seat:0,chips:2000});addBotToGame(s,1);applyGameAction(s,'U1',{type:'ready'});applyGameAction(s,'U1',{type:'start'});ok(s.practice===true&&s.practiceSnapshot?.U1===2000,'AI blackjack did not use practice snapshot');
}

ok(leisureUi.includes('fish-track')&&leisureUi.includes('market-chart')&&leisureUi.includes('完全模拟')&&html.includes('leisure-ui.js?v=0.4.4&build=044fix3'),'fishing/market client UI missing');
ok(leisureUi.includes('钓到一条 XP')&&leisureUi.includes('每笔交易 XP')&&leisureUi.includes('波动率 0~0.5'),'leisure admin controls incomplete');
ok(leisureSvc.includes('/api/leisure/fishing/sell')&&leisureSvc.includes('/api/leisure/market/trade')&&leisureSvc.includes('tradeXp'),'leisure service endpoints/config missing');
ok(progression.includes("a.u.pet.equipped[item.slot]===id?'':id"),'click-again accessory unequip toggle missing');

// Live API smoke: server rejects instant/client-scored fishing, market buy -> sell still works.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slime-v036-')),port=19360+Math.floor(Math.random()*200);
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'V036OWN',EMPLOYEE_HASH_SECRET:'v036-secret'},stdio:['ignore','pipe','pipe']});
let logs='';proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<70;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return await r.json()}catch{}await sleep(80)}throw Error('server start timeout '+logs)}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
try{
  const health=await wait();ok(health.version==='0.4.4','server version mismatch');
  const u=await post('/api/register',{name:'V036',employeeId:'V036OWN',slimeColor:'mint',deviceLabel:'test'}),cred={userId:u.userId,deviceId:u.deviceId,deviceToken:u.deviceToken};
  const st=await post('/api/leisure/state',cred);ok(st.fishing?.config?.fish?.length&&st.market?.config?.assets?.length,'leisure state unavailable');
  const cast=await post('/api/leisure/fishing/cast',cred);const instant=await fetch(`http://127.0.0.1:${port}/api/leisure/fishing/catch`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...cred,token:cast.token,score:100})});ok(instant.status===409,'instant client-scored fishing was not rejected');await post('/api/leisure/fishing/abort',{...cred,token:cast.token});
  const first=st.market.config.assets[0];const buy=await post('/api/leisure/market/trade',{...cred,assetId:first.id,side:'buy',qty:1});ok(buy.side==='buy'&&buy.qty===1,'market buy failed');
  // v0.4.4: the market has a server-side short cooldown; legitimate back-to-back trades must respect it.
  await sleep(Math.max(600,Number(st.market?.config?.tradeCooldownMs||0)+50));
  const sell=await post('/api/leisure/market/trade',{...cred,assetId:first.id,side:'sell',qty:1});ok(sell.side==='sell','market sell failed');
  const admin=await post('/api/leisure/admin',{...cred,action:'get'});ok(admin.config?.fishing?.fish?.length&&admin.config?.market?.assets?.length,'leisure admin payload missing');
  console.log('[OK] v0.4.4 poker boss / formal blackjack / server-authoritative fishing / simulated market / patch-merge config / accessory toggle');
}finally{proc.kill('SIGTERM');await sleep(120);fs.rmSync(tmp,{recursive:true,force:true})}

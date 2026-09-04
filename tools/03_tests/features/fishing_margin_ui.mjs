import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const ok=(v,m)=>{if(!v)throw Error(m)};
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const leisure=fs.readFileSync(path.join(root,'server/leisure_service.js'),'utf8');
const prog=fs.readFileSync(path.join(root,'server/progression.js'),'utf8');
const diag=fs.readFileSync(path.join(root,'server/runtime_diagnostics.js'),'utf8');
const leisureUi=fs.readFileSync(path.join(root,'public/leisure-ui.js'),'utf8');
const progUi=fs.readFileSync(path.join(root,'public/progression-ui.js'),'utf8');
const gameUi=fs.readFileSync(path.join(root,'public/app-games.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/ui-overrides.css'),'utf8');
const regression=fs.readFileSync(path.join(root,'tools/03_tests/regression/project.mjs'),'utf8');
const runner=fs.readFileSync(path.join(root,'tools/02_validation/02_run_all_checks.mjs'),'utf8');
ok(pkg.version==='0.4.7','package version is not v0.4.7');
ok(leisure.includes('heartbeatMs:650')&&leisure.includes('version:9'),'fishing request-frequency migration missing');
ok(leisure.includes("'/api/leisure/fishing/lock'")&&leisure.includes('x.locked'),'server-side fish lock missing');
ok(leisure.includes("'/api/leisure/market/order'")&&leisure.includes("'/api/leisure/market/margin'")&&leisure.includes('maxLeverage:10')&&leisure.includes('maintenanceMarginPct:20'),'simulated exchange order/margin core missing');
ok(leisure.includes('s.fairPrice=Number(s.price)')&&leisure.includes('gapToFair=clamp(Math.log')&&leisure.includes('1-Math.pow(1-cfg.market.fairPriceAlpha,scale)')&&!leisure.includes('mean=-.0015*Math.log(Math.max(.01,Number(s.price))/Math.max(.01,a.basePrice))'),'market still mean-reverts directly to initial basePrice');
ok(leisure.includes('h1:historyWindow(s,now,3600000,60000)')&&leisure.includes('d1:historyWindow(s,now,86400000,900000)')&&leisure.includes('w1:historyWindow(s,now,7*86400000,2*3600000)')&&leisure.includes('m1:historyWindow(s,now,30*86400000,6*3600000)'),'market history windows are not independently bucketed');
ok(leisureUi.includes("marketRange='h1'")&&leisureUi.includes("['h1','d1','w1','m1']")&&leisureUi.includes("marketRange==='w1'?'1周'")&&leisureUi.includes('market-y-labels')&&leisureUi.includes('market-x-labels')&&leisureUi.includes('data-margin-long')&&leisureUi.includes('data-market-order-type'),'market four-range/axis/margin UI missing');
ok(leisureUi.includes('data-fish-lock')&&leisureUi.includes('出售全部未加锁')&&leisureUi.includes('按售价低→高'),'fish lock/catalogue sort UI missing');
ok(prog.includes('chipPenaltyHungerThreshold:15')&&prog.includes('lowHungerChipCostPctPerHour:0.35')&&prog.includes('badMoodChipCostPctPerHour:0.20')&&prog.includes('maxOfflineChipPenaltyHours:24'),'pet chip penalty defaults missing');
ok(progUi.includes('低饱腹每小时消耗筹码')&&progUi.includes('互动冷却中'),'pet penalty/admin/cooldown UI missing');
ok(gameUi.includes('data-single-game-exit')&&gameUi.includes('外部音源慢响应'),'single-player exit or diagnostics distinction missing');
ok(diag.includes('isExternalWait')&&diag.includes('externalSlow'),'external music latency classification missing');
ok(css.includes('#adminView.page:not(.hidden),#shopView.page:not(.hidden){display:block')&&css.includes('z-index:9999')&&css.includes('repeat(auto-fit,minmax(min(128px,100%),1fr))')&&css.includes('@media(orientation:portrait)'),'full-page admin/shop or content-driven market responsive overrides missing');
ok(regression.includes("readFileSync(path.join(root,'package.json')")&&!regression.includes("health.version!=='0.4.7'"),'legacy regression still hardcodes release version');
ok(runner.includes('features/fishing_tetris.mjs')&&runner.includes('features/fishing_margin_ui.mjs'),'v0.4.3/v0.4.7 tests missing from npm run check');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v044-')),port=18144;let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'V044OWN',EMPLOYEE_HASH_SECRET:'v044-secret'},stdio:['ignore','pipe','pipe'],windowsHide:true});proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return await r.json()}catch{}await sleep(70)}throw Error('server timeout\n'+logs)}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
try{
 const h=await wait();ok(h.version===pkg.version,'live server/package version mismatch');
 const u=await post('/api/register',{name:'V044',employeeId:'V044OWN',slimeColor:'mint',deviceLabel:'test'}),cred={userId:u.userId,deviceId:u.deviceId,deviceToken:u.deviceToken};
 let st=await post('/api/leisure/state',cred),asset=st.market.config.assets[0];ok(asset,'no market asset');const hs=st.market.prices[asset.id]?.histories||{};ok(Array.isArray(hs.h1)&&Array.isArray(hs.d1)&&Array.isArray(hs.w1)&&Array.isArray(hs.m1),'live four-range market histories missing');
 await post('/api/leisure/admin',{...cred,action:'save-core',config:{market:{sessionStartHour:0,sessionEndHour:24,weekendClosed:false}}});
 st=await post('/api/leisure/state',cred);
 const px=Number(st.market.prices[asset.id].price);const order=await post('/api/leisure/market/order',{...cred,action:'create',assetId:asset.id,side:'buy',qty:1,limitPrice:Math.max(.01,px*.5)});ok(order.market.portfolio.orders.length===1,'limit order not stored');
 const oid=order.market.portfolio.orders[0].id;const cancelled=await post('/api/leisure/market/order',{...cred,action:'cancel',orderId:oid});ok(cancelled.market.portfolio.orders.length===0,'limit order cancel failed');
 const margin=await post('/api/leisure/market/margin',{...cred,action:'open',assetId:asset.id,side:'long',qty:1,leverage:2,stopLoss:0,takeProfit:0});ok(margin.market.portfolio.positions.length===1&&margin.market.portfolio.marginUsed>0,'cash-margin position not opened');
 const pid=margin.market.portfolio.positions[0].id;const closed=await post('/api/leisure/market/margin',{...cred,action:'close',positionId:pid});ok(closed.market.portfolio.positions.length===0,'margin close failed');
 console.log('[OK] v0.4.7 fish lock / diagnostics / pet penalty / responsive UI / limit+margin trading');
}finally{proc.kill();fs.rmSync(tmp,{recursive:true,force:true})}

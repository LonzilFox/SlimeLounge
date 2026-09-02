import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ok=(v,m)=>{if(!v)throw Error(m)};
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const leisure=fs.readFileSync(path.join(root,'server/leisure_service.js'),'utf8');
const progression=fs.readFileSync(path.join(root,'server/progression.js'),'utf8');
const single=fs.readFileSync(path.join(root,'server/single_game_service.js'),'utf8');
const extra=fs.readFileSync(path.join(root,'shared/extra_games.js'),'utf8');
const leisureUi=fs.readFileSync(path.join(root,'public/leisure-ui.js'),'utf8');
const progUi=fs.readFileSync(path.join(root,'public/progression-ui.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/ui-enhancements.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/ui-overrides.css'),'utf8');
ok(pkg.version==='0.4.6','package version is not v0.4.6');
ok(extra.indexOf("game:'tetris'")<extra.indexOf("game:'sudoku'")&&extra.indexOf("game:'sudoku'")<extra.indexOf("game:'minesweeper'"),'single-player order is not Tetris / Sudoku / Minesweeper');
ok(single.includes("'/api/game/single/result'")&&single.includes('roundToken')&&single.includes('bestScore')&&single.includes('bestMs'),'server-authoritative single-player result tracking missing');
ok(leisure.includes("rod_training")&&leisure.includes("rod_bamboo")&&leisure.includes("rod_fiberglass")&&leisure.includes("rod_iridium")&&leisure.includes("rod_advanced_iridium"),'five fishing rods missing');
ok(leisure.includes("const QUALITY_RANK={'普通':0,'铜星':1,'银星':2,'金星':3,'铱星':4}")&&leisure.includes('qualityAtMost')&&leisure.includes('x.locked'),'quality pricing / threshold sell / fish lock missing');
ok(leisureUi.includes('catchId:id')&&leisureUi.includes('fishQualityThreshold')&&leisureUi.includes('fishingRodsHtml'),'fishing lock compatibility / quality bulk sell / rods UI missing');
ok(leisure.includes("id:'AURORA'")&&leisure.includes('basePrice:5000')&&leisure.includes('volatility:0.2')&&leisure.includes('tickTrend:0.001')&&leisure.includes("id:'TITAN'")&&leisure.includes('basePrice:10000')&&leisure.includes('volatility:0.3')&&leisure.includes('tickTrend:0.0025'),'new configured stocks missing');
ok(leisure.includes('function baseTickTrend')&&leisure.includes('(1-ratio)/.5')&&leisure.includes('(ratio-1)/1')&&leisure.includes("event=Math.random()<.005?(Math.random()<.5?-1:1)"),'symmetric base-ratio tick trend / market event logic missing');
ok(leisure.includes("'/api/leisure/market/quotes'")&&leisure.includes("'/api/leisure/market/history'")&&leisure.includes('candleWindow')&&leisure.includes('history1h'),'lightweight quotes / OHLC history retention missing');
ok(leisureUi.includes('refreshMarketDynamic')&&leisureUi.includes('exportMarketHistory')&&leisureUi.includes('market-candle')&&!/if\(sec<=0\)[^}]*renderMarket\(epoch\)/.test(leisureUi),'market refresh still rebuilds the page or K-line export missing');
ok(leisureUi.includes('data-f="tickTrend"')&&leisureUi.includes('当前实际趋势'),'admin configured / live tick trend fields missing');
ok(progression.includes("version:10")&&progression.includes('title_market_operator')&&progression.includes('title_lake_legend')&&progression.includes('checkin_streak_30')&&progression.includes('market_batch_10000'),'advanced titles / achievements / v9 migration missing');
ok(progUi.includes('draggable="true"')&&progUi.includes('insertBefore(titleDrag'),'draggable title display order missing');
ok(ui.includes("'/accessories/partyhat.svg'")&&ui.includes("'/accessories/halo.svg'")&&ui.includes('accessoryPalette'),'new recolorable accessory visuals missing');
ok(css.includes('.fishing-rod-grid')&&css.includes('.fish-card .fish-card-main>*')&&css.includes('.market-candle.up')&&css.includes('repeat(auto-fit'),'v0.4.6 responsive fishing/market styles missing');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v045-')),port=18145;let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp,OWNER_EMPLOYEE_ID:'V045OWN',EMPLOYEE_HASH_SECRET:'v045-secret'},stdio:['ignore','pipe','pipe'],windowsHide:true});proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return await r.json()}catch{}await sleep(70)}throw Error('server timeout\n'+logs)}
async function post(p,b){const r=await fetch(`http://127.0.0.1:${port}${p}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(`${p}: ${j.error||r.status}`);return j}
try{
 const h=await wait();ok(h.version===pkg.version,'live version mismatch');
 const u=await post('/api/register',{name:'V045',employeeId:'V045OWN',slimeColor:'mint',deviceLabel:'test'}),cred={userId:u.userId,deviceId:u.deviceId,deviceToken:u.deviceToken};
 const st=await post('/api/leisure/state',cred),assets=st.market.config.assets,a=assets.find(x=>Number(x.basePrice)<1000)||assets[0];
 ok(st.fishing.config.rods.length>=5&&st.fishing.rods.includes('rod_training'),'rod migration / starter rod missing');
 const quotes=await post('/api/leisure/market/quotes',cred);ok(quotes.market?.prices?.[a.id]&&!('histories' in quotes.market.prices[a.id]),'quote endpoint is not lightweight');
 const hist=await post('/api/leisure/market/history',{...cred,range:'m1'});ok(Array.isArray(hist.assets?.[a.id])&&hist.assets[a.id].every(x=>['t','o','h','l','c'].every(k=>Number.isFinite(Number(x[k])))),'OHLC history endpoint malformed');
 const all=await post('/api/leisure/market/history',{...cred,range:'all'});ok(all.range==='all'&&Array.isArray(all.assets?.[a.id]),'full saved history export missing');
 const p1=await post('/api/leisure/market/margin',{...cred,action:'open',assetId:a.id,side:'long',qty:1,leverage:2});await sleep(560);
 const p2=await post('/api/leisure/market/margin',{...cred,action:'open',assetId:a.id,side:'long',qty:1,leverage:2});const ids=p2.market.portfolio.positions.map(x=>x.id);ok(ids.length===2&&new Set(ids).size===2,'same-asset margin positions not independently identified');
 const first=ids[0],second=ids[1],closed=await post('/api/leisure/market/margin',{...cred,action:'close',positionId:first}),left=closed.market.portfolio.positions;ok(left.length===1&&left[0].id===second,'closing one position affected another position');
 const entry=await post('/api/game/entry',{...cred,kind:'tetris',difficulty:'classic'});ok(entry.roundToken,'single-game round token missing');await sleep(1550);await post('/api/game/single/result',{...cred,roundToken:entry.roundToken,won:true,score:5432,lines:12});const ranks=await post('/api/leaderboards',cred);ok(ranks.leaderboards?.single?.tetris?.classic?.some(x=>x.userId===u.userId&&x.bestScore===5432&&x.games>=1),'Tetris score/completed-game leaderboard missing');
 const pr=await post('/api/progression/self',cred);ok(pr.progression.achievements.some(x=>x.id==='checkin_streak_30')&&pr.progression.shop.accessories.some(x=>x.id==='acc_sparkles')&&pr.progression.shop.titles.some(x=>x.id==='title_table_master'),'v0.4.6 shop/title/achievement payload missing');
 console.log('[OK] v0.4.6 single rankings / rods+quality fishing / titles+achievements / independent positions / dynamic OHLC market');
}finally{proc.kill();fs.rmSync(tmp,{recursive:true,force:true})}

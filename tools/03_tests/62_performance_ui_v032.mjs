import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {unreadySeatDelayMs,disconnectedSeatDelayMs,resultCleanupDelayMs} from '../../server/game_lifecycle.js';
import {publicRiichiState} from '../../shared/riichi.js';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const ok=(v,m)=>{if(!v)throw Error(m)};
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const games=fs.readFileSync(path.join(root,'public/app-games.js'),'utf8');
const music=fs.readFileSync(path.join(root,'public/music-ui.js'),'utf8');
const poker=fs.readFileSync(path.join(root,'public/game-poker.js'),'utf8');
const mj=fs.readFileSync(path.join(root,'public/game-mahjong.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8')+fs.readFileSync(path.join(root,'public/styles-responsive.css'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

ok(!html.includes('<script defer src="/music-ui.js'), 'music module should be lazy loaded');
ok(html.includes('startup-ui.js?v=0.3.4&build=034')&&html.includes('app.js?v=0.3.4&build=034')&&!html.includes('onload="this.media='), 'hotfix asset revision / CSP-safe startup loader missing');
ok(app.includes("loadFeatureScript('music-ui')")&&app.includes("loadFeatureScript('game-mahjong')"), 'lazy feature loader missing');
ok(app.includes('WebSocket RTT')&&app.includes('大厅同步 RTT')&&app.includes('clientAt:Date.now()'), 'client RTT diagnostics missing');
ok(games.includes('平均 RTT')&&games.includes('服务端 平均 / 最大'), 'admin latency diagnostics missing');
ok(music.includes('bindMusicDrawerToggle')&&!music.includes("},{once:true});bindMusicControlMirrors(c)"), 'mobile drawer still one-shot');
ok(music.includes('speaker-wave')&&css.includes('modern music volume control'), 'modern volume UI missing');
ok(poker.includes('标准最低带入：20BB')&&poker.includes('短码保护'), 'poker buy-in rule is not explicit');
ok(games.includes('轮到你准备了')&&css.includes('.ready-reminder'), 'READY reminder missing');
ok((mj.includes('const W=820,H=820')||css.includes('width:820px!important;height:820px!important'))&&css.includes('.mj-edge-rail.left'), 'riichi square table/left rail containment missing');
ok(mj.includes('bindMahjongTableFit')&&mj.includes('wrap.dataset.mjLayout')&&mj.includes('const W=820,H=820')&&css.includes('.mahjong-table-v2{width:820px!important')&&css.includes('height:820px!important'), 'riichi phone/desktop adaptive fitting missing');
ok(mj.includes('荒牌流局')&&mj.includes('mjEdgeRail')&&mj.includes('手牌已在牌桌原座位公开'), 'riichi result reveal UI missing');

const mk=n=>({seats:Array.from({length:n},(_,i)=>({userId:`U${i}`}))});
ok(unreadySeatDelayMs(mk(1))===45000&&unreadySeatDelayMs(mk(4))===75000, 'unready delay is not player-count aware');
ok(disconnectedSeatDelayMs(mk(1))===20000&&disconnectedSeatDelayMs(mk(4))===35000, 'disconnect delay is not player-count aware');
ok(resultCleanupDelayMs(mk(2))===90000&&resultCleanupDelayMs(mk(4))===130000, 'result cleanup delay is not player-count aware');

const hand=[0,1,2,3,4,5,6,7,8,9,10,11,18];
const riichi={phase:'result',resultDetail:{type:'exhaustive',tenpai:[0]},seats:[{userId:'U0',hand:[...hand],melds:[],lastDraw:null},{userId:'U1',hand:[...hand],melds:[]},{userId:'U2',hand:[...hand],melds:[]},{userId:'U3',hand:[...hand],melds:[]}],dealer:0,points:[25000,25000,25000,25000],discards:[[],[],[],[]]};
const pub=publicRiichiState(riichi,'spectator');
ok(pub.resultDetail.reveals?.[0]?.hand?.length===13, 'tenpai hand was not revealed at draw');
ok(pub.resultDetail.reveals[0].waits?.includes(18), 'tenpai waits were not exposed');
ok(pub.seats[0].hand.every(x=>x?.hidden===true), 'normal opponent hand privacy leaked');

const port=19100+Math.floor(Math.random()*600),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slime-v032-'));
const child=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
async function wait(){for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return await r.json()}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server start timeout '+logs)}
try{
  const health=await wait();ok(health.version==='0.3.4','server version mismatch');
  const a=await fetch(`http://127.0.0.1:${port}/app.js?v=0.3.4&build=034`,{headers:{'accept-encoding':'gzip'}});
  ok(a.ok,'static asset failed');ok(/immutable/.test(a.headers.get('cache-control')||''),'versioned asset is not immutable');ok((a.headers.get('content-encoding')||'').includes('gzip'),'gzip missing');
  const etag=a.headers.get('etag');ok(etag,'etag missing');await a.arrayBuffer();
  const b=await fetch(`http://127.0.0.1:${port}/app.js?v=0.3.4&build=034`,{headers:{'if-none-match':etag}});ok(b.status===304,'etag did not return 304');
  const h=await fetch(`http://127.0.0.1:${port}/`);ok((h.headers.get('cache-control')||'')==='no-cache','HTML should revalidate');
  console.log('[OK] v0.3.4 cache/gzip/lazy loading / RTT diagnostics / dynamic cleanup / READY / poker / riichi / mobile music UI');
}finally{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,120));fs.rmSync(tmp,{recursive:true,force:true})}

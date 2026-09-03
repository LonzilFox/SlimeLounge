import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGame,applyGameAction,publicGameState} from '../../../shared/games.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const ok=(v,m)=>{if(!v)throw Error(m)};
const sumChips=s=>(s.seats||[]).reduce((n,p)=>n+(Number(p?.chips)||0),0);

// Drinking dice: concealed dice, zai disables wild 1, fei restores wild and needs 2x quantity.
let d=createGame('dice');
for(const [u,seat] of [['u1',0],['u2',1]])applyGameAction(d,u,{type:'join',seat});
for(const u of ['u1','u2'])applyGameAction(d,u,{type:'ready'});
applyGameAction(d,'u1',{type:'start'});d.turnSeat=0;d.seats[0].dice=[1,2,3,4,5];d.seats[1].dice=[1,2,2,6,6];
ok(publicGameState(d,'u1').seats[1].dice.every(x=>x===0),'dice opponents were not concealed');
applyGameAction(d,'u1',{type:'call',count:3,face:2,zai:true});
let badFei=false;try{applyGameAction(d,'u2',{type:'call',count:5,face:2,fei:true})}catch{badFei=true}ok(badFei,'dice fei below 2x zai quantity was accepted');
applyGameAction(d,'u2',{type:'call',count:6,face:2,fei:true});applyGameAction(d,'u1',{type:'challenge'});
ok(d.phase==='result'&&d.winner==='u1'&&d.loser==='u2','dice challenge/zai/fei result mismatch');
ok(publicGameState(d,'u1').seats[1].dice.some(x=>x!==0),'dice were not revealed after challenge');

function allInTable(){
  const s=createGame('poker');for(const [u,seat,chips] of [['u1',0,100],['u2',1,200],['u3',2,300]])applyGameAction(s,u,{type:'join',seat,chips});
  for(const u of ['u1','u2','u3'])applyGameAction(s,u,{type:'ready'});applyGameAction(s,'u1',{type:'start'});
  while(s.phase==='preflop'&&s.turnSeat!=null)applyGameAction(s,s.seats[s.turnSeat].userId,{type:'allin'});
  ok(s.phase==='run_choice'&&s.community.length===0,'poker run choice should happen before exposing the next street');return s;
}
let p=allInTable();for(const i of [...p.runEligible])if(p.phase==='run_choice')applyGameAction(p,p.seats[i].userId,{type:'run_board',count:2});
ok(p.phase==='result'&&p.boardRuns.length===2,'poker unanimous run-twice failed');
ok(p.potBreakdown.reduce((n,x)=>n+x.amount,0)===600&&sumChips(p)===600,'poker run-twice main/side pots did not conserve chips');
ok(new Set(p.boardRuns.flat().map(c=>`${c.s}${c.r}`)).size===10,'poker run-twice reused a community card');
let one=allInTable(),ids=[...one.runEligible];applyGameAction(one,one.seats[ids[0]].userId,{type:'run_board',count:2});applyGameAction(one,one.seats[ids[1]].userId,{type:'run_board',count:1});if(one.phase==='run_choice')applyGameAction(one,one.seats[ids[2]].userId,{type:'run_board',count:2});ok(one.boardRuns.length===1,'poker did not follow the smaller run-count choice');

// Fold show/muck is privacy-sensitive and must be reflected in public state.
function foldTable(show){const s=createGame('poker');for(const [u,seat] of [['a',0],['b',1]])applyGameAction(s,u,{type:'join',seat,chips:1000});for(const u of ['a','b'])applyGameAction(s,u,{type:'ready'});applyGameAction(s,'a',{type:'start'});const actor=s.seats[s.turnSeat].userId,viewer=actor==='a'?'b':'a',cards=s.seats[s.turnSeat].cards.map(c=>`${c.s}${c.r}`).join(',');applyGameAction(s,actor,{type:'fold',show});const pub=publicGameState(s,viewer),seat=pub.seats.find(x=>x?.userId===actor);return {cards,shown:(seat.cards||[]).some(c=>c&&c.r)}}
ok(foldTable(true).shown,'fold-show did not reveal folded cards');ok(!foldTable(false).shown,'mucked folded cards were exposed');

const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8')+fs.readFileSync(path.join(root,'public/music-ui.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
const security=fs.readFileSync(path.join(root,'server/http_security.js'),'utf8');
const economy=fs.readFileSync(path.join(root,'server/economy.js'),'utf8');
const release=JSON.parse(fs.readFileSync(path.join(root,'release_notes/releases.json'),'utf8')).find(x=>x.id==='v0.2.8');
ok(app.includes("timeout:12000,retries:2")&&app.includes('不代表 Cookie 失效或被删除')&&!app.includes("el.textContent=err.message"),'music Cookie timeout UX regression');
ok(app.includes('abortWithReason')&&app.includes('isAbortLike')&&!/setTimeout\(\(\)=>ctrl\.abort\(\),\s*(?:9000|9500)\)/.test(app),'browser music requests still use reasonless AbortController cancellation');
const musicService=fs.readFileSync(path.join(root,'server/music_service.js'),'utf8');
ok(musicService.includes('abortAfter')&&musicService.includes('wasAborted')&&!/setTimeout\(\(\)=>ctrl\.abort\(\)/.test(musicService),'server music requests still expose reasonless AbortController cancellation');
ok(!app.includes('signal is aborted without reason')&&!musicService.includes('signal is aborted without reason'),'raw Chromium AbortError wording leaked into product code');
ok(app.includes("slimelounge.musicVolume.v2")&&app.includes("volumechange")&&app.includes('return .25'),'persistent music volume/default missing');
ok(/pattern="\[A-Za-z0-9\]\{6,9\}"/.test(html)&&html.includes('00XXXXXX'),'employee ID 6-9/old-user guidance missing');
ok(!readme.includes('## 更新日志')&&readme.includes('release_notes/releases.json'),'README contains changelog or release-note append docs missing');
ok(release.id==='v0.2.8'&&release.items?.length>=5,'v0.2.8 append-only release note missing');
ok(security.includes('preferredV4')&&security.includes('strict-transport-security')&&security.includes('permissions-policy'),'IPv4 preference/security headers missing');
ok(economy.includes('dailyReward:1000')&&economy.includes('entryFee'),'configurable economy/entry fee defaults missing');
ok(fs.existsSync(path.join(root,'public/favicon.ico'))&&fs.existsSync(path.join(root,'public/icon-192.png')),'favicon assets missing');
console.log('[OK] v0.2.8 dice / poker run-once-twice / fold privacy / music timeout+volume / employee / release / security');

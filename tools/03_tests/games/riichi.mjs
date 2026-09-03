import assert from 'node:assert/strict';
import {createRiichiState,riichiStartHand,riichiShanten,publicRiichiState,riichiTurnOptions,riichiReactionOptions,applyRiichiAction,RIICHI_RULE_PROFILE,riichiEvaluateHand} from '../../../shared/riichi.js';

assert.equal(RIICHI_RULE_PROFILE.startPoints,25000);assert.equal(RIICHI_RULE_PROFILE.akaDora,3);assert.equal(RIICHI_RULE_PROFILE.kuikae,false);assert.equal(RIICHI_RULE_PROFILE.multipleRon,true);assert(RIICHI_RULE_PROFILE.features.includes('番符计分'));assert(RIICHI_RULE_PROFILE.features.includes('双倍役满'));assert(RIICHI_RULE_PROFILE.features.includes('责任払い（大三元 / 大四喜包牌）'));

const winning=[0,1,2,9,10,11,18,19,20,27,27,27,31,31];
assert.equal(riichiShanten(winning),-1,'complete standard hand');
assert.equal(riichiShanten(winning.slice(0,-1)),0,'standard tenpai hand');



// Scoring regressions: seven pairs is always 25 fu; a ron-completed triplet is not concealed.
const scoreState=createRiichiState();
scoreState.doraIndicators=[];scoreState.uraIndicators=[];scoreState.discards=[[],[],[],[]];
scoreState.seats[0]={userId:'SCORE',isBot:false,ready:true,hand:[0,0,1,1,2,2,9,9,10,10,18,18,27,27],melds:[],riichi:false,ippatsu:false,doubleRiichi:false,lastDraw:27,firstTurn:false,discardCount:1};
const seven=riichiEvaluateHand(scoreState,0,{tsumo:true,winTile:27});
assert(seven,'seven-pairs score exists');assert.equal(seven.fu,25,'seven pairs fixed 25 fu');assert(seven.yaku.some(x=>x[0]==='七对子'),'seven pairs yaku');
scoreState.seats[0]={userId:'SCORE',isBot:false,ready:true,hand:[31,31,31,3,3,3,2,2,12,13,14,22,22],melds:[],riichi:false,ippatsu:false,doubleRiichi:false,lastDraw:null,firstTurn:false,discardCount:1};
const ronTrip=riichiEvaluateHand(scoreState,0,{tsumo:false,winTile:2,fromSeat:1});
assert(ronTrip,'ron score exists');assert(ronTrip.yaku.some(x=>x[0]==='役牌 白'),'yakuhai keeps the hand valid');assert(!ronTrip.yaku.some(x=>x[0]==='三暗刻'),'ron-completed triplet is not counted as concealed');


// 国士无双可以抢暗杠；其他普通牌型不能抢暗杠。
const rob=createRiichiState();
for(let i=0;i<4;i++)rob.seats[i]={userId:`R${i}`,isBot:false,ready:true,hand:[],melds:[],riichi:false,ippatsu:false,doubleRiichi:false,temporaryFuriten:false,riichiFuriten:false,lastDraw:null,lastDrawSource:null,firstTurn:false,discardCount:1,kans:0,forbiddenDiscards:[]};
rob.phase='playing';rob.turnSeat=0;rob.wall=[1,2,3,4,5,6,7,8,9,10];rob.deadWall=Array(14).fill(1);rob.doraIndicators=[1];rob.uraIndicators=[2];rob.discards=[[],[],[],[]];rob.points=[25000,25000,25000,25000];rob.turnStartedAt=Date.now();
// R0 has four East tiles to ankan; R1 has Kokushi 13-tile tenpai waiting on East (27).
rob.seats[0].hand=[27,27,27,27,1,2,3,4,5,6,7,8,9,10];rob.seats[0].lastDraw=27;
rob.seats[1].hand=[0,8,9,17,18,26,28,29,30,31,32,33,33];
rob.seats[2].hand=[0,0,1,1,2,2,3,3,4,4,5,5,6];
rob.seats[3].hand=[9,9,10,10,11,11,12,12,13,13,14,14,15];
applyRiichiAction(rob,'R0',{type:'ankan',tile:27});
assert.equal(rob.phase,'reaction','ankan opens reaction window for Kokushi');
assert(riichiReactionOptions(rob,1).some(x=>x.kind==='ron'),'Kokushi seat may rob ankan');
assert.equal(riichiReactionOptions(rob,2).some(x=>x.kind==='ron'),false,'ordinary hand may not rob ankan');
applyRiichiAction(rob,'R1',{type:'claim',kind:'ron'});
assert.equal(rob.phase,'result','Kokushi chankan resolves as ron');
assert.equal(rob.resultDetail?.type,'ron');
assert.equal(rob.resultDetail?.from,0);
assert(rob.resultDetail?.winners?.some(x=>x.seat===1),'Kokushi robber recorded as winner');


// v0.2.2: 大三元责任払い（包牌）。第三组龙牌由他家喂出并鸣牌后，喂牌者承担自摸役满全额。
const pao=createRiichiState();
for(let i=0;i<4;i++)pao.seats[i]={userId:`P${i}`,isBot:false,ready:true,hand:[],melds:[],pao:{},riichi:false,ippatsu:false,doubleRiichi:false,temporaryFuriten:false,riichiFuriten:false,lastDraw:null,lastDrawSource:null,firstTurn:false,discardCount:1,kans:0,forbiddenDiscards:[]};
pao.points=[25000,25000,25000,25000];pao.dealer=3;pao.wall=[1,2,3,4,5,6,7,8,9,10];pao.deadWall=Array(14).fill(1);pao.doraIndicators=[1];pao.uraIndicators=[2];pao.discards=[[],[{tile:33,called:false}],[],[]];
pao.seats[0].melds=[{type:'pon',tiles:[31,31,31],from:2,called:31},{type:'pon',tiles:[32,32,32],from:3,called:32}];
pao.seats[0].hand=[33,33,0,1,2,9,9];
pao.phase='reaction';pao.pending={discarder:1,tile:33,eligible:{0:[{kind:'pon',indices:[0,1]}]},responses:{},expiresAt:Date.now()+5000};
applyRiichiAction(pao,'P0',{type:'claim',kind:'pon'});
assert.equal(pao.seats[0].pao?.daisangen,1,'third open dragon set records liable seat');
pao.seats[0].hand=[0,1,2,9,9];pao.seats[0].lastDraw=9;pao.seats[0].lastDrawSource='wall';pao.phase='playing';pao.turnSeat=0;pao.turnStartedAt=Date.now();
applyRiichiAction(pao,'P0',{type:'tsumo'});
assert.equal(pao.resultDetail?.pao?.seat,1,'pao seat exposed in result detail');
assert.equal(pao.resultDetail?.pao?.reason,'大三元');
assert.equal(pao.points[1],-7000,'liable non-dealer pays full 32000 for non-dealer yakuman tsumo');
assert.equal(pao.points[2],25000,'non-liable player does not pay pao tsumo');

// v0.2.2: 四家立直/四风连打等途中流局必须让荣和优先，不能在第四张宣言牌出现时直接吞掉荣和。
const abortPriority=createRiichiState();
for(let i=0;i<4;i++)abortPriority.seats[i]={userId:`A${i}`,isBot:false,ready:true,hand:[],melds:[],pao:{},riichi:true,ippatsu:false,doubleRiichi:false,temporaryFuriten:false,riichiFuriten:false,lastDraw:null,lastDrawSource:null,firstTurn:false,discardCount:1,kans:0,forbiddenDiscards:[]};
abortPriority.points=[25000,25000,25000,25000];abortPriority.wall=[1,2,3,4,5,6,7,8,9,10];abortPriority.deadWall=Array(14).fill(1);abortPriority.doraIndicators=[5];abortPriority.uraIndicators=[6];abortPriority.discards=[[0],[9],[18],[]];abortPriority.phase='playing';abortPriority.turnSeat=0;abortPriority.turnStartedAt=Date.now();
abortPriority.seats[0].hand=[3,4,5,6,7,8,10,11,12,20,21,22,23,31];abortPriority.seats[0].lastDraw=31;
abortPriority.seats[1].hand=[0,1,2,9,10,11,18,19,20,27,27,27,31];
applyRiichiAction(abortPriority,'A0',{type:'discard',index:13});
assert.equal(abortPriority.phase,'reaction','four-riichi abort waits for ron/call priority');
assert.equal(abortPriority.pending?.abortReason,'四家立直');
assert(riichiReactionOptions(abortPriority,1).some(x=>x.kind==='ron'),'ron remains available on fourth riichi discard');
applyRiichiAction(abortPriority,'A1',{type:'claim',kind:'ron'});
assert.equal(abortPriority.resultDetail?.type,'ron','ron overrides four-riichi abort');

const s=createRiichiState();
for(let i=0;i<4;i++)s.seats[i]={userId:i===0?'HUMAN':`BOT:MJ:${i}`,isBot:i!==0,ready:true,hand:[]};
riichiStartHand(s);
assert.equal(s.phase,'playing');
assert.equal(s.points.reduce((a,b)=>a+b,0),100000);
assert.equal(s.deadWall.length,14);
assert.equal(s.wall.length,69);
assert.equal(s.seats[s.dealer].hand.length,14);
for(let i=0;i<4;i++)if(i!==s.dealer)assert.equal(s.seats[i].hand.length,13);
const all=[...s.wall,...s.deadWall,...s.seats.flatMap(x=>x.hand)];
assert.equal(all.length,136);
assert.equal(all.filter(x=>[34,35,36].includes(x)).length,3,'aka dora x3');
const pub=publicRiichiState(s,'HUMAN');
for(let i=1;i<4;i++)assert(pub.seats[i].hand.every(x=>x.hidden),'opponent hand privacy');
assert.equal(pub.seats[0].hand.some(x=>x?.hidden),false);
assert.equal(typeof riichiTurnOptions(s,s.dealer),'object');
assert.equal(Array.isArray(pub.doraIndicators),true);
console.log('[OK] riichi: rule profile / scoring / pao / abortive-draw priority / shanten / 25k / 136 tiles / aka3 / dead wall / hidden hands');

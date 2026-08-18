import {createDiceGame,applyDiceAction,addDiceBot,removeDiceBot,diceHasBot,advanceDiceBots,publicDiceState,tickDice} from './dice.js';
import {EXTRA_ROOM_DEFS,isExtraKind,createExtraGame,applyExtraGameAction,addExtraBot,removeExtraBot,extraHasBot,advanceExtraBots,publicExtraGameState,tickExtraGame} from './extra_games.js';

export const ROOM_DEFS = [
  { id:'chat-announcements', category:'chat', game:null, name:'公告', description:'管理员发布公告与重要通知', capacity:100, adminOnlyPost:true },
  { id:'chat-changelog', category:'chat', game:null, name:'更新日志', description:'版本发布记录 · Owner / Admin 可继续编辑与删除', capacity:100, adminOnlyPost:true },
  { id:'chat-general', category:'chat', game:null, name:'大厅', description:'日常聊天与所有人的公共讨论区', capacity:100 },
  { id:'chat-tech', category:'chat', game:null, name:'技术交流', description:'代码、AI、工具与技术交流', capacity:100 },
  { id:'chat-games', category:'chat', game:null, name:'游戏讨论', description:'约战、攻略、游戏闲聊', capacity:100 },
  { id:'chat-help', category:'chat', game:null, name:'求助', description:'提问、故障求助与使用问题', capacity:100 },
  { id:'chat-suggestions', category:'chat', channelType:'text', game:null, name:'建议', description:'功能建议、改进想法与反馈', capacity:100 },
  { id:'voice-lounge', category:'chat', channelType:'voice', voiceAllowed:true, game:null, name:'休息室', description:'自由语音聊天', capacity:100 },
  { id:'voice-games', category:'chat', channelType:'voice', voiceAllowed:true, game:null, name:'开黑语音', description:'游戏组队语音', capacity:100 },
  ...[['cn','华语流行','华语流行与经典'],['jp','日语 / ACG','日语、动画与游戏音乐'],['en','欧美流行','欧美流行与热门单曲'],['chill','轻音乐 / 氛围','纯音乐、Lo-Fi 与氛围音乐'],['rock','摇滚','摇滚、朋克与独立音乐'],['electronic','电子','电子、舞曲与合成器音乐']].flatMap(([key,name,description])=>Array.from({length:3},(_,i)=>({id:`music-${key}-${i+1}`,category:'music',game:null,name:`${name} ${i+1}号房`,label:`${i+1}号房`,style:name,description,capacity:50}))),
  {id:'music-other-1',category:'music',game:null,name:'其他风格 1号房',label:'1号房',style:'其他风格',description:'不限定曲风，自由点歌与发现新音乐',capacity:50},
  ...Array.from({length:5},(_,i)=>({id:`dice-${i+1}`,category:'game',game:'dice',mode:'multi',name:`摇骰子 ${i+1}号房`,capacity:6,minPlayers:2,description:'喝酒大话骰 · 每人5骰 · 斋 / 飞 / 开盅'})),
  ...Array.from({length:5},(_,i)=>({id:`gomoku-${i+1}`,category:'game',game:'gomoku',mode:'multi',name:`五子棋 ${i+1}号房`,capacity:2})),
  ...Array.from({length:3},(_,i)=>({id:`xiangqi-${i+1}`,category:'game',game:'xiangqi',mode:'multi',name:`中国象棋 ${i+1}号房`,capacity:2})),
  ...Array.from({length:3},(_,i)=>({id:`chess-${i+1}`,category:'game',game:'chess',mode:'multi',name:`国际象棋 ${i+1}号房`,capacity:2})),
  ...Array.from({length:3},(_,i)=>({id:`blackjack-${i+1}`,category:'game',game:'blackjack',mode:'multi',name:`21点 ${i+1}号房`,capacity:5,minPlayers:1})),
  ...Array.from({length:2},(_,i)=>({id:`poker-${i+1}`,category:'game',game:'poker',mode:'multi',name:`德州扑克 ${i+1}号房`,capacity:8,minPlayers:1})),  ...EXTRA_ROOM_DEFS,
];

export const ROOM_MAP = Object.fromEntries(ROOM_DEFS.map(r=>[r.id,r]));

const clone = v => JSON.parse(JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-5);
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
export const BOARD_FREE_MS=10000,BOARD_BANK_MS=200000,CARD_TURN_MS=30000,RESULT_AUTO_LEAVE_MS=60000;
function timingFields(){return {turnStartedAt:0,timeBanks:[BOARD_BANK_MS,BOARD_BANK_MS],turnFreeMs:BOARD_FREE_MS,bankInitialMs:BOARD_BANK_MS,finishedAt:0};}
function setTimeControl(s,freeMs,bankMs){if(s.started)throw Error('对局开始后不能修改思考时间');const f=clamp(Math.round(Number(freeMs)||BOARD_FREE_MS),1000,60000),b=clamp(Math.round(Number(bankMs)||BOARD_BANK_MS),30000,1800000);s.turnFreeMs=f;s.bankInitialMs=b;s.timeBanks=[b,b];s.turnStartedAt=0;return s;}
function boardClockRemaining(s,side,now=Date.now()){const bank=(s.timeBanks?.[side]??BOARD_BANK_MS);if(!s.started||s.turn!==side||!s.turnStartedAt)return bank;return Math.max(0,bank-Math.max(0,now-s.turnStartedAt-(s.turnFreeMs||BOARD_FREE_MS)));}
function consumeBoardClock(s,side,now=Date.now()){const remain=boardClockRemaining(s,side,now);s.timeBanks[side]=remain;if(remain<=0){const other=s.players?.[1-side];if(other)s.winner=other;s.result='time_forfeit';s.started=false;s.finishedAt=now;return false}return true;}
function startTurnClock(s,now=Date.now()){s.turnStartedAt=now;}

export const BOT_PREFIX='BOT:';
export const isBotId=v=>typeof v==='string'&&v.startsWith(BOT_PREFIX);
const botId=(kind)=>`${BOT_PREFIX}${kind}:${uid()}`;

function shuffle(deck, rnd=Math.random){
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  return deck;
}

function stdDeck(){
  const suits=['S','H','D','C']; const ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return suits.flatMap(s=>ranks.map(r=>({s,r,id:`${r}${s}`})));
}
function cardValueRank(r){return r==='A'?14:r==='K'?13:r==='Q'?12:r==='J'?11:Number(r)}

// ---------------- Gomoku ----------------
export function createGomoku(){
  return {kind:'gomoku',board:Array.from({length:15},()=>Array(15).fill(null)),players:[null,null],ready:[false,false],started:false,turn:1,winner:null,result:null,last:null,round:1,...timingFields()};
}
function gomokuWin(board,x,y,c){
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    let n=1;
    for(const sign of [-1,1]){let xx=x+dx*sign,yy=y+dy*sign;while(xx>=0&&xx<15&&yy>=0&&yy<15&&board[yy][xx]===c){n++;xx+=dx*sign;yy+=dy*sign;}}
    if(n>=5)return true;
  }
  return false;
}

function boardReadyMaybeStart(s){
  const was=!!s.started;if(!s.players.every(Boolean)){s.started=false;s.turnStartedAt=0;return false;}
  for(let i=0;i<2;i++)if(isBotId(s.players[i]))s.ready[i]=true;
  s.started=s.players.every((p,i)=>p&&(isBotId(p)||s.ready[i]));
  if(s.started&&!was)startTurnClock(s);
  return s.started;
}
function boardJoin(s,userId,seat=null){
  if(!s.players.includes(userId)){const i=Number.isInteger(seat)?seat:s.players.findIndex(x=>!x);if(i<0||i>1||s.players[i])throw Error('座位不可用');s.players[i]=userId;s.ready[i]=isBotId(userId);}
  boardReadyMaybeStart(s);
}
function boardLeave(s,userId){const i=s.players.indexOf(userId);if(i>=0){if(s.started&&!s.winner&&!s.result&&s.players[1-i]){s.winner=s.players[1-i];s.result='forfeit';s.finishedAt=Date.now()}s.players[i]=null;s.ready[i]=false;s.started=false;s.turnStartedAt=0;}}
function boardReady(s,userId){const i=s.players.indexOf(userId);if(i<0)throw Error('请先加入座位');if(isBotId(userId))return;s.ready[i]=!s.ready[i];boardReadyMaybeStart(s);}
function boardResetReady(s){for(let i=0;i<2;i++)s.ready[i]=!!(s.players[i]&&isBotId(s.players[i]));s.started=false;s.timeBanks=[s.bankInitialMs||BOARD_BANK_MS,s.bankInitialMs||BOARD_BANK_MS];s.finishedAt=0;s.turnStartedAt=0;boardReadyMaybeStart(s);}
function gomokuAction(s,userId,a){
  if(a.type==='join'){boardJoin(s,userId,Number.isInteger(a.seat)?a.seat:null);return;}
  if(a.type==='leave'){boardLeave(s,userId);return;}
  if(a.type==='resign'){const i=s.players.indexOf(userId);if(i<0||!s.started)throw Error('当前不能认输');s.winner=s.players[1-i];s.result='resign';s.started=false;s.finishedAt=Date.now();return;}
  if(a.type==='ready'){boardReady(s,userId);return;}
  if(a.type==='set_time_control'){if(!s.players.includes(userId))throw Error('只有本桌玩家可修改思考时间');setTimeControl(s,a.freeMs,a.bankMs);return;}
  if(a.type==='reset'){
    if(!s.players.includes(userId))throw Error('只有玩家可以重开');
    s.board=Array.from({length:15},()=>Array(15).fill(null));s.turn=1;s.winner=null;s.result=null;s.last=null;s.round++;boardResetReady(s);return;
  }
  if(a.type==='place'){
    const pi=s.players.indexOf(userId);if(pi<0)throw Error('你不是本桌玩家');if(s.players.some(x=>!x))throw Error('等待第二位玩家');if(!s.started)throw Error('所有真人玩家准备后才能开始');if(s.winner)throw Error('本局已结束');if(pi!==s.turn)throw Error('还没轮到你');
    if(!consumeBoardClock(s,pi))return;const x=Number(a.x),y=Number(a.y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=15||y<0||y>=15)throw Error('坐标无效');if(s.board[y][x])throw Error('这里已经有棋子');
    const c=pi===0?'W':'B';s.board[y][x]=c;s.last={x,y,c};if(gomokuWin(s.board,x,y,c)){s.winner=userId;s.started=false;s.finishedAt=Date.now();}else{s.turn=1-s.turn;startTurnClock(s);}return;
  }
  throw Error('未知操作');
}

// ---------------- Xiangqi ----------------
const XQ = {R:'车',N:'马',B:'相',A:'仕',K:'帅',C:'炮',P:'兵',r:'车',n:'马',b:'象',a:'士',k:'将',c:'炮',p:'卒'};
export function createXiangqi(){
  const b=Array.from({length:10},()=>Array(9).fill(null));
  const top=['r','n','b','a','k','a','b','n','r']; const bot=['R','N','B','A','K','A','B','N','R'];
  b[0]=top.slice();b[2][1]='c';b[2][7]='c';[0,2,4,6,8].forEach(x=>b[3][x]='p');
  b[9]=bot.slice();b[7][1]='C';b[7][7]='C';[0,2,4,6,8].forEach(x=>b[6][x]='P');
  const s={kind:'xiangqi',board:b,players:[null,null],ready:[false,false],started:false,turn:0,winner:null,result:null,check:false,last:null,round:1,history:[],undoRequest:null,positionCounts:{},...timingFields()};s.positionCounts[xqPositionKey(s.board,s.turn)]=1;return s;
}
const xqSide=p=>!p?null:(p===p.toUpperCase()?0:1);
function xqPositionKey(board,turn){return `${board.map(r=>r.map(x=>x||'.').join('')).join('/')}|${turn}`}
const inXq=(x,y)=>x>=0&&x<9&&y>=0&&y<10;
const palace=(side,x,y)=>x>=3&&x<=5&&(side===0?y>=7&&y<=9:y>=0&&y<=2);
function xqPathCount(b,x1,y1,x2,y2){let n=0;if(x1===x2){for(let y=Math.min(y1,y2)+1;y<Math.max(y1,y2);y++)if(b[y][x1])n++;}else if(y1===y2){for(let x=Math.min(x1,x2)+1;x<Math.max(x1,x2);x++)if(b[y1][x])n++;}else return -1;return n;}
function xqPseudo(b,x1,y1,x2,y2){
  if(!inXq(x2,y2)|| (x1===x2&&y1===y2))return false; const p=b[y1][x1]; if(!p)return false; const side=xqSide(p),t=b[y2][x2]; if(t&&xqSide(t)===side)return false;
  const k=p.toLowerCase(),dx=x2-x1,dy=y2-y1,adx=Math.abs(dx),ady=Math.abs(dy);
  if(k==='r')return (x1===x2||y1===y2)&&xqPathCount(b,x1,y1,x2,y2)===0;
  if(k==='c'){const c=xqPathCount(b,x1,y1,x2,y2);return t?c===1:c===0;}
  if(k==='n'){
    if(!((adx===1&&ady===2)||(adx===2&&ady===1)))return false;
    const bx=adx===2?x1+Math.sign(dx):x1, by=ady===2?y1+Math.sign(dy):y1;
    return !b[by][bx];
  }
  if(k==='b'){
    if(adx!==2||ady!==2)return false; if(side===0&&y2<5)return false;if(side===1&&y2>4)return false; return !b[y1+dy/2][x1+dx/2];
  }
  if(k==='a')return adx===1&&ady===1&&palace(side,x2,y2);
  if(k==='k'){
    if(palace(side,x2,y2)&&adx+ady===1)return true;
    if(x1===x2&&t&&t.toLowerCase()==='k'&&xqPathCount(b,x1,y1,x2,y2)===0)return true;
    return false;
  }
  if(k==='p'){
    const f=side===0?-1:1; const crossed=side===0?y1<=4:y1>=5;
    if(dx===0&&dy===f)return true; if(crossed&&ady===0&&adx===1)return true; return false;
  }
  return false;
}
function xqFindGeneral(b,side){const k=side===0?'K':'k';for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]===k)return [x,y];return null;}
function xqAttacked(b,x,y,bySide){for(let yy=0;yy<10;yy++)for(let xx=0;xx<9;xx++)if(b[yy][xx]&&xqSide(b[yy][xx])===bySide&&xqPseudo(b,xx,yy,x,y))return true;return false;}
function xqLegal(b,x1,y1,x2,y2){if(!xqPseudo(b,x1,y1,x2,y2))return false;const p=b[y1][x1],side=xqSide(p),target=b[y2][x2];if(target&&target.toLowerCase()==='k')return false;const nb=clone(b);nb[y2][x2]=nb[y1][x1];nb[y1][x1]=null;const g=xqFindGeneral(nb,side);return !!g&&!xqAttacked(nb,g[0],g[1],1-side);}
function xqHasMove(b,side){for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]&&xqSide(b[y][x])===side)for(let yy=0;yy<10;yy++)for(let xx=0;xx<9;xx++)if(xqLegal(b,x,y,xx,yy))return true;return false;}
function xqSnapshot(s,mover){return {mover,board:clone(s.board),turn:s.turn,winner:s.winner,result:s.result,check:s.check,last:clone(s.last),started:s.started,positionCounts:clone(s.positionCounts||{}),timeBanks:(s.timeBanks||[]).slice(),turnStartedAt:s.turnStartedAt,finishedAt:s.finishedAt}}
function xqRestore(s,h){s.board=clone(h.board);s.turn=h.turn;s.winner=h.winner;s.result=h.result;s.check=h.check;s.last=clone(h.last);s.started=h.started;s.positionCounts=clone(h.positionCounts||{});s.timeBanks=(h.timeBanks||[]).slice();s.turnStartedAt=h.turnStartedAt;s.finishedAt=h.finishedAt;s.undoRequest=null}
function xqCanUndoFor(s,userId){const pi=s.players.indexOf(userId);if(pi<0||!s.started||!s.history?.length)return false;const last=s.history.at(-1);if(last?.mover===userId)return true;const opp=s.players[1-pi];return isBotId(opp)&&last?.mover===opp&&s.history.at(-2)?.mover===userId}

function xiangqiAction(s,userId,a){
  if(a.type==='join'){boardJoin(s,userId,Number.isInteger(a.seat)?a.seat:null);return;}
  if(a.type==='leave'){boardLeave(s,userId);return;}
  if(a.type==='resign'){const i=s.players.indexOf(userId);if(i<0||!s.started)throw Error('当前不能认输');s.winner=s.players[1-i];s.result='resign';s.started=false;s.finishedAt=Date.now();return;}
  if(a.type==='ready'){boardReady(s,userId);return;}
  if(a.type==='set_time_control'){if(!s.players.includes(userId))throw Error('只有本桌玩家可修改思考时间');setTimeControl(s,a.freeMs,a.bankMs);return;}
  if(a.type==='reset'){const fresh=createXiangqi();s.board=fresh.board;s.winner=null;s.result=null;s.check=false;s.last=null;s.turn=0;s.history=[];s.undoRequest=null;s.positionCounts=fresh.positionCounts;s.round++;boardResetReady(s);return;}
  if(a.type==='undo_request'){
    const pi=s.players.indexOf(userId);if(pi<0||!s.started)throw Error('当前不能悔棋');if(!xqCanUndoFor(s,userId))throw Error('当前没有可悔的一步');const opp=1-pi;
    if(isBotId(s.players[opp])){let h=s.history.pop();xqRestore(s,h);if(s.turn!==pi&&s.history.length){h=s.history.pop();xqRestore(s,h)}if(s.started)startTurnClock(s);s.message='已悔一步（AI 对局回退双方最近一手）';return;}
    s.undoRequest={from:pi,to:opp,requestedAt:Date.now()};return;
  }
  if(a.type==='undo_accept'||a.type==='undo_reject'){
    const pi=s.players.indexOf(userId),r=s.undoRequest;if(pi<0||!r||r.to!==pi)throw Error('当前没有需要你处理的悔棋申请');if(a.type==='undo_reject'){s.undoRequest=null;return;}const h=s.history.pop();if(!h)throw Error('没有可恢复的棋步');xqRestore(s,h);if(s.started)startTurnClock(s);return;
  }
  if(a.type==='move'){
    const pi=s.players.indexOf(userId);if(pi<0)throw Error('你不是本桌玩家');if(s.players.some(x=>!x))throw Error('等待第二位玩家');if(!s.started)throw Error('所有真人玩家准备后才能开始');if(s.winner)throw Error('本局已结束');if(pi!==s.turn)throw Error('还没轮到你');
    const {x1,y1,x2,y2}=a;if(![x1,y1,x2,y2].every(Number.isInteger))throw Error('坐标无效');const p=s.board[y1]?.[x1];if(!p||xqSide(p)!==pi)throw Error('请选择自己的棋子');if(!xqLegal(s.board,x1,y1,x2,y2))throw Error('这步不合法');const preview=clone(s.board),captured=preview[y2][x2];preview[y2][x2]=preview[y1][x1];preview[y1][x1]=null;const nextTurn=1-pi,g0=xqFindGeneral(preview,nextTurn),willCheck=g0?xqAttacked(preview,g0[0],g0[1],pi):true,key=xqPositionKey(preview,nextTurn);if(willCheck&&(s.positionCounts?.[key]||0)>=2)throw Error('禁止长将：不能用连续将军形成第三次相同局面，请改走其他棋步');if(!consumeBoardClock(s,pi))return;
    s.history=s.history||[];s.history.push(xqSnapshot(s,userId));if(s.history.length>24)s.history.shift();s.undoRequest=null;s.board=preview;s.last={x1,y1,x2,y2,p,captured,by:userId};s.turn=nextTurn;s.positionCounts||={};s.positionCounts[key]=(s.positionCounts[key]||0)+1;const opp=s.turn,g=xqFindGeneral(s.board,opp),checked=g?xqAttacked(s.board,g[0],g[1],1-opp):true;s.check=checked;if(!xqHasMove(s.board,opp)){s.winner=userId;s.result=checked?'checkmate':'stalemate_loss';s.started=false;s.finishedAt=Date.now();}else startTurnClock(s);return;
  }
  throw Error('未知操作');
}

// ---------------- Chess ----------------
export function createChess(){
  const b=Array.from({length:8},()=>Array(8).fill(null));
  b[0]=['br','bn','bb','bq','bk','bb','bn','br'];b[1]=Array(8).fill('bp');b[6]=Array(8).fill('wp');b[7]=['wr','wn','wb','wq','wk','wb','wn','wr'];
  const s={kind:'chess',board:b,players:[null,null],ready:[false,false],started:false,turn:0,winner:null,result:null,check:false,last:null,castle:{wK:true,wQ:true,bK:true,bQ:true},ep:null,halfmoveClock:0,positionCounts:{},round:1,...timingFields()};
  s.positionCounts[chPositionKey(s)]=1;return s;
}
const chSide=p=>p?.[0]==='w'?0:p?.[0]==='b'?1:null; const chType=p=>p?.[1]; const inCh=(x,y)=>x>=0&&x<8&&y>=0&&y<8;
function chPositionKey(s){const board=s.board.map(r=>r.map(x=>x||'--').join(',')).join('/'),castle=['wK','wQ','bK','bQ'].filter(k=>s.castle?.[k]).join('')||'-',ep=s.ep?`${s.ep.x},${s.ep.y}`:'-';return `${board}|${s.turn}|${castle}|${ep}`;}
function chInsufficient(s){const pieces=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=s.board[y][x];if(p&&chType(p)!=='k')pieces.push({p,x,y,t:chType(p)});}if(!pieces.length)return true;if(pieces.length===1&&['b','n'].includes(pieces[0].t))return true;if(pieces.every(x=>x.t==='b')){const colors=new Set(pieces.map(x=>(x.x+x.y)&1));if(colors.size===1)return true;}return false;}
function chDrawClaim(s){const key=chPositionKey(s),reps=s.positionCounts?.[key]||0;return {threefold:reps>=3,fifty:(s.halfmoveClock||0)>=100,repetitions:reps};}
function chPathClear(b,x1,y1,x2,y2){const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1);let x=x1+dx,y=y1+dy;while(x!==x2||y!==y2){if(b[y][x])return false;x+=dx;y+=dy;}return true;}
function chPseudo(s,x1,y1,x2,y2,attacksOnly=false){
  const b=s.board,p=b[y1]?.[x1];if(!p||!inCh(x2,y2)||(x1===x2&&y1===y2))return false;const side=chSide(p),t=b[y2][x2];if(t&&chSide(t)===side)return false;const type=chType(p),dx=x2-x1,dy=y2-y1,adx=Math.abs(dx),ady=Math.abs(dy);
  if(type==='p'){
    const f=side===0?-1:1,start=side===0?6:1;if(attacksOnly)return adx===1&&dy===f;
    if(dx===0&&dy===f&&!t)return true;if(dx===0&&dy===2*f&&y1===start&&!t&&!b[y1+f][x1])return true;
    if(adx===1&&dy===f&&(t|| (s.ep&&s.ep.x===x2&&s.ep.y===y2)))return true;return false;
  }
  if(type==='n')return (adx===1&&ady===2)||(adx===2&&ady===1);
  if(type==='b')return adx===ady&&chPathClear(b,x1,y1,x2,y2);
  if(type==='r')return (dx===0||dy===0)&&chPathClear(b,x1,y1,x2,y2);
  if(type==='q')return (dx===0||dy===0||adx===ady)&&chPathClear(b,x1,y1,x2,y2);
  if(type==='k'){
    if(adx<=1&&ady<=1)return true;if(attacksOnly)return false;
    if(dy===0&&adx===2){const key=(side===0?'w':'b')+(dx>0?'K':'Q');if(!s.castle[key])return false;const rookX=dx>0?7:0;const step=Math.sign(dx);for(let x=x1+step;x!==rookX;x+=step)if(b[y1][x])return false;return true;} return false;
  }
  return false;
}
function chFindKing(b,side){const k=side===0?'wk':'bk';for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(b[y][x]===k)return [x,y];return null;}
function chAttacked(s,x,y,bySide){for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)if(s.board[yy][xx]&&chSide(s.board[yy][xx])===bySide&&chPseudo(s,xx,yy,x,y,true))return true;return false;}
function chApplyCopy(s,x1,y1,x2,y2,promotion='q'){
  const ns=clone(s),b=ns.board,p=b[y1][x1],side=chSide(p),type=chType(p),t=b[y2][x2];ns.ep=null;
  if(type==='p'&&x1!==x2&&!t&&s.ep&&s.ep.x===x2&&s.ep.y===y2)b[y1][x2]=null;
  b[y2][x2]=p;b[y1][x1]=null;
  if(type==='p'&&Math.abs(y2-y1)===2)ns.ep={x:x1,y:(y1+y2)/2};
  if(type==='p'&&(y2===0||y2===7))b[y2][x2]=(side===0?'w':'b')+(['q','r','b','n'].includes(promotion)?promotion:'q');
  if(type==='k'&&Math.abs(x2-x1)===2){const rookFrom=x2>x1?7:0,rookTo=x2>x1?5:3;b[y1][rookTo]=b[y1][rookFrom];b[y1][rookFrom]=null;}
  if(p==='wk'){ns.castle.wK=false;ns.castle.wQ=false;}if(p==='bk'){ns.castle.bK=false;ns.castle.bQ=false;}
  if(p==='wr'&&y1===7&&x1===0)ns.castle.wQ=false;if(p==='wr'&&y1===7&&x1===7)ns.castle.wK=false;if(p==='br'&&y1===0&&x1===0)ns.castle.bQ=false;if(p==='br'&&y1===0&&x1===7)ns.castle.bK=false;
  if(t==='wr'&&y2===7&&x2===0)ns.castle.wQ=false;if(t==='wr'&&y2===7&&x2===7)ns.castle.wK=false;if(t==='br'&&y2===0&&x2===0)ns.castle.bQ=false;if(t==='br'&&y2===0&&x2===7)ns.castle.bK=false;
  return ns;
}
function chLegal(s,x1,y1,x2,y2,promotion='q'){
  const p=s.board[y1]?.[x1];if(!p||!chPseudo(s,x1,y1,x2,y2,false))return false;const target=s.board[y2]?.[x2];if(target&&chType(target)==='k')return false;const side=chSide(p),type=chType(p);
  if(type==='k'&&Math.abs(x2-x1)===2){if(chAttacked(s,x1,y1,1-side))return false;const mid=x1+Math.sign(x2-x1);const tmp=chApplyCopy(s,x1,y1,mid,y1,promotion);const kg=chFindKing(tmp.board,side);if(!kg||chAttacked(tmp,kg[0],kg[1],1-side))return false;}
  const ns=chApplyCopy(s,x1,y1,x2,y2,promotion),k=chFindKing(ns.board,side);return !!k&&!chAttacked(ns,k[0],k[1],1-side);
}
function chHasMove(s,side){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(s.board[y][x]&&chSide(s.board[y][x])===side)for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)if(chLegal(s,x,y,xx,yy))return true;return false;}
function chessAction(s,userId,a){
  if(a.type==='join'){boardJoin(s,userId,Number.isInteger(a.seat)?a.seat:null);return;}
  if(a.type==='leave'){boardLeave(s,userId);return;}
  if(a.type==='resign'){const i=s.players.indexOf(userId);if(i<0||!s.started)throw Error('当前不能认输');s.winner=s.players[1-i];s.result='resign';s.started=false;s.finishedAt=Date.now();return;}
  if(a.type==='ready'){boardReady(s,userId);return;}
  if(a.type==='set_time_control'){if(!s.players.includes(userId))throw Error('只有本桌玩家可修改思考时间');setTimeControl(s,a.freeMs,a.bankMs);return;}
  if(a.type==='reset'){const tc={turnFreeMs:s.turnFreeMs,bankInitialMs:s.bankInitialMs};const fresh=createChess();Object.assign(s,fresh,{players:s.players.slice(),ready:s.ready.slice(),turn:0,round:s.round+1,...tc});boardResetReady(s);return;}
  if(a.type==='claim_draw'){const pi=s.players.indexOf(userId);if(pi<0||!s.started||s.turn!==pi)throw Error('只能在自己的回合申请和棋');const c=chDrawClaim(s);if(!c.threefold&&!c.fifty)throw Error('当前不满足三次重复或50回合和棋条件');s.result=c.threefold?'threefold':'fifty_move';s.started=false;s.finishedAt=Date.now();return;}
  if(a.type==='move'){
    const pi=s.players.indexOf(userId);if(pi<0)throw Error('你不是本桌玩家');if(s.players.some(x=>!x))throw Error('等待第二位玩家');if(!s.started)throw Error('所有真人玩家准备后才能开始');if(s.winner||s.result)throw Error('本局已结束');if(pi!==s.turn)throw Error('还没轮到你');if(!consumeBoardClock(s,pi))return;const{x1,y1,x2,y2}=a;const p=s.board[y1]?.[x1];if(!p||chSide(p)!==pi)throw Error('请选择自己的棋子');if(!chLegal(s,x1,y1,x2,y2,a.promotion))throw Error('这步不合法');
    const target=s.board[y2]?.[x2],epCapture=chType(p)==='p'&&x1!==x2&&!target&&s.ep&&s.ep.x===x2&&s.ep.y===y2,capture=!!target||epCapture,pawn=chType(p)==='p';const ns=chApplyCopy(s,x1,y1,x2,y2,a.promotion);ns.last={x1,y1,x2,y2,p};ns.turn=1-s.turn;ns.halfmoveClock=(pawn||capture)?0:(s.halfmoveClock||0)+1;ns.positionCounts={...(s.positionCounts||{})};const key=chPositionKey(ns);ns.positionCounts[key]=(ns.positionCounts[key]||0)+1;Object.assign(s,ns);
    const opp=s.turn,k=chFindKing(s.board,opp),checked=k?chAttacked(s,k[0],k[1],1-opp):true;s.check=checked;if(!chHasMove(s,opp)){if(checked){s.winner=userId;s.result='checkmate';}else s.result='stalemate';s.started=false;s.finishedAt=Date.now();return;}if(chInsufficient(s)){s.result='insufficient';s.started=false;s.finishedAt=Date.now();return;}const reps=s.positionCounts[chPositionKey(s)]||0;if(reps>=5){s.result='fivefold';s.started=false;s.finishedAt=Date.now();return;}if((s.halfmoveClock||0)>=150){s.result='seventyfive_move';s.started=false;s.finishedAt=Date.now();return;}startTurnClock(s);return;
  }
  throw Error('未知操作');
}

// ---------------- Blackjack ----------------
function bjValue(cards){let total=0,aces=0;for(const c of cards){if(c.r==='A'){aces++;total+=11;}else total+=Math.min(10,cardValueRank(c.r));}while(total>21&&aces){total-=10;aces--;}return total;}
export function createBlackjack(){return {kind:'blackjack',seats:Array(5).fill(null),phase:'waiting',dealer:[],deck:[],turnSeat:null,turnStartedAt:0,turnTimeoutMs:CARD_TURN_MS,finishedAt:0,defaultStack:2000,betMin:10,betMax:200,defaultBet:20,message:'等待 1~5 位玩家入座',handNo:1};}
function bjSeat(s,userId){return s.seats.findIndex(x=>x?.userId===userId)}
function bjStart(s){
  const occupied=s.seats.filter(Boolean);if(occupied.length<1)throw Error('至少需要 1 位玩家');if(occupied.some(x=>!x.isBot&&!isBotId(x.userId)&&!x.ready))throw Error('所有真人玩家都准备后才能开始');const active=occupied.filter(x=>x.ready&&x.chips>0);if(active.length<1)throw Error('至少需要 1 位可参与玩家');s.practice=active.some(x=>x.isBot||isBotId(x.userId));s.practiceSnapshot=s.practice?Object.fromEntries(s.seats.filter(x=>x&&!x.isBot&&!isBotId(x.userId)).map(x=>[x.userId,x.chips])):null;s.deck=shuffle(stdDeck());s.dealer=[s.deck.pop(),s.deck.pop()];
  for(const seat of s.seats)if(seat){seat.hand=[];seat.result=null;seat.stood=false;seat.busted=false;if(seat.ready&&seat.chips>0){seat.bet=clamp(Number(seat.bet)||s.defaultBet||20,s.betMin||10,Math.min(s.betMax||200,seat.chips));seat.chips-=seat.bet;seat.hand=[s.deck.pop(),s.deck.pop()];seat.blackjack=bjValue(seat.hand)===21;seat.stood=seat.blackjack;}else{seat.hand=[];seat.blackjack=false;}}
  s.phase='playing';s.turnSeat=s.seats.findIndex(x=>x?.ready&&x.hand.length&&!x.stood&&!x.busted);s.turnStartedAt=Date.now();s.finishedAt=0;s.message='本局开始';if(s.turnSeat<0)bjDealer(s);
}
function bjAdvance(s){let i=s.turnSeat;for(let n=0;n<5;n++){i=(i+1)%5;const p=s.seats[i];if(p?.ready&&p.hand.length&&!p.stood&&!p.busted){s.turnSeat=i;s.turnStartedAt=Date.now();return;}}bjDealer(s);}
function bjDealer(s){s.phase='dealer';const dealerBlackjack=s.dealer.length===2&&bjValue(s.dealer)===21;if(!dealerBlackjack)while(bjValue(s.dealer)<17)s.dealer.push(s.deck.pop());const dv=bjValue(s.dealer);for(const p of s.seats)if(p?.ready&&p.hand.length){const v=bjValue(p.hand),natural=p.hand.length===2&&v===21;let mult=0;if(v>21){p.result='爆牌';mult=0;}else if(dealerBlackjack){if(natural){p.result='Blackjack 平局';mult=1}else{p.result='庄家 Blackjack';mult=0}}else if(natural){p.result='Blackjack · 3:2';mult=2.5}else if(dv>21||v>dv){p.result='胜';mult=2;}else if(v===dv){p.result='平';mult=1}else{p.result='负';mult=0}p.chips+=Math.floor(p.bet*mult);p.ready=(p.isBot||isBotId(p.userId));}if(s.practice&&s.practiceSnapshot){for(const p of s.seats)if(p){if(p.isBot||isBotId(p.userId))p.chips=s.defaultStack||2000;else if(s.practiceSnapshot[p.userId]!=null)p.chips=s.practiceSnapshot[p.userId];}}s.phase='result';s.turnSeat=null;s.turnStartedAt=0;s.finishedAt=Date.now();s.message=`庄家 ${dealerBlackjack?'Blackjack':dv>21?'爆牌':dv}，本局结束`;s.handNo++;}
function blackjackAction(s,userId,a){
  if(a.type==='join'){
    let i=bjSeat(s,userId);if(i<0){i=Number.isInteger(a.seat)?a.seat:s.seats.findIndex(x=>!x);if(i<0||i>=s.seats.length||s.seats[i])throw Error('座位不可用');s.seats[i]={userId,chips:clamp(Number(a.chips)||s.defaultStack||2000,0,100000000),bet:s.defaultBet||20,ready:false,hand:[],stood:false,busted:false,result:null};}return;
  }
  if(a.type==='leave'){const i=bjSeat(s,userId);if(i>=0){if(s.phase==='playing'&&s.turnSeat===i){s.seats[i]=null;bjAdvance(s);}else s.seats[i]=null;}return;}
  const i=bjSeat(s,userId);if(i<0)throw Error('请先入座');const p=s.seats[i];
  if(a.type==='bet'){if(s.phase==='playing'||s.phase==='dealer')throw Error('本局进行中');p.bet=clamp(Number(a.amount)||s.defaultBet||20,s.betMin||10,Math.min(s.betMax||200,p.chips));return;}
  if(a.type==='ready'){if(s.phase==='playing'||s.phase==='dealer')throw Error('本局进行中');p.ready=!p.ready;if(s.phase==='result')s.phase='waiting';return;}
  if(a.type==='start'){if(!['waiting','result'].includes(s.phase))throw Error('本局进行中');bjStart(s);return;}
  if(a.type==='hit'){if(s.phase!=='playing'||s.turnSeat!==i)throw Error('还没轮到你');p.hand.push(s.deck.pop());const v=bjValue(p.hand);if(v>21){p.busted=true;p.result='爆牌';bjAdvance(s);}else if(v===21){p.stood=true;bjAdvance(s);}return;}
  if(a.type==='double'){if(s.phase!=='playing'||s.turnSeat!==i)throw Error('还没轮到你');if(p.hand.length!==2||p.stood||p.busted)throw Error('只有起手两张牌时可以加倍');if(p.chips<p.bet)throw Error('剩余筹码不足以加倍');p.chips-=p.bet;p.bet*=2;p.hand.push(s.deck.pop());const v=bjValue(p.hand);if(v>21){p.busted=true;p.result='加倍爆牌'}p.stood=true;bjAdvance(s);return;}
  if(a.type==='stand'){if(s.phase!=='playing'||s.turnSeat!==i)throw Error('还没轮到你');p.stood=true;bjAdvance(s);return;}
  throw Error('未知操作');
}

// ---------------- Texas Hold'em ----------------
const combo5 = arr => {const out=[];for(let a=0;a<arr.length-4;a++)for(let b=a+1;b<arr.length-3;b++)for(let c=b+1;c<arr.length-2;c++)for(let d=c+1;d<arr.length-1;d++)for(let e=d+1;e<arr.length;e++)out.push([arr[a],arr[b],arr[c],arr[d],arr[e]]);return out;};
function eval5(cards){
  const vals=cards.map(c=>cardValueRank(c.r)).sort((a,b)=>b-a);const counts=new Map;for(const v of vals)counts.set(v,(counts.get(v)||0)+1);let uniq=[...counts.keys()].sort((a,b)=>b-a);if(uniq[0]===14)uniq.push(1);let highStraight=0;for(let i=0;i<=uniq.length-5;i++)if(uniq[i]-uniq[i+4]===4){highStraight=uniq[i];break;}const flush=cards.every(c=>c.s===cards[0].s);const groups=[...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  if(flush&&highStraight)return [8,highStraight];if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];if(groups[0][1]===3&&groups[1][1]>=2)return [6,groups[0][0],groups[1][0]];if(flush)return [5,...vals];if(highStraight)return [4,highStraight];if(groups[0][1]===3)return [3,groups[0][0],...groups.slice(1).map(g=>g[0]).sort((a,b)=>b-a)];if(groups[0][1]===2&&groups[1][1]===2){const hi=Math.max(groups[0][0],groups[1][0]),lo=Math.min(groups[0][0],groups[1][0]),k=groups.find(g=>g[1]===1)?.[0]||0;return[2,hi,lo,k];}if(groups[0][1]===2)return[1,groups[0][0],...groups.slice(1).map(g=>g[0]).sort((a,b)=>b-a)];return[0,...vals];
}
function cmpRank(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
function best7(cards){let best=null;for(const c of combo5(cards)){const r=eval5(c);if(!best||cmpRank(r,best)>0)best=r;}return best;}
function rankName(r){return ['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺'][r[0]]||'牌型';}
export function createPoker(){return {kind:'poker',seats:Array(8).fill(null),phase:'waiting',deck:[],community:[],boardRuns:[],pot:0,currentBet:0,dealerSeat:-1,turnSeat:null,turnStartedAt:0,turnTimeoutMs:CARD_TURN_MS,finishedAt:0,minRaise:20,minRaiseBase:20,smallBlind:10,bigBlind:20,defaultStack:2000,handNo:1,message:'等待 2~8 位玩家入座',potBreakdown:[],shortRaiseActive:false,runChoices:{},runEligible:[],runChoiceDeadline:0};}
const pkSeat=(s,u)=>s.seats.findIndex(x=>x?.userId===u);
function pkActive(s){return s.seats.map((p,i)=>p&&p.inHand&&!p.folded?i:-1).filter(i=>i>=0);}
function pkCanAct(p){return !!(p?.inHand&&!p.folded&&!p.allIn);}
function nextSeat(s,from,pred){const nSeat=s.seats.length;for(let n=1;n<=nSeat;n++){const i=(from+n+nSeat)%nSeat;if(pred(s.seats[i],i))return i;}return -1;}
function postBlind(s,i,n){const p=s.seats[i],amt=Math.min(n,p.chips);p.chips-=amt;p.roundBet+=amt;p.totalBet+=amt;s.pot+=amt;if(p.chips===0)p.allIn=true;}
function pkPlayer(userId,chips,ready=false,isBot=false,walletAtBuyIn=chips){return {userId,isBot, chips,buyIn:chips,walletAtBuyIn,ready,cards:[],folded:false,foldShow:false,allIn:false,roundBet:0,totalBet:0,result:null,payout:0,rank:null,inHand:false};}
function pkStart(s){
  let occupied=s.seats.filter(Boolean);
  if(occupied.length<1)throw Error('至少需要 1 位玩家');
  if(occupied.length===1&&!occupied[0].isBot&&!isBotId(occupied[0].userId)){const j=s.seats.findIndex(x=>!x);if(j>=0)s.seats[j]=pkPlayer(botId('poker'),s.defaultStack||2000,true,true,s.defaultStack||2000);occupied=s.seats.filter(Boolean);}
  if(occupied.some(x=>!x.isBot&&!isBotId(x.userId)&&!x.ready))throw Error('所有真人玩家都准备后才能开始');
  const ready=occupied.filter(x=>x.ready&&x.chips>0);if(ready.length<2)throw Error('至少需要 2 位可参与玩家');
  s.practice=ready.some(x=>x.isBot||isBotId(x.userId));s.practiceSnapshot=s.practice?Object.fromEntries(s.seats.filter(x=>x&&!x.isBot&&!isBotId(x.userId)).map(x=>[x.userId,x.chips])):null;
  s.deck=shuffle(stdDeck());s.community=[];s.boardRuns=[];s.runChoices={};s.runEligible=[];s.runChoiceDeadline=0;s.pot=0;s.potBreakdown=[];s.currentBet=0;s.minRaise=s.minRaiseBase||s.bigBlind||20;s.dealerSeat=nextSeat(s,s.dealerSeat,p=>p&&p.ready&&p.chips>0);
  for(const p of s.seats)if(p){p.cards=[];p.folded=false;p.foldShow=false;p.allIn=false;p.roundBet=0;p.totalBet=0;p.result=null;p.payout=0;p.rank=null;p.inHand=!!(p.ready&&p.chips>0);if(p.inHand)p.cards=[s.deck.pop(),s.deck.pop()];}
  const activeCount=pkActive(s).length,sb=activeCount===2?s.dealerSeat:nextSeat(s,s.dealerSeat,p=>p?.inHand),bb=nextSeat(s,sb,p=>p?.inHand);
  postBlind(s,sb,s.smallBlind||10);postBlind(s,bb,s.bigBlind||20);s.currentBet=Math.max(s.seats[sb].roundBet,s.seats[bb].roundBet);s.phase='preflop';s.lastAggressor=bb;s.acted=[];s.shortRaiseActive=false;s.finishedAt=0;s.message='翻牌前下注';s.turnSeat=nextSeat(s,bb,p=>pkCanAct(p));s.turnStartedAt=Date.now();
  if(s.turnSeat<0||pkActive(s).filter(i=>pkCanAct(s.seats[i])).length<=1)pkAdvancePhase(s);
}
function pkRoundDone(s){const active=pkActive(s);if(active.length<=1)return true;return active.every(i=>s.seats[i].allIn||(s.acted.includes(i)&&s.seats[i].roundBet===s.currentBet));}
function pkBeginRunChoice(s){
  const active=pkActive(s);if(active.length<2||s.community.length>=5)return false;
  s.phase='run_choice';s.turnSeat=null;s.turnStartedAt=0;s.runEligible=active.slice();s.runChoices={};
  for(const i of active)if(s.seats[i].isBot||isBotId(s.seats[i].userId))s.runChoices[i]=2;
  s.runChoiceDeadline=Date.now()+10000;s.message='全下后选择公共牌发 1 次或 2 次 · 按较少次数执行';
  if(active.every(i=>s.runChoices[i]))pkFinalizeRuns(s);return true;
}
function pkAdvancePhase(s){
  const active=pkActive(s);if(active.length<=1){pkShowdown(s);return;}
  for(const p of s.seats)if(p)p.roundBet=0;s.currentBet=0;s.acted=[];s.minRaise=s.minRaiseBase||s.bigBlind||20;s.shortRaiseActive=false;
  const actors=pkActive(s).filter(i=>pkCanAct(s.seats[i]));if(actors.length<=1&&s.community.length<5){if(pkBeginRunChoice(s))return;}
  if(s.phase==='preflop'){s.community.push(s.deck.pop(),s.deck.pop(),s.deck.pop());s.phase='flop';s.message='翻牌圈';}
  else if(s.phase==='flop'){s.community.push(s.deck.pop());s.phase='turn';s.message='转牌圈';}
  else if(s.phase==='turn'){s.community.push(s.deck.pop());s.phase='river';s.message='河牌圈';}
  else {pkShowdown(s);return;}
  const nextActors=pkActive(s).filter(i=>pkCanAct(s.seats[i]));
  if(nextActors.length<=1){if(pkBeginRunChoice(s))return;pkAdvancePhase(s);return;}
  s.turnSeat=nextSeat(s,s.dealerSeat,p=>pkCanAct(p));s.turnStartedAt=Date.now();
}
function pkSidePots(s){
  const contributors=s.seats.map((p,i)=>p&&p.totalBet>0?{i,amt:p.totalBet}:null).filter(Boolean),levels=[...new Set(contributors.map(x=>x.amt))].sort((a,b)=>a-b),pots=[];let prev=0;
  for(const level of levels){const ids=contributors.filter(x=>x.amt>=level).map(x=>x.i),amount=(level-prev)*ids.length;if(amount>0){const eligible=ids.filter(i=>s.seats[i]?.inHand&&!s.seats[i]?.folded);pots.push({amount,cap:level,contributors:ids,eligible});}prev=level;}
  return pots;
}
function pkDealRuns(s,count){
  const prefix=s.community.slice(),need=5-prefix.length,boards=[];
  for(let r=0;r<count;r++){const board=prefix.slice();for(let k=0;k<need;k++)board.push(s.deck.pop());boards.push(board);}
  return boards;
}
function pkPayShare(s,winners,amount){
  const share=Math.floor(amount/winners.length);let rem=amount-share*winners.length;
  const ordered=winners.slice().sort((a,b)=>((a-s.dealerSeat+s.seats.length)%s.seats.length)-((b-s.dealerSeat+s.seats.length)%s.seats.length));
  for(const i of ordered){const win=share+(rem-->0?1:0);s.seats[i].chips+=win;s.seats[i].payout+=win;}
  return ordered;
}
function pkShowdown(s,boards=null){
  const active=pkActive(s);for(const p of s.seats)if(p)p.payout=0;
  if(active.length===1){const i=active[0];s.seats[i].chips+=s.pot;s.seats[i].payout=s.pot;s.seats[i].result='胜 · 其他玩家弃牌';s.potBreakdown=[{amount:s.pot,winners:[i],board:0}];s.boardRuns=[];}
  else{
    const runs=boards?.length?boards:pkDealRuns(s,1);s.boardRuns=runs.map(b=>b.slice());s.community=runs[0].slice();s.potBreakdown=[];
    const pots=pkSidePots(s),runCount=runs.length;
    for(let bi=0;bi<runCount;bi++){
      const board=runs[bi];
      for(const pot of pots){
        const part=Math.floor(pot.amount/runCount)+(bi<pot.amount%runCount?1:0),eligible=pot.eligible.length?pot.eligible:active;if(part<=0)continue;
        let best=null,winners=[];for(const i of eligible){const rank=best7([...s.seats[i].cards,...board]);if(!best||cmpRank(rank,best)>0){best=rank;winners=[i];}else if(cmpRank(rank,best)===0)winners.push(i);}
        const ordered=pkPayShare(s,winners,part);s.potBreakdown.push({amount:part,winners:ordered,board:bi+1});
      }
    }
    for(const i of active){const r=best7([...s.seats[i].cards,...runs[0]]);s.seats[i].rank=r;s.seats[i].result=runCount===1?rankName(r):'两次发牌';if(s.seats[i].payout>0)s.seats[i].result+=` · 赢 ${s.seats[i].payout}`;}
  }
  if(s.practice&&s.practiceSnapshot){for(const p of s.seats)if(p){if(p.isBot||isBotId(p.userId))p.chips=s.defaultStack||2000;else if(s.practiceSnapshot[p.userId]!=null)p.chips=s.practiceSnapshot[p.userId];}}
  for(const p of s.seats)if(p){p.ready=(p.isBot||isBotId(p.userId));p.inHand=false;p.allIn=false;}
  s.phase='result';s.turnSeat=null;s.turnStartedAt=0;s.runChoiceDeadline=0;s.finishedAt=Date.now();s.message=`本手结束${s.boardRuns?.length===2?' · 公共牌发两次':''}${s.potBreakdown.length>1?` · ${s.potBreakdown.length} 个分池结算`:''}`;s.handNo++;
}
function pkFinalizeRuns(s){
  if(s.phase!=='run_choice')return;
  const active=pkActive(s),choices=active.map(i=>Number(s.runChoices[i])===2?2:1),count=choices.length&&choices.every(x=>x===2)?2:1;
  pkShowdown(s,pkDealRuns(s,count));
}
function pkAfterAction(s,i){const active=pkActive(s);if(active.length<=1){pkShowdown(s);return;}if(pkRoundDone(s)){pkAdvancePhase(s);return;}const n=nextSeat(s,i,p=>pkCanAct(p));if(n<0){pkAdvancePhase(s);return;}s.turnSeat=n;s.turnStartedAt=Date.now();}
function pkCommit(s,p,amt){const pay=Math.max(0,Math.min(Math.floor(amt),p.chips));p.chips-=pay;p.roundBet+=pay;p.totalBet+=pay;s.pot+=pay;if(p.chips===0)p.allIn=true;return pay;}
function pokerAction(s,userId,a){
  if(a.type==='join'){let i=pkSeat(s,userId);if(i<0){i=Number.isInteger(a.seat)?a.seat:s.seats.findIndex(x=>!x);if(i<0||i>=s.seats.length||s.seats[i])throw Error('座位不可用');const stack=clamp(Number(a.chips)||s.defaultStack||2000,0,100000000);s.seats[i]=pkPlayer(userId,stack,false,isBotId(userId),Number.isFinite(Number(a.walletAtBuyIn))?Number(a.walletAtBuyIn):stack);}return;}
  if(a.type==='leave'){
    const i=pkSeat(s,userId);if(i<0)return;
    if(s.phase==='run_choice'&&s.seats[i]?.inHand){s.seats[i].folded=true;s.seats[i].inHand=false;delete s.runChoices[i];s.runEligible=s.runEligible.filter(x=>x!==i);if(pkActive(s).length<=1)pkShowdown(s);else if(pkActive(s).every(x=>s.runChoices[x]))pkFinalizeRuns(s);return;}
    const wasTurn=s.turnSeat===i;if(['preflop','flop','turn','river'].includes(s.phase)&&s.seats[i]?.inHand){s.seats[i].folded=true;s.seats[i].foldShow=false;s.seats[i].inHand=false;if(wasTurn)pkAfterAction(s,i);}else s.seats[i]=null;return;
  }
  const i=pkSeat(s,userId);if(i<0)throw Error('请先入座');const p=s.seats[i];
  if(a.type==='run_board'){
    if(s.phase!=='run_choice'||!s.runEligible.includes(i)||p.folded||!p.inHand)throw Error('当前不需要选择发牌次数');
    const count=Number(a.count)===2?2:1;s.runChoices[i]=count;s.message=`已选择发 ${count} 次 · 等待其他玩家`;
    if(pkActive(s).every(x=>s.runChoices[x]))pkFinalizeRuns(s);return;
  }
  if(a.type==='set_default_stack'){if(['preflop','flop','turn','river','run_choice'].includes(s.phase))throw Error('本局进行中不能修改默认筹码');s.defaultStack=clamp(Math.round(Number(a.chips)||1000),100,100000);return;}
  if(a.type==='ready'){if(['preflop','flop','turn','river','run_choice'].includes(s.phase))throw Error('本局进行中');p.ready=!p.ready;if(s.phase==='result')s.phase='waiting';return;}
  if(a.type==='start'){if(!['waiting','result'].includes(s.phase))throw Error('本局进行中');pkStart(s);return;}
  if(!['preflop','flop','turn','river'].includes(s.phase)||s.turnSeat!==i||!pkCanAct(p))throw Error('还没轮到你');
  if(a.type==='fold'){p.folded=true;p.foldShow=!!a.show;if(!s.acted.includes(i))s.acted.push(i);pkAfterAction(s,i);return;}
  const need=Math.max(0,s.currentBet-p.roundBet);
  if(a.type==='check'){if(need!==0)throw Error('当前需要跟注');if(!s.acted.includes(i))s.acted.push(i);pkAfterAction(s,i);return;}
  if(a.type==='call'){pkCommit(s,p,need);if(!s.acted.includes(i))s.acted.push(i);pkAfterAction(s,i);return;}
  if(a.type==='allin'){
    const before=s.currentBet,newBet=p.roundBet+p.chips,raiseBy=Math.max(0,newBet-before),raising=newBet>before;if(raising&&s.shortRaiseActive&&s.acted.includes(i))throw Error('之前的短码全下没有重新开放你的加注权，只能跟注或弃牌');pkCommit(s,p,p.chips);if(p.roundBet>before){s.currentBet=p.roundBet;if(raiseBy>=s.minRaise){s.minRaise=raiseBy;s.acted=[i];s.lastAggressor=i;s.shortRaiseActive=false;}else{s.shortRaiseActive=true;if(!s.acted.includes(i))s.acted.push(i);}}else if(!s.acted.includes(i))s.acted.push(i);pkAfterAction(s,i);return;
  }
  if(a.type==='raise'){
    if(s.shortRaiseActive&&s.acted.includes(i))throw Error('之前的短码全下没有重新开放你的加注权，只能跟注或弃牌');const requested=Math.floor(Number(a.amount));if(!Number.isFinite(requested)||requested<s.minRaise)throw Error(`最小完整加注为 ${s.minRaise}`);const target=s.currentBet+requested,maxTarget=p.roundBet+p.chips;if(maxTarget<=s.currentBet)throw Error('筹码只够跟注，无法加注');const actualTarget=Math.min(target,maxTarget),actualRaise=actualTarget-s.currentBet;pkCommit(s,p,actualTarget-p.roundBet);s.currentBet=Math.max(s.currentBet,p.roundBet);if(actualRaise>=s.minRaise){s.minRaise=actualRaise;s.acted=[i];s.lastAggressor=i;s.shortRaiseActive=false;}else{s.shortRaiseActive=true;if(!s.acted.includes(i))s.acted.push(i);}pkAfterAction(s,i);return;
  }
  throw Error('未知操作');
}

const XQ_VAL={k:100000,r:900,c:520,n:450,b:230,a:230,p:120};
const CH_VAL={k:100000,q:900,r:500,b:335,n:325,p:100};
function choose(arr){return arr.length?arr[Math.floor(Math.random()*arr.length)]:null}

// Stronger Gomoku AI: tactical win/block + threat-space two-ply search.
function gomokuCandidates(board,radius=2){
  let any=false;const out=[],seen=new Set();
  for(let y=0;y<15;y++)for(let x=0;x<15;x++)if(board[y][x]){any=true;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=15||yy<0||yy>=15||board[yy][xx])continue;const k=xx+','+yy;if(!seen.has(k)){seen.add(k);out.push({x:xx,y:yy});}}}
  return any?out:[{x:7,y:7}];
}
function gomokuLineScore(board,x,y,c,dx,dy){
  let left=0,right=0,openL=0,openR=0;
  let xx=x-dx,yy=y-dy;while(xx>=0&&xx<15&&yy>=0&&yy<15&&board[yy][xx]===c){left++;xx-=dx;yy-=dy;}if(xx>=0&&xx<15&&yy>=0&&yy<15&&!board[yy][xx])openL=1;
  xx=x+dx;yy=y+dy;while(xx>=0&&xx<15&&yy>=0&&yy<15&&board[yy][xx]===c){right++;xx+=dx;yy+=dy;}if(xx>=0&&xx<15&&yy>=0&&yy<15&&!board[yy][xx])openR=1;
  const n=left+right+1,o=openL+openR;
  if(n>=5)return 5_000_000;if(n===4&&o===2)return 500_000;if(n===4&&o===1)return 90_000;if(n===3&&o===2)return 35_000;if(n===3&&o===1)return 5_000;if(n===2&&o===2)return 1_200;if(n===2&&o===1)return 250;return 30*n+20*o;
}
function gomokuThreatStats(board,x,y,c){let open4=0,four=0,open3=0;for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){let l=0,r=0,ol=0,or=0,xx=x-dx,yy=y-dy;while(xx>=0&&xx<15&&yy>=0&&yy<15&&board[yy][xx]===c){l++;xx-=dx;yy-=dy}if(xx>=0&&xx<15&&yy>=0&&yy<15&&!board[yy][xx])ol=1;xx=x+dx;yy=y+dy;while(xx>=0&&xx<15&&yy>=0&&yy<15&&board[yy][xx]===c){r++;xx+=dx;yy+=dy}if(xx>=0&&xx<15&&yy>=0&&yy<15&&!board[yy][xx])or=1;const n=l+r+1,o=ol+or;if(n===4&&o===2)open4++;else if(n===4&&o===1)four++;else if(n===3&&o===2)open3++}return {open4,four,open3}}
function gomokuPatternBonus(board,x,y,c){let bonus=0;for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){let line='';for(let k=-5;k<=5;k++){const xx=x+dx*k,yy=y+dy*k;if(xx<0||xx>=15||yy<0||yy>=15)line+='#';else if(xx===x&&yy===y)line+='X';else line+=board[yy][xx]===c?'X':board[yy][xx]?'O':'_'}const pats=[['_XXXX_',900000],['_XXX_X_',650000],['_XX_XX_',650000],['_X_XXX_',650000],['#XXXX_',170000],['_XXXX#',170000],['_XXX__',48000],['__XXX_',48000],['_XX_X_',42000],['_X_XX_',42000],['_X_X_X_',60000]];for(const [pat,v] of pats)if(line.includes(pat))bonus+=v}return bonus}
function gomokuMoveScore(board,m,c){
  board[m.y][m.x]=c;let score=gomokuPatternBonus(board,m.x,m.y,c);for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]])score+=gomokuLineScore(board,m.x,m.y,c,dx,dy);const t=gomokuThreatStats(board,m.x,m.y,c);if(t.open4>=1)score+=700000;if(t.open4+t.four>=2)score+=1800000;if(t.open3>=2)score+=260000;if(t.open3>=1&&(t.open4+t.four)>=1)score+=520000;board[m.y][m.x]=null;score+=35-(Math.abs(m.x-7)+Math.abs(m.y-7));return score;
}
function gomokuBotMove(s){
  const pi=s.turn,c=pi===0?'W':'B',opp=pi===0?'B':'W',cand=gomokuCandidates(s.board,2);
  for(const m of cand){s.board[m.y][m.x]=c;const w=gomokuWin(s.board,m.x,m.y,c);s.board[m.y][m.x]=null;if(w)return m;}
  for(const m of cand){s.board[m.y][m.x]=opp;const w=gomokuWin(s.board,m.x,m.y,opp);s.board[m.y][m.x]=null;if(w)return m;}
  const ranked=cand.map(m=>({m,attack:gomokuMoveScore(s.board,m,c),defend:gomokuMoveScore(s.board,m,opp)})).sort((a,b)=>Math.max(b.attack,b.defend*.96)-Math.max(a.attack,a.defend*.96)).slice(0,18);
  let best=null,bestV=-Infinity;
  for(const r of ranked){const m=r.m;s.board[m.y][m.x]=c;
    const replies=gomokuCandidates(s.board,2).map(q=>({q,v:Math.max(gomokuMoveScore(s.board,q,opp),gomokuMoveScore(s.board,q,c)*.88)})).sort((a,b)=>b.v-a.v).slice(0,12);
    let worst=0,replyPenalty=0;for(const rr of replies){const q=rr.q;s.board[q.y][q.x]=opp;const tv=gomokuMoveScore(s.board,q,opp);const counters=gomokuCandidates(s.board,2).map(z=>gomokuMoveScore(s.board,z,c)).sort((a,b)=>b-a).slice(0,5);const comeback=counters[0]||0;s.board[q.y][q.x]=null;const line=tv-comeback*.34;worst=Math.max(worst,line);if(tv>400000&&comeback<400000)replyPenalty=Math.max(replyPenalty,650000);}
    s.board[m.y][m.x]=null;const v=r.attack*1.18+r.defend*1.08-worst*.92-replyPenalty+Math.random()*.8;if(v>bestV){bestV=v;best=m;}
  }
  return best||ranked[0]?.m||cand[0]||null;
}

function xqMoves(board,side){const moves=[];for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(!p||xqSide(p)!==side)continue;for(let yy=0;yy<10;yy++)for(let xx=0;xx<9;xx++)if(xqLegal(board,x,y,xx,yy)){const t=board[yy][xx];moves.push({x1:x,y1:y,x2:xx,y2:yy,p,captured:t,order:(t?XQ_VAL[t.toLowerCase()]||0:0)+(p.toLowerCase()==='p'?20:0)});}}return moves.sort((a,b)=>b.order-a.order)}
function xqApply(board,m){const b=clone(board);b[m.y2][m.x2]=b[m.y1][m.x1];b[m.y1][m.x1]=null;return b;}
function xqEval(board,root){let v=0;const fileRooks=[0,0],guards=[0,0];for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(!p)continue;const side=xqSide(p),type=p.toLowerCase();let pv=XQ_VAL[type]||0;if(type==='p'){const adv=side===0?9-y:y;pv+=adv*11;if((side===0&&y<=4)||(side===1&&y>=5))pv+=42;pv+=8-Math.abs(x-4)*2;}if(type==='n')pv+=24-Math.abs(x-4)*4-Math.abs(y-4.5)*2;if(type==='c')pv+=18-Math.abs(x-4)*2;if(type==='r'){pv+=12-Math.abs(x-4);fileRooks[side]++}if(type==='a'||type==='b')guards[side]++;v+=(side===root?pv:-pv)}const rg=xqFindGeneral(board,root),og=xqFindGeneral(board,1-root);if(rg)v+=guards[root]*9;if(og)v-=guards[1-root]*9;v+=(fileRooks[root]-fileRooks[1-root])*5;return v;}
function xqSearch(board,side,root,depth,alpha,beta){const g=xqFindGeneral(board,side),og=xqFindGeneral(board,1-side);if(!g)return -999999-depth;if(!og)return 999999+depth;if(depth<=0)return xqEval(board,root);const moves=xqMoves(board,side);if(!moves.length)return xqEval(board,root)-5000;const maximize=side===root;let best=maximize?-Infinity:Infinity;for(const m of moves.slice(0,36)){const b=xqApply(board,m),v=xqSearch(b,1-side,root,depth-1,alpha,beta);if(maximize){best=Math.max(best,v);alpha=Math.max(alpha,best);}else{best=Math.min(best,v);beta=Math.min(beta,best);}if(beta<=alpha)break;}return best;}
function xqSearchBeam(board,side,root,depth,alpha,beta){if(depth<=0)return xqEval(board,root);const g=xqFindGeneral(board,side),og=xqFindGeneral(board,1-side);if(!g)return -999999-depth;if(!og)return 999999+depth;const moves=xqMoves(board,side).slice(0,depth>=3?16:22);if(!moves.length)return xqEval(board,root)-5000;const max=side===root;let best=max?-Infinity:Infinity;for(const m of moves){const v=xqSearchBeam(xqApply(board,m),1-side,root,depth-1,alpha,beta);if(max){best=Math.max(best,v);alpha=Math.max(alpha,best)}else{best=Math.min(best,v);beta=Math.min(beta,best)}if(beta<=alpha)break}return best}
function xqForbiddenLongCheck(s,m,side){const b=xqApply(s.board,m),opp=1-side,g=xqFindGeneral(b,opp),checked=g?xqAttacked(b,g[0],g[1],side):true,key=xqPositionKey(b,opp);return checked&&(s.positionCounts?.[key]||0)>=2}
function xiangqiBotMove(s){const side=s.turn,moves=xqMoves(s.board,side).filter(m=>!xqForbiddenLongCheck(s,m,side)),scored=[];for(const m of moves){const immediate=m.captured?.toLowerCase()==='k'?999999:0,b=xqApply(s.board,m),v=immediate+xqSearch(b,1-side,side,2,-Infinity,Infinity)+(m.order||0)*.12;scored.push({m,b,v})}scored.sort((a,b)=>b.v-a.v);let best=scored[0],bv=-Infinity;for(const x of scored.slice(0,5)){const deep=x.v+xqSearchBeam(x.b,1-side,side,3,-Infinity,Infinity)*.18+Math.random()*.3;if(deep>bv){bv=deep;best=x}}return best?.m||null;}

function chMoves(s,side){const moves=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=s.board[y][x];if(!p||chSide(p)!==side)continue;for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)if(chLegal(s,x,y,xx,yy,'q')){const t=s.board[yy][xx];moves.push({x1:x,y1:y,x2:xx,y2:yy,promotion:'q',captured:t,order:(t?CH_VAL[chType(t)]||0:0)+(chType(p)==='p'?10:0)});}}return moves.sort((a,b)=>b.order-a.order)}
function chEval(s,root){let v=0;const bishops=[0,0],pawns=[0,0];for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=s.board[y][x];if(!p)continue;const side=chSide(p),t=chType(p);let pv=CH_VAL[t]||0;const center=(3.5-Math.abs(x-3.5))+(3.5-Math.abs(y-3.5));if(t==='n')pv+=center*9;if(t==='b'){pv+=center*5;bishops[side]++}if(t==='q')pv+=center*2;if(t==='r')pv+=(y===0||y===7)?0:7;if(t==='p'){pawns[side]++;pv+=(side===0?(6-y):(y-1))*9;pv+=(x>=2&&x<=5?6:0)}if(t==='k'){const home=side===0?7:0;pv-=Math.abs(y-home)*8;pv-=Math.max(0,2-Math.min(x,7-x))*2}v+=(side===root?pv:-pv)}if(bishops[root]>=2)v+=26;if(bishops[1-root]>=2)v-=26;v+=(pawns[root]-pawns[1-root])*2;return v;}
function chSearch(s,side,root,depth,alpha,beta){const king=chFindKing(s.board,side);if(!king)return -999999-depth;if(depth<=0)return chEval(s,root);const moves=chMoves(s,side);if(!moves.length){const checked=chAttacked(s,king[0],king[1],1-side);return checked?(side===root?-900000-depth:900000+depth):0;}const maximize=side===root;let best=maximize?-Infinity:Infinity;for(const m of moves.slice(0,38)){const ns=chApplyCopy(s,m.x1,m.y1,m.x2,m.y2,m.promotion);ns.turn=1-side;const v=chSearch(ns,1-side,root,depth-1,alpha,beta);if(maximize){best=Math.max(best,v);alpha=Math.max(alpha,best);}else{best=Math.min(best,v);beta=Math.min(beta,best);}if(beta<=alpha)break;}return best;}
function chSearchBeam(s,side,root,depth,alpha,beta){const king=chFindKing(s.board,side);if(!king)return -999999-depth;if(depth<=0)return chEval(s,root);const moves=chMoves(s,side).slice(0,depth>=3?18:26);if(!moves.length)return chAttacked(s,king[0],king[1],1-side)?(side===root?-900000-depth:900000+depth):0;const max=side===root;let best=max?-Infinity:Infinity;for(const m of moves){const ns=chApplyCopy(s,m.x1,m.y1,m.x2,m.y2,m.promotion);ns.turn=1-side;const v=chSearchBeam(ns,1-side,root,depth-1,alpha,beta);if(max){best=Math.max(best,v);alpha=Math.max(alpha,best)}else{best=Math.min(best,v);beta=Math.min(beta,best)}if(beta<=alpha)break}return best}
function chessBotMove(s){const side=s.turn,moves=chMoves(s,side),scored=[];for(const m of moves){const ns=chApplyCopy(s,m.x1,m.y1,m.x2,m.y2,'q');ns.turn=1-side;scored.push({m,ns,v:chSearch(ns,1-side,side,2,-Infinity,Infinity)+(m.order||0)*.08})}scored.sort((a,b)=>b.v-a.v);let best=scored[0],bv=-Infinity;for(const x of scored.slice(0,6)){const deep=x.v+chSearchBeam(x.ns,1-side,side,3,-Infinity,Infinity)*.16+Math.random()*.25;if(deep>bv){bv=deep;best=x}}return best?.m||null;}

function blackjackBotAction(s,p){
  const total=bjValue(p.hand),dealer=s.dealer[0],dv=dealer?Math.min(10,cardValueRank(dealer.r==='A'?'A':dealer.r)):10;let aces=0,raw=0;for(const c of p.hand){if(c.r==='A'){aces++;raw+=11}else raw+=Math.min(10,cardValueRank(c.r))}while(raw>21&&aces){raw-=10;aces--;}const soft=aces>0&&raw<=21;
  if(soft){if(total<=17)return 'hit';if(total===18&&dv>=9)return 'hit';return 'stand';}
  if(total<=11)return 'hit';if(total===12)return (dv>=4&&dv<=6)?'stand':'hit';if(total>=13&&total<=16)return (dv>=2&&dv<=6)?'stand':'hit';return 'stand';
}
function pokerPreflopStrength(cards){if(!cards||cards.length<2)return .3;const [a,b]=cards,va=cardValueRank(a.r),vb=cardValueRank(b.r),hi=Math.max(va,vb),lo=Math.min(va,vb),pair=va===vb,suited=a.s===b.s,gap=hi-lo;let s=hi/14*.36+lo/14*.12;if(pair)s=.52+hi/14*.42;if(suited)s+=.07;if(gap<=1)s+=.08;else if(gap===2)s+=.035;if(hi===14)s+=.08;return clamp(s,0,1);}
function pokerMonteCarlo(s,p,samples=44){const known=[...p.cards,...s.community],knownIds=new Set(known.map(c=>c.id)),deck=stdDeck().filter(c=>!knownIds.has(c.id)),opp=Math.max(1,pkActive(s).length-1);let score=0;for(let z=0;z<samples;z++){const d=shuffle(deck.slice()),comm=s.community.concat(d.splice(0,5-s.community.length)),my=best7([...p.cards,...comm]);let win=true,ties=0;for(let o=0;o<opp;o++){const oh=[d.pop(),d.pop()],r=best7([...oh,...comm]),cmp=cmpRank(my,r);if(cmp<0){win=false;break;}if(cmp===0)ties++;}if(win)score+=ties?1/(ties+1):1;}return score/samples;}
function pokerBotAction(s,p){const need=Math.max(0,s.currentBet-p.roundBet),potOdds=need>0?need/(s.pot+need):0,phase=s.phase;let strength=phase==='preflop'?pokerPreflopStrength(p.cards):pokerMonteCarlo(s,p,36);strength+=Math.random()*.05-.025;
  if(need===0){if(strength>.78&&p.chips>=s.minRaise&&Math.random()<.65)return {type:'raise',amount:Math.min(80,Math.max(s.minRaise,Math.round((20+strength*60)/10)*10))};if(strength>.58&&p.chips>=s.minRaise&&Math.random()<.28)return {type:'raise',amount:s.minRaise};return {type:'check'};}
  if(strength+0.04<potOdds)return {type:'fold'};if(strength>.82&&p.chips>need+s.minRaise&&Math.random()<.58)return {type:'raise',amount:Math.min(100,Math.max(s.minRaise,40))};if(need<=p.chips)return {type:'call'};return p.chips>0?{type:'allin'}:{type:'fold'};
}
export function addBotToGame(s,seat=null){
  if(!s)throw Error('不是游戏房间');const humans=Array.isArray(s.players)?s.players.filter(x=>x&&!isBotId(x)).length:Array.isArray(s.seats)?s.seats.filter(x=>x&&!x.isBot&&!isBotId(x.userId)).length:0;if(humans<1)throw Error('至少先有一位真人入座后才能添加 AI');
  if(s?.kind==='dice')return addDiceBot(s,seat);
  if(isExtraKind(s?.kind))return addExtraBot(s,seat);
  const id=botId(s.kind);
  if(['gomoku','xiangqi','chess'].includes(s.kind)){const i=Number.isInteger(seat)?seat:s.players.findIndex(x=>!x);if(i<0||i>1||s.players[i])throw Error('没有空位');s.players[i]=id;s.ready[i]=true;boardReadyMaybeStart(s);return id;}
  if(!['waiting','result'].includes(s.phase))throw Error('对局进行中，不能调整 AI');const i=Number.isInteger(seat)?seat:s.seats.findIndex(x=>!x);if(i<0||i>=s.seats.length||s.seats[i])throw Error('没有空位');
  if(s.kind==='blackjack')s.seats[i]={userId:id,isBot:true,chips:s.defaultStack||2000,bet:s.defaultBet||20,ready:true,hand:[],stood:false,busted:false,result:null};
  else if(s.kind==='poker')s.seats[i]=pkPlayer(id,s.defaultStack||2000,true,true,s.defaultStack||2000);
  return id;
}
export function removeBotFromGame(s,seat=null){
  if(s?.kind==='dice')return removeDiceBot(s,seat);
  if(isExtraKind(s?.kind))return removeExtraBot(s,seat);
  if(['gomoku','xiangqi','chess'].includes(s.kind)){const i=Number.isInteger(seat)?seat:s.players.findIndex(isBotId);if(i>=0&&isBotId(s.players[i])){s.players[i]=null;s.ready[i]=false;s.started=false;}return;}
  if(!['waiting','result'].includes(s.phase))throw Error('对局进行中，不能调整 AI');const i=Number.isInteger(seat)?seat:s.seats.findIndex(x=>x&&(x.isBot||isBotId(x.userId)));if(i>=0&&s.seats[i]&&(s.seats[i].isBot||isBotId(s.seats[i].userId)))s.seats[i]=null;
}
export function advanceBots(s,maxSteps=80){
  if(!s)return;
  if(s.kind==='dice'){advanceDiceBots(s,maxSteps);return;}
  if(isExtraKind(s.kind)){advanceExtraBots(s,maxSteps);return;}
  for(let step=0;step<maxSteps;step++){
    if(s.kind==='gomoku'){const id=s.players[s.turn];if(!s.started||!isBotId(id)||s.winner||s.players.some(x=>!x))break;const m=gomokuBotMove(s);if(!m)break;gomokuAction(s,id,{type:'place',...m});continue;}
    if(s.kind==='xiangqi'){const id=s.players[s.turn];if(!s.started||!isBotId(id)||s.winner||s.players.some(x=>!x))break;const m=xiangqiBotMove(s);if(!m)break;xiangqiAction(s,id,{type:'move',...m});continue;}
    if(s.kind==='chess'){const id=s.players[s.turn];if(!s.started||!isBotId(id)||s.winner||s.result||s.players.some(x=>!x))break;const m=chessBotMove(s);if(!m)break;chessAction(s,id,{type:'move',...m});continue;}
    if(s.kind==='blackjack'){
      if(!['playing','dealer'].includes(s.phase))break;const p=s.seats[s.turnSeat];if(!p||!(p.isBot||isBotId(p.userId)))break;blackjackAction(s,p.userId,{type:blackjackBotAction(s,p)});continue;
    }
    if(s.kind==='poker'){
      if(!['preflop','flop','turn','river'].includes(s.phase))break;const p=s.seats[s.turnSeat];if(!p||!(p.isBot||isBotId(p.userId)))break;pokerAction(s,p.userId,pokerBotAction(s,p));continue;
    }
    break;
  }
}
export function hasBot(s){return !s?false:s.kind==='dice'?diceHasBot(s):isExtraKind(s.kind)?extraHasBot(s):['gomoku','xiangqi','chess'].includes(s.kind)?s.players.some(isBotId):s.seats?.some(x=>x&&(x.isBot||isBotId(x.userId)))||false}
export function createGame(kind){if(kind==='dice')return createDiceGame();if(isExtraKind(kind))return createExtraGame(kind);if(kind==='gomoku')return createGomoku();if(kind==='xiangqi')return createXiangqi();if(kind==='chess')return createChess();if(kind==='blackjack')return createBlackjack();if(kind==='poker')return createPoker();return null;}
export function tickGame(state,now=Date.now()){if(!state)return {changed:false};if(state.kind==='dice')return tickDice(state,now);if(isExtraKind(state.kind))return tickExtraGame(state,now);let changed=false,forceLeaveUsers=[];if(state.kind==='poker'&&state.phase==='run_choice'&&state.runChoiceDeadline&&now>=state.runChoiceDeadline){for(const i of pkActive(state))if(!state.runChoices[i])state.runChoices[i]=1;pkFinalizeRuns(state);changed=true;}if(['gomoku','xiangqi','chess'].includes(state.kind)&&state.started&&!state.winner&&!state.result){const side=state.turn,remain=boardClockRemaining(state,side,now);if(remain<=0){state.timeBanks[side]=0;const other=state.players?.[1-side];if(other)state.winner=other;state.result='time_forfeit';state.started=false;state.finishedAt=now;changed=true;}}if(['blackjack','poker'].includes(state.kind)&&state.turnSeat!=null&&state.turnStartedAt&&now-state.turnStartedAt>=(state.turnTimeoutMs||CARD_TURN_MS)){const seat=state.seats?.[state.turnSeat];if(seat&&!seat.isBot&&!isBotId(seat.userId)){try{applyGameAction(state,seat.userId,{type:state.kind==='blackjack'?'stand':'fold'});}catch{}changed=true;}}const ended=(state.winner||state.result||['result'].includes(state.phase));if(ended&&!state.finishedAt){state.finishedAt=now;changed=true;}return {changed,forceLeaveUsers,autoReset:!!(state.finishedAt&&now-state.finishedAt>=RESULT_AUTO_LEAVE_MS)};}

export function applyGameAction(state,userId,action){if(!state)throw Error('不是游戏房间');if(state.kind==='dice'){applyDiceAction(state,userId,action);return state}if(isExtraKind(state.kind)){applyExtraGameAction(state,userId,action);return state}if(state.kind==='gomoku')gomokuAction(state,userId,action);else if(state.kind==='xiangqi')xiangqiAction(state,userId,action);else if(state.kind==='chess')chessAction(state,userId,action);else if(state.kind==='blackjack')blackjackAction(state,userId,action);else if(state.kind==='poker')pokerAction(state,userId,action);else throw Error('未知游戏');return state;}

export function publicGameState(state,viewerId){
  if(!state)return null;if(state.kind==='dice')return publicDiceState(state,viewerId);if(isExtraKind(state.kind))return publicExtraGameState(state,viewerId);const s=clone(state);s.serverNow=Date.now();
  if(s.kind==='blackjack'&&['playing','dealer'].includes(s.phase)){
    if(s.dealer.length>1&&s.phase==='playing')s.dealer=[s.dealer[0],{hidden:true}];
  }
  if(s.kind==='poker'){
    const live=['preflop','flop','turn','river','run_choice'].includes(s.phase);
    for(const seat of s.seats)if(seat&&seat.userId!==viewerId){const canShow=!!seat.folded&&!!seat.foldShow;if(live&&!canShow)seat.cards=seat.cards.map(()=>({hidden:true}));if(s.phase==='result'&&seat.folded&&!seat.foldShow)seat.cards=seat.cards.map(()=>({hidden:true}));}
  }
  if(s.kind==='chess')s.drawClaims=chDrawClaim(state);
  if(s.kind==='xiangqi'){s.canUndo=xqCanUndoFor(state,viewerId);delete s.history;}
  if(s.kind==='poker'){const i=pkSeat(state,viewerId);s.raiseClosedForViewer=i>=0&&!!state.shortRaiseActive&&(state.acted||[]).includes(i);}
  return s;
}

export function gameSeatInfo(state){
  if(!state)return [];
  if(['gomoku','xiangqi','chess','go'].includes(state.kind))return state.players;
  return state.seats.map(s=>s?.userId||null);
}

export function roomInitialState(def){return {roomId:def.id,category:def.category,music:def.category==='music'?{provider:'netease',trackId:'',mediaId:'',title:'',setBy:'',cover:'',duration:0,positionMs:0,playing:false,updatedAt:0,revision:0,queue:[]}:null,game:def.game&&!def.single?createGame(def.game):null,messages:[]};}

export {XQ,bjValue,rankName};

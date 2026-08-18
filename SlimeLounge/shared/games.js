export const ROOM_DEFS = [
  { id:'chat-announcements', category:'chat', game:null, name:'公告', description:'管理员发布公告与重要通知', capacity:100, adminOnlyPost:true },
  { id:'chat-general', category:'chat', game:null, name:'大厅', description:'日常聊天与所有人的公共讨论区', capacity:100 },
  { id:'chat-tech', category:'chat', game:null, name:'技术 / 开发', description:'代码、AI、工具与技术讨论', capacity:100 },
  { id:'chat-games', category:'chat', game:null, name:'游戏讨论', description:'约战、攻略、游戏闲聊', capacity:100 },
  { id:'chat-music', category:'chat', game:null, name:'音乐讨论', description:'分享歌曲、歌手与歌单', capacity:100 },
  { id:'chat-random', category:'chat', game:null, name:'闲聊', description:'不需要主题的轻松聊天', capacity:100 },
  { id:'chat-help', category:'chat', game:null, name:'求助 / 建议', description:'提问、建议和问题反馈', capacity:100 },
  { id:'music-cn', category:'music', game:null, name:'华语流行', description:'华语流行与经典', capacity:50 },
  { id:'music-jp', category:'music', game:null, name:'日语 / ACG', description:'日语、动画与游戏音乐', capacity:50 },
  { id:'music-en', category:'music', game:null, name:'欧美流行', description:'欧美流行与热门单曲', capacity:50 },
  { id:'music-chill', category:'music', game:null, name:'轻音乐 / 氛围', description:'纯音乐、Lo-Fi 与氛围音乐', capacity:50 },
  { id:'music-rock', category:'music', game:null, name:'摇滚', description:'摇滚、朋克与独立音乐', capacity:50 },
  { id:'music-electronic', category:'music', game:null, name:'电子', description:'电子、舞曲与合成器音乐', capacity:50 },
  ...Array.from({length:5},(_,i)=>({id:`gomoku-${i+1}`,category:'game',game:'gomoku',name:`五子棋 ${i+1}号房`,capacity:2})),
  ...Array.from({length:3},(_,i)=>({id:`xiangqi-${i+1}`,category:'game',game:'xiangqi',name:`中国象棋 ${i+1}号房`,capacity:2})),
  ...Array.from({length:3},(_,i)=>({id:`chess-${i+1}`,category:'game',game:'chess',name:`国际象棋 ${i+1}号房`,capacity:2})),
  ...Array.from({length:3},(_,i)=>({id:`blackjack-${i+1}`,category:'game',game:'blackjack',name:`21点 ${i+1}号房`,capacity:5,minPlayers:2})),
  ...Array.from({length:2},(_,i)=>({id:`poker-${i+1}`,category:'game',game:'poker',name:`德州扑克 ${i+1}号房`,capacity:5,minPlayers:2})),
];

export const ROOM_MAP = Object.fromEntries(ROOM_DEFS.map(r=>[r.id,r]));

const clone = v => JSON.parse(JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-5);
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
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
  return {kind:'gomoku',board:Array.from({length:15},()=>Array(15).fill(null)),players:[null,null],ready:[false,false],started:false,turn:0,winner:null,last:null,round:1,focusViolations:{}};
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
  if(!s.players.every(Boolean)){s.started=false;return false;}
  for(let i=0;i<2;i++)if(isBotId(s.players[i]))s.ready[i]=true;
  s.started=s.players.every((p,i)=>p&&(isBotId(p)||s.ready[i]));
  return s.started;
}
function boardJoin(s,userId){
  if(!s.players.includes(userId)){const i=s.players.findIndex(x=>!x);if(i<0)throw Error('房间已满');s.players[i]=userId;s.ready[i]=isBotId(userId);}
  boardReadyMaybeStart(s);
}
function boardLeave(s,userId){const i=s.players.indexOf(userId);if(i>=0){s.players[i]=null;s.ready[i]=false;s.started=false;}}
function boardReady(s,userId){const i=s.players.indexOf(userId);if(i<0)throw Error('请先加入座位');if(isBotId(userId))return;s.ready[i]=!s.ready[i];boardReadyMaybeStart(s);}
function boardResetReady(s){for(let i=0;i<2;i++)s.ready[i]=!!(s.players[i]&&isBotId(s.players[i]));s.started=false;boardReadyMaybeStart(s);}
function boardFocusForfeit(s,userId){if(hasBot(s))return false;const i=s.players.indexOf(userId);if(i<0||!s.started||s.winner||s.result)return false;s.focusViolations[userId]=(s.focusViolations[userId]||0)+1;const other=s.players[1-i];if(other)s.winner=other;s.result='focus_forfeit';s.started=false;return true;}
function gomokuAction(s,userId,a){
  if(a.type==='join'){boardJoin(s,userId);return;}
  if(a.type==='leave'){boardLeave(s,userId);return;}
  if(a.type==='ready'){boardReady(s,userId);return;}
  if(a.type==='focus_forfeit'){boardFocusForfeit(s,userId);return;}
  if(a.type==='reset'){
    if(!s.players.includes(userId))throw Error('只有玩家可以重开');
    s.board=Array.from({length:15},()=>Array(15).fill(null));s.turn=(s.round%2);s.winner=null;s.result=null;s.last=null;s.round++;boardResetReady(s);return;
  }
  if(a.type==='place'){
    const pi=s.players.indexOf(userId);if(pi<0)throw Error('你不是本桌玩家');if(s.players.some(x=>!x))throw Error('等待第二位玩家');if(!s.started)throw Error('所有真人玩家准备后才能开始');if(s.winner)throw Error('本局已结束');if(pi!==s.turn)throw Error('还没轮到你');
    const x=Number(a.x),y=Number(a.y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=15||y<0||y>=15)throw Error('坐标无效');if(s.board[y][x])throw Error('这里已经有棋子');
    const c=pi===0?'B':'W';s.board[y][x]=c;s.last={x,y,c};if(gomokuWin(s.board,x,y,c)){s.winner=userId;s.started=false;}else s.turn=1-s.turn;return;
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
  return {kind:'xiangqi',board:b,players:[null,null],ready:[false,false],started:false,turn:0,winner:null,last:null,round:1,focusViolations:{}};
}
const xqSide=p=>!p?null:(p===p.toUpperCase()?0:1);
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
function xqLegal(b,x1,y1,x2,y2){if(!xqPseudo(b,x1,y1,x2,y2))return false;const p=b[y1][x1],side=xqSide(p),nb=clone(b);nb[y2][x2]=nb[y1][x1];nb[y1][x1]=null;const g=xqFindGeneral(nb,side);return !!g&&!xqAttacked(nb,g[0],g[1],1-side);}
function xiangqiAction(s,userId,a){
  if(a.type==='join'){boardJoin(s,userId);return;}
  if(a.type==='leave'){boardLeave(s,userId);return;}
  if(a.type==='ready'){boardReady(s,userId);return;}
  if(a.type==='focus_forfeit'){boardFocusForfeit(s,userId);return;}
  if(a.type==='reset'){s.board=createXiangqi().board;s.winner=null;s.result=null;s.last=null;s.turn=(s.round%2);s.round++;boardResetReady(s);return;}
  if(a.type==='move'){
    const pi=s.players.indexOf(userId);if(pi<0)throw Error('你不是本桌玩家');if(s.players.some(x=>!x))throw Error('等待第二位玩家');if(!s.started)throw Error('所有真人玩家准备后才能开始');if(s.winner)throw Error('本局已结束');if(pi!==s.turn)throw Error('还没轮到你');
    const {x1,y1,x2,y2}=a;if(![x1,y1,x2,y2].every(Number.isInteger))throw Error('坐标无效');const p=s.board[y1]?.[x1];if(!p||xqSide(p)!==pi)throw Error('请选择自己的棋子');if(!xqLegal(s.board,x1,y1,x2,y2))throw Error('这步不合法');
    const captured=s.board[y2][x2];s.board[y2][x2]=p;s.board[y1][x1]=null;s.last={x1,y1,x2,y2,p,captured};if(captured&&captured.toLowerCase()==='k'){s.winner=userId;s.started=false;}else s.turn=1-s.turn;return;
  }
  throw Error('未知操作');
}

// ---------------- Chess ----------------
export function createChess(){
  const b=Array.from({length:8},()=>Array(8).fill(null));
  b[0]=['br','bn','bb','bq','bk','bb','bn','br'];b[1]=Array(8).fill('bp');b[6]=Array(8).fill('wp');b[7]=['wr','wn','wb','wq','wk','wb','wn','wr'];
  return {kind:'chess',board:b,players:[null,null],ready:[false,false],started:false,turn:0,winner:null,result:null,last:null,castle:{wK:true,wQ:true,bK:true,bQ:true},ep:null,round:1,focusViolations:{}};
}
const chSide=p=>p?.[0]==='w'?0:p?.[0]==='b'?1:null; const chType=p=>p?.[1]; const inCh=(x,y)=>x>=0&&x<8&&y>=0&&y<8;
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
  const p=s.board[y1]?.[x1];if(!p||!chPseudo(s,x1,y1,x2,y2,false))return false;const side=chSide(p),type=chType(p);
  if(type==='k'&&Math.abs(x2-x1)===2){if(chAttacked(s,x1,y1,1-side))return false;const mid=x1+Math.sign(x2-x1);const tmp=chApplyCopy(s,x1,y1,mid,y1,promotion);const kg=chFindKing(tmp.board,side);if(!kg||chAttacked(tmp,kg[0],kg[1],1-side))return false;}
  const ns=chApplyCopy(s,x1,y1,x2,y2,promotion),k=chFindKing(ns.board,side);return !!k&&!chAttacked(ns,k[0],k[1],1-side);
}
function chHasMove(s,side){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(s.board[y][x]&&chSide(s.board[y][x])===side)for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)if(chLegal(s,x,y,xx,yy))return true;return false;}
function chessAction(s,userId,a){
  if(a.type==='join'){boardJoin(s,userId);return;}
  if(a.type==='leave'){boardLeave(s,userId);return;}
  if(a.type==='ready'){boardReady(s,userId);return;}
  if(a.type==='focus_forfeit'){boardFocusForfeit(s,userId);return;}
  if(a.type==='reset'){const fresh=createChess();Object.assign(s,fresh,{players:s.players.slice(),ready:s.ready.slice(),turn:s.round%2,round:s.round+1});boardResetReady(s);return;}
  if(a.type==='move'){
    const pi=s.players.indexOf(userId);if(pi<0)throw Error('你不是本桌玩家');if(s.players.some(x=>!x))throw Error('等待第二位玩家');if(!s.started)throw Error('所有真人玩家准备后才能开始');if(s.winner||s.result)throw Error('本局已结束');if(pi!==s.turn)throw Error('还没轮到你');const{x1,y1,x2,y2}=a;const p=s.board[y1]?.[x1];if(!p||chSide(p)!==pi)throw Error('请选择自己的棋子');if(!chLegal(s,x1,y1,x2,y2,a.promotion))throw Error('这步不合法');
    const ns=chApplyCopy(s,x1,y1,x2,y2,a.promotion);ns.last={x1,y1,x2,y2,p};ns.turn=1-s.turn;Object.assign(s,ns);const opp=s.turn,k=chFindKing(s.board,opp),checked=k?chAttacked(s,k[0],k[1],1-opp):true;if(!chHasMove(s,opp)){if(checked)s.winner=userId;else s.result='stalemate';s.started=false;}
    return;
  }
  throw Error('未知操作');
}

// ---------------- Blackjack ----------------
function bjValue(cards){let total=0,aces=0;for(const c of cards){if(c.r==='A'){aces++;total+=11;}else total+=Math.min(10,cardValueRank(c.r));}while(total>21&&aces){total-=10;aces--;}return total;}
export function createBlackjack(){return {kind:'blackjack',seats:Array(5).fill(null),phase:'waiting',dealer:[],deck:[],turnSeat:null,message:'等待 2~5 位玩家入座',handNo:1};}
function bjSeat(s,userId){return s.seats.findIndex(x=>x?.userId===userId)}
function bjStart(s){
  const occupied=s.seats.filter(Boolean);if(occupied.length<2)throw Error('至少需要 2 位玩家');if(occupied.some(x=>!x.isBot&&!isBotId(x.userId)&&!x.ready))throw Error('所有真人玩家都准备后才能开始');const active=occupied.filter(x=>x.ready&&x.chips>0);if(active.length<2)throw Error('至少需要 2 位可参与玩家');s.practice=active.some(x=>x.isBot||isBotId(x.userId));s.practiceSnapshot=s.practice?Object.fromEntries(s.seats.filter(x=>x&&!x.isBot&&!isBotId(x.userId)).map(x=>[x.userId,x.chips])):null;s.deck=shuffle(stdDeck());s.dealer=[s.deck.pop(),s.deck.pop()];
  for(const seat of s.seats)if(seat){seat.hand=[];seat.result=null;seat.stood=false;seat.busted=false;if(seat.ready&&seat.chips>0){seat.bet=clamp(Number(seat.bet)||20,10,Math.min(200,seat.chips));seat.chips-=seat.bet;seat.hand=[s.deck.pop(),s.deck.pop()];}else seat.hand=[];}
  s.phase='playing';s.turnSeat=s.seats.findIndex(x=>x?.ready&&x.hand.length);s.message='本局开始';
}
function bjAdvance(s){let i=s.turnSeat;for(let n=0;n<5;n++){i=(i+1)%5;const p=s.seats[i];if(p?.ready&&p.hand.length&&!p.stood&&!p.busted){s.turnSeat=i;return;}}bjDealer(s);}
function bjDealer(s){s.phase='dealer';while(bjValue(s.dealer)<17)s.dealer.push(s.deck.pop());const dv=bjValue(s.dealer);for(const p of s.seats)if(p?.ready&&p.hand.length){const v=bjValue(p.hand);let mult=0;if(v>21){p.result='爆牌';mult=0;}else if(dv>21||v>dv){p.result='胜';mult=(p.hand.length===2&&v===21)?2.5:2;}else if(v===dv){p.result='平';mult=1;}else{p.result='负';mult=0;}p.chips+=Math.floor(p.bet*mult);p.ready=(p.isBot||isBotId(p.userId));}if(s.practice&&s.practiceSnapshot){for(const p of s.seats)if(p){if(p.isBot||isBotId(p.userId))p.chips=1000;else if(s.practiceSnapshot[p.userId]!=null)p.chips=s.practiceSnapshot[p.userId];}}s.phase='result';s.turnSeat=null;s.message=`庄家 ${dv>21?'爆牌':dv}，本局结束`;s.handNo++;}
function blackjackAction(s,userId,a){
  if(a.type==='join'){
    let i=bjSeat(s,userId);if(i<0){i=Number.isInteger(a.seat)?a.seat:s.seats.findIndex(x=>!x);if(i<0||i>=5||s.seats[i])throw Error('座位不可用');s.seats[i]={userId,chips:1000,bet:20,ready:false,hand:[],stood:false,busted:false,result:null};}return;
  }
  if(a.type==='leave'){const i=bjSeat(s,userId);if(i>=0){if(s.phase==='playing'&&s.turnSeat===i){s.seats[i]=null;bjAdvance(s);}else s.seats[i]=null;}return;}
  const i=bjSeat(s,userId);if(i<0)throw Error('请先入座');const p=s.seats[i];if(a.type==='focus_forfeit'){if(!s.practice&&s.phase==='playing'&&s.turnSeat===i){p.stood=true;p.result='切屏自动停牌';bjAdvance(s);}return;}
  if(a.type==='bet'){if(s.phase==='playing'||s.phase==='dealer')throw Error('本局进行中');p.bet=clamp(Number(a.amount)||20,10,Math.min(200,p.chips));return;}
  if(a.type==='ready'){if(s.phase==='playing'||s.phase==='dealer')throw Error('本局进行中');p.ready=!p.ready;if(s.phase==='result')s.phase='waiting';return;}
  if(a.type==='start'){if(!['waiting','result'].includes(s.phase))throw Error('本局进行中');bjStart(s);return;}
  if(a.type==='hit'){if(s.phase!=='playing'||s.turnSeat!==i)throw Error('还没轮到你');p.hand.push(s.deck.pop());const v=bjValue(p.hand);if(v>21){p.busted=true;p.result='爆牌';bjAdvance(s);}else if(v===21){p.stood=true;bjAdvance(s);}return;}
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
export function createPoker(){return {kind:'poker',seats:Array(5).fill(null),phase:'waiting',deck:[],community:[],pot:0,currentBet:0,dealerSeat:-1,turnSeat:null,minRaise:20,handNo:1,message:'等待 2~5 位玩家入座'};}
const pkSeat=(s,u)=>s.seats.findIndex(x=>x?.userId===u);
function pkActive(s){return s.seats.map((p,i)=>p&&p.inHand&&!p.folded?i:-1).filter(i=>i>=0)}
function nextSeat(s,from,pred){for(let n=1;n<=5;n++){const i=(from+n)%5;if(pred(s.seats[i],i))return i;}return -1;}
function pkStart(s){
  const occupied=s.seats.filter(Boolean);if(occupied.length<2)throw Error('至少需要 2 位玩家');if(occupied.some(x=>!x.isBot&&!isBotId(x.userId)&&!x.ready))throw Error('所有真人玩家都准备后才能开始');const ready=occupied.filter(x=>x.ready&&x.chips>=20);if(ready.length<2)throw Error('至少需要 2 位可参与玩家');s.practice=ready.some(x=>x.isBot||isBotId(x.userId));s.practiceSnapshot=s.practice?Object.fromEntries(s.seats.filter(x=>x&&!x.isBot&&!isBotId(x.userId)).map(x=>[x.userId,x.chips])):null;s.deck=shuffle(stdDeck());s.community=[];s.pot=0;s.currentBet=0;s.minRaise=20;s.dealerSeat=nextSeat(s,s.dealerSeat,p=>p&&p.ready&&p.chips>=20);for(const p of s.seats)if(p){p.cards=[];p.folded=false;p.roundBet=0;p.totalBet=0;p.result=null;p.inHand=!!(p.ready&&p.chips>=20);if(p.inHand)p.cards=[s.deck.pop(),s.deck.pop()];}
  const activeCount=pkActive(s).length;const sb=activeCount===2?s.dealerSeat:nextSeat(s,s.dealerSeat,p=>p?.inHand),bb=nextSeat(s,sb,p=>p?.inHand);postBlind(s,sb,10);postBlind(s,bb,20);s.currentBet=20;s.phase='preflop';s.turnSeat=nextSeat(s,bb,p=>p?.inHand&&!p.folded);s.message='翻牌前下注';s.lastAggressor=bb;s.acted=[];
}
function postBlind(s,i,n){const p=s.seats[i],amt=Math.min(n,p.chips);p.chips-=amt;p.roundBet+=amt;p.totalBet+=amt;s.pot+=amt;}
function pkRoundDone(s){const active=pkActive(s);if(active.length<=1)return true;return active.every(i=>s.acted.includes(i)&&s.seats[i].roundBet===s.currentBet);}
function pkAdvancePhase(s){
  const active=pkActive(s);if(active.length<=1){pkShowdown(s);return;}
  for(const p of s.seats)if(p)p.roundBet=0;s.currentBet=0;s.acted=[];s.minRaise=20;
  if(s.phase==='preflop'){s.community.push(s.deck.pop(),s.deck.pop(),s.deck.pop());s.phase='flop';s.message='翻牌圈';}
  else if(s.phase==='flop'){s.community.push(s.deck.pop());s.phase='turn';s.message='转牌圈';}
  else if(s.phase==='turn'){s.community.push(s.deck.pop());s.phase='river';s.message='河牌圈';}
  else {pkShowdown(s);return;}
  const activeCount=pkActive(s).length;s.turnSeat=activeCount===2&&s.seats[s.dealerSeat]?.inHand&&!s.seats[s.dealerSeat]?.folded?s.dealerSeat:nextSeat(s,s.dealerSeat,p=>p?.inHand&&!p.folded);
}
function pkShowdown(s){
  const active=pkActive(s);let winners=[];let best=null;if(active.length===1)winners=[active[0]];else for(const i of active){const r=best7([...s.seats[i].cards,...s.community]);s.seats[i].rank=r;s.seats[i].result=rankName(r);if(!best||cmpRank(r,best)>0){best=r;winners=[i];}else if(cmpRank(r,best)===0)winners.push(i);}
  const share=Math.floor(s.pot/winners.length);let rem=s.pot-share*winners.length;for(const i of winners){s.seats[i].chips+=share+(rem-->0?1:0);s.seats[i].result=(s.seats[i].result||'')+' · 胜';}
  if(s.practice&&s.practiceSnapshot){for(const p of s.seats)if(p){if(p.isBot||isBotId(p.userId))p.chips=1000;else if(s.practiceSnapshot[p.userId]!=null)p.chips=s.practiceSnapshot[p.userId];}}for(const p of s.seats)if(p)p.ready=(p.isBot||isBotId(p.userId));s.phase='result';s.turnSeat=null;s.message=`本局结束，赢家 ${winners.length} 位`;s.handNo++;}
function pkAfterAction(s,i){
  const active=pkActive(s);if(active.length<=1){pkShowdown(s);return;}if(pkRoundDone(s)){pkAdvancePhase(s);return;}s.turnSeat=nextSeat(s,i,p=>p?.inHand&&!p.folded);}
function pokerAction(s,userId,a){
  if(a.type==='join'){let i=pkSeat(s,userId);if(i<0){i=Number.isInteger(a.seat)?a.seat:s.seats.findIndex(x=>!x);if(i<0||i>=5||s.seats[i])throw Error('座位不可用');s.seats[i]={userId,chips:1000,ready:false,cards:[],folded:false,roundBet:0,totalBet:0,result:null,inHand:false};}return;}
  if(a.type==='leave'){const i=pkSeat(s,userId);if(i>=0){const wasTurn=s.turnSeat===i;s.seats[i]=null;if(wasTurn&&['preflop','flop','turn','river'].includes(s.phase))pkAfterAction(s,i);}return;}
  const i=pkSeat(s,userId);if(i<0)throw Error('请先入座');const p=s.seats[i];if(a.type==='focus_forfeit'){if(!s.practice&&['preflop','flop','turn','river'].includes(s.phase)&&p.inHand&&!p.folded){p.folded=true;p.result='切屏自动弃牌';if(!s.acted.includes(i))s.acted.push(i);pkAfterAction(s,i);}return;}
  if(a.type==='ready'){if(['preflop','flop','turn','river'].includes(s.phase))throw Error('本局进行中');p.ready=!p.ready;if(s.phase==='result')s.phase='waiting';return;}
  if(a.type==='start'){if(!['waiting','result'].includes(s.phase))throw Error('本局进行中');pkStart(s);return;}
  if(!['preflop','flop','turn','river'].includes(s.phase)||s.turnSeat!==i)throw Error('还没轮到你');
  if(a.type==='fold'){p.folded=true;s.acted.push(i);pkAfterAction(s,i);return;}
  const need=Math.max(0,s.currentBet-p.roundBet);
  if(a.type==='check'){if(need!==0)throw Error('当前需要跟注');if(!s.acted.includes(i))s.acted.push(i);pkAfterAction(s,i);return;}
  if(a.type==='call'){const amt=Math.min(need,p.chips);if(amt<need)throw Error('筹码不足，当前版本不开放边池全下');p.chips-=amt;p.roundBet+=amt;p.totalBet+=amt;s.pot+=amt;if(!s.acted.includes(i))s.acted.push(i);pkAfterAction(s,i);return;}
  if(a.type==='raise'){
    const raiseBy=clamp(Number(a.amount)||s.minRaise,s.minRaise,200),target=s.currentBet+raiseBy,amt=target-p.roundBet;if(amt>p.chips)throw Error('筹码不足');p.chips-=amt;p.roundBet=target;p.totalBet+=amt;s.pot+=amt;s.currentBet=target;s.minRaise=raiseBy;s.acted=[i];pkAfterAction(s,i);return;
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
function gomokuMoveScore(board,m,c){
  board[m.y][m.x]=c;let score=0;for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]])score+=gomokuLineScore(board,m.x,m.y,c,dx,dy);board[m.y][m.x]=null;score+=35-(Math.abs(m.x-7)+Math.abs(m.y-7));return score;
}
function gomokuBotMove(s){
  const pi=s.turn,c=pi===0?'B':'W',opp=pi===0?'W':'B',cand=gomokuCandidates(s.board,2);
  for(const m of cand){s.board[m.y][m.x]=c;const w=gomokuWin(s.board,m.x,m.y,c);s.board[m.y][m.x]=null;if(w)return m;}
  for(const m of cand){s.board[m.y][m.x]=opp;const w=gomokuWin(s.board,m.x,m.y,opp);s.board[m.y][m.x]=null;if(w)return m;}
  const ranked=cand.map(m=>({m,attack:gomokuMoveScore(s.board,m,c),defend:gomokuMoveScore(s.board,m,opp)})).sort((a,b)=>Math.max(b.attack,b.defend*.96)-Math.max(a.attack,a.defend*.96)).slice(0,18);
  let best=null,bestV=-Infinity;
  for(const r of ranked){const m=r.m;s.board[m.y][m.x]=c;
    const replies=gomokuCandidates(s.board,2).map(q=>({q,v:Math.max(gomokuMoveScore(s.board,q,opp),gomokuMoveScore(s.board,q,c)*.88)})).sort((a,b)=>b.v-a.v).slice(0,12);
    let worst=0;for(const rr of replies){const q=rr.q;s.board[q.y][q.x]=opp;const ov=gomokuMoveScore(s.board,q,c);const tv=gomokuMoveScore(s.board,q,opp);s.board[q.y][q.x]=null;worst=Math.max(worst,tv+ov*.4);}
    s.board[m.y][m.x]=null;const v=r.attack*1.08+r.defend*.98-worst*.82+Math.random()*3;if(v>bestV){bestV=v;best=m;}
  }
  return best||ranked[0]?.m||cand[0]||null;
}

function xqMoves(board,side){const moves=[];for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(!p||xqSide(p)!==side)continue;for(let yy=0;yy<10;yy++)for(let xx=0;xx<9;xx++)if(xqLegal(board,x,y,xx,yy)){const t=board[yy][xx];moves.push({x1:x,y1:y,x2:xx,y2:yy,p,captured:t,order:(t?XQ_VAL[t.toLowerCase()]||0:0)+(p.toLowerCase()==='p'?20:0)});}}return moves.sort((a,b)=>b.order-a.order)}
function xqApply(board,m){const b=clone(board);b[m.y2][m.x2]=b[m.y1][m.x1];b[m.y1][m.x1]=null;return b;}
function xqEval(board,root){let v=0;for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=board[y][x];if(!p)continue;const side=xqSide(p),type=p.toLowerCase();let pv=XQ_VAL[type]||0;if(type==='p'){const adv=side===0?9-y:y;pv+=adv*10;if((side===0&&y<=4)||(side===1&&y>=5))pv+=35;}if(type==='n'||type==='c')pv+=18-(Math.abs(x-4)*3);v+=(side===root?pv:-pv);}return v;}
function xqSearch(board,side,root,depth,alpha,beta){const g=xqFindGeneral(board,side),og=xqFindGeneral(board,1-side);if(!g)return -999999-depth;if(!og)return 999999+depth;if(depth<=0)return xqEval(board,root);const moves=xqMoves(board,side);if(!moves.length)return xqEval(board,root)-5000;const maximize=side===root;let best=maximize?-Infinity:Infinity;for(const m of moves.slice(0,36)){const b=xqApply(board,m),v=xqSearch(b,1-side,root,depth-1,alpha,beta);if(maximize){best=Math.max(best,v);alpha=Math.max(alpha,best);}else{best=Math.min(best,v);beta=Math.min(beta,best);}if(beta<=alpha)break;}return best;}
function xiangqiBotMove(s){const side=s.turn,moves=xqMoves(s.board,side);let best=null,bv=-Infinity;for(const m of moves){const immediate=m.captured?.toLowerCase()==='k'?999999:0;const b=xqApply(s.board,m),v=immediate+xqSearch(b,1-side,side,2,-Infinity,Infinity)+(m.order||0)*.12+Math.random();if(v>bv){bv=v;best=m;}}return best;}

function chMoves(s,side){const moves=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=s.board[y][x];if(!p||chSide(p)!==side)continue;for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)if(chLegal(s,x,y,xx,yy,'q')){const t=s.board[yy][xx];moves.push({x1:x,y1:y,x2:xx,y2:yy,promotion:'q',captured:t,order:(t?CH_VAL[chType(t)]||0:0)+(chType(p)==='p'?10:0)});}}return moves.sort((a,b)=>b.order-a.order)}
function chEval(s,root){let v=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=s.board[y][x];if(!p)continue;const side=chSide(p),t=chType(p);let pv=CH_VAL[t]||0;const center=(3.5-Math.abs(x-3.5))+(3.5-Math.abs(y-3.5));if(['n','b','q'].includes(t))pv+=center*5;if(t==='p')pv+=(side===0?(6-y):(y-1))*8;v+=(side===root?pv:-pv);}return v;}
function chSearch(s,side,root,depth,alpha,beta){const king=chFindKing(s.board,side);if(!king)return -999999-depth;if(depth<=0)return chEval(s,root);const moves=chMoves(s,side);if(!moves.length){const checked=chAttacked(s,king[0],king[1],1-side);return checked?(side===root?-900000-depth:900000+depth):0;}const maximize=side===root;let best=maximize?-Infinity:Infinity;for(const m of moves.slice(0,38)){const ns=chApplyCopy(s,m.x1,m.y1,m.x2,m.y2,m.promotion);ns.turn=1-side;const v=chSearch(ns,1-side,root,depth-1,alpha,beta);if(maximize){best=Math.max(best,v);alpha=Math.max(alpha,best);}else{best=Math.min(best,v);beta=Math.min(beta,best);}if(beta<=alpha)break;}return best;}
function chessBotMove(s){const side=s.turn,moves=chMoves(s,side);let best=null,bv=-Infinity;for(const m of moves){const ns=chApplyCopy(s,m.x1,m.y1,m.x2,m.y2,'q');ns.turn=1-side;const v=chSearch(ns,1-side,side,2,-Infinity,Infinity)+(m.order||0)*.08+Math.random();if(v>bv){bv=v;best=m;}}return best;}

function blackjackBotAction(s,p){
  const total=bjValue(p.hand),dealer=s.dealer[0],dv=dealer?Math.min(10,cardValueRank(dealer.r==='A'?'A':dealer.r)):10;let aces=0,raw=0;for(const c of p.hand){if(c.r==='A'){aces++;raw+=11}else raw+=Math.min(10,cardValueRank(c.r))}while(raw>21&&aces){raw-=10;aces--;}const soft=aces>0&&raw<=21;
  if(soft){if(total<=17)return 'hit';if(total===18&&dv>=9)return 'hit';return 'stand';}
  if(total<=11)return 'hit';if(total===12)return (dv>=4&&dv<=6)?'stand':'hit';if(total>=13&&total<=16)return (dv>=2&&dv<=6)?'stand':'hit';return 'stand';
}
function pokerPreflopStrength(cards){if(!cards||cards.length<2)return .3;const [a,b]=cards,va=cardValueRank(a.r),vb=cardValueRank(b.r),hi=Math.max(va,vb),lo=Math.min(va,vb),pair=va===vb,suited=a.s===b.s,gap=hi-lo;let s=hi/14*.36+lo/14*.12;if(pair)s=.52+hi/14*.42;if(suited)s+=.07;if(gap<=1)s+=.08;else if(gap===2)s+=.035;if(hi===14)s+=.08;return clamp(s,0,1);}
function pokerMonteCarlo(s,p,samples=44){const known=[...p.cards,...s.community],knownIds=new Set(known.map(c=>c.id)),deck=stdDeck().filter(c=>!knownIds.has(c.id)),opp=Math.max(1,pkActive(s).length-1);let score=0;for(let z=0;z<samples;z++){const d=shuffle(deck.slice()),comm=s.community.concat(d.splice(0,5-s.community.length)),my=best7([...p.cards,...comm]);let win=true,ties=0;for(let o=0;o<opp;o++){const oh=[d.pop(),d.pop()],r=best7([...oh,...comm]),cmp=cmpRank(my,r);if(cmp<0){win=false;break;}if(cmp===0)ties++;}if(win)score+=ties?1/(ties+1):1;}return score/samples;}
function pokerBotAction(s,p){const need=Math.max(0,s.currentBet-p.roundBet),potOdds=need>0?need/(s.pot+need):0,phase=s.phase;let strength=phase==='preflop'?pokerPreflopStrength(p.cards):pokerMonteCarlo(s,p,36);strength+=Math.random()*.05-.025;
  if(need===0){if(strength>.78&&p.chips>=s.minRaise&&Math.random()<.65)return {type:'raise',amount:Math.min(80,Math.max(s.minRaise,Math.round((20+strength*60)/10)*10))};if(strength>.58&&p.chips>=s.minRaise&&Math.random()<.28)return {type:'raise',amount:s.minRaise};return {type:'check'};}
  if(strength+0.04<potOdds)return {type:'fold'};if(strength>.82&&p.chips>need+s.minRaise&&Math.random()<.58)return {type:'raise',amount:Math.min(100,Math.max(s.minRaise,40))};if(need<=p.chips)return {type:'call'};return {type:'fold'};
}
export function addBotToGame(s,seat=null){
  if(!s)throw Error('不是游戏房间');const id=botId(s.kind);
  if(['gomoku','xiangqi','chess'].includes(s.kind)){const i=Number.isInteger(seat)?seat:s.players.findIndex(x=>!x);if(i<0||i>1||s.players[i])throw Error('没有空位');s.players[i]=id;s.ready[i]=true;boardReadyMaybeStart(s);return id;}
  if(!['waiting','result'].includes(s.phase))throw Error('对局进行中，不能调整 AI');const i=Number.isInteger(seat)?seat:s.seats.findIndex(x=>!x);if(i<0||i>=5||s.seats[i])throw Error('没有空位');
  if(s.kind==='blackjack')s.seats[i]={userId:id,isBot:true,chips:1000,bet:20,ready:true,hand:[],stood:false,busted:false,result:null};
  else if(s.kind==='poker')s.seats[i]={userId:id,isBot:true,chips:1000,ready:true,cards:[],folded:false,roundBet:0,totalBet:0,result:null,inHand:false};
  return id;
}
export function removeBotFromGame(s,seat=null){
  if(['gomoku','xiangqi','chess'].includes(s.kind)){const i=Number.isInteger(seat)?seat:s.players.findIndex(isBotId);if(i>=0&&isBotId(s.players[i])){s.players[i]=null;s.ready[i]=false;s.started=false;}return;}
  if(!['waiting','result'].includes(s.phase))throw Error('对局进行中，不能调整 AI');const i=Number.isInteger(seat)?seat:s.seats.findIndex(x=>x&&(x.isBot||isBotId(x.userId)));if(i>=0&&s.seats[i]&&(s.seats[i].isBot||isBotId(s.seats[i].userId)))s.seats[i]=null;
}
export function advanceBots(s,maxSteps=80){
  if(!s)return;
  for(let step=0;step<maxSteps;step++){
    if(s.kind==='gomoku'){const id=s.players[s.turn];if(!isBotId(id)||s.winner||s.players.some(x=>!x))break;const m=gomokuBotMove(s);if(!m)break;gomokuAction(s,id,{type:'place',...m});continue;}
    if(s.kind==='xiangqi'){const id=s.players[s.turn];if(!isBotId(id)||s.winner||s.players.some(x=>!x))break;const m=xiangqiBotMove(s);if(!m)break;xiangqiAction(s,id,{type:'move',...m});continue;}
    if(s.kind==='chess'){const id=s.players[s.turn];if(!isBotId(id)||s.winner||s.result||s.players.some(x=>!x))break;const m=chessBotMove(s);if(!m)break;chessAction(s,id,{type:'move',...m});continue;}
    if(s.kind==='blackjack'){
      if(!['playing','dealer'].includes(s.phase))break;const p=s.seats[s.turnSeat];if(!p||!(p.isBot||isBotId(p.userId)))break;blackjackAction(s,p.userId,{type:blackjackBotAction(s,p)});continue;
    }
    if(s.kind==='poker'){
      if(!['preflop','flop','turn','river'].includes(s.phase))break;const p=s.seats[s.turnSeat];if(!p||!(p.isBot||isBotId(p.userId)))break;pokerAction(s,p.userId,pokerBotAction(s,p));continue;
    }
    break;
  }
}
export function hasBot(s){return !s?false:['gomoku','xiangqi','chess'].includes(s.kind)?s.players.some(isBotId):s.seats.some(x=>x&&(x.isBot||isBotId(x.userId)))}
export function createGame(kind){if(kind==='gomoku')return createGomoku();if(kind==='xiangqi')return createXiangqi();if(kind==='chess')return createChess();if(kind==='blackjack')return createBlackjack();if(kind==='poker')return createPoker();return null;}
export function applyGameAction(state,userId,action){if(!state)throw Error('不是游戏房间');if(state.kind==='gomoku')gomokuAction(state,userId,action);else if(state.kind==='xiangqi')xiangqiAction(state,userId,action);else if(state.kind==='chess')chessAction(state,userId,action);else if(state.kind==='blackjack')blackjackAction(state,userId,action);else if(state.kind==='poker')pokerAction(state,userId,action);else throw Error('未知游戏');return state;}

export function publicGameState(state,viewerId){
  if(!state)return null;const s=clone(state);
  if(s.kind==='blackjack'&&['playing','dealer'].includes(s.phase)){
    if(s.dealer.length>1&&s.phase==='playing')s.dealer=[s.dealer[0],{hidden:true}];
  }
  if(s.kind==='poker'&&['preflop','flop','turn','river'].includes(s.phase)){
    for(const seat of s.seats)if(seat&&seat.userId!==viewerId)seat.cards=seat.cards.map(()=>({hidden:true}));
  }
  return s;
}

export function gameSeatInfo(state){
  if(!state)return [];
  if(['gomoku','xiangqi','chess'].includes(state.kind))return state.players;
  return state.seats.map(s=>s?.userId||null);
}

export function roomInitialState(def){return {roomId:def.id,category:def.category,music:def.category==='music'?{trackId:'',title:'',setBy:'',updatedAt:0}:null,game:def.game?createGame(def.game):null,messages:[]};}

export {XQ,bjValue,rankName};

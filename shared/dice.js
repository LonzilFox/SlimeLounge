const BOT_PREFIX='BOT:';
const isBotId=v=>typeof v==='string'&&v.startsWith(BOT_PREFIX);
const uid=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const botId=()=>`${BOT_PREFIX}dice:${uid()}`;
const roll5=()=>Array.from({length:5},()=>1+Math.floor(Math.random()*6));
const occupied=s=>s.seats.map((p,i)=>p?i:-1).filter(i=>i>=0);
const nextSeat=(s,from)=>{for(let n=1;n<=s.seats.length;n++){const i=(from+n+s.seats.length)%s.seats.length;if(s.seats[i])return i;}return -1;};
const faceOrder=f=>f===1?7:f;

export function createDiceGame(){
  return {kind:'dice',seats:Array(6).fill(null),phase:'waiting',turnSeat:null,turnStartedAt:0,turnTimeoutMs:30000,call:null,lastCallerSeat:null,round:1,winner:null,loser:null,result:null,message:'等待 2~6 位玩家入座',finishedAt:0,entryFee:0};
}
function seatIndex(s,u){return s.seats.findIndex(x=>x?.userId===u);}
function minCount(s){return Math.max(2,occupied(s).length);}
function start(s){
  const ids=occupied(s);
  if(ids.length<2)throw Error('至少需要 2 位玩家');
  if(ids.some(i=>!s.seats[i].isBot&&!s.seats[i].ready))throw Error('所有真人玩家都准备后才能开始');
  for(const i of ids){const p=s.seats[i];p.dice=roll5();p.revealed=false;p.ready=p.isBot;p.result='';}
  s.call=null;s.lastCallerSeat=null;s.winner=null;s.loser=null;s.result=null;s.phase='playing';s.finishedAt=0;
  s.turnSeat=ids[Math.floor(Math.random()*ids.length)];s.turnStartedAt=Date.now();s.message='摇骰完成 · 普通状态下 1 可作百搭';
}
function validCall(s,count,face,zai,fei=false){
  count=Math.floor(Number(count));face=Math.floor(Number(face));
  if(count<minCount(s)||face<1||face>6)return false;
  if(!s.call)return !fei;
  const prev=s.call;
  if(fei)return !!prev.zai&&!zai&&count>=prev.count*2;
  if(prev.zai&&!zai)return false;
  if(!prev.zai&&zai)return count>=prev.count;
  if(count>prev.count)return true;
  if(count<prev.count)return false;
  return faceOrder(face)>faceOrder(prev.face);
}
function actualCount(s,call){
  let n=0;
  for(const i of occupied(s))for(const d of s.seats[i].dice||[])if(d===call.face||(!call.zai&&call.face!==1&&d===1))n++;
  return n;
}
function finish(s,challenger){
  const caller=s.lastCallerSeat;
  if(caller==null||!s.call)throw Error('还没有可以开的上一手');
  const actual=actualCount(s,s.call),truth=actual>=s.call.count,loser=truth?challenger:caller,winner=truth?caller:challenger;
  s.winner=s.seats[winner]?.userId||null;s.loser=s.seats[loser]?.userId||null;s.result=truth?'challenge_failed':'bluff_caught';
  s.phase='result';s.turnSeat=null;s.finishedAt=Date.now();
  for(const i of occupied(s)){s.seats[i].revealed=true;s.seats[i].result=i===winner?'胜':i===loser?'负':'';s.seats[i].ready=s.seats[i].isBot;}
  s.message=`开盅：${s.call.count} 个 ${s.call.face}${s.call.zai?' · 斋':''}，实际 ${actual} 个 · ${truth?'叫骰成立，开盅者输':'叫骰不足，上家输'}`;
  s.round++;
}
export function applyDiceAction(s,u,a){
  if(a.type==='join'){
    if(seatIndex(s,u)>=0)return;
    const i=Number.isInteger(a.seat)?a.seat:s.seats.findIndex(x=>!x);
    if(i<0||i>=s.seats.length||s.seats[i])throw Error('座位不可用');
    s.seats[i]={userId:u,isBot:isBotId(u),ready:isBotId(u),dice:[],revealed:false,result:''};return;
  }
  if(a.type==='leave'){
    const i=seatIndex(s,u);if(i<0)return;
    if(s.phase==='playing'){const p=s.seats[i];s.seats[i]={...p,userId:botId(),isBot:true,ready:true,forfeitUserId:p.forfeitUserId||u,forfeited:true};return;}
    s.seats[i]=null;return;
  }
  const i=seatIndex(s,u);if(i<0)throw Error('请先入座');const p=s.seats[i];
  if(a.type==='ready'){if(s.phase==='playing')throw Error('本轮进行中');if(!p.isBot)p.ready=!p.ready;return;}
  if(a.type==='start'){if(!['waiting','result'].includes(s.phase))throw Error('本轮进行中');start(s);return;}
  if(a.type==='reset'){if(!['waiting','result'].includes(s.phase))throw Error('本轮进行中');s.phase='waiting';s.call=null;s.winner=null;s.loser=null;s.result=null;s.finishedAt=0;return;}
  if(s.phase!=='playing'||s.turnSeat!==i)throw Error('还没轮到你');
  if(a.type==='challenge'){if(s.lastCallerSeat==null)throw Error('第一手不能开盅');finish(s,i);return;}
  if(a.type==='call'){
    const count=Math.floor(Number(a.count)),face=Math.floor(Number(a.face)),zai=!!a.zai,fei=!!a.fei;
    if(!validCall(s,count,face,zai,fei))throw Error(fei?'飞斋时数量至少为上一手斋骰的 2 倍':'叫骰必须高于上一手；斋后只能继续斋，除非使用“飞”');
    s.call={count,face,zai,fei,by:i};s.lastCallerSeat=i;s.turnSeat=nextSeat(s,i);s.turnStartedAt=Date.now();
    s.message=`${count} 个 ${face}${zai?' · 斋（1 不百搭）':fei?' · 飞（恢复 1 百搭）':' · 1 可百搭'}`;return;
  }
  throw Error('未知摇骰操作');
}
export function addDiceBot(s,seat=null){
  if(occupied(s).filter(i=>!s.seats[i].isBot).length<1)throw Error('至少先有一位真人入座');
  const i=Number.isInteger(seat)?seat:s.seats.findIndex(x=>!x);if(i<0||i>=s.seats.length||s.seats[i])throw Error('没有空位');
  const id=botId();s.seats[i]={userId:id,isBot:true,ready:true,dice:[],revealed:false,result:''};return id;
}
export function removeDiceBot(s,seat=null){
  if(s.phase==='playing')throw Error('本轮进行中不能移除 AI');
  const i=Number.isInteger(seat)?seat:s.seats.findIndex(x=>x?.isBot);if(i>=0&&s.seats[i]?.isBot){s.seats[i]=null;return true;}return false;
}
export function diceHasBot(s){return !!s?.seats?.some(x=>x?.isBot);}
function botAction(s,p){
  if(!s.call){const face=2+Math.floor(Math.random()*5),mine=(p.dice||[]).filter(d=>d===face||d===1).length;return {type:'call',count:Math.max(minCount(s),mine+occupied(s).length-1),face,zai:false};}
  const c=s.call,own=(p.dice||[]).filter(d=>d===c.face||(!c.zai&&c.face!==1&&d===1)).length,total=occupied(s).length*5;
  const expected=own+(total-5)*(c.zai||c.face===1?1/6:1/3),risk=c.count-expected;
  if(risk>1.3||Math.random()<Math.max(.08,risk*.18))return {type:'challenge'};
  let count=c.count,face=c.face,zai=c.zai;if(faceOrder(face)<6)face=face===1?2:face+1;else{count++;face=2;}
  return {type:'call',count,face,zai};
}
export function advanceDiceBots(s,max=30){for(let n=0;n<max;n++){if(s.phase!=='playing')break;const p=s.seats[s.turnSeat];if(!p?.isBot)break;applyDiceAction(s,p.userId,botAction(s,p));}}
export function publicDiceState(s,viewerId){const x=JSON.parse(JSON.stringify(s));for(const p of x.seats||[])if(p&&p.userId!==viewerId&&!p.revealed)p.dice=(p.dice||[]).map(()=>0);x.serverNow=Date.now();return x;}
export function tickDice(s,now=Date.now()){
  if(s?.phase==='playing'&&s.turnSeat!=null&&s.turnStartedAt&&now-s.turnStartedAt>=(s.turnTimeoutMs||30000)){
    const p=s.seats[s.turnSeat];
    if(p&&!p.isBot){if(s.lastCallerSeat!=null)finish(s,s.turnSeat);else applyDiceAction(s,p.userId,{type:'call',count:minCount(s),face:2+Math.floor(Math.random()*5),zai:false});return {changed:true,forceLeaveUsers:[],autoReset:false};}
  }
  return {changed:false,forceLeaveUsers:[],autoReset:!!(s?.finishedAt&&now-s.finishedAt>=60000)};
}

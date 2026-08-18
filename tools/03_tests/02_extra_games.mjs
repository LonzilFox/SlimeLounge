import assert from 'node:assert/strict';
import {ROOM_DEFS,roomInitialState,createGame,applyGameAction,addBotToGame,advanceBots,publicGameState,hasBot} from '../../shared/games.js';

const counts={};for(const r of ROOM_DEFS.filter(x=>x.game))counts[r.game]=(counts[r.game]||0)+1;
assert.deepEqual(Object.fromEntries(Object.entries(counts).filter(([k])=>['sudoku','minesweeper','go','mahjong','uno'].includes(k))),{sudoku:3,minesweeper:5,go:3,mahjong:2,uno:2});
for(const r of ROOM_DEFS.filter(x=>x.single))assert.equal(roomInitialState(r).game,null,'single-player rooms must not create shared server game state');

function prepTwo(kind){const s=createGame(kind);applyGameAction(s,'U',{type:'join',seat:0});addBotToGame(s,1);applyGameAction(s,'U',{type:'ready'});assert.equal(s.started,true);assert.equal(hasBot(s),true);return s}
{
 const s=prepTwo('go');assert.equal(s.size,19,'go board must be 19x19');assert.equal(s.board.length,19);assert.equal(s.board[0].length,19);applyGameAction(s,'U',{type:'place',x:18,y:18});assert.equal(s.board[18][18],0,'bottom-right intersection must be playable');advanceBots(s);assert.equal(s.board.flat().filter(x=>x!=null).length,2);const pub=publicGameState(s,'U');assert.equal(pub.kind,'go');assert.equal(pub.size,19);
}
function prepFour(kind){const s=createGame(kind);applyGameAction(s,'U',{type:'join',seat:0});applyGameAction(s,'U',{type:'ready'});applyGameAction(s,'U',{type:'start'});assert.equal(hasBot(s),true);assert.equal(s.phase,'playing');return s}
function advanceUnoToHuman(s){for(let n=0;n<20;n++){advanceBots(s,80);if(s.pendingWild4?.target===0){applyGameAction(s,'U',{type:'accept_wild4'});continue}if(s.phase==='playing'&&s.turnSeat===0&&!s.pendingWild4)return}assert.equal(s.phase,'playing');assert.equal(s.turnSeat,0,'UNO must return turn to human after initial/action bots');assert.equal(s.pendingWild4,null,'UNO human turn must not be blocked by unresolved +4')}
{
 const s=prepFour('uno');advanceUnoToHuman(s);const me=s.seats[0];const idx=me.hand.findIndex(c=>c.c==='W'||c.c===s.currentColor||c.v===s.discard.at(-1)?.v),played=idx>=0?{...me.hand[idx]}:null;applyGameAction(s,'U',idx>=0?{type:'play',index:idx,color:'R'}:{type:'draw'});if(played?.c==='W')assert.equal(s.lastChosenColor,'R');advanceBots(s,20);const pub=publicGameState(s,'U');assert(pub.seats[1].hand.every(x=>x.hidden));assert.equal(pub.seats[1].handCount,s.seats[1].hand.length);
}
{
 const s=prepFour('mahjong');applyGameAction(s,'U',{type:'discard',index:0});advanceBots(s,20);const pub=publicGameState(s,'U');assert(pub.seats[1].hand.every(x=>x.hidden));assert(s.wall.length<83);
}


// v0.1.3 safety: a table may never be created with AI only.
for(const kind of ['go','uno','mahjong']){
  const s=createGame(kind);
  assert.throws(()=>addBotToGame(s,0),/真人/,`${kind}: AI-only table must be rejected`);
}
// Human + AI regression: bots may act only while a human still occupies the table.
{
  const s=prepTwo('go');applyGameAction(s,'U',{type:'place',x:4,y:4});advanceBots(s,8);assert(s.players.includes('U'));
}
{
  const s=prepFour('uno');advanceUnoToHuman(s);const me=s.seats[0];const idx=me.hand.findIndex(c=>c.c==='W'||c.c===s.currentColor||c.v===s.discard.at(-1)?.v);applyGameAction(s,'U',idx>=0?{type:'play',index:idx,color:'R'}:{type:'draw'});advanceBots(s,50);assert(s.seats.some(p=>p?.userId==='U'));
}
{
  const s=prepFour('mahjong');applyGameAction(s,'U',{type:'discard',index:0});advanceBots(s,50);assert(s.seats.some(p=>p?.userId==='U'));const pub=publicGameState(s,'U');assert(pub.seats.filter((p,i)=>p&&i!==0).every(p=>p.hand.every(x=>x.hidden)));
}

console.log('[OK] extra games: rooms / go / UNO / mahjong / privacy / AI-human guard');

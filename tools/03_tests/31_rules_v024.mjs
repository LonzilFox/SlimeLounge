import assert from 'node:assert/strict';
import {ROOM_DEFS,createGame,applyGameAction,isBotId} from '../../shared/games.js';

const pokerRooms=ROOM_DEFS.filter(r=>r.game==='poker');
assert.equal(pokerRooms.length,2);
assert(pokerRooms.every(r=>r.capacity===8&&r.minPlayers===1),'poker should only raise max seats to 8');
{
  const s=createGame('poker');
  assert.equal(s.seats.length,8,'poker table must have 8 seats');
  applyGameAction(s,'P1',{type:'join',seat:0,chips:2345});
  applyGameAction(s,'P1',{type:'ready'});
  applyGameAction(s,'P1',{type:'start'});
  const occupied=s.seats.filter(Boolean);
  assert.equal(occupied.length,2,'single-human poker practice must retain old auto-AI start rule');
  assert(occupied.some(p=>p.userId==='P1'));
  assert(occupied.some(p=>p.isBot||isBotId(p.userId)));
  assert.equal(s.practice,true);
}

function joinUno4(){
  const s=createGame('uno');
  for(let i=0;i<4;i++)applyGameAction(s,`U${i+1}`,{type:'join',seat:i});
  for(let i=0;i<4;i++)applyGameAction(s,`U${i+1}`,{type:'ready'});
  applyGameAction(s,'U1',{type:'start'});
  return s;
}
function forceFinish(s,seat,userId){
  s.phase='playing';s.pendingWild4=null;s.drawnSeat=null;s.drawnIndex=null;s.currentColor='R';s.discard=[{c:'R',v:'9'}];s.turnSeat=seat;s.seats[seat].hand=[{c:'R',v:'1'}];
  applyGameAction(s,userId,{type:'play',index:0});
}
{
  const s=joinUno4();
  forceFinish(s,0,'U1');
  assert.deepEqual(s.finishOrder,[0]);
  assert.equal(s.phase,'playing','remaining players must continue after first winner');
  applyGameAction(s,'U1',{type:'leave'});
  assert.equal(s.seats[0].departed,true,'placed UNO winner may leave freely');
  assert.equal(s.seats[0].forfeited,false,'placed winner must not become a forfeit');
  forceFinish(s,1,'U2');
  forceFinish(s,2,'U3');
  assert.equal(s.phase,'result');
  assert.deepEqual(s.placements,[0,1,2,3],'UNO must retain 1st/2nd/3rd/4th order');
}
{
  const s=createGame('uno');
  for(let i=0;i<2;i++)applyGameAction(s,`H${i+1}`,{type:'join',seat:i});
  for(let i=0;i<2;i++)applyGameAction(s,`H${i+1}`,{type:'ready'});
  applyGameAction(s,'H1',{type:'start'});
  applyGameAction(s,'H1',{type:'leave'});
  assert(s.seats[0]?.isBot,'mid-game human leave must become AI trustee');
  assert.equal(s.seats[0]?.forfeitUserId,'H1');
  assert.equal(s.seats[0]?.forfeited,true);
}
console.log('[OK] v0.2.4 rules: poker max 8 with original minimum / UNO placements / placed-winner exit / trustee');

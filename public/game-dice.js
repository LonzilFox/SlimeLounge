function dicePips(n){if(!n)return '<span class="die-face hidden-die" aria-label="未公开骰子"><i class="die-question">?</i></span>';return `<span class="die-face d${n}" role="img" aria-label="${n}点">${Array.from({length:9},(_,i)=>`<i class="pip p${i+1}"></i>`).join('')}</span>`}
function renderDice(e){
  const s=state.game,me=(s.seats||[]).findIndex(x=>x?.userId===state.profile.userId),mine=me>=0?s.seats[me]:null,call=s.call;
  const dice=mine?.dice?.length?`<div class="dice-hand">${mine.dice.map(dicePips).join('')}</div>`:'';
  const prev=call?`<div class="dice-current-call"><b>${call.count} 个 ${call.face}</b><span>${call.zai?'斋 · 1 不百搭':call.fei?'飞 · 恢复 1 百搭':'普通 · 1 可百搭'}</span></div>`:'<div class="dice-current-call muted">还没有叫骰</div>';
  const myTurn=s.phase==='playing'&&s.turnSeat===me,countMin=Math.max(2,(s.seats||[]).filter(Boolean).length),defaultCount=Math.max(countMin,(call?.count||countMin));
  e.innerHTML=`<div class="game-wrap dice-game"><div class="game-status">${esc(s.message||'')}</div>${gameClockHtml(s)}${extraSeatControls(s,2)}${prev}${dice}${mine&&s.phase==='playing'?`<div class="dice-action-panel ${myTurn?'':'disabled-panel'}"><label>数量<input id="diceCount" type="number" inputmode="numeric" min="${countMin}" max="30" value="${defaultCount}"></label><label>点数<select id="diceFace">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${n===(call?.face||2)?'selected':''}>${n}</option>`).join('')}</select></label><div class="game-toolbar"><button id="diceCall" class="primary" ${myTurn?'':'disabled'}>叫骰</button><button id="diceZai" ${myTurn?'':'disabled'}>斋</button>${call?.zai?`<button id="diceFei" ${myTurn?'':'disabled'}>飞</button>`:''}<button id="diceOpen" class="danger" ${myTurn&&call?'':'disabled'}>开盅</button></div><small>普通：1 可作百搭；斋：1 只算 1；飞：从斋恢复普通，数量至少为上一手斋骰的 2 倍。开盅后比较全桌实际数量。</small></div>`:''}${s.phase==='result'?`<div class="result-box"><b>${esc(s.message||'本轮结束')}</b><div class="dice-reveal-grid">${(s.seats||[]).filter(Boolean).map(p=>`<div><b>${esc(seatName(p))}</b><div class="dice-hand mini">${(p.dice||[]).map(dicePips).join('')}</div></div>`).join('')}</div></div>`:''}</div>`;
  bindExtraSeats(e);
  if(!mine||!myTurn)return;
  const val=()=>({count:Math.floor(Number($('#diceCount')?.value)||countMin),face:Math.floor(Number($('#diceFace')?.value)||2)});
  $('#diceCall')&&($('#diceCall').onclick=()=>gameAction({type:'call',...val(),zai:false}));
  $('#diceZai')&&($('#diceZai').onclick=()=>gameAction({type:'call',...val(),zai:true}));
  $('#diceFei')&&($('#diceFei').onclick=()=>gameAction({type:'call',...val(),zai:false,fei:true}));
  $('#diceOpen')&&($('#diceOpen').onclick=()=>gameAction({type:'challenge'}));
}

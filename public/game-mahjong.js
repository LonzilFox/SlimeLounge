const MJ_LABELS=['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','4p','5p','6p','7p','8p','9p','1s','2s','3s','4s','5s','6s','7s','8s','9s','东','南','西','北','白','发','中','赤5m','赤5p','赤5s'];
const MJ_ASSET_BASE='https://cdn.jsdelivr.net/gh/FluffyStuff/riichi-mahjong-tiles@master/Regular/';
const MJ_ASSET_BACKUP='https://cdn.statically.io/gh/FluffyStuff/riichi-mahjong-tiles/master/Regular/';
const MJ_ASSET_FILES=['Man1.svg','Man2.svg','Man3.svg','Man4.svg','Man5.svg','Man6.svg','Man7.svg','Man8.svg','Man9.svg','Pin1.svg','Pin2.svg','Pin3.svg','Pin4.svg','Pin5.svg','Pin6.svg','Pin7.svg','Pin8.svg','Pin9.svg','Sou1.svg','Sou2.svg','Sou3.svg','Sou4.svg','Sou5.svg','Sou6.svg','Sou7.svg','Sou8.svg','Sou9.svg','Ton.svg','Nan.svg','Shaa.svg','Pei.svg','Haku.svg','Hatsu.svg','Chun.svg','Man5-Dora.svg','Pin5-Dora.svg','Sou5-Dora.svg'];
function mjAsset(raw){if(raw&&typeof raw==='object'&&raw.hidden)return MJ_ASSET_BASE+'Back.svg';const n=Number(raw);return MJ_ASSET_BASE+(MJ_ASSET_FILES[n]||'Blank.svg')}
function mjTileFallback(raw){if(raw&&typeof raw==='object'&&raw.hidden)return '▦';const n=Number(raw);return esc(MJ_LABELS[n]||'?')}
function mjTile(t,cls=''){const hidden=t&&typeof t==='object'&&t.hidden,n=hidden?-1:Number(t),red=n>=34&&n<=36,file=hidden?'Back.svg':(MJ_ASSET_FILES[n]||'Blank.svg');return `<span class="mj-tile asset ${hidden?'back':''} ${red?'aka':''} ${cls}" title="${esc(hidden?'牌背':MJ_LABELS[n]||'?')}"><img src="${attr(MJ_ASSET_BASE+file)}" data-backup="${attr(MJ_ASSET_BACKUP+file)}" alt="${esc(hidden?'牌背':MJ_LABELS[n]||'?')}" referrerpolicy="no-referrer" onerror="if(this.dataset.backup){const u=this.dataset.backup;this.dataset.backup='';this.src=u}else{this.style.display='none';this.nextElementSibling.style.display='grid'}"><span class="mj-asset-fallback">${mjTileFallback(t)}</span></span>`}
function fitMahjongTable(scope){
  cancelAnimationFrame(scope?._mjFitFrame||0);if(!scope)return;
  scope._mjFitFrame=requestAnimationFrame(()=>{const wrap=scope.querySelector('.mj-table-scroll'),table=scope.querySelector('.mahjong-table-v2');if(!wrap||!table)return;const W=820,H=820;table.style.setProperty('width',W+'px','important');table.style.setProperty('min-width',W+'px','important');table.style.setProperty('height',H+'px','important');table.style.setProperty('min-height',H+'px','important');table.style.setProperty('transform-origin','top center','important');const maxW=Math.max(260,(wrap.clientWidth||innerWidth)-6),phone=matchMedia('(max-width:860px)').matches;let scale=Math.min(phone?1:1.08,maxW/W);if(!phone){const avail=Math.max(420,innerHeight-wrap.getBoundingClientRect().top-100);scale=Math.min(scale,Math.max(.56,avail/H))}table.style.setProperty('transform',`scale(${scale})`,'important');wrap.style.setProperty('height',`${Math.ceil(H*scale)}px`,'important');wrap.style.setProperty('overflow','visible','important');wrap.dataset.mjScale=String(scale);wrap.dataset.mjLayout=phone?'mobile':'desktop'})
}
function bindMahjongTableFit(scope){
  if(!scope)return;
  scope._mjFitObserver?.disconnect?.();
  let lastW=0,lastH=0;
  if(typeof ResizeObserver!=='undefined'){
    scope._mjFitObserver=new ResizeObserver(entries=>{const r=entries[0]?.contentRect;if(!r)return;if(Math.abs(r.width-lastW)<1&&Math.abs(r.height-lastH)<1)return;lastW=r.width;lastH=r.height;fitMahjongTable(scope)});
    scope._mjFitObserver.observe(scope);
  }
  if(!scope._mjFitWindowHandler){
    scope._mjFitWindowHandler=()=>{if(scope.querySelector('.mahjong-table-v2'))fitMahjongTable(scope)};
    addEventListener('resize',scope._mjFitWindowHandler,{passive:true});
    addEventListener('orientationchange',scope._mjFitWindowHandler,{passive:true});
    globalThis.visualViewport?.addEventListener?.('resize',scope._mjFitWindowHandler,{passive:true});
  }
  fitMahjongTable(scope)
}
function mjMelds(p,seat){return (p?.melds||[]).map(m=>{const ts=(m.tiles||[]).slice();if(m.type==='ankan')return `<span class="mj-meld ankan">${ts.map((t,i)=>i===0||i===ts.length-1?mjTile({hidden:true}):mjTile(t)).join('')}</span>`;const diff=seat!=null&&m.from!=null?(m.from-seat+4)%4:3,callPos=m.type==='chi'?0:diff===3?0:diff===2?1:Math.min(2,ts.length-1);if(m.added&&ts.length===4){const added=ts.pop();return `<span class="mj-meld kan added-kan">${ts.map((t,i)=>i===callPos?`<span class="mj-called-stack">${mjTile(t,'called')}${mjTile(added,'added')}</span>`:mjTile(t)).join('')}</span>`}return `<span class="mj-meld ${m.type}">${ts.map((t,i)=>mjTile(t,i===callPos?'called':'')).join('')}</span>`}).join('')}
function mjRiver(s,i,pos){const river=s.discards?.[i]||[];return `<div class="mj-river-grid river-${pos}">${river.map((d,k)=>{if(d?.called)return`<span class="mj-river-cell called-gap" aria-label="已被鸣走"><i></i></span>`;const riichi=!!d?.riichi,last=k===river.length-1&&s.lastDiscard?.seat===i,win=last&&s.resultDetail?.type==='ron'&&s.resultDetail?.from===i&&Number(s.resultDetail?.tile)===Number(d?.tile??d);return `<span class="mj-river-cell ${riichi?'riichi-cell':''} ${win?'winning-discard':''}">${mjTile(d?.tile??d,`river-tile ${riichi?'riichi':''} ${last?'river-last':''} ${win?'ron-tile':''}`)}${win?'<i class="mj-win-mark">和</i>':''}</span>`}).join('')}</div>`}
function mjSeatBadge(s,i,pos){const p=s.seats?.[i],wind=['東','南','西','北'][(i-(s.dealer||0)+4)%4];return `<div class="mj-seat-badge ${pos} ${s.turnSeat===i&&s.phase==='playing'?'turn':''} ${p?.riichi?'riichi':''}"><b>${wind}</b><span>${esc(seatName(p))}</span><small>${Math.round(s.points?.[i]??25000)}${p?.riichi?' · 立直':''}</small></div>`}
function mjResultRevealFor(s,seat){return (s.resultDetail?.reveals||[]).find(x=>Number(x.seat)===Number(seat))||null}
function mjEdgeRail(s,seat,pos){const p=s.seats?.[seat];if(!p)return'';const r=mjResultRevealFor(s,seat),n=Math.min(14,p.handCount??0),concealed=r?(r.hand||[]).map(x=>mjTile(x,'edge-reveal')).join(''):Array.from({length:n},()=>'<i class="mj-back"></i>').join(''),meld=mjMelds(p,seat),waits=r?.waits?.length?`<span class="mj-edge-waits">听 ${r.waits.map(x=>esc(MJ_LABELS[x]||x)).join(' ')}</span>`:'';return `<div class="mj-edge-rail ${pos} ${r?'revealed':''}"><div class="mj-edge-concealed">${concealed}</div>${meld?`<div class="mj-edge-melds">${meld}</div>`:''}${waits}</div>`}
function mjResultRevealRows(s,d){return (d.reveals||[]).map(r=>{const p=s.seats?.[r.seat],waits=(r.waits||[]).map(x=>MJ_LABELS[x]||x).join(' / ');return `<div class="mj-result-line"><b>${r.seat+1}家 · ${esc(seatName(p))}</b><span>${waits?`听牌：${esc(waits)}`:'手牌已在牌桌原座位公开'}</span></div>`}).join('')}
function mjResultHtml(s){const d=s.resultDetail;if(!d)return'';const score=x=>{const sc=x?.score;if(!sc)return'';if(sc.yakuman)return `${(sc.yaku||[]).map(y=>`${y[0]}${y[1]>1?`×${y[1]}`:''}`).join(' / ')} · ${sc.limitName||`${sc.yakuman}倍役满`}`;return `${(sc.yaku||[]).map(y=>`${y[0]} ${y[1]}番`).join(' / ')}${sc.dora?` / 宝牌 ${sc.dora}`:''}${sc.aka?` / 赤宝 ${sc.aka}`:''}${sc.ura?` / 里宝 ${sc.ura}`:''} · ${sc.han||0}番 ${sc.fu||0}符 · ${sc.limitName||'通常'} `},reveal=mjResultRevealRows(s,d);if(d.type==='tsumo')return `<div class="mj-result"><b>${d.seat+1}家 自摸</b><p>${score(d)}</p>${reveal}</div>`;if(d.type==='ron')return `<div class="mj-result"><b>荣和</b>${(d.winners||[]).map(x=>`<p>${x.seat+1}家：${score(x)}</p>`).join('')}${reveal}</div>`;if(d.type==='abortive')return `<div class="mj-result"><b>途中流局 · ${esc(d.reason||'')}</b></div>`;if(d.type==='exhaustive')return `<div class="mj-result"><b>荒牌流局</b><p>听牌：${(d.tenpai||[]).map(x=>x+1+'家').join(' / ')||'无人'}</p>${reveal}</div>`;if(d.type==='nagashi')return `<div class="mj-result"><b>流局满贯</b>${reveal}</div>`;return `<div class="mj-result"><b>本局结束</b>${reveal}</div>`}
function scrollMahjongResultIntoView(scope,s){
  if(!scope||s.phase!=='result'||!s.resultDetail)return;
  const sig=JSON.stringify([s.roundWind,s.handNo,s.honba,s.resultDetail?.type,s.resultDetail?.seat,s.resultDetail?.from,s.resultDetail?.tile,s.finishedAt||0]);
  if(scope.dataset.mjResultSig===sig)return;
  scope.dataset.mjResultSig=sig;
  const box=scope.querySelector('.mj-result');
  if(!box)return;
  requestAnimationFrame(()=>{
    try{box.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})}catch{}
  });
}
const MJ_AUTO_KEY='slimelounge.riichi.auto.v1';
function mjAutoPrefs(){try{return {pass:false,win:false,tsumogiri:false,...JSON.parse(localStorage.getItem(MJ_AUTO_KEY)||'{}')}}catch{return {pass:false,win:false,tsumogiri:false}}}
function mjSetAuto(key){const x=mjAutoPrefs();x[key]=!x[key];localStorage.setItem(MJ_AUTO_KEY,JSON.stringify(x));state.riichiAutoActKey='';renderMain()}
function scheduleRiichiAuto(s,me,p,turn,react){
  if(!p||me<0)return;
  const a=mjAutoPrefs();
  let action=null,delay=0,key='';
  const ron=react.some(x=>x.kind==='ron');
  if(react.length){
    if(ron&&a.win){action={type:'claim',kind:'ron'};delay=650;key=`ron:${s.pending?.expiresAt||0}:${s.pending?.tile}`}
    else if(a.pass&&!ron){action={type:'claim',kind:'pass'};delay=420;key=`pass:${s.pending?.expiresAt||0}:${s.pending?.tile}`}
  }else if(s.phase==='playing'&&s.turnSeat===me&&p.lastDraw!=null){
    if(turn.tsumo&&a.win){action={type:'tsumo'};delay=620;key=`tsumo:${s.turnStartedAt||0}:${p.lastDraw}`}
    else if(!turn.tsumo&&(p.riichi||a.tsumogiri)){
      const i=(p.hand||[]).lastIndexOf(p.lastDraw);
      if(i>=0){action={type:'discard',index:i};delay=450;key=`discard:${s.turnStartedAt||0}:${i}:${p.lastDraw}`}
    }
  }
  if(!action){state.riichiAutoActKey='';return}
  if(state.riichiAutoActKey===key)return;
  state.riichiAutoActKey=key;
  const pendingExpires=s.pending?.expiresAt,pendingTile=s.pending?.tile,turnStartedAt=s.turnStartedAt,lastDraw=p.lastDraw;
  setTimeout(()=>{
    const g=state.game,cp=g?.seats?.[me];
    if(state.riichiAutoActKey!==key||g?.kind!=='mahjong')return;
    const stillReaction=action.type==='claim'&&g.phase==='reaction'&&g.pending?.expiresAt===pendingExpires&&g.pending?.tile===pendingTile;
    const stillTurn=action.type!=='claim'&&g.phase==='playing'&&g.turnSeat===me&&g.turnStartedAt===turnStartedAt&&cp?.lastDraw===lastDraw;
    if(!stillReaction&&!stillTurn){state.riichiAutoActKey='';return}
    state.riichiAutoActKey='';
    gameAction(action);
  },delay);
}

function renderMahjong(e){
  const s=state.game,me=s.mySeat??s.seats.findIndex(x=>x?.userId===state.profile.userId),p=me>=0?s.seats[me]:null,r=relativeSeats(s,me),round=['東','南'][s.roundWind]||'東',turn=s.myTurnOptions||{},react=s.myReactionOptions||[],riichiSet=new Set(turn.riichiDiscards||[]),ld=s.lastDiscard,sig=ld?`${ld.seat}:${(s.discards?.[ld.seat]||[]).length}:${ld.tile}`:'',pos=ld?seatPos(r,ld.seat):'top',fly=ld&&freshAnim('mj-discard',sig)?`<div class="mj-discard-flight from-${pos}">${mjTile(ld.tile)}</div>`:'',auto=mjAutoPrefs();
  e.closest('.room-main')?.classList.add('mahjong-room-main');
  const hand=p?(p.hand||[]):[],drawIdx=p&&p.lastDraw!=null?hand.lastIndexOf(p.lastDraw):-1,handOrder=drawIdx>=0?[...hand.map((_,i)=>i).filter(i=>i!==drawIdx),drawIdx]:hand.map((_,i)=>i),ownHand=p?handOrder.map(i=>`<button type="button" data-mj="${i}" class="mj-own ${riichiSet.has(i)?'riichi-able':''} ${i===drawIdx?'drawn':''}">${mjTile(hand[i])}</button>`).join(''):'';
  const actionButtons=`${turn.tsumo?'<button id="mjTsumo" class="primary">自摸</button>':''}${(turn.ankan||[]).map(t=>`<button data-mj-kan="${t}">暗杠 ${esc(MJ_LABELS[t]||t)}</button>`).join('')}${(turn.kakan||[]).map(x=>`<button data-mj-kakan="${x.meldIndex}">加杠 ${esc(MJ_LABELS[x.tile]||x.tile)}</button>`).join('')}${turn.kyuushu?'<button id="mjKyuushu">九种九牌</button>':''}${riichiSet.size?'<label class="id-badge"><input id="mjRiichi" type="checkbox"> 立直（高亮牌）</label>':''}${s.phase==='result'?'<button id="mjNext" class="primary">下一局</button>':''}`;
  const reactionButtons=react.length?`<div class="mj-reactions"><b>响应</b>${react.map((o,i)=>`<button data-mj-claim="${esc(o.kind)}" data-mj-opt="${i}" class="${o.kind==='ron'?'primary':''}">${({ron:'荣和',pon:'碰',kan:'杠',chi:'吃',pass:'过'})[o.kind]||o.kind}${o.tiles?` ${(o.tiles||[]).map(t=>MJ_LABELS[t]).join(' ')}`:''}</button>`).join('')}<button data-mj-claim="pass">过</button></div>`:'<div class="mj-reaction-placeholder"><b>当前无需响应</b><small>没有可吃 / 碰 / 杠 / 荣和的牌；需要你响应时按钮会出现在这里。</small></div>';
  e.innerHTML=`<div class="cards-area mahjong-area"><div class="game-status">${esc(s.message||'')} · ${round}${s.handNo||1}局 ${s.honba||0}本场 · 供托 ${s.kyotaku||0} · 牌山 ${s.wall?.length||0}</div>${gameClockHtml(s)}${['waiting','result'].includes(s.phase)?extraSeatControls(s,4):''}<div class="mj-table-scroll"><div class="mahjong-table-v2">${fly}${mjSeatBadge(s,r.top,'top')}${mjSeatBadge(s,r.left,'left')}${mjSeatBadge(s,r.right,'right')}${mjSeatBadge(s,r.bottom,'bottom')}${mjEdgeRail(s,r.top,'top')}${mjEdgeRail(s,r.left,'left')}${mjEdgeRail(s,r.right,'right')}<div class="mj-center-v2"><b>${round}${s.handNo||1}局</b><span>${s.honba||0}本 · 供托 ${s.kyotaku||0}</span><small>余 ${s.wall?.length||0}</small><div class="mj-dora-v2"><label>ドラ</label>${(s.doraIndicators||[]).map(t=>mjTile(t)).join('')}</div></div><div class="mj-river-zone top">${mjRiver(s,r.top,'top')}</div><div class="mj-river-zone left">${mjRiver(s,r.left,'left')}</div><div class="mj-river-zone right">${mjRiver(s,r.right,'right')}</div><div class="mj-river-zone bottom">${mjRiver(s,r.bottom,'bottom')}</div>${p?`<div class="mj-own-hand-zone"><div class="mj-own-label">${p.riichi?'<b>立直 · 自动摸切</b> · ':''}我的手牌</div><div class="mj-own-rail"><div class="mj-hand-v2">${ownHand}</div>${mjMelds(p,me)?`<div class="mj-own-melds">${mjMelds(p,me)}</div>`:''}</div></div>`:''}</div></div>${mjResultHtml(s)}${p?`<div class="mj-command-zone"><div class="mj-auto-controls"><button data-mj-auto="pass" class="${auto.pass?'primary':''}">不吃碰杠：${auto.pass?'开':'关'}</button><button data-mj-auto="win" class="${auto.win?'primary':''}">自动和牌：${auto.win?'开':'关'}</button><button data-mj-auto="tsumogiri" class="${auto.tsumogiri?'primary':''}">自动摸切：${auto.tsumogiri?'开':'关'}</button><small>立直后无论“自动摸切”开关，都会自动摸切；出现可自摸时若“自动和牌”关闭则先保留手动选择。</small></div><div class="game-toolbar mj-actions">${actionButtons||'<span class="mj-action-placeholder">等待可用操作</span>'}</div>${reactionButtons}</div>`:''}<div class="mj-rule-note">四麻：25,000点起家 · 食断/后付允许 · 食替禁止 · 赤5×3 · 振听/立直振听 · 吃碰明杠/暗杠/加杠/抢杠 · 多家荣和 · 九种九牌/四风连打/四杠散了/四家立直 · 流局满贯 · 番符/满贯以上计分。</div></div>`;
  bindExtraSeats(e);bindMahjongTableFit(e);e.querySelectorAll('[data-mj]').forEach(b=>b.onclick=()=>{const i=+b.dataset.mj,decl=$('#mjRiichi')?.checked;if(decl&&!riichiSet.has(i))return toast('立直只能打出高亮的听牌牌张');gameAction({type:decl?'riichi_discard':'discard',index:i})});$('#mjTsumo')&&($('#mjTsumo').onclick=()=>gameAction({type:'tsumo'}));$('#mjKyuushu')&&($('#mjKyuushu').onclick=()=>gameAction({type:'kyuushu'}));$('#mjNext')&&($('#mjNext').onclick=()=>gameAction({type:'next_hand'}));e.querySelectorAll('[data-mj-kan]').forEach(b=>b.onclick=()=>gameAction({type:'ankan',tile:+b.dataset.mjKan}));e.querySelectorAll('[data-mj-kakan]').forEach(b=>b.onclick=()=>gameAction({type:'kakan',meldIndex:+b.dataset.mjKakan}));e.querySelectorAll('[data-mj-claim]').forEach(b=>b.onclick=()=>gameAction({type:'claim',kind:b.dataset.mjClaim,optionIndex:b.dataset.mjOpt==null?null:+b.dataset.mjOpt}));e.querySelectorAll('[data-mj-auto]').forEach(b=>b.onclick=()=>mjSetAuto(b.dataset.mjAuto));scheduleRiichiAuto(s,me,p,turn,react);scrollMahjongResultIntoView(e,s)
}

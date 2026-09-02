const ECON_REC={
  dice:{name:'摇骰子',entryFee:10,aiEntryFee:4,stake:30,note:'通常 1–3 分钟 / 局'},
  gomoku:{name:'五子棋',entryFee:20,aiEntryFee:8,stake:50,note:'通常 5–10 分钟 / 局'},
  xiangqi:{name:'中国象棋',entryFee:35,aiEntryFee:14,stake:80,note:'通常 15–30 分钟 / 局'},
  chess:{name:'国际象棋',entryFee:35,aiEntryFee:14,stake:80,note:'通常 15–30 分钟 / 局'},
  go:{name:'围棋',entryFee:45,aiEntryFee:18,stake:100,note:'19 路通常较长'},
  blackjack:{name:'21点',entryFee:6,aiEntryFee:3,minBet:10,defaultBet:20,maxBet:200,note:'单手较短，下注本身已承担主要波动'},
  poker:{name:'德州扑克',entryFee:10,aiEntryFee:4,smallBlind:10,bigBlind:20,buyInCapBb:200,note:'按每手牌计费，盲注承担主要波动；建议最大带入上限 200BB'},
  doudizhu:{name:'斗地主',entryFee:18,aiEntryFee:7,stake:40,note:'三人局，结算再乘叫分与炸弹/春天倍数'},
  uno:{name:'UNO',entryFee:20,aiEntryFee:8,rankStep:50,note:'通常 5–15 分钟 / 局'},
  mahjong:{name:'日麻',entryFee:50,aiEntryFee:20,pointsPerChip:100,forfeitPenalty:50,note:'完整对局时间最长'},
  sudoku:{name:'数独',entryFee:12,aiEntryFee:12,note:'每个新题计费'},
  minesweeper:{name:'扫雷',entryFee:8,aiEntryFee:8,note:'每次重新开始计费'},
  tetris:{name:'俄罗斯方块',entryFee:10,aiEntryFee:10,note:'每次新局计费'}
};
function econVal(v,f){return Number.isFinite(Number(v))?Number(v):f}
function econInput(id,label,value,min=0,hint=''){return `<label>${label}<input id="${id}" type="number" min="${min}" value="${value}">${hint?`<small>${hint}</small>`:''}</label>`}
function feeInputs(kind,rules,single=false){const rec=ECON_REC[kind],r=rules[kind]||{};if(single)return econInput(`aifee_${kind}`,'每个新局 / 新题费用',econVal(r.aiEntryFee,r.entryFee??rec.aiEntryFee),0,`推荐 ${rec.aiEntryFee}`);return `${econInput(`fee_${kind}`,'真人对局 · 每局费用',econVal(r.entryFee,rec.entryFee),0,`推荐 ${rec.entryFee}`)}${econInput(`aifee_${kind}`,'AI 练习 · 每局费用',econVal(r.aiEntryFee,rec.aiEntryFee),0,`推荐 ${rec.aiEntryFee}`)}`}
function gameEconomyCard(kind,rules,extra=''){const rec=ECON_REC[kind],single=['sudoku','minesweeper','tetris'].includes(kind);return `<details class="chip-game-card"><summary><b>${rec.name}</b><span>${rec.note}</span><em>${single?`推荐 ${rec.aiEntryFee} / 局`:`推荐 真人 ${rec.entryFee} · AI ${rec.aiEntryFee}`}</em></summary><div class="chip-game-grid">${feeInputs(kind,rules,single)}${extra}</div></details>`}
function renderChipAdmin(rules,d,users){
  const ranked=[...(users||[])].sort((a,b)=>(Number(b.chips)||0)-(Number(a.chips)||0)||String(a.name||'').localeCompare(String(b.name||''),'zh-CN'));
  return `<details class="admin-subsetting"><summary>总设置</summary><div class="admin-setting-body chip-economy-overview"><h3>筹码经济 · 总设置</h3><p class="muted">签到和低保恢复属于系统增发；每局费用属于系统销毁；真人胜负筹码主要在玩家之间转移。v0.2.9 起，<b>入座不扣费</b>，只有一局真正开始时才扣一次；AI 练习费用低于真人局。</p><div class="chip-rule-grid chip-global-grid">${econInput('econFloor','默认 / 低保筹码',econVal(d.chipFloor,2000),0,'推荐 2000')}${econInput('econDaily','每日签到奖励',econVal(d.dailyReward,1000),0,'推荐 1000')}${econInput('econRecover','每小时恢复筹码',econVal(d.recoverPerHour,1000),0,'推荐 1000')}</div><p><button id="chipRulesSave" class="primary">保存全部经济设置</button></p></div></details>
  <details class="admin-subsetting"><summary>分游戏设置</summary><div class="admin-setting-body"><h3>分游戏设置</h3><p class="muted">推荐值按一局常见时长、游戏本身是否已有下注 / 盲注 / 点数结算来分层。这里只是默认平衡值，管理员可独立调整每个游戏。</p><div class="chip-game-settings">
  ${gameEconomyCard('dice',rules,econInput('chipRuleDice','胜负转移',econVal(rules.dice?.stake,ECON_REC.dice.stake),1,`推荐 ${ECON_REC.dice.stake}`))}
  ${gameEconomyCard('gomoku',rules,econInput('chipRuleGomoku','胜负转移',econVal(rules.gomoku?.stake,ECON_REC.gomoku.stake),1,`推荐 ${ECON_REC.gomoku.stake}`))}
  ${gameEconomyCard('xiangqi',rules,econInput('chipRuleXiangqi','胜负转移',econVal(rules.xiangqi?.stake,ECON_REC.xiangqi.stake),1,`推荐 ${ECON_REC.xiangqi.stake}`))}
  ${gameEconomyCard('chess',rules,econInput('chipRuleChess','胜负转移',econVal(rules.chess?.stake,ECON_REC.chess.stake),1,`推荐 ${ECON_REC.chess.stake}`))}
  ${gameEconomyCard('go',rules,econInput('chipRuleGo','胜负转移',econVal(rules.go?.stake,ECON_REC.go.stake),1,`推荐 ${ECON_REC.go.stake}`))}
  ${gameEconomyCard('blackjack',rules,`${econInput('chipRuleBjMin','最小下注',econVal(rules.blackjack?.minBet,10),1,'推荐 10')}${econInput('chipRuleBjDefault','默认下注',econVal(rules.blackjack?.defaultBet,20),1,'推荐 20')}${econInput('chipRuleBjMax','最大下注',econVal(rules.blackjack?.maxBet,200),1,'推荐 200')}`)}
  ${gameEconomyCard('poker',rules,`${econInput('chipRulePokerSb','小盲',econVal(rules.poker?.smallBlind,10),1,'推荐 10')}${econInput('chipRulePokerBb','大盲 / 最小完整加注',econVal(rules.poker?.bigBlind,20),1,'推荐 20')}${econInput('chipRulePokerCap','最大带入上限（BB）',econVal(rules.poker?.buyInCapBb,200),20,'推荐 200BB；可防止单桌过度堆叠')}`)}
  ${gameEconomyCard('doudizhu',rules,econInput('chipRuleDdzStake','基础胜负转移',econVal(rules.doudizhu?.stake,40),1,'结算再乘叫分 / 炸弹 / 春天倍数；地主双份'))}
  ${gameEconomyCard('uno',rules,econInput('chipRuleUno','名次级差',econVal(rules.uno?.rankStep,50),1,'推荐 50'))}
  ${gameEconomyCard('mahjong',rules,`${econInput('chipRuleMahjong','每多少点折 1 筹码',econVal(rules.mahjong?.pointsPerChip,100),1,'推荐 100')}${econInput('chipRuleMahjongForfeit','中途退出最低损失',econVal(rules.mahjong?.forfeitPenalty,50),1,'推荐 50')}`)}
  ${gameEconomyCard('sudoku',rules)}${gameEconomyCard('minesweeper',rules)}${gameEconomyCard('tetris',rules)}</div></div></details>
  <div class="page-card"><h3>玩家筹码修改 · 从高到低</h3><p class="muted">管理员写入服务器权威余额并记录流水。正在进行 21 点 / 德州一手牌时仍应避免强改，以免桌上筹码与钱包错位。</p><div class="chip-user-list">${ranked.map((u,i)=>`<div class="admin-row chip-user-row" data-chip-user="${u.userId}"><b class="chip-user-rank">#${i+1}</b>${slime(u.slimeColor,'',u.userId)}<div class="grow"><b>${esc(u.name)}</b> · ${esc(u.loungeId)}<br><small>当前筹码：${Number(u.chips)||0}</small></div><input data-chip-value type="number" min="0" max="1000000000" value="${Number(u.chips)||0}" style="width:140px"><button data-chip-save="${u.userId}" class="primary">写入筹码</button></div>`).join('')}</div></div>`;
}
function chipRulesPayload(){
  const n=id=>Math.max(0,Math.floor(Number($(id)?.value)||0)),rule=(kind,extra={})=>({entryFee:n(`#fee_${kind}`),aiEntryFee:n(`#aifee_${kind}`),...extra}),single=kind=>({entryFee:n(`#aifee_${kind}`),aiEntryFee:n(`#aifee_${kind}`)});
  return {chipFloor:n('#econFloor'),dailyReward:n('#econDaily'),recoverPerHour:n('#econRecover'),gameRules:{dice:rule('dice',{stake:n('#chipRuleDice')}),gomoku:rule('gomoku',{stake:n('#chipRuleGomoku')}),xiangqi:rule('xiangqi',{stake:n('#chipRuleXiangqi')}),chess:rule('chess',{stake:n('#chipRuleChess')}),go:rule('go',{stake:n('#chipRuleGo')}),blackjack:rule('blackjack',{minBet:n('#chipRuleBjMin'),defaultBet:n('#chipRuleBjDefault'),maxBet:n('#chipRuleBjMax')}),poker:rule('poker',{smallBlind:n('#chipRulePokerSb'),bigBlind:n('#chipRulePokerBb'),buyInCapBb:Math.max(20,n('#chipRulePokerCap')||200)}),doudizhu:rule('doudizhu',{stake:n('#chipRuleDdzStake')}),uno:rule('uno',{rankStep:n('#chipRuleUno')}),mahjong:rule('mahjong',{pointsPerChip:n('#chipRuleMahjong'),forfeitPenalty:n('#chipRuleMahjongForfeit')}),sudoku:single('sudoku'),minesweeper:single('minesweeper'),tetris:single('tetris')}};
}
function bindChipAdmin(root){
  $('#chipRulesSave')&&($('#chipRulesSave').onclick=async()=>{try{await post('/api/admin/chips',creds({action:'set_rules',...chipRulesPayload()}));toast('经济与全部游戏筹码规则已保存');renderAdmin()}catch(err){toast(err.message)}});
  root.querySelectorAll('[data-chip-save]').forEach(b=>b.onclick=async()=>{const row=b.closest('[data-chip-user]'),chips=Number(row.querySelector('[data-chip-value]').value);if(!Number.isFinite(chips)||chips<0)return toast('筹码必须是 0 或正整数');try{const x=await post('/api/admin/chips',creds({action:'set_user',targetUserId:b.dataset.chipSave,chips:Math.floor(chips)}));if(x.profile?.userId===state.profile.userId){state.profile={...state.profile,...x.profile};paintSelf()}toast(`筹码已修改：${x.before} → ${x.after}`);renderAdmin()}catch(err){toast(err.message)}});
}
function splitChipAdmin(rules,d,users){const h=renderChipAdmin(rules,d,users),m='<div class="page-card"><h3>玩家筹码修改',i=h.indexOf(m);return i<0?{settings:h,players:''}:{settings:h.slice(0,i),players:h.slice(i)}}

export const DEFAULT_ECONOMY={chipFloor:2000,recoverPerHour:1000,dailyReward:1000};

// v0.2.9 recommendations: fees are charged per round, not per seat join.
// Human games cost more than AI practice; longer games have a larger sink.
export const DEFAULT_GAME_CHIP_RULES={
  dice:{stake:30,entryFee:10,aiEntryFee:4},
  gomoku:{stake:50,entryFee:20,aiEntryFee:8},
  xiangqi:{stake:80,entryFee:35,aiEntryFee:14},
  chess:{stake:80,entryFee:35,aiEntryFee:14},
  go:{stake:100,entryFee:45,aiEntryFee:18},
  blackjack:{minBet:10,maxBet:200,defaultBet:20,entryFee:6,aiEntryFee:3},
  poker:{smallBlind:10,bigBlind:20,buyInCapBb:200,entryFee:10,aiEntryFee:4},
  uno:{rankStep:50,entryFee:20,aiEntryFee:8},
  doudizhu:{stake:40,entryFee:18,aiEntryFee:7},
  mahjong:{pointsPerChip:100,forfeitPenalty:50,entryFee:50,aiEntryFee:20},
  sudoku:{entryFee:12,aiEntryFee:12},
  minesweeper:{entryFee:8,aiEntryFee:8},
  tetris:{entryFee:10,aiEntryFee:10}
};

export const V028_GAME_CHIP_RULES={
  dice:{stake:30,entryFee:30},gomoku:{stake:50,entryFee:30},xiangqi:{stake:50,entryFee:30},chess:{stake:50,entryFee:30},go:{stake:50,entryFee:30},
  blackjack:{minBet:10,maxBet:200,defaultBet:20,entryFee:20},poker:{smallBlind:10,bigBlind:20,entryFee:20},uno:{rankStep:50,entryFee:30},
  mahjong:{pointsPerChip:100,forfeitPenalty:50,entryFee:50},sudoku:{entryFee:10},minesweeper:{entryFee:10},tetris:{entryFee:10}
};

export function boundedInt(v,min,max,fallback){
  const n=Math.round(Number(v));
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
}
const fee=(src,k,key='entryFee')=>boundedInt(src?.[k]?.[key],0,100000,DEFAULT_GAME_CHIP_RULES[k]?.[key]||0);

export function normalizeEconomy(raw={}){
  const src=raw?.gameRules||raw||{},out={
    chipFloor:boundedInt(raw?.chipFloor,0,100000000,DEFAULT_ECONOMY.chipFloor),
    recoverPerHour:boundedInt(raw?.recoverPerHour,0,10000000,DEFAULT_ECONOMY.recoverPerHour),
    dailyReward:boundedInt(raw?.dailyReward,0,100000000,DEFAULT_ECONOMY.dailyReward),
    gameRules:{}
  };
  for(const k of ['gomoku','xiangqi','chess','go'])out.gameRules[k]={stake:boundedInt(src?.[k]?.stake,1,100000,DEFAULT_GAME_CHIP_RULES[k].stake),entryFee:fee(src,k),aiEntryFee:fee(src,k,'aiEntryFee')};
  out.gameRules.dice={stake:boundedInt(src.dice?.stake,1,100000,DEFAULT_GAME_CHIP_RULES.dice.stake),entryFee:fee(src,'dice'),aiEntryFee:fee(src,'dice','aiEntryFee')};
  const bj=src.blackjack||{},bjMin=boundedInt(bj.minBet,1,100000,DEFAULT_GAME_CHIP_RULES.blackjack.minBet),bjMax=boundedInt(bj.maxBet,bjMin,1000000,DEFAULT_GAME_CHIP_RULES.blackjack.maxBet);
  out.gameRules.blackjack={minBet:bjMin,maxBet:bjMax,defaultBet:boundedInt(bj.defaultBet,bjMin,bjMax,DEFAULT_GAME_CHIP_RULES.blackjack.defaultBet),entryFee:fee(src,'blackjack'),aiEntryFee:fee(src,'blackjack','aiEntryFee')};
  const pk=src.poker||{},sb=boundedInt(pk.smallBlind,1,100000,DEFAULT_GAME_CHIP_RULES.poker.smallBlind),bb=boundedInt(pk.bigBlind,sb,1000000,DEFAULT_GAME_CHIP_RULES.poker.bigBlind),capDefault=DEFAULT_GAME_CHIP_RULES.poker.buyInCapBb;
  out.gameRules.poker={smallBlind:sb,bigBlind:bb,buyInCapBb:boundedInt(pk.buyInCapBb,20,1000,capDefault),entryFee:fee(src,'poker'),aiEntryFee:fee(src,'poker','aiEntryFee')};
  out.gameRules.uno={rankStep:boundedInt(src.uno?.rankStep,1,100000,DEFAULT_GAME_CHIP_RULES.uno.rankStep),entryFee:fee(src,'uno'),aiEntryFee:fee(src,'uno','aiEntryFee')};
  out.gameRules.doudizhu={stake:boundedInt(src.doudizhu?.stake,1,100000,DEFAULT_GAME_CHIP_RULES.doudizhu.stake),entryFee:fee(src,'doudizhu'),aiEntryFee:fee(src,'doudizhu','aiEntryFee')};
  out.gameRules.mahjong={pointsPerChip:boundedInt(src.mahjong?.pointsPerChip,1,100000,DEFAULT_GAME_CHIP_RULES.mahjong.pointsPerChip),forfeitPenalty:boundedInt(src.mahjong?.forfeitPenalty,1,100000,DEFAULT_GAME_CHIP_RULES.mahjong.forfeitPenalty),entryFee:fee(src,'mahjong'),aiEntryFee:fee(src,'mahjong','aiEntryFee')};
  out.gameRules.sudoku={entryFee:fee(src,'sudoku'),aiEntryFee:fee(src,'sudoku','aiEntryFee')};
  out.gameRules.minesweeper={entryFee:fee(src,'minesweeper'),aiEntryFee:fee(src,'minesweeper','aiEntryFee')};
  out.gameRules.tetris={entryFee:fee(src,'tetris'),aiEntryFee:fee(src,'tetris','aiEntryFee')};
  out.updatedAt=Number(raw?.updatedAt)||0;out.updatedBy=String(raw?.updatedBy||'');return out;
}

export function migrateEconomyV029(raw={}){
  const copy=JSON.parse(JSON.stringify(raw||{})),src=copy.gameRules||(copy.gameRules={});
  for(const [kind,rec] of Object.entries(DEFAULT_GAME_CHIP_RULES)){
    const old=V028_GAME_CHIP_RULES[kind]||{},r=src[kind]||(src[kind]={});
    if(r.entryFee==null||Number(r.entryFee)===Number(old.entryFee))r.entryFee=rec.entryFee;
    if(r.aiEntryFee==null)r.aiEntryFee=rec.aiEntryFee;
    for(const key of ['stake','minBet','maxBet','defaultBet','smallBlind','bigBlind','rankStep','pointsPerChip','forfeitPenalty','buyInCapBb'])if(rec[key]!=null&&(r[key]==null||Number(r[key])===Number(old[key])))r[key]=rec[key];
  }
  return normalizeEconomy(copy);
}

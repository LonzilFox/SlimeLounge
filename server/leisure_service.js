const clone=x=>JSON.parse(JSON.stringify(x));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const int=(v,d=0)=>Math.floor(num(v,d));
const clamp=(v,a,b,d=a)=>Math.max(a,Math.min(b,num(v,d)));
const text=(v,n=80)=>String(v??'').trim().slice(0,n);
const bool=v=>v!==false&&v!=='false'&&v!==0&&v!=='0';
const OLD_FISH_PRICES={sardine:85,anchovy:95,carp:120,bass:185,catfish:290,salmon:260,tuna:330,eel:360,puffer:520,squid:420,octopus:760,rainbow:460,icefish:980,lavaeel:1680};

export const DEFAULT_LEISURE_CONFIG={
  version:2,
  fishing:{
    enabled:true,inventoryLimit:120,castCooldownMs:900,minCatchScore:62,catchXp:5,sellXp:1,minPlayMs:2500,heartbeatMs:400,maxCatches10m:45,
    fish:[
      {id:'sardine',name:'沙丁鱼',basePrice:80,difficulty:22,rarity:1,minSize:18,maxSize:42,enabled:true},
      {id:'anchovy',name:'凤尾鱼',basePrice:90,difficulty:24,rarity:1,minSize:15,maxSize:38,enabled:true},
      {id:'carp',name:'鲤鱼',basePrice:115,difficulty:18,rarity:1,minSize:30,maxSize:78,enabled:true},
      {id:'bass',name:'大口黑鲈',basePrice:175,difficulty:34,rarity:2,minSize:28,maxSize:75,enabled:true},
      {id:'catfish',name:'鲶鱼',basePrice:275,difficulty:58,rarity:3,minSize:35,maxSize:105,enabled:true},
      {id:'salmon',name:'鲑鱼',basePrice:245,difficulty:48,rarity:2,minSize:38,maxSize:96,enabled:true},
      {id:'tuna',name:'金枪鱼',basePrice:315,difficulty:60,rarity:3,minSize:55,maxSize:150,enabled:true},
      {id:'eel',name:'鳗鱼',basePrice:340,difficulty:65,rarity:3,minSize:35,maxSize:115,enabled:true},
      {id:'puffer',name:'河豚',basePrice:495,difficulty:74,rarity:4,minSize:20,maxSize:58,enabled:true},
      {id:'squid',name:'鱿鱼',basePrice:400,difficulty:63,rarity:3,minSize:25,maxSize:82,enabled:true},
      {id:'octopus',name:'章鱼',basePrice:720,difficulty:82,rarity:5,minSize:35,maxSize:110,enabled:true},
      {id:'rainbow',name:'虹鳟',basePrice:435,difficulty:57,rarity:3,minSize:28,maxSize:88,enabled:true},
      {id:'icefish',name:'冰晶鱼',basePrice:930,difficulty:86,rarity:6,minSize:20,maxSize:68,enabled:true},
      {id:'lavaeel',name:'熔岩鳗',basePrice:1580,difficulty:94,rarity:9,minSize:55,maxSize:135,enabled:true,legendary:true}
    ]
  },
  market:{
    enabled:true,tickSeconds:30,tradeFeeBps:20,tradeXp:2,maxHistory:120,minTradeQty:1,maxTradeQty:100000,
    assets:[
      {id:'SLM',name:'Slime Coin',basePrice:100,volatility:0.018,drift:0.0003,enabled:true},
      {id:'MINT',name:'Mint Token',basePrice:64,volatility:0.026,drift:0.00015,enabled:true},
      {id:'STAR',name:'Star Bits',basePrice:220,volatility:0.035,drift:0.0001,enabled:true},
      {id:'WAVE',name:'Sea Wave',basePrice:145,volatility:0.042,drift:-0.00005,enabled:true},
      {id:'MOON',name:'Moon Dust',basePrice:380,volatility:0.055,drift:0.0002,enabled:true}
    ]
  }
};

function mergeById(cur,defs){const out=Array.isArray(cur)?cur.map(x=>({...x})):[],ids=new Set(out.map(x=>String(x.id||'')));for(const d of defs||[])if(!ids.has(d.id)){out.push(clone(d));ids.add(d.id)}return out}
function normFish(x,i=0){return {id:text(x?.id,40)||`fish_${i}`,name:text(x?.name,30)||'新鱼',basePrice:Math.max(1,int(x?.basePrice,100)),difficulty:clamp(x?.difficulty,1,100,30),rarity:clamp(x?.rarity,1,20,1),minSize:clamp(x?.minSize,1,500,10),maxSize:clamp(x?.maxSize,1,500,60),enabled:bool(x?.enabled),legendary:bool(x?.legendary)}}
function normAsset(x,i=0){return {id:text(x?.id,16).toUpperCase()||`ASSET${i}`,name:text(x?.name,30)||'新资产',basePrice:clamp(x?.basePrice,.01,1e9,100),volatility:clamp(x?.volatility,0,.5,.02),drift:clamp(x?.drift,-.05,.05,0),enabled:bool(x?.enabled)}}
function migrateFishPrices(list,ver){if(ver>=2)return list;const defs=Object.fromEntries(DEFAULT_LEISURE_CONFIG.fishing.fish.map(x=>[x.id,x.basePrice]));return list.map(x=>OLD_FISH_PRICES[x.id]===Number(x.basePrice)?{...x,basePrice:defs[x.id]??x.basePrice}:x)}
export function normalizeLeisureConfig(src={}){
  const ver=int(src.version),f={...DEFAULT_LEISURE_CONFIG.fishing,...(src.fishing||{})},m={...DEFAULT_LEISURE_CONFIG.market,...(src.market||{})};
  let fish=ver<1?mergeById(f.fish,DEFAULT_LEISURE_CONFIG.fishing.fish):(Array.isArray(f.fish)?f.fish:DEFAULT_LEISURE_CONFIG.fishing.fish),assets=ver<1?mergeById(m.assets,DEFAULT_LEISURE_CONFIG.market.assets):(Array.isArray(m.assets)?m.assets:DEFAULT_LEISURE_CONFIG.market.assets);fish=migrateFishPrices(fish,ver);
  const tick=ver<2&&Number(m.tickSeconds)===45?30:m.tickSeconds;
  return {version:2,fishing:{enabled:bool(f.enabled),inventoryLimit:Math.floor(clamp(f.inventoryLimit,10,1000,120)),castCooldownMs:Math.floor(clamp(f.castCooldownMs,0,30000,900)),minCatchScore:clamp(f.minCatchScore,20,95,62),catchXp:Math.floor(clamp(f.catchXp,0,10000,5)),sellXp:Math.floor(clamp(f.sellXp,0,10000,1)),minPlayMs:Math.floor(clamp(f.minPlayMs,1500,20000,2500)),heartbeatMs:Math.floor(clamp(f.heartbeatMs,200,1500,400)),maxCatches10m:Math.floor(clamp(f.maxCatches10m,5,300,45)),fish:fish.map(normFish)},market:{enabled:bool(m.enabled),tickSeconds:Math.floor(clamp(tick,10,3600,30)),tradeFeeBps:Math.floor(clamp(m.tradeFeeBps,0,1000,20)),tradeXp:Math.floor(clamp(m.tradeXp,0,10000,2)),maxHistory:Math.floor(clamp(m.maxHistory,20,500,120)),minTradeQty:Math.floor(clamp(m.minTradeQty,1,1e6,1)),maxTradeQty:Math.floor(clamp(m.maxTradeQty,1,1e9,100000)),assets:assets.map(normAsset)}}
}
export function ensureLeisureConfig(data){data.leisureConfig=normalizeLeisureConfig(data.leisureConfig||{});return data.leisureConfig}
function ensureUser(u){u.fishing={inventory:[],lastCastAt:0,totalValueSold:0,...(u.fishing||{})};u.fishing.inventory=Array.isArray(u.fishing.inventory)?u.fishing.inventory:[];u.market={holdings:{},avgCost:{},realized:0,...(u.market||{})};u.market.holdings={...(u.market.holdings||{})};u.market.avgCost={...(u.market.avgCost||{})};return u}
function quality(score){return score>=96?['铱星',1.75]:score>=88?['金星',1.4]:score>=76?['银星',1.18]:['普通',1]}
function fishWeight(x){return 1/Math.max(1,Number(x.rarity)||1)}
function pickFish(list){const xs=list.filter(x=>x.enabled),total=xs.reduce((a,x)=>a+fishWeight(x),0);let r=Math.random()*total;for(const x of xs){r-=fishWeight(x);if(r<=0)return x}return xs[0]}
function marketInit(data,cfg,now=Date.now()){data.marketState||={assets:{}};for(const a of cfg.market.assets){const s=data.marketState.assets[a.id]||{};if(!Number.isFinite(Number(s.price)))s.price=a.basePrice;if(!s.lastAt)s.lastAt=now;s.history=Array.isArray(s.history)?s.history:[];if(!s.history.length)s.history.push({t:now,p:Number(s.price)});data.marketState.assets[a.id]=s}return data.marketState}
function advanceMarket(data,cfg,now=Date.now()){
  const st=marketInit(data,cfg,now),tick=cfg.market.tickSeconds*1000;
  for(const a of cfg.market.assets){const s=st.assets[a.id];if(!a.enabled)continue;let steps=Math.min(96,Math.floor((now-s.lastAt)/tick));while(steps-->0){const shock=(Math.random()+Math.random()+Math.random()+Math.random()-2)*a.volatility,regime=(Math.random()<.025?(Math.random()-.5)*a.volatility*5:0),ret=a.drift+shock+regime;s.price=Math.max(.01,Number(s.price)*Math.exp(ret));s.lastAt+=tick;s.history.push({t:s.lastAt,p:Number(s.price.toFixed(4))})}if(s.history.length>cfg.market.maxHistory)s.history.splice(0,s.history.length-cfg.market.maxHistory)}return st
}
function marketPayload(data,cfg,u){const now=Date.now(),st=advanceMarket(data,cfg,now),enabled=cfg.market.assets.filter(x=>x.enabled),next=enabled.length?Math.min(...enabled.map(a=>(st.assets[a.id]?.lastAt||now)+cfg.market.tickSeconds*1000)):now+cfg.market.tickSeconds*1000;return {config:{tickSeconds:cfg.market.tickSeconds,tradeFeeBps:cfg.market.tradeFeeBps,minTradeQty:cfg.market.minTradeQty,maxTradeQty:cfg.market.maxTradeQty,assets:enabled},prices:Object.fromEntries(enabled.map(a=>[a.id,{price:st.assets[a.id]?.price||a.basePrice,history:st.assets[a.id]?.history||[]} ])),portfolio:clone(ensureUser(u).market),serverNow:now,nextTickAt:next}}

export function createLeisureService({data,crypto,body,auth,json,isStaff,publicUser,refreshWallet,save,progression}){
  let cfg=ensureLeisureConfig(data);const casts=new Map(),userCast=new Map(),catchTimes=new Map(),chipLocked=id=>Object.values(data.roomGames||{}).some(s=>['blackjack','poker'].includes(s?.kind)&&['insurance','playing','dealer','preflop','flop','turn','river','run_choice'].includes(s.phase)&&(s.seats||[]).some(p=>p?.userId===id));
  const refresh=()=>cfg=ensureLeisureConfig(data),dropCast=x=>{if(!x)return;casts.delete(x.token);if(userCast.get(x.userId)===x.token)userCast.delete(x.userId)};
  function self(u){ensureUser(u);return {profile:publicUser(u),fishing:{...clone(u.fishing),config:{inventoryLimit:cfg.fishing.inventoryLimit,minPlayMs:cfg.fishing.minPlayMs,heartbeatMs:cfg.fishing.heartbeatMs,fish:cfg.fishing.fish.filter(x=>x.enabled)}},market:marketPayload(data,cfg,u)}}
  function catchQuota(userId,now){const xs=(catchTimes.get(userId)||[]).filter(t=>now-t<600000);catchTimes.set(userId,xs);return xs}
  async function handle(req,res,url){
    if(!url.pathname.startsWith('/api/leisure/'))return false;if(req.method!=='POST')return json(res,405,{ok:false,error:'Method Not Allowed'}),true;const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);if(!a)return json(res,401,{ok:false,error:'设备身份无效'}),true;refresh();ensureUser(a.u);
    if(url.pathname==='/api/leisure/state'){refreshWallet(a.u);return json(res,200,{ok:true,...self(a.u)}),true}
    if(url.pathname==='/api/leisure/fishing/cast'){
      if(!cfg.fishing.enabled)return json(res,403,{ok:false,error:'钓鱼当前未开放'}),true;const now=Date.now(),oldToken=userCast.get(a.u.userId),old=casts.get(oldToken);if(old&&old.expiresAt>now)return json(res,409,{ok:false,error:'上一竿还在进行，请先完成或放弃'}),true;if(old)dropCast(old);if(now-Number(a.u.fishing.lastCastAt||0)<cfg.fishing.castCooldownMs)return json(res,429,{ok:false,error:'鱼竿还没收稳，稍等一下'}),true;if(a.u.fishing.inventory.length>=cfg.fishing.inventoryLimit)return json(res,409,{ok:false,error:'鱼篓满了，先卖掉一些鱼'}),true;const fish=pickFish(cfg.fishing.fish);if(!fish)return json(res,409,{ok:false,error:'当前没有可钓鱼类'}),true;const token=crypto.randomUUID(),x={token,userId:a.u.userId,fishId:fish.id,at:now,expiresAt:now+45000,lastInputAt:0,lastSampleAt:0,lastHoldAt:now,hold:false,holdMs:0,samples:0,changes:0};casts.set(token,x);userCast.set(a.u.userId,token);a.u.fishing.lastCastAt=now;save();return json(res,200,{ok:true,token,minPlayMs:cfg.fishing.minPlayMs,heartbeatMs:cfg.fishing.heartbeatMs,fish:{id:fish.id,name:fish.name,difficulty:fish.difficulty,rarity:fish.rarity}}),true
    }
    if(url.pathname==='/api/leisure/fishing/input'){
      const token=text(b.token,80),x=casts.get(token),now=Date.now();if(!x||x.userId!==a.u.userId||now>x.expiresAt)return json(res,410,{ok:false,error:'本次钓鱼已失效'}),true;if(now-x.lastSampleAt<100)return json(res,200,{ok:true}),true;const hold=!!b.hold;if(x.lastInputAt){const dt=Math.min(1500,now-x.lastHoldAt);if(x.hold)x.holdMs+=Math.max(0,dt)}if(x.samples&&hold!==x.hold)x.changes++;x.hold=hold;x.lastHoldAt=now;x.lastInputAt=now;x.lastSampleAt=now;x.samples++;return json(res,200,{ok:true}),true
    }
    if(url.pathname==='/api/leisure/fishing/abort'){
      const x=casts.get(text(b.token,80));if(x&&x.userId===a.u.userId)dropCast(x);return json(res,200,{ok:true}),true
    }
    if(url.pathname==='/api/leisure/fishing/catch'){
      const token=text(b.token,80),x=casts.get(token),now=Date.now();if(!x||x.userId!==a.u.userId||now>x.expiresAt){if(x)dropCast(x);return json(res,410,{ok:false,error:'这次咬钩已经失效'}),true}const elapsed=now-x.at;if(elapsed<cfg.fishing.minPlayMs)return json(res,409,{ok:false,error:'小游戏完成得过快，服务端拒绝结算'}),true;if(x.samples<4||!x.lastInputAt||now-x.lastInputAt>1800)return json(res,409,{ok:false,error:'缺少有效钓鱼操作记录，无法结算'}),true;const quota=catchQuota(a.u.userId,now);if(quota.length>=cfg.fishing.maxCatches10m){dropCast(x);return json(res,429,{ok:false,error:'短时间鱼获过多，请稍后再钓'}),true}const fish=cfg.fishing.fish.find(f=>f.id===x.fishId&&f.enabled);if(!fish){dropCast(x);return json(res,410,{ok:false,error:'鱼类配置已变化'}),true}if(x.hold)x.holdMs+=Math.min(1500,now-x.lastHoldAt);const observed=Math.max(1,Math.min(elapsed,Math.max(1,x.lastInputAt-x.at))),holdRatio=clamp(x.holdMs/observed,0,1,0),activeBonus=Math.min(11,x.changes*1.6)+(holdRatio>.1&&holdRatio<.9?7:0),timeBonus=Math.min(7,Math.max(0,elapsed-cfg.fishing.minPlayMs)/1800),score=Math.round(clamp(73+activeBonus+timeBonus-fish.difficulty*.13+(Math.random()-.5)*7,35,99));dropCast(x);if(score<cfg.fishing.minCatchScore)return json(res,200,{ok:true,caught:false,score}),true;quota.push(now);catchTimes.set(a.u.userId,quota);const q=quality(score),size=fish.minSize+Math.random()*Math.max(0,fish.maxSize-fish.minSize),sizeFactor=.75+.5*((size-fish.minSize)/Math.max(1,fish.maxSize-fish.minSize)),value=Math.max(1,Math.round(fish.basePrice*q[1]*sizeFactor)),row={id:crypto.randomUUID(),fishId:fish.id,name:fish.name,size:Number(size.toFixed(1)),quality:q[0],score,value,caughtAt:now,legendary:!!fish.legendary};a.u.fishing.inventory.push(row);a.u.stats.fishCaught=(a.u.stats.fishCaught||0)+1;if(fish.legendary)a.u.stats.fishLegendary=(a.u.stats.fishLegendary||0)+1;progression.grantExternalXp(a.u,cfg.fishing.catchXp);progression.evaluateUser(a.u);save();return json(res,200,{ok:true,caught:true,fish:row,...self(a.u)}),true
    }
    if(url.pathname==='/api/leisure/fishing/sell'){
      if(chipLocked(a.u.userId))return json(res,409,{ok:false,error:'21点 / 德州本手进行中，结束后再出售鱼获'}),true;const ids=b.all?a.u.fishing.inventory.map(x=>x.id):[text(b.catchId,80)],set=new Set(ids),sold=a.u.fishing.inventory.filter(x=>set.has(x.id));if(!sold.length)return json(res,400,{ok:false,error:'没有可出售的鱼'}),true;const value=sold.reduce((n,x)=>n+Math.max(0,int(x.value)),0);a.u.fishing.inventory=a.u.fishing.inventory.filter(x=>!set.has(x.id));a.u.chips=refreshWallet(a.u)+value;a.u.chipsUpdatedAt=Date.now();a.u.fishing.totalValueSold=(a.u.fishing.totalValueSold||0)+value;a.u.stats.fishSold=(a.u.stats.fishSold||0)+sold.length;progression.grantExternalXp(a.u,cfg.fishing.sellXp*Math.max(1,sold.length));progression.evaluateUser(a.u);save();return json(res,200,{ok:true,sold:sold.length,value,...self(a.u)}),true
    }
    if(url.pathname==='/api/leisure/market/trade'){
      if(chipLocked(a.u.userId))return json(res,409,{ok:false,error:'21点 / 德州本手进行中，结束后再交易'}),true;if(!cfg.market.enabled)return json(res,403,{ok:false,error:'虚拟交易所当前未开放'}),true;const asset=cfg.market.assets.find(x=>x.enabled&&x.id===text(b.assetId,16).toUpperCase());if(!asset)return json(res,404,{ok:false,error:'资产不存在'}),true;const rawQty=Number(b.qty);if(!Number.isInteger(rawQty)||rawQty<cfg.market.minTradeQty||rawQty>cfg.market.maxTradeQty)return json(res,400,{ok:false,error:`交易数量必须为 ${cfg.market.minTradeQty}~${cfg.market.maxTradeQty} 的整数`}),true;const qty=rawQty,side=String(b.side||''),mp=marketPayload(data,cfg,a.u),price=Number(mp.prices[asset.id]?.price||asset.basePrice),gross=Math.round(price*qty),fee=Math.max(1,Math.round(gross*cfg.market.tradeFeeBps/10000));if(side==='buy'){const wallet=refreshWallet(a.u),cost=gross+fee;if(wallet<cost)return json(res,400,{ok:false,error:`筹码不足，需要 ${cost}`}),true;const oldQty=num(a.u.market.holdings[asset.id]),oldAvg=num(a.u.market.avgCost[asset.id],price),newQty=oldQty+qty;a.u.chips=wallet-cost;a.u.chipsUpdatedAt=Date.now();a.u.market.holdings[asset.id]=newQty;a.u.market.avgCost[asset.id]=(oldQty*oldAvg+qty*price)/newQty}else if(side==='sell'){const have=num(a.u.market.holdings[asset.id]);if(have<qty)return json(res,400,{ok:false,error:`持仓不足，当前 ${have}`}),true;const avg=num(a.u.market.avgCost[asset.id],price),net=Math.max(0,gross-fee),profit=Math.round((price-avg)*qty-fee);a.u.market.holdings[asset.id]=have-qty;if(a.u.market.holdings[asset.id]<=0){delete a.u.market.holdings[asset.id];delete a.u.market.avgCost[asset.id]}a.u.chips=refreshWallet(a.u)+net;a.u.chipsUpdatedAt=Date.now();a.u.market.realized=num(a.u.market.realized)+profit;if(profit>0)a.u.stats.marketProfit=(a.u.stats.marketProfit||0)+profit}else return json(res,400,{ok:false,error:'交易方向无效'}),true;a.u.stats.marketTrades=(a.u.stats.marketTrades||0)+1;progression.grantExternalXp(a.u,cfg.market.tradeXp);progression.evaluateUser(a.u);save();return json(res,200,{ok:true,side,assetId:asset.id,qty,price,fee,...self(a.u)}),true
    }
    if(url.pathname==='/api/leisure/admin'){
      if(!isStaff(a.u))return json(res,403,{ok:false,error:'无管理员权限'}),true;const action=String(b.action||'get');if(action==='get')return json(res,200,{ok:true,config:clone(cfg)}),true;if(action==='save-core'){const src=b.config||{},next=normalizeLeisureConfig({...cfg,fishing:{...cfg.fishing,...(src.fishing||{}),fish:cfg.fishing.fish},market:{...cfg.market,...(src.market||{}),assets:cfg.market.assets}});data.leisureConfig=next;cfg=next;save();return json(res,200,{ok:true,config:clone(cfg)}),true}if(action==='fish-upsert'){const raw=b.item||{},list=cfg.fishing.fish,idx=list.findIndex(x=>x.id===raw.id),v=normFish({...list[idx],...raw},idx<0?list.length:idx);if(idx>=0)list[idx]=v;else list.push(v)}else if(action==='fish-delete'){cfg.fishing.fish=cfg.fishing.fish.filter(x=>x.id!==text(b.itemId,40))}else if(action==='asset-upsert'){const raw=b.item||{},list=cfg.market.assets,idx=list.findIndex(x=>x.id===text(raw.id,16).toUpperCase()),v=normAsset({...list[idx],...raw},idx<0?list.length:idx);if(idx>=0)list[idx]=v;else list.push(v)}else if(action==='asset-delete'){cfg.market.assets=cfg.market.assets.filter(x=>x.id!==text(b.itemId,16).toUpperCase())}else return json(res,400,{ok:false,error:'未知管理操作'}),true;data.leisureConfig=normalizeLeisureConfig(cfg);cfg=data.leisureConfig;marketInit(data,cfg);save();return json(res,200,{ok:true,config:clone(cfg)}),true
    }
    return json(res,404,{ok:false,error:'未知休闲接口'}),true
  }
  return {handle,ensureUser,config:()=>cfg};
}

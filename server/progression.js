export const SHOP_CATALOG={
  accessories:[
    {id:'acc_bow',name:'小蝴蝶结',price:180,slot:'head',desc:'宠物头顶的轻巧蝴蝶结'},
    {id:'acc_leaf',name:'薄荷叶',price:220,slot:'head',desc:'清爽的小叶子'},
    {id:'acc_star',name:'星星发夹',price:320,slot:'head',desc:'一颗会闪的小星星'},
    {id:'acc_glasses',name:'圆框眼镜',price:420,slot:'face',desc:'给史莱姆增加一点书卷气'},
    {id:'acc_scarf',name:'小围巾',price:520,slot:'neck',desc:'柔软的像素围巾'}
  ],
  food:[
    {id:'food_jelly',name:'果冻丁',price:25,hunger:18,mood:2,desc:'便宜的日常口粮'},
    {id:'food_pudding',name:'布丁',price:55,hunger:32,mood:5,desc:'史莱姆很喜欢的甜点'},
    {id:'food_starcake',name:'星星蛋糕',price:120,hunger:55,mood:12,desc:'适合庆祝升级'}
  ],
  titles:[
    {id:'title_lounge_regular',name:'大厅常客',price:500,desc:'展示在用户名旁边'},
    {id:'title_music_lover',name:'耳机不离身',price:700,desc:'听歌室常驻玩家'},
    {id:'title_game_night',name:'今晚开黑',price:700,desc:'游戏室专属氛围'},
    {id:'title_slime_keeper',name:'史莱姆饲养员',price:900,desc:'宠物养成爱好者'}
  ]
};
export const ACHIEVEMENTS=[
  {id:'first_chat',name:'初次发言',desc:'发送第一条聊天消息',counter:'chatMessages',goal:1,xp:20,title:'初来乍到'},
  {id:'chat_100',name:'聊得来',desc:'累计发送 100 条聊天消息',counter:'chatMessages',goal:100,xp:120,title:'话题制造机'},
  {id:'chat_500',name:'频道常驻',desc:'累计发送 500 条聊天消息',counter:'chatMessages',goal:500,xp:260,title:'频道常驻民'},
  {id:'music_30',name:'听歌半小时',desc:'累计在听歌室活跃 30 分钟',counter:'musicMinutes',goal:30,xp:100,title:'耳朵已上线'},
  {id:'music_180',name:'循环播放',desc:'累计在听歌室活跃 180 分钟',counter:'musicMinutes',goal:180,xp:260,title:'今日单曲循环'},
  {id:'game_1',name:'第一次开局',desc:'完成第一局游戏',counter:'gamesFinished',goal:1,xp:40,title:'新手上桌'},
  {id:'game_20',name:'今晚开局',desc:'累计完成 20 局游戏',counter:'gamesFinished',goal:20,xp:180,title:'再来一局'},
  {id:'game_100',name:'百局玩家',desc:'累计完成 100 局游戏',counter:'gamesFinished',goal:100,xp:420,title:'百战史莱姆'},
  {id:'friends_1',name:'第一位好友',desc:'拥有第一位好友',counter:'friends',goal:1,xp:30,title:'认识你很高兴'},
  {id:'friends_5',name:'五人成行',desc:'拥有 5 位好友',counter:'friends',goal:5,xp:100,title:'社交史莱姆'},
  {id:'friends_10',name:'小小社群',desc:'拥有 10 位好友',counter:'friends',goal:10,xp:180,title:'大家都认识'},
  {id:'shop_1',name:'第一次购物',desc:'在商城购买第一件商品',counter:'purchases',goal:1,xp:30,title:'试着买点什么'},
  {id:'shop_5',name:'第一次剁手之后',desc:'累计购买 5 件商品',counter:'purchases',goal:5,xp:80,title:'小小收藏家'},
  {id:'shop_20',name:'收藏柜满了',desc:'累计购买 20 件商品',counter:'purchases',goal:20,xp:200,title:'收藏家'},
  {id:'pet_1',name:'第一次投喂',desc:'第一次给宠物喂食',counter:'petFeeds',goal:1,xp:30,title:'开始养宠'},
  {id:'pet_10',name:'投喂专家',desc:'累计投喂宠物 10 次',counter:'petFeeds',goal:10,xp:100,title:'投喂熟练工'},
  {id:'pet_50',name:'长期饭票',desc:'累计投喂宠物 50 次',counter:'petFeeds',goal:50,xp:260,title:'专属饭票'},
  {id:'level_5',name:'五级居民',desc:'账号等级达到 5 级',counter:'level',goal:5,xp:80,title:'Lounge 居民'},
  {id:'level_10',name:'十级居民',desc:'账号等级达到 10 级',counter:'level',goal:10,xp:200,title:'Lounge 熟面孔'},
  {id:'level_20',name:'二十级居民',desc:'账号等级达到 20 级',counter:'level',goal:20,xp:400,title:'Lounge 老住户'}
]
function int(v,d=0){const n=Math.floor(Number(v));return Number.isFinite(n)?n:d}
function xpNeed(level){return 80+Math.max(0,level-1)*35}
export function ensureProgressionUser(u){
  if(!u)return u;u.level=Math.max(1,int(u.level,1));u.xp=Math.max(0,int(u.xp,0));u.stats={chatMessages:0,musicMinutes:0,gameMinutes:0,gamesFinished:0,purchases:0,petFeeds:0,...(u.stats||{})};u.inventory={accessories:[],food:{},titles:[],...(u.inventory||{})};u.inventory.accessories=[...new Set(u.inventory.accessories||[])];u.inventory.titles=[...new Set(u.inventory.titles||[])];u.inventory.food={...(u.inventory.food||{})};u.achievements=[...new Set(u.achievements||[])];u.unlockedTitles=[...new Set(u.unlockedTitles||[])];u.customTitles=[...new Set(u.customTitles||[])];u.equippedTitle=String(u.equippedTitle||'');u.activityXpAt={...(u.activityXpAt||{})};u.pet={name:'小史莱姆',level:1,xp:0,hunger:80,mood:70,lastCareAt:Date.now(),equipped:{head:'',face:'',neck:''},...(u.pet||{})};u.pet.level=Math.max(1,int(u.pet.level,1));u.pet.xp=Math.max(0,int(u.pet.xp,0));u.pet.hunger=Math.max(0,Math.min(100,int(u.pet.hunger,80)));u.pet.mood=Math.max(0,Math.min(100,int(u.pet.mood,70)));u.pet.equipped={head:'',face:'',neck:'',...(u.pet.equipped||{})};return u
}
function refreshPet(u,now=Date.now()){ensureProgressionUser(u);const last=Number(u.pet.lastCareAt)||now,hours=Math.floor(Math.max(0,now-last)/3600000);if(hours>0){const h=Math.min(72,hours);u.pet.hunger=Math.max(0,u.pet.hunger-h*2);if(u.pet.hunger<35)u.pet.mood=Math.max(0,u.pet.mood-Math.ceil(h/2));u.pet.lastCareAt=last+hours*3600000}return u.pet}
function levelUp(u){ensureProgressionUser(u);let changed=false;while(u.xp>=xpNeed(u.level)){u.xp-=xpNeed(u.level);u.level++;changed=true}return changed}
function petLevelUp(u){ensureProgressionUser(u);let changed=false;while(u.pet.xp>=60+u.pet.level*25){u.pet.xp-=60+u.pet.level*25;u.pet.level++;changed=true}return changed}
export function grantXp(u,amount,{pet=true}={}){ensureProgressionUser(u);const n=Math.max(0,int(amount));if(!n)return;u.xp+=n;if(pet)u.pet.xp+=Math.max(1,Math.round(n*.65));levelUp(u);petLevelUp(u)}
export function evaluateAchievements(u,friendCount=0){ensureProgressionUser(u);const got=[];const values={...u.stats,friends:friendCount,level:u.level};for(const a of ACHIEVEMENTS){if(u.achievements.includes(a.id))continue;if((values[a.counter]||0)>=a.goal){u.achievements.push(a.id);u.unlockedTitles.push(a.title);grantXp(u,a.xp,{pet:false});got.push(a)}}u.unlockedTitles=[...new Set(u.unlockedTitles)];return got}
export function titleOptions(u){ensureProgressionUser(u);const purchased=(SHOP_CATALOG.titles||[]).filter(x=>u.inventory.titles.includes(x.id)).map(x=>x.name);return [...new Set([...u.unlockedTitles,...purchased,...u.customTitles])]}
export function publicProgressionExtras(u){ensureProgressionUser(u);return {level:u.level,xp:u.xp,xpNext:xpNeed(u.level),equippedTitle:u.equippedTitle||'',pet:{name:u.pet.name,level:u.pet.level,hunger:u.pet.hunger,mood:u.pet.mood,equipped:u.pet.equipped},achievementCount:u.achievements.length}}
export function createProgressionService({data,body,auth,json,isStaff,publicUser,refreshWallet,save,friendRel}){
  const chipLocked=id=>Object.values(data.roomGames||{}).some(s=>['blackjack','poker'].includes(s?.kind)&&['playing','dealer','preflop','flop','turn','river','run_choice'].includes(s.phase)&&(s.seats||[]).some(p=>p?.userId===id));
  const friendCount=id=>(data.friendships||[]).filter(f=>f.state==='accepted'&&(f.a===id||f.b===id)).length;
  const selfPayload=u=>{ensureProgressionUser(u);refreshPet(u);evaluateAchievements(u,friendCount(u.userId));return {profile:publicUser(u),progression:{level:u.level,xp:u.xp,xpNext:xpNeed(u.level),stats:u.stats,achievements:ACHIEVEMENTS.map(a=>({...a,done:u.achievements.includes(a.id),progress:a.counter==='friends'?friendCount(u.userId):a.counter==='level'?u.level:u.stats[a.counter]||0})),titles:titleOptions(u),equippedTitle:u.equippedTitle,inventory:u.inventory,pet:u.pet,shop:SHOP_CATALOG}}};
  function activity(u,kind){ensureProgressionUser(u);const now=Date.now(),last=Number(u.activityXpAt[kind]||0);if(now-last<55000)return 0;u.activityXpAt[kind]=now;const pts=kind==='game'?4:kind==='music'?3:2;grantXp(u,pts);if(kind==='game')u.stats.gameMinutes++;if(kind==='music')u.stats.musicMinutes++;evaluateAchievements(u,friendCount(u.userId));return pts}
  function noteChat(u){ensureProgressionUser(u);u.stats.chatMessages++;const now=Date.now();if(now-Number(u.activityXpAt.chatMessage||0)>=15000){u.activityXpAt.chatMessage=now;grantXp(u,2)}evaluateAchievements(u,friendCount(u.userId));return true}
  function recordGameFinish(before,after){if(Number(before?.finishedAt)||!Number(after?.finishedAt))return false;const ids=[];for(const p of after?.players||[])if(p&&!String(p).startsWith('BOT:'))ids.push(String(p));for(const p of after?.seats||[]){const id=p?.forfeitUserId||p?.userId;if(id&&!String(id).startsWith('BOT:'))ids.push(String(id))}let changed=false;for(const id of new Set(ids)){const u=data.users[id];if(!u)continue;ensureProgressionUser(u);u.stats.gamesFinished++;grantXp(u,15);evaluateAchievements(u,friendCount(id));changed=true}return changed}
  async function handle(req,res,url){
    if(!url.pathname.startsWith('/api/progression/')&&!url.pathname.startsWith('/api/profile-card'))return false;
    if(req.method!=='POST')return json(res,405,{ok:false,error:'Method Not Allowed'}),true;
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);if(!a)return json(res,401,{ok:false,error:'设备身份无效'}),true;ensureProgressionUser(a.u);
    if(url.pathname==='/api/profile-card'){const target=data.users[String(b.targetUserId||a.u.userId)];if(!target)return json(res,404,{ok:false,error:'用户不存在'}),true;ensureProgressionUser(target);refreshPet(target);const rel=target.userId===a.u.userId?'self':friendRel(a.u.userId,target.userId)?.state||'none';return json(res,200,{ok:true,profile:publicUser(target),relation:rel,achievements:target.achievements.length,pet:{name:target.pet.name,level:target.pet.level}}),true}
    if(url.pathname==='/api/progression/self'){return json(res,200,{ok:true,...selfPayload(a.u)}),true}
    if(url.pathname==='/api/progression/tick'){const kind=['chat','music','game'].includes(b.kind)?b.kind:'chat',gained=activity(a.u,kind);if(gained)save();return json(res,200,{ok:true,gained,...selfPayload(a.u)}),true}
    if(url.pathname==='/api/progression/equip-title'){const title=String(b.title||'');if(title&&!titleOptions(a.u).includes(title))return json(res,403,{ok:false,error:'这个头衔尚未拥有'}),true;a.u.equippedTitle=title;save();return json(res,200,{ok:true,...selfPayload(a.u)}),true}
    if(url.pathname==='/api/progression/pet'){refreshPet(a.u);const action=String(b.action||'');if(action==='rename'){const name=String(b.name||'').trim().slice(0,12);if(!name)return json(res,400,{ok:false,error:'宠物名字不能为空'}),true;a.u.pet.name=name}
      else if(action==='feed'){const id=String(b.itemId||''),item=SHOP_CATALOG.food.find(x=>x.id===id),n=int(a.u.inventory.food[id]);if(!item||n<=0)return json(res,400,{ok:false,error:'背包里没有这份食物'}),true;a.u.inventory.food[id]=n-1;a.u.pet.hunger=Math.min(100,a.u.pet.hunger+item.hunger);a.u.pet.mood=Math.min(100,a.u.pet.mood+item.mood);a.u.stats.petFeeds++;a.u.pet.lastCareAt=Date.now();grantXp(a.u,3)}
      else if(action==='play'){const now=Date.now();if(now-Number(a.u.pet.lastPlayAt||0)<5*60*1000)return json(res,429,{ok:false,error:'刚陪它玩过，过几分钟再来'}),true;a.u.pet.lastPlayAt=now;a.u.pet.mood=Math.min(100,a.u.pet.mood+14);a.u.pet.hunger=Math.max(0,a.u.pet.hunger-5);grantXp(a.u,4)}
      else if(action==='equip'){const id=String(b.itemId||''),item=SHOP_CATALOG.accessories.find(x=>x.id===id);if(!item||!a.u.inventory.accessories.includes(id))return json(res,403,{ok:false,error:'还没有这个配饰'}),true;a.u.pet.equipped[item.slot]=id}
      else if(action==='unequip'){const slot=['head','face','neck'].includes(b.slot)?b.slot:'';if(slot)a.u.pet.equipped[slot]=''}else return json(res,400,{ok:false,error:'未知宠物操作'}),true;evaluateAchievements(a.u,friendCount(a.u.userId));save();return json(res,200,{ok:true,...selfPayload(a.u)}),true}
    if(url.pathname==='/api/progression/buy'){if(chipLocked(a.u.userId))return json(res,409,{ok:false,error:'21点 / 德州本手进行中，结束后再使用筹码购物'}),true;const cat=String(b.category||''),id=String(b.itemId||''),list=SHOP_CATALOG[cat];const item=Array.isArray(list)?list.find(x=>x.id===id):null;if(!item)return json(res,404,{ok:false,error:'商品不存在'}),true;const wallet=refreshWallet(a.u);if(wallet<item.price)return json(res,400,{ok:false,error:`筹码不足，需要 ${item.price}`}),true;if(cat==='accessories'&&a.u.inventory.accessories.includes(id))return json(res,409,{ok:false,error:'已经拥有这个配饰'}),true;if(cat==='titles'&&a.u.inventory.titles.includes(id))return json(res,409,{ok:false,error:'已经拥有这个头衔'}),true;a.u.chips=wallet-item.price;a.u.chipsUpdatedAt=Date.now();if(cat==='accessories')a.u.inventory.accessories.push(id);else if(cat==='titles')a.u.inventory.titles.push(id);else if(cat==='food')a.u.inventory.food[id]=(int(a.u.inventory.food[id])+1);a.u.stats.purchases++;grantXp(a.u,2);evaluateAchievements(a.u,friendCount(a.u.userId));save();return json(res,200,{ok:true,...selfPayload(a.u)}),true}
    if(url.pathname==='/api/progression/admin-title'){if(!isStaff(a.u))return json(res,403,{ok:false,error:'无管理员权限'}),true;const target=data.users[String(b.targetUserId||'')];if(!target)return json(res,404,{ok:false,error:'用户不存在'}),true;ensureProgressionUser(target);const title=String(b.title||'').trim().slice(0,20);if(b.action==='grant'){if(!title)return json(res,400,{ok:false,error:'请输入头衔'}),true;target.customTitles=[...new Set([...target.customTitles,title])]}else if(b.action==='revoke'){target.customTitles=target.customTitles.filter(x=>x!==title);if(target.equippedTitle===title)target.equippedTitle=''}else return json(res,400,{ok:false,error:'未知头衔操作'}),true;save();return json(res,200,{ok:true,profile:publicUser(target)}),true}
    return json(res,404,{ok:false,error:'未知养成接口'}),true
  }
  return {handle,activity,selfPayload,recordGameFinish,noteChat}
}

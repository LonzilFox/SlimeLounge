import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createProgressionService,DEFAULT_PROGRESSION_CONFIG,normalizeProgressionConfig} from '../../server/progression.js';
import {validateRoomMessage} from '../../server/input_validation.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw Error(m)};
const app=read('public/app.js'),chat=read('public/chat-ui.js'),ws=read('server/ws_session_auth.js'),server=read('local_server.js'),prog=read('server/progression.js'),progUi=read('public/progression-ui.js'),acc=read('public/ui-enhancements.js'),leisure=read('public/leisure-ui.js'),css=read('public/styles.css')+'\n'+read('public/styles-responsive.css')+'\n'+read('public/ui-overrides.css'),games=read('public/app-games.js'),html=read('public/index.html');

ok(server.includes('messages:m.slice(-24)')&&ws.includes('allMessages.slice(-24)')&&app.includes('chatHasMore:j.chatHasMore'),'initial chat window is not newest 24 / HTTP metadata missing');
ok(chat.includes('chatHistoryBatchSize')&&chat.includes('Math.ceil(h/58)+6')&&chat.includes('if(e.scrollTop>80)return')&&!chat.includes('limit:40'),'chat history is not top-triggered adaptive batching');
ok(app.includes('chatWindowInitialized')&&app.includes('forceBottom:chatInitFresh'),'chat init/fallback history lifecycle protection missing');
ok(css.includes('#adminView .admin-item-scroll')&&css.includes('max-height:none!important;overflow:visible!important')&&css.includes('content-visibility:visible!important'),'admin expanded sections still use nested scroll/containment');
ok(games.includes('restoreScroll=options.resetScroll?0')&&games.includes('e.scrollTop=restoreScroll')&&games.includes('renderAdmin({resetScroll:true})'),'admin save scroll preservation/tab reset missing');
ok(css.includes('.diag-overview-card')&&css.includes('.diag-user-card')&&css.includes('.diag-grid>div'),'diagnostics UI repair missing');
ok(leisure.includes('<small>可用筹码</small>')&&!leisure.includes('这是 SlimeLounge 内部模拟行情')&&css.includes('min-height:82px!important')&&css.includes('min-height:40px!important'),'market row remains compressed or obsolete note remains');
ok(html.includes('ui-enhancements.js?v=0.4.6&build=046')&&acc.includes('accessoryPalette')&&acc.includes('accessory-svg')&&!acc.includes('accessory-base-layer'),'single-SVG accessory renderer not loaded');
ok(prog.includes('ACCESSORY_ORIGINAL_COLORS')&&prog.includes("c.toLowerCase()==='#ffffff'")&&prog.includes('version:11'),'accessory original-color migration missing');
ok(read('public/accessories/star.svg').includes('viewBox="0 0 28 24"')&&read('public/accessories/star.svg').includes('shape-rendering="crispEdges"'),'star asset is not the v0.4.6 pixel redesign');
ok(progUi.includes('data-prog-shop-move')&&prog.includes("action==='move'")&&progUi.includes('↑ 上移')&&progUi.includes('↓ 下移'),'shop ordering controls/API missing');
ok(progUi.includes('每次活跃结算 XP')&&progUi.includes('约每 60 秒申请一次'),'account growth timer wording is still ambiguous');
ok(prog.includes('moodHungerPenaltyPerHour')&&prog.includes('badMoodXpPenaltyPct')&&prog.includes('carePenalty')&&progUi.includes('当前成长惩罚'),'pet baseline mood decay / care penalty missing');

// Millisecond timestamps are legitimate room-message numbers; generic validation must not reject heartbeats.
validateRoomMessage({type:'heartbeat',clientAt:Date.now()});
let badNumberRejected=false;try{validateRoomMessage({type:'game_action',action:{type:'ready',value:Number.POSITIVE_INFINITY}})}catch{badNumberRejected=true}
ok(badNumberRejected,'non-finite numeric payloads must still be rejected');

// v4 white-default migration -> original per-accessory color.
const migrated=normalizeProgressionConfig({version:4,shop:{accessories:[{id:'acc_bow',name:'x',asset:'/accessories/bow.svg',color:'#ffffff',enabled:true}]}});
ok(migrated.version===11&&migrated.shop.accessories.find(x=>x.id==='acc_bow')?.color==='#ff7fa2','white accessory migration did not recover bow original color');

// Pet mood always decays; low hunger adds extra mood loss; poor care reduces normal activity XP.
const now=Date.now(),user={userId:'u1',name:'T',level:1,xp:0,stats:{},inventory:{},achievements:[],pet:{name:'S',level:1,xp:0,hunger:80,mood:70,lastCareAt:now-2*3600000,equipped:{},accessoryColors:{}},activityXpAt:{}};
const data={users:{u1:user},friendships:[],roomGames:{},progressionConfig:structuredClone(DEFAULT_PROGRESSION_CONFIG)};
const svc=createProgressionService({data,body:async()=>({}),auth:()=>null,json:()=>{},isStaff:()=>false,publicUser:u=>u,refreshWallet:u=>u.chips||0,save:()=>{},friendRel:()=>null});
let payload=svc.selfPayload(user);ok(payload.progression.pet.hunger===76&&payload.progression.pet.mood===68,'mood must decay every elapsed hour even while not hungry');
user.pet.hunger=20;user.pet.mood=20;user.pet.lastCareAt=Date.now();user.activityXpAt.game=0;const gained=svc.activity(user,'game');ok(gained===2,'combined hunger+mood penalty should reduce default 4 game activity XP to 2');

console.log('[OK] v0.4.6 newest-chat paging / full admin expansion / market UI / single-SVG accessory recoloring+order / pet mood penalties');

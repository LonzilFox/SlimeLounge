import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_LEISURE_CONFIG,normalizeLeisureConfig} from '../../../server/leisure_service.js';
import {DEFAULT_GAME_CHIP_RULES,normalizeEconomy} from '../../../server/economy.js';
import {EXTRA_ROOM_DEFS} from '../../../shared/extra_games.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw Error(m)};
const pkg=JSON.parse(read('package.json'));
const html=read('public/index.html'),app=read('public/app.js'),games=read('public/app-games.js'),leisure=read('public/leisure-ui.js'),prog=read('public/progression-ui.js'),progression=read('server/progression.js'),rank=read('server/rankings.js'),diag=read('server/runtime_diagnostics.js'),css=read('public/ui-overrides.css');

ok(pkg.version==='0.4.8','package version is not v0.4.8');
ok(html.includes('v=0.4.8&build=048')&&!html.includes('042fix2'),'v0.4.8 asset cache revision missing');
ok(app.includes("FEATURE_VERSION='0.4.8',ASSET_BUILD='048'"),'dynamic feature cache revision missing');

const cfg=normalizeLeisureConfig({});
const fish=cfg.fishing.fish;
ok(DEFAULT_LEISURE_CONFIG.version===9&&fish.length===77,'Stardew fishing catalogue should contain 77 entries');
ok(new Set(fish.map(x=>x.id)).size===77,'duplicate fish ids');
ok(['legend','legend_ii','goby','river_jelly','sea_jelly','cave_jelly'].every(id=>fish.some(x=>x.id===id)),'key Stardew fish/special catches missing');
ok(fish.every(x=>x.basePrice>=50&&x.basePrice<=2000&&x.basePrice%25===0),'fish prices must be 50..2000 and multiples of 25');
ok(fish.every(x=>x.rarity>=1&&x.rarity<=10&&x.difficulty>=1&&x.difficulty<=110),'fish rarity/difficulty bounds invalid');
ok(leisure.includes("sort((a,b)=>(Number(a.rarity)||0)-(Number(b.rarity)||0)||(Number(a.basePrice)||0)-(Number(b.basePrice)||0)"),'admin fish list is not low rarity/price first');

ok(leisure.includes('if(fishingGame)return')&&leisure.includes('if(fishingCastBusy||fishingGame||Date.now()<fishingCastBlockedUntil)return'),'fishing single-round render/cast lock missing');
ok(leisure.includes('fishingCastBlockedUntil=Date.now()+850')&&leisure.includes('const epoch=leisureEpoch,box=$(\'#fishingGame\'),unlock='),'fishing ghost-click guard missing');
ok(leisure.includes('持股实时盈亏')&&leisure.includes('spreadBps')&&leisure.includes('marketTradeBusy'),'market floating P/L, spread or client trade lock missing');
ok(DEFAULT_LEISURE_CONFIG.market.spreadBps>0&&cfg.market.tradeCooldownMs>=500,'market difficulty defaults not applied');

ok(app.includes("fishing:'钓鱼盈利'")&&games.includes("isFishing=tab==='fishing'")&&games.includes('累计钓鱼盈利')&&rank.includes('fishing=users.map')&&rank.includes('return {chips,accountLevel,petLevel,market,fishing,single,games}'),'fishing profit ranking missing');
ok(app.includes("trading:'炒股中'")&&app.includes("fishing:'钓鱼中'"),'trading/fishing presence labels missing');
ok(app.includes("setTimeout(()=>{if(!established)ensureFallback")&&app.includes('},3500)')&&app.includes('},1800)'),'room transport tolerance not updated');
ok(app.includes('setInterval(healthPing,25000)')&&app.includes('},60000)'),'background request intervals not reduced');
ok(read('public/chat-ui.js').includes('setInterval(refreshChannelUnread,20000)'),'chat unread polling interval not reduced');
ok(diag.includes("x.path!=='/api/room/poll'")&&diag.includes("pathname!=='/api/room/poll'"),'intentional long-poll is still counted as server slowness');

ok(EXTRA_ROOM_DEFS.some(x=>x.game==='tetris'&&x.single&&x.board===undefined),'single-player Tetris room missing');
ok(DEFAULT_GAME_CHIP_RULES.tetris&&normalizeEconomy({}).gameRules.tetris,'Tetris economy rule missing');
ok(app.includes("tetris:'俄罗斯方块'")&&games.includes('function renderTetris')&&games.includes('createLocalTetris'),'Tetris client implementation missing');
ok(css.includes('.tetris-board')&&css.includes('grid-template-columns:repeat(10,1fr)'),'Tetris responsive CSS missing');

const food=prog.indexOf("['food','宠物食物'"),acc=prog.indexOf("['accessories','宠物配饰'"),title=prog.indexOf("['titles','用户头衔'");
ok(food>=0&&food<acc&&acc<title&&prog.includes('<details class="page-card shop-section"'),'shop collapsible order is wrong');
ok(prog.includes("['effect','特效']")&&progression.includes("'effect'"),'pet effect accessory slot missing');

const finalSticky=css.lastIndexOf('#adminView .admin-tabs-v038{');
ok(finalSticky>=0&&css.slice(finalSticky,finalSticky+300).includes('position:sticky!important'),'admin tabs final rule is not sticky/topmost');
ok(css.includes('.market-summary{grid-template-columns:repeat(auto-fit,minmax')&&css.includes('overflow:visible!important')&&css.includes('@media(max-width:380px)'), 'market/mobile responsive summary repair missing');
const finalResponsive=css.slice(css.lastIndexOf('/* v0.4.4 responsive market hotfix'));
ok(finalResponsive.includes('repeat(auto-fit,minmax')&&!/market-(?:summary|grid|asset|order|margin-open|position-actions)[^{]*\{[^}]*overflow-x\s*:\s*auto!important/.test(finalResponsive),'v0.4.8 final market layer reintroduced a horizontal scroller');

ok(fs.statSync(path.join(root,'public/app.js')).size<90000&&fs.statSync(path.join(root,'local_server.js')).size<90000,'upload-sensitive source file exceeds 90KB');
console.log('[OK] v0.4.8 fishing state machine / Stardew catalogue / transport tuning / Tetris / rankings / responsive UI');

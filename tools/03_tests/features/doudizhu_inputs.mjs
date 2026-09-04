import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_PROGRESSION_CONFIG,normalizeProgressionConfig} from '../../../server/progression.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const ok=(v,m)=>{if(!v)throw Error(m)};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('public/app.js'),games=read('public/app-games.js'),pet=read('public/progression-ui.js'),leisure=read('public/leisure-ui.js'),poker=read('public/game-poker.js'),css=read('public/styles.css')+'\n'+read('public/styles-responsive.css')+'\n'+read('public/ui-overrides.css'),html=read('public/index.html');

// Multiplayer game discovery and first-class leisure navigation.
ok(app.includes("'doudizhu'")&&app.includes("doudizhu:'三人斗地主"),'doudizhu missing from multiplayer game discovery'); // exact v0.4.8 placement is covered by 70_feature_market_admin_rankings.mjs
ok(app.includes("doudizhu:'三人斗地主")&&app.includes("loadFeatureScript('game-doudizhu')"),'doudizhu UI module/description missing');
ok(!app.includes('leisure-row')&&!app.includes('data-leisure='),'fishing/market still exposed from single-player games');
ok(html.includes('data-section="fishing"')&&html.includes('data-section="market"')&&!pet.includes('data-pet-leisure="fishing"')&&!pet.includes('data-pet-leisure="market"'),'fishing/market are not first-class nav items');
ok(leisure.includes("const back=leisureOrigin==='nav'?'':")&&html.includes('ui-enhancements.js') ,'leisure first-class navigation mode missing');

// Requested admin information architecture: exactly six top-level tabs, everything else nested.
const expected=[['users','用户与设备'],['employee','工号审核'],['games','游戏设置'],['shop','商城设置'],['growth','成长与宠物'],['diagnostics','服务器诊断']];
for(const [id,label] of expected)ok(games.includes(`data-admin-tab="${id}"`)&&games.includes(`>${label}`),`admin tab missing: ${label}`);
for(const legacy of ['data-admin-tab="chips"','data-admin-tab="rankings"','data-admin-tab="leisure"','data-admin-tab="progression"'])ok(!games.includes(legacy),`legacy top admin tab survived: ${legacy}`);
ok(games.includes('<b>筹码设置</b>')&&games.includes('<b>玩家筹码设置</b>')&&games.includes('renderLeisureAdminSection(\'fishing\'')&&games.includes('renderLeisureAdminSection(\'market\''),'game settings subgroups missing');
ok(pet.includes("renderProgressionAdminSection(kind")&&pet.includes("kind==='shop'")&&pet.includes("kind==='growth'")&&pet.includes('成就设置')&&!games.includes('data-admin-tab="achievements"'),'shop/growth/achievement admin grouping missing');
ok(css.includes('.admin-setting-group')&&css.includes('.admin-item-scroll')&&css.includes('.admin-tabs-v038'),'compact admin/collapsible styles missing');

// Boss mode needs to look like neutral work/data UI, not colored playing cards.
ok(poker.includes('boss-token')&&poker.includes('数据协作')&&poker.includes('记录工作台')&&poker.includes("'<span class=\"boss-token muted\">--</span>'"),'neutral poker boss UI missing');
ok(css.includes('.poker-boss-shell')&&css.includes('.boss-token'),'boss-mode neutral visual treatment missing');

// Responsive / spacing baseline.
ok(html.includes('styles.css?v=0.4.8&build=048'),'v0.3.8 responsive stylesheet not loaded');
ok(css.includes('.game-row-list')&&css.includes('gap:12px')&&css.includes('@media(max-width:520px)')&&css.includes('min-width:0!important'),'spacing/zoom responsive guardrails missing');

// v0.3.6 -> v0.3.8 migration must preserve Owner custom values/deletions and append ONLY v4 additions.
const previous={
  version:3,
  account:{...DEFAULT_PROGRESSION_CONFIG.account,levelXpBase:777},
  pet:{...DEFAULT_PROGRESSION_CONFIG.pet,feedXp:91},
  shop:{
    accessories:DEFAULT_PROGRESSION_CONFIG.shop.accessories.filter(x=>x.id!=='acc_leaf'&&!['acc_flower','acc_crown','acc_headphones'].includes(x.id)).map(x=>x.id==='acc_bow'?{...x,price:76543}:x),
    food:DEFAULT_PROGRESSION_CONFIG.shop.food.filter(x=>!['food_mint_mochi','food_berry_soda','food_moon_cookie'].includes(x.id)),
    titles:DEFAULT_PROGRESSION_CONFIG.shop.titles.filter(x=>!['title_lake_angler','title_market_watcher','title_table_regular'].includes(x.id))
  },
  achievements:DEFAULT_PROGRESSION_CONFIG.achievements.filter(x=>!['fish_250','market_200','pet_100','game_300'].includes(x.id))
};
const up=normalizeProgressionConfig(previous);
ok(up.version===14&&up.account.levelXpBase===777&&up.pet.feedXp===91,'v3 growth customization overwritten by v4 migration');
ok(up.shop.accessories.find(x=>x.id==='acc_bow')?.price===76543,'custom accessory price overwritten');
ok(!up.shop.accessories.some(x=>x.id==='acc_leaf'),'previously deleted old default accessory was resurrected');
for(const id of ['acc_flower','acc_crown','acc_headphones'])ok(up.shop.accessories.some(x=>x.id===id),`new v4 accessory not appended: ${id}`);
for(const id of ['food_mint_mochi','food_berry_soda','food_moon_cookie'])ok(up.shop.food.some(x=>x.id===id),`new v4 food not appended: ${id}`);
for(const id of ['title_lake_angler','title_market_watcher','title_table_regular'])ok(up.shop.titles.some(x=>x.id===id),`new v4 title not appended: ${id}`);
for(const id of ['fish_250','market_200','pet_100','game_300'])ok(up.achievements.some(x=>x.id===id),`new v4 achievement not appended: ${id}`);

ok(leisure.includes('钓到一条 XP')&&leisure.includes('每条售出 XP')&&(leisure.includes('宠物 XP')||leisure.includes('宠物经验')),'fishing XP/admin explanation missing');
ok(fs.existsSync(path.join(root,'docs/PROJECT_GUIDE.md'))&&read('docs/PROJECT_GUIDE.md').includes('每周观察'),'maintenance/product roadmap missing');
ok(JSON.parse(read('release_notes/releases.json')).some(x=>x.id==='v0.3.8'),'v0.3.8 release notes missing');
console.log('[OK] v0.3.8 admin IA / discreet boss mode / first-class leisure / doudizhu / responsive spacing / patch migration / roadmap');

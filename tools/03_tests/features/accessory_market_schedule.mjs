import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizeLeisureConfig,DEFAULT_LEISURE_CONFIG,fishingQuality} from '../../../server/leisure_service.js';
import {normalizeProgressionConfig,DEFAULT_PROGRESSION_CONFIG} from '../../../server/progression.js';
import {normalizeEconomy} from '../../../server/economy.js';
import {syncReleaseNotes} from '../../../server/release_notes.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw Error(m)};
const pkg=JSON.parse(read('package.json')),app=read('public/app.js'),leisure=read('server/leisure_service.js'),leisureUi=read('public/leisure-ui.js'),progression=read('server/progression.js'),progressionUi=read('public/progression-ui.js'),economy=read('server/economy.js'),adminEconomy=read('public/admin-economy.js'),pokerUi=read('public/game-poker.js'),html=read('public/index.html'),extra=read('shared/extra_games.js'),fishingNav=read('public/icons/fishing-nav.svg'),ui=read('public/ui-enhancements.js'),notes=JSON.parse(read('release_notes/releases.json'));

ok(pkg.version==='0.4.8','package version is not v0.4.8');
ok(DEFAULT_LEISURE_CONFIG.version===9&&DEFAULT_PROGRESSION_CONFIG.version===14,'current leisure/progression schema mismatch');
ok(html.includes('/icons/fishing-nav.svg?v=0.4.8')&&!html.includes('<span class="nav-icon">🎣</span><span class="nav-label">钓鱼</span>'),'pixel fishing nav icon missing');
ok(/fill="#ffffff"/i.test(fishingNav)&&!/fill="#(?!ffffff)[0-9a-f]{6}/i.test(fishingNav)&&fishingNav.includes('M2 1h2v12H2z'),'fishing icon is not pure-white / longer-rod pixel art');
for(const name of ['star','partyhat','crown','halo','horns','monocle','bowtie','sparkles']){const svg=read(`public/accessories/${name}.svg`);ok(svg.includes('shape-rendering="crispEdges"'),`${name} is not crisp pixel art`)}
ok(read('public/accessories/halo.svg').includes('viewBox="0 0 64 24"')&&ui.includes("'/accessories/halo.svg'")&&ui.includes("viewBox:'0 0 64 24'")&&ui.includes("M16 2h32v3H16z"),'angel halo is not a hollow segmented pixel ring in file/runtime renderer');
ok(!read('public/accessories/monocle.svg').includes('fill-opacity')&&ui.includes("'/accessories/monocle.svg'")&&!/monocle\.svg'[^\n]+glass:/.test(ui),'monocle lens is not transparent');
ok(progression.includes('version:14')&&progression.includes('migrateAccessoryV12')&&progression.includes("name:'天使光环'")&&progression.includes("slot:'head'"),'halo head-slot semantic migration missing');
ok(progressionUi.includes("slime('sky','pet-big')")&&progressionUi.includes('petAccessoryVisual(x,x.color)')&&read('public/ui-overrides.css').includes('.admin-acc-live .slime.pet-big'),'accessory admin preview is not using the actual pet canvas/placement renderer');
const pc=normalizeProgressionConfig({version:11,shop:{accessories:[{id:'acc_halo',name:'史莱姆光环',price:98765,slot:'effect',desc:'漂浮在头顶的柔光环',enabled:true,asset:'/accessories/halo.svg',x:43,y:7,w:71,rotate:3,z:8,color:'#ffe77a'}]}}),haloAcc=pc.shop.accessories.find(x=>x.id==='acc_halo');
ok(pc.version===14&&haloAcc?.slot==='head'&&haloAcc.name==='天使光环','halo did not migrate to head/angel semantics');
ok(haloAcc.price===98765&&haloAcc.x===43&&haloAcc.y===7&&haloAcc.w===71&&haloAcc.rotate===3&&haloAcc.z===8,'halo migration overwrote owner price/placement customization');
ok(progressionUi.includes("progAdminFold('经验排行'")&&progressionUi.includes("growthRanks,false")&&!progressionUi.includes("growthRanks,true"),'growth/pet admin should default collapsed');
const t=extra.indexOf("id:'tetris-1'"),s=extra.indexOf("id:'sudoku-1'"),m=extra.indexOf("id:'minesweeper-1'");ok(t>=0&&t<s&&s<m&&app.includes("['tetris','sudoku','minesweeper']"),'single-player order is not Tetris -> Sudoku -> Minesweeper');

const lc=normalizeLeisureConfig({version:8,market:{minBaseRatio:0.1,maxBaseRatio:10,sessionStartHour:8,sessionEndHour:21,weekendClosed:true,sessionTimeZone:'Asia/Shanghai'},fishing:{rods:[{id:'rod_training',name:'自定义训练竿',price:777,enabled:true}],fish:[{id:'carp',name:'自定义鲤鱼',basePrice:125,difficulty:15,rarity:1,minSize:30,maxSize:78,enabled:true}]}});
ok(lc.market.minBaseRatio===0.1&&lc.market.maxBaseRatio===10&&lc.market.softBandBufferPct===1,'market band defaults/migration missing');
ok(lc.market.sessionStartHour===8&&lc.market.sessionEndHour===21&&lc.market.weekendClosed&&lc.market.sessionTimeZone==='Asia/Shanghai','market schedule defaults missing');
ok(lc.market.noiseScale===0.06&&lc.market.eventChance===0.012&&lc.market.eventMinVolScale===0.03&&lc.market.eventExtraVolScale===0.07,'fresh/default random-vs-trend balance missing');
ok(leisure.includes('/Math.sqrt(.5)')&&leisure.includes('noise=z*a.volatility*cfg.market.noiseScale*wallClockScale'),'market noise is not standardized to make admin volatility intuitive');
ok(lc.fishing.rods[0].price===777&&lc.fishing.fish[0].basePrice===125,'v0.4.8 migration overwrote existing rod/fish price');
const advanced=DEFAULT_LEISURE_CONFIG.fishing.rods.find(x=>x.id==='rod_advanced_iridium');let iri=0;for(let i=0;i<10000;i++)if(fishingQuality(91,advanced,()=>i/10000)[0]==='铱星')iri++;ok(iri>=2000&&iri<=2400,`advanced iridium rod quality balance unexpected: ${iri}/10000`);

ok(leisure.includes('outerMin*(1+buffer)')&&leisure.includes('outerMax*(1-buffer)')&&leisure.includes('edgeGuardStrength')&&leisure.includes('bounce=Math.min(.025,.001+over*.12)'),'market does not approach limits with inward buffer/edge guard/reflection');
for(const key of ['market.minBaseRatio','market.maxBaseRatio','market.softBandBufferPct','market.edgeGuardZonePct','market.edgeGuardStrength','market.noiseScale','market.eventChance','market.eventMinVolScale','market.eventExtraVolScale','market.regimeChance','market.regimeBiasScale','market.momentumFactor','market.meanReversion','market.maxTickMovePct','market.fairPriceAlpha','market.sessionStartHour','market.sessionEndHour','market.weekendClosed','market.sessionTimeZone'])ok(leisureUi.includes(key),`market admin field missing: ${key}`);
ok(leisure.includes('marketIsOpen(cfg,now)')&&leisure.includes('当前为休市时间，仅工作日 08:00-21:00'),'market closed-time server guard missing');
const eco=normalizeEconomy({gameRules:{poker:{smallBlind:10,bigBlind:20,buyInCapBb:320}}});ok(eco.gameRules.poker.buyInCapBb===320&&economy.includes('buyInCapBb:200')&&adminEconomy.includes('chipRulePokerCap')&&pokerUi.includes('bounds.capBb'),'poker buy-in cap admin/server/UI missing');

for(const f of ['comet-dust','prism-glimmer','frost-moths','ember-wisps','void-shards'])ok(fs.existsSync(path.join(root,`public/accessories/${f}.svg`)),`v0.4.8 particle asset missing: ${f}`);
for(const id of ['acc_comet_dust','acc_prism_glimmer','acc_frost_moths','acc_ember_wisps','acc_void_shards'])ok(DEFAULT_PROGRESSION_CONFIG.shop.accessories.some(x=>x.id===id),`v0.4.8 particle product missing: ${id}`);
for(const id of ['acc_fireflies','acc_moon_motes','acc_petals','acc_aurora_dust','acc_nebula_dust'])ok(!DEFAULT_PROGRESSION_CONFIG.shop.accessories.some(x=>x.id===id),`deleted v0.4.7 particle should not be restored in fresh defaults: ${id}`);
for(const id of ['food_happy_candy','food_rainbow_jelly','food_peach_soda','food_cloud_macaron','food_honey_pancake','food_stardew_milktea','food_dream_parfait','food_aurora_sundae']){const f=DEFAULT_PROGRESSION_CONFIG.shop.food.find(x=>x.id===id);ok(f&&f.price%50===0&&f.mood%5===0&&f.hunger%5===0,`mood-food balance/multiples invalid: ${id}`)}
ok(DEFAULT_PROGRESSION_CONFIG.shop.food.find(x=>x.id==='food_mint_mochi')?.mood===7,'mint mochi mood should remain 7');
ok(app.includes("accountLevel:'用户等级'")&&app.includes("petLevel:'宠物等级'")&&read('server/rankings.js').includes('accountLevel=users.map')&&read('server/rankings.js').includes('petLevel=users.map'),'user/pet level leaderboards missing');
ok(leisureUi.includes('行情公式提醒 / 参数怎么算')&&leisureUi.includes('普通随机标准差')&&!leisureUi.includes('价格默认只在基础价'),'admin formula/public-internal separation missing');
ok(read('package.json').includes('clean:repo')&&fs.existsSync(path.join(root,'tools/00_maintenance/clean_repo.mjs')),'one-command repo cleanup/check missing');
const n47=notes.find(x=>x.id==='v0.4.7'),n48=notes.find(x=>x.id==='v0.4.8');ok(n47?.items?.length>=13&&n48?.items?.length>=7&&n48.date==='2026-09-04','v0.4.7/v0.4.8 release notes are incomplete');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sl-release-sync-'));try{fs.mkdirSync(path.join(tmp,'release_notes'));fs.writeFileSync(path.join(tmp,'release_notes','releases.json'),JSON.stringify([{id:'v-test',title:'Version Test',items:['new text']}])) ;const data={releaseNotesPublished:['v-test'],ownerUserId:'u',users:{u:{userId:'u',name:'Owner',role:'owner',slimeColor:'mint'}},roomMessages:{'chat-changelog':[{id:'old',systemReleaseId:'v-test',text:'old text',at:1},{id:'manual',text:'manual text',at:2}]}};const r=syncReleaseNotes({data,root:tmp,crypto});ok(r.added===0&&r.updated===1,'published release revision did not update existing system message');ok(data.roomMessages['chat-changelog'].find(x=>x.id==='old').text.includes('new text'),'system release text was not revised');ok(data.roomMessages['chat-changelog'].find(x=>x.id==='manual').text==='manual text','manual changelog was overwritten')}finally{fs.rmSync(tmp,{recursive:true,force:true})}
console.log('[OK] accessories / exact preview / single order / market bounds+randomness+hours / release revision / poker cap');

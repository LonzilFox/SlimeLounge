import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeProgressionConfig,DEFAULT_PROGRESSION_CONFIG} from '../../../server/progression.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw Error(m)};
const pkg=JSON.parse(read('package.json')),games=read('public/app-games.js'),leisure=read('public/leisure-ui.js'),ui=read('public/ui-enhancements.js'),css=read('public/ui-overrides.css');

ok(pkg.version==='0.4.8','package version is not v0.4.8');
const marketStart=leisure.indexOf('async function renderMarket'),marketEnd=leisure.indexOf('function leisureAdminRowFish',marketStart),marketPublic=leisure.slice(marketStart,marketEnd);
ok(marketStart>=0&&marketEnd>marketStart,'market public/admin boundary not found');
ok(!marketPublic.includes('actualTickTrend')&&!marketPublic.includes('设定趋势')&&!marketPublic.includes('当前实际趋势')&&!marketPublic.includes('价格默认只在基础价')&&!marketPublic.includes('内侧缓冲区'),'market internals leaked into normal trading UI');
ok(leisure.includes('当前实际趋势')&&leisure.includes('当前公式估算')&&leisure.includes('market.edgeGuardStrength')&&leisure.includes('market.noiseScale'),'market internals missing from admin UI');

const meStart=games.indexOf('function renderMe'),meEnd=games.indexOf('\nfunction lastSeenText',meStart),mePublic=games.slice(meStart,meEnd);
ok(meStart>=0&&meEnd>meStart,'me page boundary not found');
ok(!mePublic.includes('IP 只用于安全日志')&&!mePublic.includes('固定设备 ID')&&!mePublic.includes('当前入口：')&&!mePublic.includes('本机服务器管理')&&!mePublic.includes('网络与代理诊断'),'technical/admin diagnostics still visible in My page');

ok(games.includes('综合 / 成长')&&games.includes("growthKeys=['chips','accountLevel','petLevel','market','fishing']"),'growth rankings are not first-class public tabs');
ok(games.includes("else if(isAccountLevel)")&&games.includes("else if(isPetLevel)"),'account/pet public ranking tables missing');
ok(css.includes('.rank-tab-featured .rank-tabs')&&css.includes('grid-template-columns:repeat(2'),'mobile growth ranking visibility styles missing');

for(const [name,needle] of [
  ['star','viewBox="0 0 34 32"'],['crown','viewBox="0 0 48 30"'],['halo','viewBox="0 0 64 24"'],['horns','viewBox="0 0 56 34"'],['monocle','viewBox="0 0 44 42"'],['sparkles','viewBox="0 0 72 64"']
]){const svg=read(`public/accessories/${name}.svg`);ok(svg.includes(needle)&&svg.includes('shape-rendering="crispEdges"'),`${name} v0.4.8 pixel geometry missing`)}
ok(!read('public/accessories/monocle.svg').includes('fill-opacity'),'monocle lens must remain fully transparent');
ok(ui.includes("'/accessories/sparkles.svg'")&&ui.includes("effect:true,cssClass:'acc-fx-stars'")&&ui.includes('layers:['),'sparkles are not using layered fine-particle renderer');
ok(ui.includes('acc-fx-layer')&&css.includes('@keyframes accFxDriftA')&&css.includes('@keyframes accFxRise'),'layered pixel effect animation missing');

const newIds=['acc_comet_dust','acc_prism_glimmer','acc_frost_moths','acc_ember_wisps','acc_void_shards'];
for(const id of newIds)ok(DEFAULT_PROGRESSION_CONFIG.shop.accessories.some(x=>x.id===id),`new v0.4.8 effect missing: ${id}`);
const oldIds=['acc_fireflies','acc_moon_motes','acc_petals','acc_aurora_dust','acc_nebula_dust'];
for(const id of oldIds)ok(!DEFAULT_PROGRESSION_CONFIG.shop.accessories.some(x=>x.id===id),`old disliked effect restored in defaults: ${id}`);
const migrated=normalizeProgressionConfig({version:13,shop:{accessories:[{id:'acc_star',name:'自定义星星',price:54321,slot:'head',asset:'/accessories/star.svg',x:61,y:12,w:37,rotate:5,z:8,color:'#abcdef',enabled:true}]}});
ok(migrated.version===14,'progression schema did not migrate to v14');
ok(newIds.every(id=>migrated.shop.accessories.some(x=>x.id===id)),'v0.4.8 new effects were not appended on v13 migration');
ok(oldIds.every(id=>!migrated.shop.accessories.some(x=>x.id===id)),'deleted v0.4.7 old effects were resurrected by v14 migration');
const star=migrated.shop.accessories.find(x=>x.id==='acc_star');ok(star?.price===54321&&star.x===61&&star.y===12&&star.w===37&&star.rotate===5&&star.z===8&&star.color==='#abcdef','v14 migration overwrote customized accessory data');

console.log('[OK] v0.4.8 public privacy / growth rankings / pixel accessories / replacement particle effects');

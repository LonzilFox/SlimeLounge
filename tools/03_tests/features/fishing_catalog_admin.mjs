import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLeisureService} from '../../../server/leisure_service.js';
import {normalizeProgressionConfig} from '../../../server/progression.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const retired=['src/index.js','wrangler.jsonc','deploy_cloudflare.bat','check_repo_root.bat','test_internal_connection.bat','test_ipop_connection.bat','public/styles-v038.css','public/accessory-visual.js','public/ui-v038.js'];
for(const rel of retired){const p=path.join(root,rel);try{if(fs.existsSync(p))fs.rmSync(p,{force:true})}catch{}}
for(const [dirRel,test] of [['release_notes',n=>n.endsWith('.json')&&n!=='releases.json'],['public/accessories',n=>/\.(?:tint|detail)\.svg$/i.test(n)]]){const dir=path.join(root,dirRel);if(fs.existsSync(dir))for(const n of fs.readdirSync(dir))if(test(n))try{fs.rmSync(path.join(dir,n),{force:true})}catch{}}
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ok=(v,m)=>{if(!v)throw Error(m)};
const app=read('public/app.js'),ui=read('public/leisure-ui.js'),progUi=read('public/progression-ui.js'),enh=read('public/ui-enhancements.js'),css=read('public/styles.css')+'\n'+read('public/styles-responsive.css')+'\n'+read('public/ui-overrides.css'),pkg=JSON.parse(read('package.json'));

ok(app.includes("catch(parseErr){throw Error(r.ok?'响应不完整，请重试'"),'broken 200 JSON is still swallowed as a successful empty object');
ok(ui.includes("!r?.fishing||!Array.isArray(r.fishing.inventory)")&&ui.includes('for(let i=0;i<2;i++'),'leisure state schema guard / retry missing');
ok(ui.includes('最近捕获')&&ui.includes('稀有度')&&ui.includes('售价')&&ui.includes('data-fish-select')&&ui.includes('fishSellSelected'),'fishing sort / multi-select sell UI missing');
ok(ui.includes('钓鱼图鉴')&&ui.includes('最轻')&&ui.includes('最重')&&ui.includes('次</strong>'),'fishing catalogue stats UI missing');
ok(css.includes('.admin-tabs-v038{display:flex')&&css.includes('#adminView .admin-tabs-v038{position:sticky!important'),'admin top tabs / v0.4.8 sticky repair missing');
ok(css.includes('.fish-collection-grid')&&css.includes('.fish-card.selected'),'fishing catalogue/selection styles missing');
ok(!fs.existsSync(path.join(root,'src/index.js'))&&!fs.existsSync(path.join(root,'wrangler.jsonc'))&&!fs.existsSync(path.join(root,'deploy_cloudflare.bat'))&&!fs.existsSync(path.join(root,'check_repo_root.bat'))&&!fs.existsSync(path.join(root,'test_internal_connection.bat'))&&!fs.existsSync(path.join(root,'test_ipop_connection.bat')),'obsolete Worker/root helper files were not cleaned');
ok(fs.readdirSync(path.join(root,'release_notes')).filter(x=>x.endsWith('.json')).join(',')==='releases.json'&&Array.isArray(JSON.parse(read('release_notes/releases.json'))),'release notes were not consolidated / stale overlay notes were not cleaned');
ok(fs.existsSync(path.join(root,'public/ui-enhancements.js'))&&!fs.existsSync(path.join(root,'public/ui-v038.js'))&&!fs.existsSync(path.join(root,'public/accessory-visual.js'))&&!fs.existsSync(path.join(root,'public/styles-v038.css')),'versioned UI assets were not consolidated');
ok(enh.includes('accessoryPalette')&&enh.includes('accessory-svg')&&!enh.includes('accessory-base-layer')&&!enh.includes('accessory-primary-layer'),'accessories are still rendered as overlapping duplicate layers');
ok(progUi.includes("slime(profile?.slimeColor||'mint',cls)}<div class=\"pet-accessory-visual\">")&&!progUi.includes("slime(profile?.slimeColor||'mint',cls,profile?.userId||'')}<div class=\"pet-accessory-visual\">"),'pet view still renders the same equipped accessories twice');
ok(!fs.readdirSync(path.join(root,'public/accessories')).some(x=>/\.(?:tint|detail)\.svg$/i.test(x)),'obsolete accessory layer SVGs were not cleaned');
const migrated=normalizeProgressionConfig({version:5,shop:{accessories:[{id:'acc_bow',name:'小蝴蝶结',asset:'/accessories/bow.svg',color:'#ffffff'}],food:[],titles:[]},achievements:[]});
ok(migrated.version===14&&migrated.shop.accessories[0].color==='#ff7fa2','legacy white accessory color was not migrated back to its original main color');
ok(ui.includes('返回结果不完整，正在重新同步鱼篓')&&ui.includes('Number.isInteger(sold)')&&ui.includes('Number.isFinite(value)'),'fish sale UI can still render undefined sold/value');
ok(pkg.version==='0.4.8'&&!pkg.scripts?.deploy&&!pkg.devDependencies?.wrangler,'obsolete Cloudflare deployment entry still present');

// Existing basket data is migrated into the catalogue once, and selected IDs can be sold atomically.
const now=Date.now();
const user={userId:'u1',loungeId:'SL-TEST',name:'Fish',slimeColor:'mint',chips:1000,chipsUpdatedAt:now,stats:{fishCaught:3,fishSold:0},fishing:{inventory:[
  {id:'a',fishId:'sardine',name:'沙丁鱼',size:20.5,quality:'普通',score:80,value:80,caughtAt:now-3000},
  {id:'b',fishId:'sardine',name:'沙丁鱼',size:31.2,quality:'银星',score:84,value:95,caughtAt:now-2000},
  {id:'c',fishId:'carp',name:'鲤鱼',size:48.6,quality:'金星',score:90,value:150,caughtAt:now-1000}
]},market:{holdings:{},avgCost:{},realized:0}};
const data={users:{u1:user},roomGames:{}};
let requestBody={},saved=0;
const svc=createLeisureService({
  data,crypto:globalThis.crypto,
  body:async()=>requestBody,
  auth:()=>({u:user,d:{}}),
  json:(res,status,payload)=>{res.status=status;res.payload=payload},
  isStaff:()=>false,
  publicUser:u=>({userId:u.userId,name:u.name,chips:Math.floor(u.chips||0)}),
  refreshWallet:u=>Math.floor(u.chips||0),
  save:()=>{saved++},
  progression:{grantExternalXp:()=>{},evaluateUser:()=>{}}
});
async function call(pathName,body={}){requestBody=body;const res={};const handled=await svc.handle({method:'POST'},res,new URL('http://local'+pathName));ok(handled,'route was not handled');return res}
let r=await call('/api/leisure/state');
ok(r.status===200&&Array.isArray(r.payload.fishing.inventory),'fishing state missing inventory');
const book=r.payload.fishing.collection;
ok(book.sardine?.count===2&&book.sardine.minSize===20.5&&book.sardine.maxSize===31.2&&book.sardine.minWeight>0&&book.sardine.maxWeight>=book.sardine.minWeight&&book.carp?.count===1,'existing basket did not migrate into per-fish catalogue stats');
ok(r.payload.fishing.inventory.every(x=>Number(x.weight)>0),'legacy basket rows did not receive compatible kg weights');
r=await call('/api/leisure/fishing/sell',{catchIds:['a','c']});
ok(r.status===200&&r.payload.sold===2&&r.payload.value===230&&user.fishing.inventory.length===1&&user.fishing.inventory[0].id==='b','multi-select fish sale failed');
ok(user.chips===1230&&user.fishing.collection.sardine.count===2&&user.fishing.collection.carp.count===1,'selling fish must not erase catalogue records');
ok(saved>0,'fish sale did not persist');

console.log('[OK] v0.4.8 fishing resilience / sorting+bulk sell / catalogue / admin tabs / project cleanup');

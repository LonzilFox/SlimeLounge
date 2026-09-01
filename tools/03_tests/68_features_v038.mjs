import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyReleaseReward} from '../../server/release_rewards.js';
import {createDoudizhu,applyDoudizhuAction,addDoudizhuBot} from '../../shared/doudizhu.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),ok=(v,m)=>{if(!v)throw Error(m)};
const html=read('public/index.html'),app=read('public/app.js'),games=read('public/app-games.js'),chat=read('public/chat-ui.js'),chatState=read('server/chat_state.js'),pet=read('public/progression-ui.js'),prog=read('server/progression.js'),leisure=read('public/leisure-ui.js'),adminEcon=read('public/admin-economy.js'),glue=read('public/ui-enhancements.js'),css=read('public/styles.css'),local=read('local_server.js');

// 1: latest-first chat viewport + upward history.
ok(chat.includes('/api/chat/history')&&chat.includes('scrollTop<80')&&chat.includes("e.style.visibility='hidden'")&&chat.includes("e.style.scrollBehavior='auto'")&&chat.includes('historyMessages'),'chat latest-first/history loading missing');
ok(chatState.includes("'/api/chat/history'")&&chatState.includes('items=older.slice(-limit)'),'chat history endpoint missing');
// 2: fishing/market are first-class nav items, not pet hub.
ok(html.includes('data-section="shop"')&&html.includes('data-section="fishing"')&&html.includes('data-section="market"')&&html.includes('data-section="pet"'),'first-class leisure nav missing');
ok(!pet.includes('data-pet-leisure="fishing"')&&!pet.includes('data-pet-leisure="market"'),'pet still contains fishing/market entry cards');
// 3: fishing mechanics easier without mutating configured difficulty/rarity semantics.
ok(leisure.includes("barH=Math.max(.185,.37-d*.0015)")&&leisure.includes('now-g.start>28000')&&leisure.includes('鱼的难度数字和稀有权重不会因前端操作手感调整而改变'),'fishing control-tuning patch missing');
// 4: six admin tabs and requested nested groups.
for(const [id,label] of [['users','用户与设备'],['employee','工号审核'],['games','游戏设置'],['shop','商城设置'],['growth','成长与宠物'],['diagnostics','服务器诊断']])ok(games.includes(`data-admin-tab="${id}"`)&&games.includes(`>${label}`),`admin tab missing ${label}`);
ok(!games.includes('data-admin-tab="achievements"')&&games.includes('<b>筹码设置</b>')&&games.includes('<b>玩家筹码设置</b>'),'admin top/group structure mismatch');
ok(adminEcon.includes('<summary>总设置</summary>')&&adminEcon.includes('<summary>分游戏设置</summary>'),'chip nested total/game settings missing');
ok(leisure.includes('<b>钓鱼设置</b>')&&leisure.includes('<summary>基础参数</summary>')&&leisure.includes('鱼类与售价')&&leisure.includes('<b>虚拟交易所</b>')&&leisure.includes('资产设置'),'leisure admin nested groups missing');
ok(pet.includes('保存账号成长')&&pet.includes('重置账号成长')&&pet.includes('保存宠物成长')&&pet.includes('重置宠物成长')&&pet.includes('成就设置'),'growth/pet/achievement grouping missing');
// 5/6/7: decorated avatars, live accessory preview, fold persistence.
ok(prog.includes('appearance=Object.values(u.pet.equipped')&&glue.includes('profileSlimeMarkup')&&glue.includes('v038DecorateStatic'),'decorated user avatars missing');
ok(pet.includes('data-acc-preview')&&pet.includes('refreshAdminAccessoryPreview')&&pet.includes('默认颜色'),'accessory live preview/config missing');
ok(glue.includes('ADMIN_FOLD_KEY')&&glue.includes('sessionStorage')&&glue.includes('v038RestoreFolds')&&glue.includes('v038SaveFolds'),'admin fold persistence missing');
// 8/9: multiple titles and accessory colors/toggle.
ok(prog.includes('equippedTitles')&&prog.includes("slice(0,8)")&&pet.includes('data-title-equip')&&pet.includes('可同时佩戴多个')&&glue.includes('equippedTitle'),'multi-title behavior missing');
ok(prog.includes('accessoryColors')&&pet.includes('data-pet-color')&&prog.includes("a.u.pet.equipped[item.slot]===id?'':id")&&!pet.includes('再点卸下'),'accessory color/toggle behavior missing');
// 10: channel unread dot/count policy.
ok(chat.includes('/api/chat/unread')&&chat.includes("new Set(['chat-announcements','chat-changelog'])")&&chat.includes('channel-unread-badge')&&chatState.includes('chatReads'),'channel unread tracking missing');
// 11: one-time per-version release compensation based on persisted pre-restart status.
const now=1_800_000_000_000,data={users:{g:{userId:'g',chips:100,lastSeenAt:now-1000,presenceStatus:'gaming',currentSection:'games'},m:{userId:'m',chips:200,lastSeenAt:now-2000,presenceStatus:'listening',currentSection:'music'},o:{userId:'o',chips:300,lastSeenAt:now-3000,presenceStatus:'online',currentSection:'chat'},x:{userId:'x',chips:400,lastSeenAt:now-1000,presenceStatus:'offline',currentSection:''}},chipLedger:[]};
let r=applyReleaseReward({data,version:'0.3.8-test',now});ok(r.applied&&r.activity===2&&r.online===1&&data.users.g.chips===1600&&data.users.m.chips===1700&&data.users.o.chips===800&&data.users.x.chips===400,'release compensation amount/status mismatch');
r=applyReleaseReward({data,version:'0.3.8-test',now});ok(!r.applied&&data.users.g.chips===1600,'release compensation repeated within same version');

// 12: 斗地主 AI 练习局可直接续局，不必离开房间。
const ddz=createDoudizhu();applyDoudizhuAction(ddz,'U1',{type:'join',seat:0});addDoudizhuBot(ddz,1);addDoudizhuBot(ddz,2);ddz.phase='result';ddz.round=3;applyDoudizhuAction(ddz,'U1',{type:'rematch'});ok(ddz.phase==='bidding'&&ddz.round===4&&ddz.seats[0]?.userId==='U1'&&ddz.seats[1]?.isBot&&ddz.seats[2]?.isBot,'doudizhu AI rematch did not continue in-place');
// 13: 好友备注为账号侧数据，UI 保留备注和原名。
ok(local.includes("'/api/social/remark'")&&games.includes('data-friend-remark')&&games.includes('原名 ${esc(u.name)}'),'friend remark API/UI missing');
// 14: 管理页首次进入默认全折叠，保存后的本次展开状态仍可恢复。
ok(glue.includes("sec==='admin'&&state.section!=='admin'")&&glue.includes("sessionStorage.removeItem('slimelounge.adminFolds.v038')")&&!games.includes('<details open><summary>设备 / 最近 IP'),'admin default collapsed behavior missing');

ok(JSON.parse(read('release_notes/releases.json')).some(x=>x.id==='v0.3.8'),'v0.3.8 release note missing');
console.log('[OK] v0.3.8 chat history / leisure / admin IA / avatars / titles / unread / compensation / DDZ rematch / friend remarks');

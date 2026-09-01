import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOM_DEFS} from '../../shared/games.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');let fail=0;

function walk(dir){
  const out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.name==='node_modules'||ent.name==='.git')continue;
    const abs=path.join(dir,ent.name);
    if(ent.isDirectory())out.push(...walk(abs));else if(ent.isFile())out.push(abs);
  }
  return out;
}
const required=['package.json','local_server.js','server/chat_state.js','server/release_rewards.js','server/music_service.js','server/economy.js','server/rankings.js','server/http_security.js','server/runtime_diagnostics.js','server/network_sync.js','server/static_service.js','server/game_lifecycle.js','server/ws_transport.js','server/room_change_hub.js','server/action_receipts.js','server/ws_session_auth.js','server/http_room_transport.js','server/device_identity.js','server/device_profile.js','server/user_merge.js','server/release_notes.js','server/voice_config.js','server/progression.js','server/leisure_service.js','server/input_validation.js','server/music_http_routes.js','server/open_browser.js','public/index.html','public/styles.css','public/styles-games.css','public/styles-responsive.css','public/origin-migrate.html','public/origin-migrate.js','public/app.js','public/ui-enhancements.js','public/music-ui.js','public/chat-ui.js','public/game-dice.js','public/game-poker.js','public/game-mahjong.js','public/game-doudizhu.js','public/progression-ui.js','public/leisure-ui.js','public/admin-economy.js','public/app-games.js','shared/games.js','shared/dice.js','shared/extra_games.js','shared/riichi.js','shared/doudizhu.js','tools/01_runtime/02_owner_recovery.sh'];
for(const f of required){const p=path.join(root,f);if(!fs.existsSync(p)){console.error('[MISSING]',f);fail=1}else console.log('[OK]',f)}
const ids=ROOM_DEFS.map(r=>r.id);if(new Set(ids).size!==ids.length){console.error('[FAIL] duplicate room id');fail=1}else console.log('[OK] room ids unique:',ids.length);
const counts={};for(const r of ROOM_DEFS)if(r.game)counts[r.game]=(counts[r.game]||0)+1;const expect={dice:5,gomoku:5,xiangqi:3,chess:3,blackjack:3,poker:2,sudoku:3,minesweeper:5,go:3,mahjong:2,uno:2,doudizhu:3};for(const [k,v] of Object.entries(expect)){if(counts[k]!==v){console.error('[FAIL]',k,counts[k],v);fail=1}else console.log('[OK]',k,v)}
const chats=ROOM_DEFS.filter(r=>r.category==='chat'),chatIds=new Set(chats.map(r=>r.id));if(chats.length!==9||chats.filter(r=>r.channelType==='voice').length!==2||!chatIds.has('chat-help')||!chatIds.has('chat-suggestions')||!chatIds.has('chat-changelog')||!chatIds.has('voice-lounge')||!chatIds.has('voice-games')||chatIds.has('chat-music')||chatIds.has('chat-random')){console.error('[FAIL] chat channels',chats.map(r=>r.id));fail=1}else console.log('[OK] chat channels 7 text + 2 voice / 公告下含更新日志');
const music=ROOM_DEFS.filter(r=>r.category==='music'),musicStyles=new Map;for(const r of music)musicStyles.set(r.style,(musicStyles.get(r.style)||0)+1);if(music.length!==19||musicStyles.get('其他风格')!==1||[...musicStyles.entries()].some(([k,n])=>k!=='其他风格'&&n!==3)){console.error('[FAIL] music rooms',music.length,Object.fromEntries(musicStyles));fail=1}else console.log('[OK] music rooms 19 / 6 styles x3 + other x1');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(pkg.version!=='0.4.2'){console.error('[FAIL] version',pkg.version);fail=1}else console.log('[OK] version 0.4.2');
const serverMainSrc=fs.readFileSync(path.join(root,'local_server.js'),'utf8'),openBrowserSrc=fs.readFileSync(path.join(root,'server/open_browser.js'),'utf8'),leisureServerSrc=fs.readFileSync(path.join(root,'server/leisure_service.js'),'utf8'),musicServerSrc=fs.readFileSync(path.join(root,'server/music_service.js'),'utf8'),musicHttpRoutesSrc=fs.readFileSync(path.join(root,'server/music_http_routes.js'),'utf8'),rankingServerSrc=fs.readFileSync(path.join(root,'server/rankings.js'),'utf8'),economyServerSrc=fs.readFileSync(path.join(root,'server/economy.js'),'utf8'),securityServerSrc=fs.readFileSync(path.join(root,'server/http_security.js'),'utf8'),runtimeDiagSrc=fs.readFileSync(path.join(root,'server/runtime_diagnostics.js'),'utf8'),networkSyncSrc=fs.readFileSync(path.join(root,'server/network_sync.js'),'utf8'),wsTransportSrc=fs.readFileSync(path.join(root,'server/ws_transport.js'),'utf8'),wsSessionAuthSrc=fs.readFileSync(path.join(root,'server/ws_session_auth.js'),'utf8'),actionReceiptsSrc=fs.readFileSync(path.join(root,'server/action_receipts.js'),'utf8'),httpRoomTransportSrc=fs.readFileSync(path.join(root,'server/http_room_transport.js'),'utf8'),identityServerSrc=fs.readFileSync(path.join(root,'server/device_identity.js'),'utf8'),deviceProfileSrc=fs.readFileSync(path.join(root,'server/device_profile.js'),'utf8'),userMergeSrc=fs.readFileSync(path.join(root,'server/user_merge.js'),'utf8'),pokerUiSrc=fs.readFileSync(path.join(root,'public/game-poker.js'),'utf8'),migrationUiSrc=fs.readFileSync(path.join(root,'public/origin-migrate.js'),'utf8'),serverSrc=serverMainSrc+musicServerSrc+musicHttpRoutesSrc+rankingServerSrc+economyServerSrc+securityServerSrc+runtimeDiagSrc+networkSyncSrc+wsTransportSrc+wsSessionAuthSrc+actionReceiptsSrc+httpRoomTransportSrc+identityServerSrc+deviceProfileSrc+userMergeSrc,serviceSrc=fs.readFileSync(path.join(root,'deploy/slimelounge.service.example'),'utf8');
if(!appCompat(fs.readFileSync(path.join(root,'public/app.js'),'utf8')+fs.readFileSync(path.join(root,'public/app-games.js'),'utf8'))){console.error('[FAIL] public HTTP/tab compatibility');fail=1}else console.log('[OK] public HTTP/tab compatibility');
if(!serverSrc.includes('function userIsOnline(userId)')||!openBrowserSrc.includes("process.platform==='linux'&&!process.env.DISPLAY&&!process.env.WAYLAND_DISPLAY")){console.error('[FAIL] Linux/tab server compatibility');fail=1}else console.log('[OK] Linux/tab server compatibility');
if(!serviceSrc.includes('WorkingDirectory=/opt/SlimeLounge')||!serviceSrc.includes('Environment=AUTO_OPEN=0')||!serviceSrc.includes('SLIMELOUNGE_DATA_DIR=/var/lib/slimelounge')){console.error('[FAIL] production systemd template');fail=1}else console.log('[OK] production systemd template');
const appUi=fs.readFileSync(path.join(root,'public/app.js'),'utf8')+fs.readFileSync(path.join(root,'public/music-ui.js'),'utf8')+fs.readFileSync(path.join(root,'public/chat-ui.js'),'utf8')+fs.readFileSync(path.join(root,'public/game-dice.js'),'utf8')+fs.readFileSync(path.join(root,'public/game-poker.js'),'utf8')+fs.readFileSync(path.join(root,'public/game-mahjong.js'),'utf8')+fs.readFileSync(path.join(root,'public/game-doudizhu.js'),'utf8')+fs.readFileSync(path.join(root,'public/progression-ui.js'),'utf8')+fs.readFileSync(path.join(root,'public/leisure-ui.js'),'utf8')+fs.readFileSync(path.join(root,'public/admin-economy.js'),'utf8')+fs.readFileSync(path.join(root,'public/app-games.js'),'utf8'),cssFiles=['public/styles.css','public/styles-games.css','public/styles-responsive.css'],cssUi=cssFiles.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
for(const f of cssFiles){const bytes=fs.statSync(path.join(root,f)).size;if(bytes>=90000){console.error('[FAIL] oversized upload-sensitive CSS',f,bytes);fail=1}else console.log('[OK] upload-safe CSS size',f,bytes)}
const uploadSensitiveExt=new Set(['.js','.mjs','.css','.html','.md','.json','.ps1','.bat','.toml','.example','.png','.ico','.svg','.webp','.jpg','.jpeg']);
for(const abs of walk(root)){
  const rel=path.relative(root,abs).replace(/\\/g,'/');
  if(rel.startsWith('node_modules/')||rel.startsWith('.git/'))continue;
  const ext=path.extname(abs).toLowerCase();
  if(!uploadSensitiveExt.has(ext)&&!abs.endsWith('.dev.vars.example'))continue;
  const bytes=fs.statSync(abs).size;
  if(bytes>=90000){console.error('[FAIL] oversized upload-sensitive file',rel,bytes);fail=1}
}
console.log('[OK] all upload-sensitive files < 90000 bytes');
const uiChecks=[
  ['go board',appUi.includes('gomoku-board go-gomoku-board')&&cssUi.includes('.go-gomoku-board')&&cssUi.includes('.gpoint .stone')],
  ['four-side tables',appUi.includes('four-table')&&cssUi.includes('.four-table')],
  ['UNO faces',appUi.includes('uno-face')&&cssUi.includes('.uno-face')],
  ['playing-card faces',appUi.includes('function cardHtml(c)')&&appUi.includes('hidden-card')&&cssUi.includes('.card{')&&cssUi.includes('.hidden-card{')],
  ['riichi table/tiles',appUi.includes('mahjong-table-v2')&&appUi.includes('function mjTile(')&&appUi.includes('FluffyStuff/riichi-mahjong-tiles')&&cssUi.includes('.mahjong-table-v2')&&cssUi.includes('.mj-river-grid')&&cssUi.includes('.mj-tile.asset')],
  ['background away presence',appUi.includes("if(document.hidden)return {status:'away',label:'页面在后台'")],
  ['music rows',appUi.includes('music-room-row')&&cssUi.includes('.music-room-row')]
];
const badUi=uiChecks.filter(([,ok])=>!ok).map(([name])=>name);if(badUi.length){console.error('[FAIL] visual/presence regressions',badUi);fail=1}else console.log('[OK] visual tables / real faces / background-away');
function appCompat(src){return src.includes('function makeTabId()')&&src.includes("sessionStorage.getItem('slimelounge.tabId')")&&src.includes('tabId,deviceInfo:clientDevicePayload()')&&src.includes('roomId:sess.id,tabId')}
const v14Checks=[
  ['no focus-screen forfeit',!serverSrc.includes("focus_forfeit")&&!appUi.includes("focus_forfeit")&&!fs.readFileSync(path.join(root,'shared/games.js'),'utf8').includes("focus_forfeit")&&!fs.readFileSync(path.join(root,'shared/extra_games.js'),'utf8').includes("focus_forfeit")],
  ['poker raise draft',appUi.includes('pokerRaiseDraft')&&appUi.includes('pkRaiseAmt')],
  ['xiangqi undo',appUi.includes('xqUndoRequest')&&fs.readFileSync(path.join(root,'shared/games.js'),'utf8').includes("undo_request")],
  ['motion polish',cssUi.includes('--motion-fast:140ms')&&cssUi.includes('@keyframes pieceLand')],
];
const badV14=v14Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV14.length){console.error('[FAIL] legacy regressions',badV14);fail=1}else console.log('[OK] legacy no-focus-forfeit / poker input / xiangqi undo / motion');
const extraSrc=fs.readFileSync(path.join(root,'shared/extra_games.js'),'utf8');
const v15Checks=[
  ['no halma',!ROOM_DEFS.some(r=>r.game==='halma')&&!appUi.includes('renderHalma')&&!extraSrc.includes("createHalma")],
  ['friends/rankings restored',appUi.includes('async function renderFriends()')&&appUi.includes('async function renderRankings(')],
  ['four-seat helpers restored',appUi.includes('function relativeSeats(')&&appUi.includes('function fourSeatPanel(')&&appUi.includes('function unoCardFace(')&&appUi.includes('const MJ_LABELS=')],
  ['offline badge priority',appUi.includes("u.online===false?'offline'")],
  ['instant HTTP action state',httpRoomTransportSrc.includes("transport:'http-long-poll',actionAck:actionId")&&appUi.includes('function applyHttpSnapshot(sess,j)')],
  ['async AI broadcast',serverSrc.includes('sendGame(c.roomId);scheduleBotTurn(c.roomId)')&&serverSrc.includes('function scheduleBotTurn(')],
  ['go grid geometry',appUi.includes('gomoku-board go-gomoku-board')&&appUi.includes('left:${edge+x*step-14}px')&&appUi.includes('19 路围棋')&&cssUi.includes('width:648px!important')],
  ['board/card animations',cssUi.includes('@keyframes boardPieceSlide')&&cssUi.includes('.play-flight.from-top')&&cssUi.includes('.mj-discard-flight')],
  ['verified audio bytes',serverSrc.includes('async function readProbeBytes(')&&serverSrc.includes('audioSignature(bytes,ct)')&&!serverSrc.includes('HTTP ${r.status} 但内容不是可识别音频')],
  ['sidebar no horizontal scroll',cssUi.includes('overflow-x:hidden!important')&&cssUi.includes('.nav{width:100%;min-width:0;overflow:hidden')]
,
  ['default announcement follow',serverSrc.includes("followedChannels:['chat-announcements']")&&serverSrc.includes("includes('chat-announcements')")],
  ['UNO inline wild color',appUi.includes('uno-color-picker')&&appUi.includes('data-uno-color')&&!appUi.includes("prompt('选择颜色")],
  ['multi-device login',serverSrc.includes('/api/device-link/create')&&serverSrc.includes('/api/device-link/redeem')&&appUi.includes('createDeviceLink')],
  ['public music cross-provider fallback',serverSrc.includes('/api/music/fallback')&&serverSrc.includes('findPublicMusicFallback')&&appUi.includes('/api/music/fallback')&&appUi.includes('musicCookie')&&!appUi.includes('musicAutoLogin')],
  ['mobile room drawer',appUi.includes('room-side-drawer')&&appUi.includes('setRoomToolsOpen')&&cssUi.includes('.room-side-drawer.open')&&cssUi.includes('.room-tools-toggle.room-tools-enabled')],
  ['game chat auto bottom',appUi.includes("force=state.room?.category==='game'")&&appUi.includes('scrollTop=e.scrollHeight')&&serverSrc.includes('clearGameChatIfEmpty')],
  ['qq music provider',serverSrc.includes('searchQQ(')&&serverSrc.includes('CgiGetVkey')&&serverSrc.includes('proxyQQAudio')&&appUi.includes('QQ 音乐')],
  ['riichi v2 rivers',appUi.includes('mj-river-grid')&&cssUi.includes('grid-template-columns:repeat(6,var(--mj-river-w))')&&appUi.includes('mj-edge-rail')],
  ['guandan removed',!appUi.includes("guandan:'掼蛋'")&&!serverMainSrc.includes("'guandan'")]
];
const badV15=v15Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV15.length){console.error('[FAIL] v0.2.2 retained regressions',badV15);fail=1}else console.log('[OK] v0.2.2 admin/music/animations/go/riichi/friends/sidebar regressions');

const v17Checks=[
  ['go 19x19 engine',extraSrc.includes('const GO_N=19')&&!extraSrc.includes('8-x,8-y')&&!extraSrc.includes('x===8||y===8')],
  ['no meeting status',!appUi.includes("'meeting'")&&!serverSrc.includes("'meeting'")],
  ['friend direct chat',appUi.includes('/api/social/messages')&&appUi.includes('/api/social/send')&&appUi.includes('friend-chat-panel')],
  ['admin grouped information architecture',appUi.includes('用户与设备')&&appUi.includes('工号审核')&&appUi.includes('游戏设置')&&appUi.includes('商城设置')&&appUi.includes('成长与宠物')&&!appUi.includes('data-admin-tab="achievements"')&&appUi.includes('服务器诊断')&&appUi.includes('排行榜校验')],
  ['ranking per game only',!appUi.includes("overall:'")&&serverSrc.includes('function repairRankings()')],
  ['manual music cookie only',appUi.includes('musicCookie')&&appUi.includes('怎样安全获取 Cookie')&&!appUi.includes('musicAutoLogin')&&!fs.existsSync(path.join(root,'browser_extension/music_cookie_bridge'))&&serverSrc.includes("url.pathname==='/api/music/account'")&&serverSrc.includes('sealSecret')],
  ['device link tolerant',serverSrc.includes("normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g,'')")],
  ['navigation icons',fs.readFileSync(path.join(root,'public/index.html'),'utf8').includes('<span class="nav-icon">▣</span><span class="nav-label">聊天室</span>')&&fs.readFileSync(path.join(root,'public/index.html'),'utf8').includes('<span class="nav-icon">♪</span>')&&cssUi.includes('.nav-icon')],
  ['music dock nowrap',cssUi.includes('[data-activity-return="music"]')&&cssUi.includes('white-space:nowrap')],
  ['mahjong meld safe zones',cssUi.includes('.mj-meld-zone.bottom{left:50%!important')&&cssUi.includes('.mj-river-zone.bottom{left:50%!important')&&cssUi.includes('.mj-seat-badge.riichi:after')],
];

const v18Checks=[
  ['dynamic unready auto leave',serverSrc.includes('SLIMELOUNGE_UNREADY_SEAT_MS')&&serverMainSrc.includes('unreadySeatDelayMs(')&&serverMainSrc.includes('仍未准备，已自动离席')],
  ['board resign all three',appUi.includes('id=\"boardResign\"')&&appUi.includes('id=\"xqResign\"')&&appUi.includes('id=\"chResign\"')&&fs.readFileSync(path.join(root,'shared/games.js'),'utf8').match(/type==='resign'/g)?.length>=3],
  ['blackjack ranking natural',serverSrc.includes("x.startsWith('Blackjack · 3:2')")&&!serverSrc.includes('if(!after||hasBot(after)')],
  ['ranking manual repair',serverSrc.includes('/api/admin/rankings/set')&&appUi.includes('rankFixSave')],
  ['chip admin nested in game settings',appUi.includes('data-admin-tab="games"')&&appUi.includes('<b>筹码设置</b>')&&appUi.includes('<b>玩家筹码设置</b>')&&appUi.includes('排行榜校验 / 历史修正')&&serverSrc.includes('/api/admin/chips')&&appUi.includes('chipRulesSave')],
  ['2000 floor / recovery configurable',economyServerSrc.includes('chipFloor:2000')&&economyServerSrc.includes('recoverPerHour:1000')&&economyServerSrc.includes('dailyReward:1000')&&serverMainSrc.includes('function chipRecoverPerHour()')],
  ['owner inline device redeem',appUi.includes('redeemDeviceLinkInlineBtn')&&serverSrc.includes('expiresAt:now+30*60*1000')],
  ['riichi public domain assets',appUi.includes('FluffyStuff/riichi-mahjong-tiles')&&fs.existsSync(path.join(root,'THIRD_PARTY.md'))],
  ['UNO waiting color hidden',appUi.includes("s.phase==='playing'?`<div class=\"uno-current-color")],
];
const badV18=v18Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV18.length){console.error('[FAIL] v0.2.2 retained final checks',badV18);fail=1}else console.log('[OK] v0.2.2 rankings / ready timeout / resign / device / tile assets');
const badV17=v17Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV17.length){console.error('[FAIL] v0.2.2 retained completion checks',badV17);fail=1}else console.log('[OK] v0.2.2 owner/music/go/riichi/admin/friends completion');
const v19Checks=[
  ['my page render helper',appUi.includes('function employeeStatusName(')&&appUi.includes("console.error('[ME render]'")],
  ['friend unread badges',serverSrc.includes('/api/social/unread')&&serverSrc.includes('function dmUnreadSummary(')&&appUi.includes('friendUnreadBadge')&&appUi.includes('dm-unread-badge')&&cssUi.includes('.nav-unread-badge')],
  ['manual music credentials encrypted',serverSrc.includes("url.pathname==='/api/music/account'")&&serverSrc.includes('sealSecret')&&!serverSrc.includes("return json(res,410")&&!fs.existsSync(path.join(root,'browser_extension/music_cookie_bridge'))],
  ['music fallback route',serverSrc.includes("url.pathname==='/api/music/fallback'")&&serverSrc.includes('findPublicMusicFallback')&&appUi.includes('/api/music/fallback')],
  ['pixel/mobile v23',cssUi.includes('Z Labs Bitmap CN')&&cssUi.includes('Fusion Pixel 12px M zh_hans')&&!cssUi.includes('.game-landscape-btn')&&cssUi.includes('touch-action:pan-y!important')&&cssUi.includes('.sidebar{position:fixed!important')],
  ['manual changelog channel',chatIds.has('chat-changelog')&&!serverSrc.includes('syncChangelogRoom')&&!fs.existsSync(path.join(root,'CHANGELOG.md'))&&ROOM_DEFS.findIndex(r=>r.id==='chat-changelog')===ROOM_DEFS.findIndex(r=>r.id==='chat-announcements')+1&&ROOM_DEFS.find(r=>r.id==='chat-changelog')?.adminOnlyPost===true&&!ROOM_DEFS.find(r=>r.id==='chat-changelog')?.readOnly],
  ['riichi drawn/top river',appUi.includes("i===drawIdx?'drawn':''")&&cssUi.includes('.mj-own.drawn{margin-left:13px')&&cssUi.includes('.mj-river-grid.river-top{direction:rtl')],
  ['riichi geometry v19',cssUi.includes('grid-template-columns:repeat(6,26px)!important')&&cssUi.includes('.mj-called-stack>.mj-tile.added')&&cssUi.includes('.mj-meld-zone.right{right:72px!important')],
];
const badV19=v19Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV19.length){console.error('[FAIL] v0.2.2 retained completion checks',badV19);fail=1}else console.log('[OK] v0.2.2 my/friend-unread/manual-music/mobile-pixel/riichi-geometry');
const riichiSrc=fs.readFileSync(path.join(root,'shared/riichi.js'),'utf8');
const v22Checks=[
  ['v0.2.3 no changelog file',!fs.existsSync(path.join(root,'CHANGELOG.md'))&&!serverSrc.includes('syncChangelogRoom')],
  ['changelog neutral styling',!cssUi.includes('.changelog-row{border-color:#6d5f34')&&!cssUi.includes('.changelog-row{background:linear-gradient(90deg,#1d1a11')],
  ['consistent page transition',appUi.includes('function animateView(')&&appUi.includes("animateView($('#roomBrowser'))")&&cssUi.includes('.view-enter{animation:viewInUnified')],
  ['music synchronized timeline',serverMainSrc.includes("m.type==='music_control'")&&serverMainSrc.includes('positionMs')&&serverMainSrc.includes('revision')&&appUi.includes('musicExpectedMs')&&appUi.includes('syncMusicAudio')],
  ['voice signaling and V toggle',serverMainSrc.includes("m.type==='voice_toggle'")&&serverMainSrc.includes("m.type==='voice_signal'")&&appUi.includes('async function toggleVoice(')&&appUi.includes("e.key.toLowerCase()!=='v'")&&cssUi.includes('.voice-speaking-badge')],
  ['UNO hand sorting',appUi.includes('function unoHandOrder(')&&appUi.includes('uno-action-reserve')&&cssUi.includes('.uno-action-reserve')],
  ['riichi automation',appUi.includes("MJ_AUTO_KEY='slimelounge.riichi.auto.v1'")&&appUi.includes('scheduleRiichiAuto')&&appUi.includes('不吃碰杠')&&appUi.includes('自动和牌')&&appUi.includes('自动摸切')],
  ['riichi winning discard',appUi.includes('winning-discard')&&appUi.includes('mj-win-mark')&&riichiSrc.includes("s.resultDetail={type:'ron',from,tile,winners:details}")],
  ['riichi pao liability',riichiSrc.includes('markPaoAfterOpenCall')&&riichiSrc.includes('paoForScore')&&riichiSrc.includes('责任払い（大三元 / 大四喜包牌）')],
  ['pixel and rounded UI',cssUi.includes('font-family:var(--pxfont)!important')&&cssUi.includes('--ui-radius-lg:18px')&&cssUi.includes('border-radius:var(--ui-radius)')],
  ['login device link before owner recovery',fs.readFileSync(path.join(root,'public/index.html'),'utf8').indexOf('已有 SlimeLounge 账号 · 绑定这台新设备')<fs.readFileSync(path.join(root,'public/index.html'),'utf8').indexOf('Owner 换电脑 / 重装系统恢复')],
  ['away/offline newest-first sorting',appUi.includes("if(ra>=5)return (b.lastSeenAt||0)-(a.lastSeenAt||0)")&&serverMainSrc.includes("if(px>=5)return (y.lastSeenAt||0)-(x.lastSeenAt||0)")],
];
const badV22=v22Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV22.length){console.error('[FAIL] v0.2.2 feature checks',badV22);fail=1}else console.log('[OK] v0.2.2 changelog / transitions / music sync / voice / UNO / riichi / UI checks');
const v23Checks=[
  ['mobile auth scroll',cssUi.includes('.auth-screen{display:block!important;height:100dvh!important')&&cssUi.includes('overflow-y:auto!important')&&htmlSource().includes('user-scalable=yes')],
  ['no landscape UI',!htmlSource().includes('gameLandscapeBtn')&&!cssUi.includes('.game-landscape-btn')],
  ['responsive board fitting',appUi.includes('function fitFixedBoard(')&&appUi.includes("fitFixedBoard(e,'.gomoku-board',512,512)")&&appUi.includes("fitFixedBoard(e,'.xiangqi-board',472,526)")&&appUi.includes("fitFixedBoard(e,'.chess',474,474)")&&appUi.includes("fitFixedBoard(e,'.go-gomoku-board',648,648)")],
  ['discord chat workspace',appUi.includes('discord-chat')&&appUi.includes('discord-channels')&&appUi.includes('discord-members')&&appUi.includes('voice-channel-stage')&&appUi.includes('/api/users/presence')],
  ['chat voice channels',ROOM_DEFS.filter(r=>r.category==='chat'&&r.channelType==='voice'&&r.voiceAllowed).length===2&&serverMainSrc.includes("def.voiceAllowed")],
  ['persistent chip recovery',serverMainSrc.includes('function chipFloor()')&&serverMainSrc.includes('function chipRecoverPerHour()')&&serverMainSrc.includes('Math.min(floor,u.chips+rate*elapsed/3600000)')],
  ['daily chip checkin',serverMainSrc.includes("url.pathname==='/api/wallet/checkin'")&&appUi.includes('dailyChipReward||1000')],
  ['human ai rankings',rankingServerSrc.includes("const RANKED_KINDS=['dice','gomoku','xiangqi','chess','blackjack','poker','go','mahjong','uno','doudizhu']")&&serverMainSrc.includes("function gameRankMode(st){return gameHumanCount(st)>=2?'human':'ai'}")&&appUi.includes('与真人对战')&&appUi.includes('与 AI 对战')&&appUi.includes("rankTab:'chips'")],
  ['AI wallet isolation',serverMainSrc.includes('function syncWalletFromGame(st){if(!st||hasBot(st))return')&&appUi.includes('真人筹码不变')],
];
function htmlSource(){return fs.readFileSync(path.join(root,'public/index.html'),'utf8')}
const v24Checks=[
  ['poker max eight / original minimum',ROOM_DEFS.filter(r=>r.game==='poker').every(r=>r.capacity===8&&r.minPlayers===1)&&fs.readFileSync(path.join(root,'shared/games.js'),'utf8').includes("seats:Array(8).fill(null)")&&fs.readFileSync(path.join(root,'shared/games.js'),'utf8').includes("occupied.length<1")],
  ['no Guandan anywhere',!ROOM_DEFS.some(r=>r.game==='guandan')&&!appUi.includes('renderGuandan')&&!extraSrc.includes('createGuandan')&&!cssUi.includes('.gd-hand')&&!cssUi.includes('.gd-center')],
  ['chat channel switch no animation',appUi.includes('switchingChat')&&appUi.includes('no-view-animation')&&cssUi.includes('.room-view.no-view-animation')],
  ['server authoritative PvP chips',serverSrc.includes('function settleZeroSum(')&&serverSrc.includes('function resultSignature(')&&serverMainSrc.includes('chipLedger')&&rankingServerSrc.includes('u.chips=Math.max(0,Number(u.chips)||0)-amt')],
  ['board PvP configurable chips',serverSrc.includes("gameChipRule(after.kind,after).stake")&&serverSrc.includes('transferChips(roomId,after.kind,loser,after.winner,stake')],
  ['UNO placement chips',serverSrc.includes("gameChipRule('uno',after).rankStep")&&serverSrc.includes('rankStep*(n-1-2*i)')&&extraSrc.includes('finishOrder:[]')&&extraSrc.includes('第 ${s.finishOrder.length+1} 名')],
  ['mahjong point based chips',serverSrc.includes("gameChipRule('mahjong',after)")&&serverSrc.includes('Math.round((x.points-mean)/ppc)')],
  ['practice leave no loss / human trustee',serverMainSrc.includes('practiceAbandon')&&serverMainSrc.includes('recordImmediateForfeit')&&extraSrc.includes('forfeitUserId:old.forfeitUserId||old.userId')],
  ['live-human AI-only guard',serverMainSrc.includes('function gameLiveHumanCount(st)')&&serverMainSrc.includes('gameLiveHumanCount(st)===0')&&serverMainSrc.includes('cleanPlacementExit')],
  ['WS security',securityServerSrc.includes('function sameOriginWs(')&&wsTransportSrc.includes("rateLimit(req,'ws-upgrade-hard'")&&wsSessionAuthSrc.includes("rateLimitSubject(`user:${String(m.userId||'unknown')}`,'ws-upgrade'")&&serverMainSrc.includes('len>65536||!(b1&128)')],
  ['HTTP security headers',securityServerSrc.includes('content-security-policy')&&securityServerSrc.includes('x-content-type-options')&&securityServerSrc.includes('permissions-policy')],
];
const badV24=v24Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV24.length){console.error('[FAIL] v0.2.4 economy / exit / security checks',badV24);fail=1}else console.log('[OK] v0.2.4 poker8 / no-guandan / chips / exits / network security');
const v25Checks=[
  ['identity IndexedDB fallback',appUi.includes("identityDbName='slimelounge-device-v1'")&&appUi.includes('loadIdentityBackup')&&appUi.includes('navigator.storage?.persist')],
  ['IP is not device identity',serverMainSrc.includes('crypto.randomUUID()')&&deviceProfileSrc.includes('d.lastIp=ip.clientIp')&&!serverMainSrc.includes('deviceId=requestIp')],
  ['session cookie multi-tab tolerance',identityServerSrc.includes('sessionHashes')&&identityServerSrc.includes('slice(-8)')&&serverMainSrc.includes('ensureRecoveryCookie(a.d,req,res)')],
  ['canonical origin device migration',serverMainSrc.includes('/api/origin-transfer/start')&&serverMainSrc.includes('/api/origin-transfer/redeem')&&appUi.includes('consumeOriginTransfer')&&migrationUiSrc.includes('slimelounge.identity.v1')],
  ['local owner device id reuse',serverMainSrc.includes("existing=Object.values(data.devices).find(d=>d.userId===u.userId&&d.localOwnerDevice===true)")],
  ['poker selectable buy-in',pokerUiSrc.includes('20BB')&&pokerUiSrc.includes('50BB')&&pokerUiSrc.includes('100BB')&&pokerUiSrc.includes('data-buyin-preset')&&serverMainSrc.includes('a.walletAtBuyIn=wallet')],
];
const badV25=v25Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV25.length){console.error('[FAIL] v0.2.6 identity / poker buy-in checks',badV25);fail=1}else console.log('[OK] v0.2.6 stable device identity / canonical migration / poker buy-in');
const v26Checks=[
  ['mobile hidden state wins',cssUi.includes('.hidden,.app.hidden,.auth-screen.hidden,#app.hidden,#authScreen.hidden{display:none!important}')],
  ['mobile auth slime geometry',cssUi.includes('.auth-brand .slime.xl:before')&&cssUi.includes('top:20px!important')],
  ['device diagnostics',appUi.includes('collectDeviceInfo')&&deviceProfileSrc.includes('platformVersion')&&deviceProfileSrc.includes('lastIpVersion')],
  ['stable browser install id',appUi.includes('slimelounge.install.v1')&&deviceProfileSrc.includes('installIdHash')],
  ['device-id recovery code',serverMainSrc.includes("action==='create_device_recovery'")&&serverMainSrc.includes('reuseDeviceId')&&appUi.includes('data-device-recover')],
  ['merge wallet uses max not sum',userMergeSrc.includes('Math.max(0,Number(sourceChips)||0,Number(targetChips)||0)')],
  ['no Windows hostname claim',appUi.includes('普通网页无法读取 Windows 主机名')]
];
const badV26=v26Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV26.length){console.error('[FAIL] v0.2.6 mobile / device recovery checks',badV26);fail=1}else console.log('[OK] v0.2.6 mobile auth / device diagnostics / recovery / merge wallet');

const v27Checks=[
  ['board AI waits for start',extraSrc.includes('')&&fs.readFileSync(path.join(root,'shared/games.js'),'utf8').includes("if(!s.started||!isBotId(id)||s.winner")],
  ['async bot errors cannot kill server',serverMainSrc.includes("console.error('[BOT TURN]" )&&serverMainSrc.includes("console.error('[GAME TICK]" )],
  ['chess symbol font isolated',cssUi.includes('.chpiece{')&&cssUi.includes('Segoe UI Symbol')&&cssUi.includes('font-synthesis:none!important')],
  ['music cookie guide collapsed',appUi.includes('class="music-cookie-guide"')&&!appUi.includes('class="music-cookie-guide" open')],
  ['UNO/riichi placement leaderboard',appUi.includes('<th>一位</th><th>二位</th><th>三位</th><th>四位</th>')&&rankingServerSrc.includes('placements:[0,0,0,0]')&&rankingServerSrc.includes('rankingPlacement(')],
  ['desktop riichi adaptive height',cssUi.includes('@media(min-width:761px)')&&cssUi.includes('.mahjong-area>.mj-command-zone')&&cssUi.includes('margin-top:auto!important')],
  ['opponent melds at table edges',cssUi.includes('.mj-meld-zone.top{left:14px!important')&&cssUi.includes('.mj-meld-zone.left{left:13px!important')&&cssUi.includes('.mj-meld-zone.right{right:13px!important')],
  ['riichi response wording',appUi.includes('当前无需响应')&&!appUi.includes('无鸣牌响应')],
  ['Discord mobile drawers',appUi.includes('chatChannelsToggle')&&appUi.includes('chatMembersToggle')&&cssUi.includes('.discord-channels.open,.discord-members.open')],
  ['game rerender keeps scroll',appUi.includes('const y=e.scrollTop,x=e.scrollLeft,rid=state.roomTarget')&&appUi.includes('e.scrollTop=Math.min(y')]
];
const badV27=v27Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV27.length){console.error('[FAIL] v0.2.7 regression checks',badV27);fail=1}else console.log('[OK] v0.2.7 AI stability / chess / rankings / riichi / mobile chat');
const badV23=v23Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV23.length){console.error('[FAIL] v0.2.3 feature checks',badV23);fail=1}else console.log('[OK] v0.2.3 mobile / Discord chat / chips / split rankings');
const releaseSrc=fs.readFileSync(path.join(root,'server/release_notes.js'),'utf8'),voiceConfigSrc=fs.readFileSync(path.join(root,'server/voice_config.js'),'utf8'),diceSrc=fs.readFileSync(path.join(root,'shared/dice.js'),'utf8'),adminEconomySrc=fs.readFileSync(path.join(root,'public/admin-economy.js'),'utf8'),readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
const v28Checks=[
 ['dice game',ROOM_DEFS.filter(r=>r.game==='dice').length===5&&diceSrc.includes("zai")&&diceSrc.includes("fei")&&appUi.includes('renderDice')],
 ['poker fold show / run twice',pokerUiSrc.includes('pkFoldMuck')&&pokerUiSrc.includes('pkFoldShow')&&pokerUiSrc.includes('pkRunOnce')&&fs.readFileSync(path.join(root,'shared/games.js'),'utf8').includes("phase='run_choice'")&&fs.readFileSync(path.join(root,'shared/games.js'),'utf8').includes('pkDealRuns')],
 ['dynamic economy / entry fees',adminEconomySrc.includes('econDaily')&&adminEconomySrc.includes('fee_${kind}')&&adminEconomySrc.includes('aifee_${kind}')&&serverMainSrc.includes('chargeRoundEntryFee')&&serverMainSrc.includes('/api/game/entry')],
 ['music volume and timeout retry',appUi.includes("MUSIC_VOLUME_KEY='slimelounge.musicVolume.v2'")&&appUi.includes("timeout:12000,retries:2")&&appUi.includes('不代表 Cookie 失效或被删除')],
 ['voice status / TURN',appUi.includes("status:'voice'")&&voiceConfigSrc.includes('SLIMELOUNGE_TURN_URLS')&&serverMainSrc.includes('/api/voice/config')],
 ['employee 6-9',serverMainSrc.includes('/^[A-Z0-9]{6,9}$/')&&htmlSource().includes('pattern="[A-Za-z0-9]{6,9}"')],
 ['ipv4 preferred / security',securityServerSrc.includes('preferredV4=candidates.find(x=>net.isIP(x)===4)')&&securityServerSrc.includes('strict-transport-security')],
 ['pixel font / diagnostics removed',cssUi.includes('Z Labs Bitmap CN')&&!appUi.includes('pixelFontDiag')],
 ['release notes append only',releaseSrc.includes('releaseNotesPublished')&&releaseSrc.includes('chat-changelog')&&!readme.includes('## 更新日志')],
 ['favicon',htmlSource().includes('/favicon.ico')&&fs.existsSync(path.join(root,'public/favicon.ico'))]
];
const badV28=v28Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV28.length){console.error('[FAIL] v0.2.8 checks',badV28);fail=1}else console.log('[OK] retained v0.2.8 dice / poker / economy / music / voice / font / security / release notes');
const roomHubSrc=fs.readFileSync(path.join(root,'server/room_change_hub.js'),'utf8');
const v31Checks=[
 ['no shared-IP POST choke',!serverMainSrc.includes("rateLimit(req,'post',240,60000)")&&wsSessionAuthSrc.includes("rateLimitSubject(`user:${String(m.userId||'unknown')}`,'ws-upgrade'")],
 ['light background sync',serverSrc.includes('/api/sync/light')&&appUi.includes("post('/api/sync/light'")&&!appUi.includes('setInterval(pollChannelNotifications,4000)')&&!appUi.includes('setInterval(pollFriendUnread,3000)')],
 ['query-free WS auth',appUi.includes("new WebSocket(`${proto}//${location.host}/api/ws`)")&&!appUi.includes('/api/ws?ticket=')&&wsTransportSrc.includes('Authentication is deliberately the first WebSocket message')&&serverMainSrc.includes('if(c.awaitingAuth){authenticateWsClient(c,m);return}')],
 ['immediate long-poll fallback',appUi.includes("'/api/room/poll'")&&appUi.includes("transport='http-long-poll'")&&httpRoomTransportSrc.includes('roomChanges.wait(')&&roomHubSrc.includes('function wait(roomId,since=0,timeoutMs=22000)')],
 ['idempotent action ACK',appUi.includes('clientActionId')&&appUi.includes("m.type==='action_ack'")&&httpRoomTransportSrc.includes('actionSeen(')&&serverMainSrc.includes("type:'action_ack'")],
 ['false-offline suppression',appUi.includes('serviceFailCount<3')&&appUi.includes('连接波动 · 自动恢复中')&&!appUi.includes('renderActivityDock();if(!quiet)healthPing()')],
 ['presence writes coalesced',serverMainSrc.includes('schedulePresenceSave')&&!serverMainSrc.includes("presenceStatus=b.presenceStatus;a.u.activityLabel=clean(b.activityLabel,80);tabTouch(a.u.userId,b.tabId);save()")],
 ['runtime diagnostics',serverSrc.includes('/api/admin/diagnostics')&&runtimeDiagSrc.includes('[METRICS]')&&appUi.includes('服务器诊断')],
 ['safe loopback proxy trust',serverMainSrc.includes("SLIMELOUNGE_TRUST_PROXY!=='0'")&&securityServerSrc.includes("ip==='::1'||ip==='127.0.0.1'||explicitTrusted.has(ip)")],
 ['away/offline separate sort',serverMainSrc.includes("u.online&&u.presenceStatus==='away'?5:6")&&appUi.includes("?'暂离':'离线'")&&appUi.includes('暂离仅表示页面切到后台')],
 ['high quality sleeping slime favicon',fs.existsSync(path.join(root,'public/slime-sleep-icon.png'))&&fs.statSync(path.join(root,'public/icon-192.png')).size>20000&&fs.statSync(path.join(root,'public/favicon.ico')).size>1000],
 ['websocket recovery while fallback active',appUi.includes('scheduleWsRecovery(sess)')&&appUi.includes('HTTP兼容（自动恢复 WebSocket）')&&appUi.includes('wsRecoveryAttempt')],
 ['per-user network diagnostics',networkSyncSrc.includes('targetUserId')&&runtimeDiagSrc.includes('selectedUserLog')&&appUi.includes('单用户网络日志')&&appUi.includes('data-diag-user')],
 ['chat timestamp formatting',appUi.includes('function chatTimeLabel(')&&appUi.includes('昨天 ${hm}')&&appUi.includes('class="msg-time"')],
 ['discord reply styling',appUi.includes('msg-reply-name')&&cssUi.includes('.msg-reply-name')&&cssUi.includes('.msg-reply-hook')],
 ['mobile music bottom sheet',cssUi.includes('mobile music bottom sheet')&&cssUi.includes('.music-activity.drawer-collapsed')&&cssUi.includes('bottom:calc(70px + env(safe-area-inset-bottom))')],
 ['refined music volume control',appUi.includes('data-music-volume')&&appUi.includes('music-volume-value')]
];
const badV31=v31Checks.filter(([,ok])=>!ok).map(([name])=>name);if(badV31.length){console.error('[FAIL] v0.3.1 transport / presence / favicon checks',badV31);fail=1}else console.log('[OK] v0.3.1 transport / long-poll / ACK / presence / favicon');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8'),app=appUi;const domIds=[...app.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map(m=>m[1]);const missing=[...new Set(domIds)].filter(id=>!new RegExp(`id=["']${id}["']`).test(html)&&!['onlineUsers','chatLog','chatForm','chatInput','roomMain','musicQuery','musicSearch','musicSearchStatus','musicResults','friendId','friendSearch','friendSearchResult','friendReq','meName','meBio','meColor','mePresence','meStatusMessage','saveProfile','newEmployee','changeEmployee','releaseEmployeeBtn','releaseEmployee','localServerAdmin','loadLocalAdmin','loadNetworkInfo','localNetworkInfo','bjLeave','bjReady','bjBet','bjSetBet','bjStart','bjHit','bjStand','pkLeave','pkReady','pkSetStack','pkStack','pkStart','pkFold','pkCheck','pkCall','pkRaiseAmt','pkRaise','activityGameTimer','activityGame','activityMusic','verifyGate','verifyRefresh','openNetease','musicToggle','musicSkip','slMusicAudio','generateOwnerRecovery','ownerRecoveryOutput','sudokuCheck','sudokuReset','sudokuNew','mineNew','goPass','goResign','unoDraw','unoPassDraw','unoAccept','unoChallenge','unoDeclare','unoCatch','chClaimDraw','bjDouble','pkAllin','mjRiichi','mjTsumo','mjKyuushu','mjNext','xqUndoRequest','xqUndoAccept','xqUndoReject','openQQMusic','roomSide','roomSideBackdrop','roomSideClose','createDeviceLink','deviceLinkResult','friendChatClose','friendChatLog','friendChatForm','friendChatInput','copyDeviceLink','repairRankings','rankingRepairResult','boardResign','xqResign','chResign','redeemDeviceLinkInlineBtn','redeemDeviceLinkInline','redeemDeviceLabelInline','rankFixSave','rankFixReset','rankFixKind','rankFixLounge','rankFixWins','rankFixLosses','rankFixDraws','reloadMe','musicAccountStatus','unlinkMusicAccount','saveMusicAccount','musicCookie','chatVoiceJoin','directoryUsers','voiceChannelMembers','rankFixMode','chipRulesSave','chipRuleGomoku','chipRuleXiangqi','chipRuleChess','chipRuleGo','chipRuleBjMin','chipRuleBjDefault','chipRuleBjMax','chipRulePokerSb','chipRulePokerBb','chipRuleUno','chipRuleMahjong','chipRuleMahjongForfeit','pkBuyIn','pkRunOnce','pkRunTwice','pkFoldMuck','pkFoldShow','pixelFontDiag','diceCount','diceFace','diceCall','diceZai','diceFei','diceOpen','econFloor','econDaily','econRecover','chipRuleDice','fee_dice','fee_gomoku','fee_xiangqi','fee_chess','fee_go','fee_blackjack','fee_poker','fee_uno','fee_mahjong','fee_sudoku','fee_minesweeper','chatReplyPreview','chatChannelsToggle','chatMembersToggle','discordChannels','discordMembers','discordDrawerBackdrop','ddzPlay','ddzPass','ddzClear','ddzRematch','petRename','petName','petPlay','titleSave','titleEquip','userCardModal','chipRuleDdzStake','fee_doudizhu','aifee_doudizhu','pkBossMode','fishCast','fishSellAll','fishSort','fishRetry','fishingGame','marketRefresh','marketCountdown','bjSetBoxes','bjBoxes','bjInsurance','bjInsuranceNo','bjSplit','bjSurrender'].includes(id));if(missing.length){console.error('[FAIL] missing static DOM ids',missing);fail=1}else console.log('[OK] static DOM references');
process.exitCode=fail;

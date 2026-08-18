import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

const syntaxFiles=[
  'local_server.js',
  'server/action_receipts.js','server/chat_service.js','server/device_identity.js','server/device_profile.js',
  'server/economy.js','server/http_room_transport.js','server/http_security.js','server/music_service.js',
  'server/network_sync.js','server/rankings.js','server/release_notes.js','server/room_change_hub.js',
  'server/runtime_diagnostics.js','server/progression.js','server/static_service.js','server/game_lifecycle.js','server/user_merge.js','server/voice_config.js','server/ws_session_auth.js','server/ws_transport.js',
  'src/index.js',
  'public/admin-economy.js','public/app-games.js','public/app.js','public/startup-ui.js','public/chat-ui.js','public/game-dice.js',
  'public/game-poker.js','public/game-mahjong.js','public/game-doudizhu.js','public/progression-ui.js','public/music-ui.js','public/origin-migrate.js',
  'shared/dice.js','shared/extra_games.js','shared/games.js','shared/riichi.js','shared/doudizhu.js',
  'tools/02_validation/01_validate_project.js'
];

const testGroups=[
  ['核心游戏',[
    'tools/03_tests/01_core_games.mjs',
    'tools/03_tests/02_extra_games.mjs',
    'tools/03_tests/03_riichi.mjs'
  ]],
  ['本地服务',[
    'tools/03_tests/10_local_server.mjs'
  ]],
  ['筹码经济',[
    'tools/03_tests/20_wallet_v023.mjs',
    'tools/03_tests/21_chip_games_v023.mjs',
    'tools/03_tests/22_chip_admin_v024.mjs'
  ]],
  ['迁移与规则',[
    'tools/03_tests/30_migration_v022.mjs',
    'tools/03_tests/31_rules_v024.mjs',
    'tools/03_tests/32_server_v024.mjs'
  ]],
  ['身份与移动端',[
    'tools/03_tests/40_identity_poker_v025.mjs',
    'tools/03_tests/41_identity_mobile_v026.mjs'
  ]],
  ['版本回归',[
    'tools/03_tests/50_regressions_v027.mjs',
    'tools/03_tests/51_features_v028.mjs',
    'tools/03_tests/52_features_v029.mjs'
  ]],
  ['网络与传输',[
    'tools/03_tests/60_network_v030.mjs',
    'tools/03_tests/61_transport_v031.mjs',
    'tools/03_tests/62_performance_ui_v032.mjs',
    'tools/03_tests/63_startup_hotfix_v032.mjs',
    'tools/03_tests/64_features_v034.mjs'
  ]]
];

function run(args,label){
  const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
  if(r.error){console.error(`[FAIL] ${label}:`,r.error.message);process.exit(1)}
  if(r.status!==0){console.error(`[FAIL] ${label}`);process.exit(r.status||1)}
}

console.log('=== SlimeLounge v0.3.4 · 工程检查 ===');
console.log('\n[1/3] JavaScript 语法');
for(const file of syntaxFiles)run(['--check',file],file);
console.log(`[OK] ${syntaxFiles.length} 个源码文件语法通过`);

console.log('\n[2/3] 工程结构 / 资源 / UI 校验');
run(['tools/02_validation/01_validate_project.js'],'工程校验');

console.log('\n[3/3] 自动化回归测试');
let count=0;
for(const [group,files] of testGroups){
  console.log(`\n--- ${group} ---`);
  for(const file of files){run([file],file);count++}
}
console.log(`\n[OK] 全部检查通过 · ${count} 个测试套件`);

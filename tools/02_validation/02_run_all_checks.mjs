import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

// Overlay deployment leaves deleted files behind. Remove only explicitly retired project files.
const retiredFiles=['src/index.js','wrangler.jsonc','deploy_cloudflare.bat','check_repo_root.bat','test_internal_connection.bat','test_ipop_connection.bat','public/styles-v038.css','public/accessory-visual.js','public/ui-v038.js'];
for(const rel of retiredFiles){const p=path.join(root,rel);try{if(fs.existsSync(p))fs.rmSync(p,{force:true})}catch(e){console.warn(`[WARN] 无法清理旧文件 ${rel}: ${e.message}`)}}

// Consolidated release notes / accessory layers may leave obsolete siblings after overlay upgrades.
for(const dirRel of ['release_notes','public/accessories']){
  const dir=path.join(root,dirRel);if(!fs.existsSync(dir))continue;
  for(const name of fs.readdirSync(dir)){
    const oldNote=dirRel==='release_notes'&&name.endsWith('.json')&&name!=='releases.json';
    const oldAcc=dirRel==='public/accessories'&&/\.(?:tint|detail)\.svg$/i.test(name);
    if(!oldNote&&!oldAcc)continue;try{fs.rmSync(path.join(dir,name),{force:true})}catch(e){console.warn(`[WARN] 无法清理旧文件 ${dirRel}/${name}: ${e.message}`)}
  }
}

const syntaxFiles=[
  'local_server.js',
  'server/action_receipts.js','server/chat_service.js','server/chat_state.js','server/release_rewards.js','server/device_identity.js','server/device_profile.js',
  'server/economy.js','server/http_room_transport.js','server/http_security.js','server/music_service.js',
  'server/network_sync.js','server/rankings.js','server/leaderboard_http.js','server/release_notes.js','server/room_change_hub.js',
  'server/runtime_diagnostics.js','server/progression.js','server/leisure_service.js','server/single_game_service.js','server/input_validation.js','server/music_http_routes.js','server/open_browser.js','server/static_service.js','server/game_lifecycle.js','server/user_merge.js','server/voice_config.js','server/ws_session_auth.js','server/ws_transport.js',
  'public/admin-economy.js','public/app-games.js','public/app.js','public/ui-enhancements.js','public/startup-ui.js','public/chat-ui.js','public/game-dice.js',
  'public/game-poker.js','public/game-mahjong.js','public/game-doudizhu.js','public/progression-ui.js','public/leisure-ui.js','public/music-ui.js','public/origin-migrate.js',
  'shared/dice.js','shared/extra_games.js','shared/games.js','shared/riichi.js','shared/doudizhu.js',
  'tools/02_validation/01_validate_project.js'
];

const testGroups=[
  ['基础玩法',[
    'tools/03_tests/01_core_games.mjs',
    'tools/03_tests/02_extra_games.mjs',
    'tools/03_tests/03_riichi.mjs',
    'tools/03_tests/10_local_server.mjs'
  ]],
  ['经济与筹码',[
    'tools/03_tests/20_economy_wallet.mjs',
    'tools/03_tests/21_economy_game_rules.mjs',
    'tools/03_tests/22_economy_admin.mjs'
  ]],
  ['规则 / 迁移 / 身份',[
    'tools/03_tests/30_migration_legacy.mjs',
    'tools/03_tests/31_rules_game_config.mjs',
    'tools/03_tests/32_server_contracts.mjs',
    'tools/03_tests/40_identity_poker.mjs',
    'tools/03_tests/41_identity_mobile.mjs'
  ]],
  ['网络与启动',[
    'tools/03_tests/60_network_sync.mjs',
    'tools/03_tests/61_transport_http_ws.mjs',
    'tools/03_tests/62_ui_performance.mjs',
    'tools/03_tests/63_startup_hotfixes.mjs',
    'tools/03_tests/69_security_boundaries.mjs'
  ]],
  ['功能综合',[
    'tools/03_tests/50_regression_project.mjs',
    'tools/03_tests/51_feature_music_games.mjs',
    'tools/03_tests/52_feature_network_music.mjs',
    'tools/03_tests/65_feature_pet_rankings.mjs',
    'tools/03_tests/66_feature_poker_blackjack_market.mjs',
    'tools/03_tests/67_feature_doudizhu_and_inputs.mjs',
    'tools/03_tests/68_feature_navigation_titles.mjs',
    'tools/03_tests/70_feature_market_admin_rankings.mjs',
    'tools/03_tests/71_feature_accessories_achievements.mjs',
    'tools/03_tests/72_feature_fishing_catalog_admin.mjs',
    'tools/03_tests/73_feature_network_fishing_tetris.mjs',
    'tools/03_tests/74_feature_fishing_margin_ui.mjs',
    'tools/03_tests/75_feature_accessories_titles_market.mjs',
    'tools/03_tests/76_feature_accessory_market_schedule.mjs'
  ]]
];

function run(args,label){
  const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});
  if(r.error){console.error(`[FAIL] ${label}:`,r.error.message);process.exit(1)}
  if(r.status!==0){console.error(`[FAIL] ${label}`);process.exit(r.status||1)}
}

console.log(`=== SlimeLounge v${JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version} · 工程检查 ===`);
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

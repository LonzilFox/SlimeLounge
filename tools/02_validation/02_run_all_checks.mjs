import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const retiredFiles=['src/index.js','wrangler.jsonc','deploy_cloudflare.bat','check_repo_root.bat','test_internal_connection.bat','test_ipop_connection.bat','public/styles-v038.css','public/accessory-visual.js','public/ui-v038.js'];
for(const rel of retiredFiles){const p=path.join(root,rel);try{if(fs.existsSync(p))fs.rmSync(p,{force:true})}catch(e){console.warn(`[WARN] 无法清理旧文件 ${rel}: ${e.message}`)}}
for(const dirRel of ['release_notes','public/accessories']){const dir=path.join(root,dirRel);if(!fs.existsSync(dir))continue;for(const name of fs.readdirSync(dir)){const oldNote=dirRel==='release_notes'&&name.endsWith('.json')&&name!=='releases.json',oldAcc=dirRel==='public/accessories'&&/\.(?:tint|detail)\.svg$/i.test(name);if(!oldNote&&!oldAcc)continue;try{fs.rmSync(path.join(dir,name),{force:true})}catch(e){console.warn(`[WARN] 无法清理旧文件 ${dirRel}/${name}: ${e.message}`)}}}

const syntaxFiles=['local_server.js','server/action_receipts.js','server/chat_service.js','server/chat_state.js','server/release_rewards.js','server/device_identity.js','server/device_profile.js','server/economy.js','server/http_room_transport.js','server/http_security.js','server/music_service.js','server/network_sync.js','server/rankings.js','server/leaderboard_http.js','server/release_notes.js','server/room_change_hub.js','server/runtime_diagnostics.js','server/progression.js','server/leisure_service.js','server/single_game_service.js','server/input_validation.js','server/music_http_routes.js','server/open_browser.js','server/static_service.js','server/game_lifecycle.js','server/user_merge.js','server/voice_config.js','server/ws_session_auth.js','server/ws_transport.js','public/admin-economy.js','public/app-games.js','public/app.js','public/ui-enhancements.js','public/startup-ui.js','public/chat-ui.js','public/game-dice.js','public/game-poker.js','public/game-mahjong.js','public/game-doudizhu.js','public/progression-ui.js','public/leisure-ui.js','public/music-ui.js','public/origin-migrate.js','shared/dice.js','shared/extra_games.js','shared/games.js','shared/riichi.js','shared/doudizhu.js','tools/02_validation/01_validate_project.js'];
const testGroups=[
 ['游戏',['tools/03_tests/games/core_games.mjs','tools/03_tests/games/extra_games.mjs','tools/03_tests/games/riichi.mjs','tools/03_tests/games/local_server.mjs']],
 ['经济',['tools/03_tests/economy/wallet.mjs','tools/03_tests/economy/game_rules.mjs','tools/03_tests/economy/admin.mjs']],
 ['身份 / 规则 / 迁移',['tools/03_tests/identity/migration_legacy.mjs','tools/03_tests/identity/game_config_rules.mjs','tools/03_tests/identity/server_contracts.mjs','tools/03_tests/identity/poker_identity.mjs','tools/03_tests/identity/mobile_identity.mjs']],
 ['网络 / 安全',['tools/03_tests/network/sync.mjs','tools/03_tests/network/http_ws_transport.mjs','tools/03_tests/network/ui_performance.mjs','tools/03_tests/network/startup.mjs','tools/03_tests/network/security_boundaries.mjs']],
 ['功能',['tools/03_tests/features/music_games.mjs','tools/03_tests/features/network_music.mjs','tools/03_tests/features/pet_rankings.mjs','tools/03_tests/features/poker_blackjack_market.mjs','tools/03_tests/features/doudizhu_inputs.mjs','tools/03_tests/features/navigation_titles.mjs','tools/03_tests/features/market_admin_rankings.mjs','tools/03_tests/features/accessories_achievements.mjs','tools/03_tests/features/fishing_catalog_admin.mjs','tools/03_tests/features/fishing_tetris.mjs','tools/03_tests/features/fishing_margin_ui.mjs','tools/03_tests/features/accessories_titles_market.mjs','tools/03_tests/features/accessory_market_schedule.mjs']],
 ['回归',['tools/03_tests/regression/project.mjs']]
];
function run(args,label){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});if(r.error){console.error(`[FAIL] ${label}:`,r.error.message);process.exit(1)}if(r.status!==0){console.error(`[FAIL] ${label}`);process.exit(r.status||1)}}
console.log(`=== SlimeLounge v${JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version} · 工程检查 ===`);
console.log('\n[1/3] JavaScript 语法');for(const file of syntaxFiles)run(['--check',file],file);console.log(`[OK] ${syntaxFiles.length} 个源码文件语法通过`);
console.log('\n[2/3] 工程结构 / 资源 / UI 校验');run(['tools/02_validation/01_validate_project.js'],'工程校验');
console.log('\n[3/3] 按功能自动化回归测试');let count=0;for(const [group,files] of testGroups){console.log(`\n--- ${group} ---`);for(const file of files){run([file],file);count++}}console.log(`\n[OK] 全部检查通过 · ${count} 个测试套件`);

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOM_DEFS} from '../shared/games.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');let fail=0;
const required=['package.json','wrangler.jsonc','local_server.js','public/index.html','public/styles.css','public/app.js','src/index.js','shared/games.js'];
for(const f of required){const p=path.join(root,f);if(!fs.existsSync(p)){console.error('[MISSING]',f);fail=1}else console.log('[OK]',f)}
const ids=ROOM_DEFS.map(r=>r.id);if(new Set(ids).size!==ids.length){console.error('[FAIL] duplicate room id');fail=1}else console.log('[OK] room ids unique:',ids.length);
const counts={};for(const r of ROOM_DEFS)if(r.game)counts[r.game]=(counts[r.game]||0)+1;const expect={gomoku:5,xiangqi:3,chess:3,blackjack:3,poker:2};for(const [k,v] of Object.entries(expect)){if(counts[k]!==v){console.error('[FAIL]',k,counts[k],v);fail=1}else console.log('[OK]',k,v)}
const chats=ROOM_DEFS.filter(r=>r.category==='chat');if(chats.length<7){console.error('[FAIL] chat channels',chats.length);fail=1}else console.log('[OK] chat channels',chats.length);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(pkg.version!=='0.0.3'){console.error('[FAIL] version',pkg.version);fail=1}else console.log('[OK] version 0.0.3');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8'),app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');const domIds=[...app.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map(m=>m[1]);const missing=[...new Set(domIds)].filter(id=>!new RegExp(`id=["']${id}["']`).test(html)&&!['onlineUsers','chatLog','chatForm','chatInput','roomMain','musicQuery','musicSearch','musicSearchStatus','musicResults','friendId','friendSearch','friendSearchResult','friendReq','meName','meBio','meColor','mePresence','meStatusMessage','saveProfile','newEmployee','changeEmployee','releaseEmployeeBtn','releaseEmployee','bjLeave','bjReady','bjBet','bjSetBet','bjStart','bjHit','bjStand','pkLeave','pkReady','pkStart','pkFold','pkCheck','pkCall','pkRaiseAmt','pkRaise'].includes(id));if(missing.length){console.error('[FAIL] missing static DOM ids',missing);fail=1}else console.log('[OK] static DOM references');
process.exitCode=fail;

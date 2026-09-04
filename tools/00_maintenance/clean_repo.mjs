import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const removed=[];
const remove=(p,recursive=false)=>{const abs=path.join(root,p);if(!fs.existsSync(abs))return;fs.rmSync(abs,{recursive,force:true});removed.push(p)};

// Only known generated/retired files are auto-deleted. Unknown files are never guessed away.
const retired=[
  'src/index.js','wrangler.jsonc','deploy_cloudflare.bat','check_repo_root.bat',
  'test_internal_connection.bat','test_ipop_connection.bat','public/styles-v038.css',
  'public/accessory-visual.js','public/ui-v038.js','Caddyfile.example',
  'public/slimes/sleeping-slime-source.png','public/icons/fishing-nav-color.svg'
];
for(const p of retired)remove(p);

const junkNames=new Set(['.DS_Store','Thumbs.db','desktop.ini']);
const junkExt=/\.(?:log|tmp|bak|old|orig|rej)$/i;
function walk(dir,rel=''){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.name==='.git'||ent.name==='node_modules')continue;
    const childRel=path.join(rel,ent.name),abs=path.join(dir,ent.name);
    if(ent.isDirectory())walk(abs,childRel);
    else if(junkNames.has(ent.name)||junkExt.test(ent.name)){fs.rmSync(abs,{force:true});removed.push(childRel.replaceAll('\\','/'))}
  }
}
walk(root);

for(const d of ['coverage','.nyc_output','.cache','dist','build','tmp','.tmp'])remove(d,true);
const notes=path.join(root,'release_notes');if(fs.existsSync(notes))for(const n of fs.readdirSync(notes))if(n.endsWith('.json')&&n!=='releases.json')remove(path.join('release_notes',n));
const acc=path.join(root,'public/accessories');if(fs.existsSync(acc))for(const n of fs.readdirSync(acc))if(/\.(?:tint|detail)\.svg$/i.test(n))remove(path.join('public/accessories',n));
const tests=path.join(root,'tools/03_tests');if(fs.existsSync(tests))for(const n of fs.readdirSync(tests,{withFileTypes:true}))if(n.isFile()&&n.name.endsWith('.mjs'))remove(path.join('tools/03_tests',n.name));

console.log(`[CLEAN] removed ${removed.length} known junk/retired item(s)`);
for(const p of removed)console.log(`  - ${p}`);

// Audit unusually large files instead of deleting them automatically.
const large=[];
function scanSize(dir,rel=''){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.name==='.git'||ent.name==='node_modules')continue;
    const childRel=path.join(rel,ent.name),abs=path.join(dir,ent.name);
    if(ent.isDirectory())scanSize(abs,childRel);else{const size=fs.statSync(abs).size;if(size>=80000)large.push([size,childRel.replaceAll('\\','/')])}
  }
}
scanSize(root);large.sort((a,b)=>b[0]-a[0]);
if(large.length){console.log('[AUDIT] files >= 80KB (kept; review only)');for(const [n,p] of large)console.log(`  ${String(n).padStart(8)}  ${p}`)}

console.log('[CHECK] running project validation...');
const r=spawnSync(process.execPath,['tools/02_validation/02_run_all_checks.mjs'],{cwd:root,stdio:'inherit',env:process.env});
if(r.error)throw r.error;
process.exit(r.status??1);

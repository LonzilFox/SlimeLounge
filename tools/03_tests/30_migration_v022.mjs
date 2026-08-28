import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slimelounge-v023-migrate-'));
const port=18091;
const legacy={schemaVersion:14,roomMessages:{'chat-changelog':[{
  id:'legacy-auto-log',userId:'SYSTEM',name:'SlimeLounge',role:'owner',text:'legacy generated changelog',at:1
}]}};
fs.writeFileSync(path.join(tmp,'data.json'),JSON.stringify(legacy,null,2));
let logs='';
const proc=spawn(process.execPath,['local_server.js'],{cwd:root,env:{...process.env,PORT:String(port),AUTO_OPEN:'0',SLIMELOUNGE_DATA_DIR:tmp},stdio:['ignore','pipe','pipe'],windowsHide:true});
proc.stdout.on('data',d=>logs+=d);proc.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let ok=false;
  for(let i=0;i<50;i++){
    try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){ok=true;break}}catch{}
    await sleep(100);
  }
  if(!ok)throw Error('migration server start timeout\n'+logs);
  await sleep(80);
  const data=JSON.parse(fs.readFileSync(path.join(tmp,'data.json'),'utf8'));
  if(data.schemaVersion!==23)throw Error(`schema did not migrate to 23: ${data.schemaVersion}`);
  if(data.roomMessages?.['chat-changelog']?.some(x=>x.id==='legacy-auto-log'||x.text==='legacy generated changelog'))throw Error('legacy generated changelog was not cleared');
  if(!data.roomMessages?.['chat-changelog']?.some(x=>String(x.text||'').includes('SlimeLounge v0.2.9')))throw Error('v0.2.9 release note was not appended after migration');
  const backups=fs.readdirSync(path.join(tmp,'backups')).filter(x=>x.endsWith('.json'));
  if(!backups.length)throw Error('pre-migration backup was not created');
  const backed=JSON.parse(fs.readFileSync(path.join(tmp,'backups',backups[0]),'utf8'));
  if(!backed.roomMessages?.['chat-changelog']?.some(x=>x.text==='legacy generated changelog'))throw Error('backup did not preserve pre-migration changelog');
  console.log('[OK] v0.2.4 migration: v0.2.1-era data -> schema 23, old generated changelog cleared once + v0.2.9 release note appended, backup preserved');
}finally{
  if(proc&&!proc.killed)proc.kill('SIGTERM');
  await sleep(80);
  fs.rmSync(tmp,{recursive:true,force:true});
}

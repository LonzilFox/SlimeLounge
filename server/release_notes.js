import fs from 'node:fs';
import path from 'node:path';

function readReleaseEntries(dir){
  const out=[],files=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort();
  // v0.4.2+ uses one consolidated file. Overlay upgrades may leave older per-version JSONs
  // on disk, so once releases.json exists it is authoritative and stale siblings are ignored.
  const chosen=files.includes('releases.json')?['releases.json']:files;
  for(const file of chosen){
    let raw;try{raw=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))}catch{continue}
    for(const note of Array.isArray(raw)?raw:[raw])if(note&&typeof note==='object')out.push({note,file});
  }
  return out;
}

export function syncReleaseNotes({data,root,crypto}){
  data.releaseNotesPublished=Array.isArray(data.releaseNotesPublished)?data.releaseNotesPublished:[];
  const dir=path.join(root,'release_notes');if(!fs.existsSync(dir))return {added:0};
  const published=new Set(data.releaseNotesPublished),arr=data.roomMessages['chat-changelog']||(data.roomMessages['chat-changelog']=[]);let added=0;
  for(const {note,file} of readReleaseEntries(dir)){
    const id=String(note.id||path.basename(file,'.json'));if(!id||published.has(id))continue;
    const owner=data.users[data.ownerUserId]||Object.values(data.users).find(x=>x.role==='admin')||null;
    const title=String(note.title||id),items=Array.isArray(note.items)?note.items.map(x=>String(x).trim()).filter(Boolean):[];
    const text=[title,...items.map(x=>`• ${x}`)].join('\n').slice(0,3000);
    arr.push({id:crypto.randomUUID(),userId:owner?.userId||'SYSTEM:release',name:owner?.name||'SlimeLounge',slimeColor:owner?.slimeColor||'mint',role:owner?.role||'admin',text,at:Date.now(),editedAt:0,systemReleaseId:id});
    while(arr.length>1000)arr.shift();published.add(id);data.releaseNotesPublished.push(id);added++;
  }
  return {added};
}

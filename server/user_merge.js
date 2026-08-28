export function createUserMergeService({data,refreshWallet,RANKED_KINDS,normalizeRankRecord,clients,save}){
  function mergeUsers(sourceId,targetId){
    const source=data.users[sourceId],target=data.users[targetId];
    if(!source||!target||sourceId===targetId)throw Error('身份合并目标无效');
    const sourceChips=refreshWallet(source),targetChips=refreshWallet(target);
    // Duplicate accounts represent the same person. Never mint chips by adding both wallets.
    target.chips=Math.max(0,Number(sourceChips)||0,Number(targetChips)||0);
    target.chipsUpdatedAt=Date.now();
    target.lastChipCheckinDay=[String(target.lastChipCheckinDay||''),String(source.lastChipCheckinDay||'')].sort().pop()||'';
    for(const d of Object.values(data.devices))if(d.userId===sourceId)d.userId=targetId;
    if(!target.employeeHash&&source.employeeHash){
      target.employeeHash=source.employeeHash;target.employeeId=source.employeeId||'';target.employeeMasked=source.employeeMasked;target.employeeStatus=source.employeeStatus;data.employeeIndex[source.employeeHash]=targetId;
    }else if(source.employeeHash&&data.employeeIndex[source.employeeHash]===sourceId)delete data.employeeIndex[source.employeeHash];
    for(const f of data.friendships){if(f.a===sourceId)f.a=targetId;if(f.b===sourceId)f.b=targetId;if(f.remarks?.[sourceId]){f.remarks[targetId]??=f.remarks[sourceId];delete f.remarks[sourceId]}}
    for(const [key,arr] of Object.entries(data.directMessages||{})){
      for(const m of arr||[]){if(m.from===sourceId)m.from=targetId;if(m.to===sourceId)m.to=targetId}
      const ids=key.split('|').map(x=>x===sourceId?targetId:x).sort(),nk=ids.join('|');
      if(nk!==key){data.directMessages[nk]=[...(data.directMessages[nk]||[]),...(arr||[])].sort((a,b)=>(a.at||0)-(b.at||0)).slice(-500);delete data.directMessages[key]}
    }
    data.directMessageReads||={};
    const srcReads=data.directMessageReads[sourceId]||{},dstReads=data.directMessageReads[targetId]||(data.directMessageReads[targetId]={});
    for(const [other,at] of Object.entries(srcReads)){const k=other===targetId?sourceId:other;dstReads[k]=Math.max(Number(dstReads[k]||0),Number(at||0))}
    delete data.directMessageReads[sourceId];
    for(const mp of Object.values(data.directMessageReads))if(mp&&Object.prototype.hasOwnProperty.call(mp,sourceId)){mp[targetId]=Math.max(Number(mp[targetId]||0),Number(mp[sourceId]||0));delete mp[sourceId]}
    const rel=new Map();
    for(const f of data.friendships){if(f.a===f.b)continue;const key=[f.a,f.b].sort().join('|'),old=rel.get(key);if(!old||f.state==='accepted'||old.state!=='accepted'&&f.updatedAt>old.updatedAt)rel.set(key,f)}
    data.friendships=[...rel.values()];
    for(const kind of RANKED_KINDS){
      const ranks=data.rankings?.[kind]||{},src=ranks[sourceId];
      if(src){
        const sr=normalizeRankRecord(src),dst=normalizeRankRecord(ranks[targetId]);
        for(const mode of ['human','ai']){
          for(const k of ['games','wins','losses','draws'])dst[mode][k]=(dst[mode][k]||0)+(sr[mode]?.[k]||0);
          dst[mode].updatedAt=Math.max(dst[mode].updatedAt||0,sr[mode]?.updatedAt||0);
        }
        ranks[targetId]=dst;delete ranks[sourceId];
      }
    }
    for(const arr of Object.values(data.roomMessages||{}))for(const m of arr||[])if(m.userId===sourceId)m.userId=targetId;
    for(const r of data.employeeChangeRequests||[])if(r.userId===sourceId)r.userId=targetId;
    if(data.musicAccounts?.[sourceId]){if(!data.musicAccounts[targetId])data.musicAccounts[targetId]=data.musicAccounts[sourceId];delete data.musicAccounts[sourceId]}
    if(data.qqMusicAccounts?.[sourceId]){if(!data.qqMusicAccounts[targetId])data.qqMusicAccounts[targetId]=data.qqMusicAccounts[sourceId];delete data.qqMusicAccounts[sourceId]}
    for(const st of Object.values(data.roomGames||{})){
      if(Array.isArray(st?.players))st.players=st.players.map(x=>x===sourceId?targetId:x);
      if(Array.isArray(st?.seats))for(const seat of st.seats||[])if(seat?.userId===sourceId)seat.userId=targetId;
      if(st?.winner===sourceId)st.winner=targetId;
    }
    for(const c of clients)if(c.userId===sourceId)c.userId=targetId;
    if(data.ownerUserId===sourceId||source.role==='owner'){
      for(const u of Object.values(data.users))if(u.userId!==targetId&&u.role==='owner')u.role='member';
      target.role='owner';target.employeeStatus='verified';data.ownerUserId=targetId;
    }
    delete data.users[sourceId];target.updatedAt=Date.now();save();return target;
  }
  return {mergeUsers};
}

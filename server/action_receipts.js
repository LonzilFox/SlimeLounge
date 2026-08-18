export function createActionReceipts({ttlMs=60000,maxEntries=5000,keepEntries=4000}={}){
  const rows=new Map();
  const key=(userId,roomId,actionId)=>`${userId}|${roomId}|${actionId}`;
  function purge(now=Date.now()){
    for(const [k,at] of rows)if(now-at>ttlMs)rows.delete(k);
    if(rows.size>maxEntries){const old=[...rows.entries()].sort((a,b)=>a[1]-b[1]);for(const [k] of old.slice(0,rows.size-keepEntries))rows.delete(k)}
  }
  function seen(userId,roomId,actionId){if(!actionId)return false;purge();return rows.has(key(userId,roomId,actionId))}
  function remember(userId,roomId,actionId){if(!actionId)return;rows.set(key(userId,roomId,actionId),Date.now());purge()}
  return {seen,remember,size:()=>rows.size};
}

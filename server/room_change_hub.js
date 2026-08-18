export function createRoomChangeHub(){
  const revisions=new Map(),waiters=new Map();
  const revision=roomId=>Math.max(0,Number(revisions.get(String(roomId||''))||0));
  function touch(roomId){
    roomId=String(roomId||'');if(!roomId)return 0;
    const next=revision(roomId)+1;revisions.set(roomId,next);
    const set=waiters.get(roomId);if(set){waiters.delete(roomId);for(const w of set){clearTimeout(w.timer);try{w.resolve(next)}catch{}}}
    return next;
  }
  function wait(roomId,since=0,timeoutMs=22000){
    roomId=String(roomId||'');since=Math.max(0,Number(since)||0);
    const current=revision(roomId);if(current>since)return Promise.resolve(current);
    return new Promise(resolve=>{
      const set=waiters.get(roomId)||new Set();waiters.set(roomId,set);
      const w={resolve,timer:null};w.timer=setTimeout(()=>{set.delete(w);if(!set.size)waiters.delete(roomId);resolve(revision(roomId))},Math.max(1000,Math.min(28000,Number(timeoutMs)||22000)));w.timer.unref?.();set.add(w);
    });
  }
  function cancelAll(){for(const set of waiters.values())for(const w of set){clearTimeout(w.timer);try{w.resolve(0)}catch{}}waiters.clear()}
  return {revision,touch,wait,cancelAll,pending:()=>[...waiters.values()].reduce((n,s)=>n+s.size,0)};
}

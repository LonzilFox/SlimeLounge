function seatedCount(st){
  if(!st)return 0;
  if(Array.isArray(st.players))return st.players.filter(Boolean).length;
  return (st.seats||[]).filter(Boolean).length;
}
function humanCount(st){
  if(!st)return 0;
  const rows=Array.isArray(st.players)?st.players:(st.seats||[]).map(x=>x?.userId);
  return rows.filter(x=>x&&!String(x).startsWith('BOT:')).length;
}
export function unreadySeatDelayMs(st,configured=0){
  const n=Math.max(1,seatedCount(st));
  return Math.max(Number(configured)||0,Math.min(120000,45000+(n-1)*10000));
}
export function disconnectedSeatDelayMs(st,configured=0){
  const n=Math.max(1,humanCount(st));
  return Math.max(Number(configured)||0,Math.min(60000,20000+(n-1)*5000));
}
export function resultCleanupDelayMs(st){
  const n=Math.max(2,seatedCount(st));
  return Math.min(210000,90000+Math.max(0,n-2)*20000);
}
export function readyReminderSeconds(st){return Math.round(unreadySeatDelayMs(st)/1000)}

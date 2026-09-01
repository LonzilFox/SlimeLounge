export function applyReleaseReward({data,version,now=Date.now(),activeWindowMs=20*60*1000,onlineReward=500,activityReward=1500}){
  data.releaseRewardsApplied=Array.isArray(data.releaseRewardsApplied)?data.releaseRewardsApplied:[];
  if(data.releaseRewardsApplied.includes(version))return {applied:false,rewarded:0,activity:0,online:0};
  let rewarded=0,activity=0,online=0;
  for(const u of Object.values(data.users||{})){
    if(!u||u.presenceStatus==='offline'||now-Number(u.lastSeenAt||0)>activeWindowMs)continue;
    const active=['gaming','listening','trading','fishing'].includes(u.presenceStatus)||['games','music','market','fishing'].includes(u.currentSection)||/游戏中|听歌中|炒股中|钓鱼中/.test(String(u.activityLabel||''));
    const amount=active?activityReward:onlineReward;if(amount<=0)continue;
    u.chips=Math.max(0,Number(u.chips)||0)+amount;u.chipsUpdatedAt=now;u.lastReleaseReward={version,amount,at:now};
    data.chipLedger=Array.isArray(data.chipLedger)?data.chipLedger:[];data.chipLedger.push({id:`release:${version}:${u.userId}`,userId:u.userId,delta:amount,before:Math.max(0,Number(u.chips)||0)-amount,after:u.chips,reason:`版本更新补偿 ${version}`,at:now});
    rewarded++;if(active)activity++;else online++;
  }
  if(data.chipLedger?.length>5000)data.chipLedger.splice(0,data.chipLedger.length-5000);
  data.releaseRewardsApplied.push(version);return {applied:true,rewarded,activity,online};
}

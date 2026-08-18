export function createRuntimeDiagnostics({requestIpInfo,version='0.0.0',trustProxy=false}){
  const startedAt=Date.now();
  const recent=[];
  const traffic=[];
  const userRequests=[];
  const clientEvents=[];
  const requestMeta=new WeakMap();
  const buckets=[];
  const ws={opened:0,closed:0,current:0,upgradeDenied:0};
  let eventLoopLagMs=0,maxEventLoopLagMs=0,lastTick=Date.now();
  const KEEP_MS=30*60*1000;
  const lagTimer=setInterval(()=>{const now=Date.now(),lag=Math.max(0,now-lastTick-1000);eventLoopLagMs=lag;maxEventLoopLagMs=Math.max(maxEventLoopLagMs,lag);lastTick=now;prune(now)},1000);
  lagTimer.unref?.();
  function bucket(now=Date.now()){
    const key=Math.floor(now/60000)*60000;let b=buckets[buckets.length-1];
    if(!b||b.at!==key){b={at:key,requests:0,status2xx:0,status4xx:0,status5xx:0,rateLimited:0,slow:0,totalMs:0,maxMs:0,paths:{}};buckets.push(b);if(buckets.length>10)buckets.splice(0,buckets.length-10)}
    return b;
  }
  function prune(now=Date.now()){
    while(recent.length&&now-recent[0].at>KEEP_MS)recent.shift();
    while(traffic.length&&now-traffic[0].at>10*60*1000)traffic.shift();
    while(userRequests.length&&now-userRequests[0].at>KEEP_MS)userRequests.shift();
    while(clientEvents.length&&now-clientEvents[0].at>KEEP_MS)clientEvents.shift();
    while(buckets.length&&now-buckets[0].at>10*60*1000)buckets.shift();
  }
  function identify(req,u,d,extra={}){
    if(!req)return;const prev=requestMeta.get(req)||{};
    requestMeta.set(req,{...prev,userId:u?.userId||prev.userId||'',userName:u?.name||prev.userName||'',loungeId:u?.loungeId||prev.loungeId||'',deviceId:d?.deviceId||prev.deviceId||'',deviceLabel:d?.label||prev.deviceLabel||'',...extra});
  }
  function metaFor(req){return requestMeta.get(req)||{}}
  function beginRequest(req,pathname){
    const started=Date.now(),ip=requestIpInfo(req);
    return {finish(status=200){
      const ms=Date.now()-started,b=bucket(),meta=metaFor(req);b.requests++;b.totalMs+=ms;b.maxMs=Math.max(b.maxMs,ms);if(status>=500)b.status5xx++;else if(status>=400)b.status4xx++;else if(status>=200)b.status2xx++;if(status===429)b.rateLimited++;if(ms>=1000)b.slow++;b.paths[pathname]=(b.paths[pathname]||0)+1;
      const row={at:Date.now(),method:req.method||'',path:pathname,status,ms,clientIp:ip.clientIp||'',proxyIp:ip.proxyIp||'',proxyTrusted:!!ip.proxyTrusted,userId:meta.userId||'',userName:meta.userName||'',loungeId:meta.loungeId||'',deviceId:meta.deviceId||'',deviceLabel:meta.deviceLabel||'',transport:meta.transport||'',roomId:meta.roomId||''};
      traffic.push({at:row.at,path:pathname,status,ms});if(traffic.length>6000)traffic.splice(0,traffic.length-6000);
      if(row.userId){userRequests.push(row);if(userRequests.length>2500)userRequests.splice(0,userRequests.length-2500)}
      const noteworthy=status>=500||status===429||ms>=1000;
      if(noteworthy){recent.push(row);if(recent.length>300)recent.shift();console.warn(`[HTTP] ${status} ${row.method} ${pathname} ${ms}ms user=${row.userId||'-'} device=${row.deviceId||'-'} client=${row.clientIp||'-'} proxy=${row.proxyIp||'-'}${row.proxyTrusted?' trusted-proxy':''}`)}
    }}
  }
  function noteRateLimit(req,key,subject='ip'){
    const ip=requestIpInfo(req),meta=metaFor(req);console.warn(`[RATE] ${key} subject=${subject} user=${meta.userId||'-'} device=${meta.deviceId||'-'} client=${ip.clientIp||'-'} proxy=${ip.proxyIp||'-'}`);
    clientEvent(req,null,null,'rate-limit',`${key} · ${subject}`,{status:429});
  }
  function clientEvent(req,u,d,kind,detail='',extra={}){
    if(req&&u)identify(req,u,d,extra);const ip=req?requestIpInfo(req):{},meta=req?metaFor(req):{};
    const row={at:Date.now(),kind:String(kind||'event').slice(0,48),detail:String(detail||'').slice(0,280),userId:u?.userId||meta.userId||extra.userId||'',userName:u?.name||meta.userName||extra.userName||'',loungeId:u?.loungeId||meta.loungeId||extra.loungeId||'',deviceId:d?.deviceId||meta.deviceId||extra.deviceId||'',deviceLabel:d?.label||meta.deviceLabel||extra.deviceLabel||'',clientIp:ip.clientIp||extra.clientIp||'',proxyIp:ip.proxyIp||extra.proxyIp||'',roomId:extra.roomId||meta.roomId||'',transport:extra.transport||meta.transport||'',status:Number(extra.status)||0,rttMs:Math.max(0,Math.round(Number(extra.rttMs)||0))};
    clientEvents.push(row);if(clientEvents.length>1200)clientEvents.splice(0,clientEvents.length-1200);
    if(['ws-auth-failed','ws-auth-timeout','ws-denied','http-fallback','http-fallback-error','rate-limit','client-network-error'].includes(row.kind))console.warn(`[NET] ${row.kind} user=${row.userId||'-'} device=${row.deviceId||'-'} room=${row.roomId||'-'} client=${row.clientIp||'-'} ${row.detail}`);
    return row;
  }
  function wsOpened(){ws.opened++;ws.current++}
  function wsClosed(){ws.closed++;ws.current=Math.max(0,ws.current-1)}
  function wsDenied(reason='',req=null){ws.upgradeDenied++;console.warn(`[WS DENY] ${reason}`);if(req)clientEvent(req,null,null,'ws-denied',reason)}
  function selectedUserLog(userId=''){
    if(!userId)return null;const now=Date.now(),requests=userRequests.filter(x=>x.userId===userId).slice(-120).reverse(),events=clientEvents.filter(x=>x.userId===userId).slice(-120).reverse(),last5=userRequests.filter(x=>x.userId===userId&&now-x.at<5*60*1000),ev5=clientEvents.filter(x=>x.userId===userId&&now-x.at<5*60*1000),rtts=ev5.map(x=>Number(x.rttMs)||0).filter(Boolean).sort((a,b)=>a-b),pathTotals={};
    for(const x of last5)pathTotals[x.path]=(pathTotals[x.path]||0)+1;const avg=rtts.length?Math.round(rtts.reduce((a,b)=>a+b,0)/rtts.length):0,p95=rtts.length?rtts[Math.min(rtts.length-1,Math.ceil(rtts.length*.95)-1)]:0;
    return {userId,requests,events,stats:{requests5m:last5.length,rateLimited5m:last5.filter(x=>x.status===429).length,errors5m:last5.filter(x=>x.status>=400).length,slow5m:last5.filter(x=>x.ms>=1000).length,avgRttMs:avg,p95RttMs:p95,maxRttMs:rtts.at(-1)||0,rttSamples:rtts.length,topPaths:Object.entries(pathTotals).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([path,count])=>({path,count}))}};
  }
  function summary(extra={},filterUserId=''){
    const now=Date.now();prune(now);const last=traffic.filter(x=>now-x.at<60000),reqs=last.length,r429=last.filter(x=>x.status===429).length,e4=last.filter(x=>x.status>=400&&x.status<500).length,e5=last.filter(x=>x.status>=500).length,slow=last.filter(x=>x.ms>=1000).length,avgMs=reqs?Math.round(last.reduce((a,x)=>a+x.ms,0)/reqs):0,maxMs=reqs?Math.max(...last.map(x=>x.ms)):0;const pathTotals={};for(const x of last)pathTotals[x.path]=(pathTotals[x.path]||0)+1;const topPaths=Object.entries(pathTotals).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([path,count])=>({path,count}));const m=process.memoryUsage();
    return {ok:true,version,startedAt,uptimeSec:Math.floor(process.uptime()),trustProxy,eventLoopLagMs,maxEventLoopLagMs,memory:{rssMB:+(m.rss/1048576).toFixed(1),heapUsedMB:+(m.heapUsed/1048576).toFixed(1),heapTotalMB:+(m.heapTotal/1048576).toFixed(1)},lastMinute:{windowSec:60,requests:reqs,rateLimited:r429,status4xx:e4,status5xx:e5,slow,avgMs,maxMs,topPaths},websocket:{...ws},recent:recent.slice(-60).reverse(),selectedUser:selectedUserLog(filterUserId),...extra}
  }
  const summaryTimer=setInterval(()=>{const s=summary();console.log(`[METRICS] req=${s.lastMinute.requests} 429=${s.lastMinute.rateLimited} 4xx=${s.lastMinute.status4xx} 5xx=${s.lastMinute.status5xx} slow=${s.lastMinute.slow} ws=${s.websocket.current} rss=${s.memory.rssMB}MB lag=${s.eventLoopLagMs}ms`)},60000);
  summaryTimer.unref?.();
  return {beginRequest,identify,noteRateLimit,clientEvent,wsOpened,wsClosed,wsDenied,summary,stop(){clearInterval(lagTimer);clearInterval(summaryTimer)}};
}

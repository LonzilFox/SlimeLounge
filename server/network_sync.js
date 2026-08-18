import fs from 'node:fs';

export function createNetworkSync({body,auth,json,limitUser,applyPresenceUpdate,publicUser,dmUnreadSummary,notificationPayload,data,onlineInfo,social,isStaff,diagnostics,userIsOnline,roomPollers,activeTabs,clients,dataFile,trustProxy,trustedProxyIps,publicOrigin}){
  const cleanEvent=v=>String(v||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,280);
  function connectionSnapshot(userId){
    if(!userId)return null;
    const wsRows=[...(clients||[])].filter(c=>!c.closed&&c.userId===userId).map(c=>({transport:'websocket',roomId:c.roomId||'',tabId:c.tabId||'',deviceId:c.deviceId||'',connectedAt:c.connectedAt||0}));
    const pollRows=[...(roomPollers||new Map()).values()].filter(x=>x.userId===userId).map(x=>({transport:x.kind==='compat'?'http-compat-legacy':'http-long-poll',roomId:x.roomId||'',tabId:x.tabId||'',lastAt:x.at||0}));
    const tabCount=[...(activeTabs||new Map()).keys()].filter(k=>String(k).startsWith(`${userId}|`)).length;
    const devices=Object.values(data.devices||{}).filter(d=>d.userId===userId).sort((a,b)=>(b.lastSeenAt||0)-(a.lastSeenAt||0)).map(d=>({deviceId:d.deviceId,label:d.label||'',lastSeenAt:d.lastSeenAt||0,lastIp:d.lastIp||'',lastIpVersion:d.lastIpVersion||0,lastHost:d.lastHost||'',platform:d.platform||'',browser:d.browser||'',model:d.model||''}));
    return {websocket:wsRows,httpFallback:pollRows,activeTabs:tabCount,devices};
  }
  return async function handleNetworkSync(req,res,url){
    if(req.method==='POST'&&url.pathname==='/api/presence/ping'){
      const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);if(!a){json(res,401,{ok:false,error:'设备身份无效'});return true}if(!limitUser(a,'presence',30,60000,req)){json(res,429,{ok:false,error:'状态同步过于频繁'});return true}applyPresenceUpdate(a.u,b);json(res,200,{ok:true,profile:publicUser(a.u)});return true;
    }
    if(req.method==='POST'&&url.pathname==='/api/sync/light'){
      const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);if(!a){json(res,401,{ok:false,error:'设备身份无效'});return true}
      // This is a background lease/sync endpoint, not a gameplay transport. Give it ample room so a temporary
      // reconnect burst never blocks login or gameplay; abuse protection remains user scoped.
      if(!limitUser(a,'light-sync',120,60000,req)){json(res,429,{ok:false,error:'后台同步过于频繁'});return true}
      applyPresenceUpdate(a.u,b);const n=notificationPayload(a.u,Math.max(0,Number(b.since)||0)),out={ok:true,profile:publicUser(a.u),unread:dmUnreadSummary(a.u.userId),notifications:n.items,now:n.now};if(b.includeUsers)out.users=Object.values(data.users).map(u=>({...publicUser(u),...onlineInfo(u)}));if(b.includeSocial)out.social=social(a.u.userId);json(res,200,out);return true;
    }
    if(req.method==='POST'&&url.pathname==='/api/client/network-event'){
      const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);if(!a){json(res,200,{ok:true});return true}
      if(limitUser(a,'client-network-event',30,60000,req))diagnostics.clientEvent(req,a.u,a.d,cleanEvent(b.kind||'client-network-error'),cleanEvent(b.detail),{roomId:cleanEvent(b.roomId).slice(0,48),transport:cleanEvent(b.transport).slice(0,48),status:Number(b.status)||0,rttMs:Number(b.rttMs)||0});
      json(res,200,{ok:true});return true;
    }
    if(req.method==='POST'&&url.pathname==='/api/admin/diagnostics'){
      const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);if(!a||!isStaff(a.u)){json(res,403,{ok:false,error:'无管理员权限'});return true}
      const onlineUsers=Object.values(data.users).filter(u=>userIsOnline(u.userId)).length;let dataBytes=0;try{dataBytes=fs.statSync(dataFile).size}catch{}
      const targetUserId=String(b.targetUserId||''),diagUsers=Object.values(data.users).map(u=>({...publicUser(u),...onlineInfo(u)})).sort((x,y)=>Number(y.online)-Number(x.online)||String(x.name||'').localeCompare(String(y.name||''),'zh-CN'));
      const extra={onlineUsers,httpPollers:[...roomPollers.values()].filter(x=>x.kind!=='compat').length,activeTabs:activeTabs.size,dataBytes,proxy:{trustProxy,trustedProxyIps:trustedProxyIps||'',publicOrigin:publicOrigin||''},diagUsers,targetConnections:connectionSnapshot(targetUserId)};
      json(res,200,diagnostics.summary(extra,targetUserId));return true;
    }
    return false;
  }
}

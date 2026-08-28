export function createHttpRoomTransport({body,auth,json,limitUser,verifiedOnly,roomData,roomPollTouch,cancelDisconnectedSeatCleanup,schedulePresenceSave,roomChanges,roomSnapshot,clean,actionSeen,message,rememberAction,tabTouch,roomPollDrop,roomHasUser,scheduleDisconnectedSeatCleanup,clearGameChatIfEmpty,diagnostics,validateRoomMessage}){
  return async function handleHttpRoomTransport(req,res,url){
    if(req.method!=='POST'||!['/api/room/snapshot','/api/room/poll','/api/room/action','/api/room/disconnect'].includes(url.pathname))return false;
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);
    if(!a){json(res,url.pathname==='/api/room/disconnect'?200:401,{ok:url.pathname==='/api/room/disconnect',error:'设备身份无效'});return true}
    const roomId=String(b.roomId||''),tid=clean(b.tabId,96),transport=url.pathname==='/api/room/poll'?'http-long-poll':url.pathname==='/api/room/action'?'http-action':'http-snapshot';diagnostics?.identify?.(req,a.u,a.d,{roomId,transport});
    if(url.pathname==='/api/room/disconnect'){
      roomPollDrop(a.u.userId,roomId,tid);diagnostics?.clientEvent?.(req,a.u,a.d,'http-fallback-close','HTTP 兼容连接关闭',{roomId,transport:'http-long-poll'});if(roomId){roomChanges.touch(roomId);if(!roomHasUser(roomId,a.u.userId))scheduleDisconnectedSeatCleanup(a.u.userId,roomId)}clearGameChatIfEmpty(roomId);json(res,200,{ok:true});return true;
    }
    const gate=verifiedOnly(a);if(gate){json(res,403,{ok:false,error:gate});return true}
    const def=roomData(roomId);if(!def){json(res,404,{ok:false,error:'房间不存在'});return true}
    // Long polling holds one request open for up to 22s, so this ceiling is intentionally generous.
    // It is per authenticated user, not per shared corporate NAT IP.
    const limits=url.pathname==='/api/room/action'?['room-action',480]:url.pathname==='/api/room/poll'?['room-long-poll',240]:['room-snapshot',180];
    if(!limitUser(a,limits[0],limits[1],60000,req)){json(res,429,{ok:false,error:url.pathname==='/api/room/action'?'房间操作过于频繁':'房间同步过于频繁'});return true}
    tabTouch(a.u.userId,tid);const isLongPoll=url.pathname==='/api/room/poll',fresh=roomPollTouch(a.u.userId,roomId,tid,!isLongPoll,isLongPoll?'poll':'compat');if(isLongPoll&&fresh)diagnostics?.clientEvent?.(req,a.u,a.d,'http-fallback','进入 HTTP 长轮询兼容通道',{roomId,transport:'http-long-poll'});cancelDisconnectedSeatCleanup(a.u.userId,roomId);a.u.lastSeenAt=Date.now();a.u.currentRoomId=roomId;schedulePresenceSave(a.u.userId);
    if(url.pathname==='/api/room/poll'){
      await roomChanges.wait(roomId,Math.max(0,Number(b.sinceRevision)||0),22000);if(res.destroyed||res.writableEnded)return true;json(res,200,{ok:true,...roomSnapshot(roomId,a.u.userId),transport:'http-long-poll'});return true;
    }
    if(url.pathname==='/api/room/action'){
      const actionId=clean(b.clientActionId,96);if(actionSeen(a.u.userId,roomId,actionId)){json(res,200,{ok:true,...roomSnapshot(roomId,a.u.userId),transport:'http-long-poll',actionAck:actionId,duplicate:true});return true}
      try{const wire=validateRoomMessage({...b.message,clientActionId:actionId||b.message?.clientActionId||''});message({closed:false,socket:{destroyed:true},userId:a.u.userId,roomId,tabId:tid,countedWs:false},JSON.stringify(wire),true);if(actionId)rememberAction(a.u.userId,roomId,actionId);json(res,200,{ok:true,...roomSnapshot(roomId,a.u.userId),transport:'http-long-poll',actionAck:actionId})}catch(e){json(res,400,{ok:false,error:e.message||'房间操作失败'})}return true;
    }
    json(res,200,{ok:true,...roomSnapshot(roomId,a.u.userId),transport:'http-long-poll'});return true;
  }
}

export function createChatState({data,ROOM_MAP,body,auth,json,scheduleSave}){
  data.chatReads=data.chatReads&&typeof data.chatReads==='object'?data.chatReads:{};
  const readMap=userId=>data.chatReads[userId]||(data.chatReads[userId]={});
  const chatRooms=()=>Object.values(ROOM_MAP).filter(r=>r?.category==='chat'&&r.channelType!=='voice');
  function unreadSummary(userId){
    const reads=readMap(userId),rooms=chatRooms(),out={};
    if(!reads._initialized){
      for(const r of rooms){const arr=data.roomMessages[r.id]||[];reads[r.id]=Number(arr[arr.length-1]?.at)||0}
      reads._initialized=Date.now();scheduleSave();
    }
    for(const r of rooms){
      const since=Number(reads[r.id]||0),arr=data.roomMessages[r.id]||[];
      const unread=arr.filter(m=>(Number(m.at)||0)>since&&m.userId!==userId);
      out[r.id]={count:unread.length,hasUnread:unread.length>0,latestAt:unread.length?Number(unread[unread.length-1].at)||0:0};
    }
    return out;
  }
  function markRead(userId,roomId,at=Date.now()){
    const def=ROOM_MAP[roomId];if(!def||def.category!=='chat'||def.channelType==='voice')return false;
    const arr=data.roomMessages[roomId]||[],last=Number(arr[arr.length-1]?.at)||0;
    readMap(userId)[roomId]=Math.max(Number(readMap(userId)[roomId]||0),Number(at)||0,last);scheduleSave();return true;
  }
  async function handle(req,res,url){
    if(req.method!=='POST'||!['/api/chat/history','/api/chat/read','/api/chat/unread'].includes(url.pathname))return false;
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);if(!a){json(res,401,{ok:false,error:'设备身份无效'});return true}
    if(url.pathname==='/api/chat/unread'){json(res,200,{ok:true,channelUnread:unreadSummary(a.u.userId)});return true}
    const roomId=String(b.roomId||''),def=ROOM_MAP[roomId];if(!def||def.category!=='chat'||def.channelType==='voice'){json(res,400,{ok:false,error:'不是文字聊天频道'});return true}
    if(url.pathname==='/api/chat/read'){markRead(a.u.userId,roomId,Date.now());json(res,200,{ok:true,channelUnread:unreadSummary(a.u.userId)});return true}
    const arr=data.roomMessages[roomId]||[],beforeAt=Math.max(0,Number(b.beforeAt)||Date.now()+1),limit=Math.max(8,Math.min(36,Math.floor(Number(b.limit)||24))),older=arr.filter(m=>(Number(m.at)||0)<beforeAt),items=older.slice(-limit),hasMore=older.length>items.length;
    json(res,200,{ok:true,items,hasMore});return true;
  }
  return {handle,unreadSummary,markRead};
}

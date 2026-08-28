export function socialPayload(data,userId,publicUser,onlineInfo,dmUnreadCount,dmUnreadSummary){
  const friends=[],incoming=[],outgoing=[];
  for(const f of data.friendships||[]){
    if(f.state==='removed'||(f.a!==userId&&f.b!==userId))continue;
    const other=f.a===userId?f.b:f.a,u=data.users[other];if(!u)continue;
    const e={...publicUser(u),...onlineInfo(u),remark:String(f.remarks?.[userId]||''),unread:f.state==='accepted'?dmUnreadCount(userId,other):0};
    if(!e.online)e.activityLabel='';
    if(f.state==='accepted')friends.push(e);else if(f.b===userId)incoming.push(e);else outgoing.push(e);
  }
  return {friends,incoming,outgoing,unread:dmUnreadSummary(userId)};
}

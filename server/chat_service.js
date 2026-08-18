export function createChatService({data,crypto,clean,isStaff,scheduleSave,broadcast,onChat=null}){
  const cleanChat=(v,n=3000)=>String(v??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/\n{4,}/g,'\n\n\n').trim().slice(0,n);
  const roomMessages=roomId=>data.roomMessages[roomId]||(data.roomMessages[roomId]=[]);
  const staffOnly=def=>!!def?.adminOnlyPost;
  function canEdit(def,u,msg){
    if(!u||!msg)return false;
    if(staffOnly(def))return isStaff(u);
    return msg.userId===u.userId;
  }
  function canDelete(def,u,msg){
    if(!u||!msg)return false;
    if(staffOnly(def))return isStaff(u);
    return msg.userId===u.userId||isStaff(u);
  }
  function handle(c,m,def,u,now=Date.now()){
    if(!['chat','chat_edit','chat_delete'].includes(m?.type))return false;
    if(def?.channelType==='voice')throw Error('语音频道不发送文字消息');
    const arr=roomMessages(c.roomId);
    if(m.type==='chat'){
      c.chatTimes=(c.chatTimes||[]).filter(x=>now-x<10000);
      if(c.chatTimes.length>=10)throw Error('发言过于频繁，请稍后再发');
      c.chatTimes.push(now);
      const text=cleanChat(m.text,3000);if(!text)return true;
      if(def.readOnly)throw Error('该频道为只读');
      if(staffOnly(def)&&!isStaff(u))throw Error('该讨论区仅 Owner / Admin 可以发言');
      const parent=arr.find(x=>x.id===String(m.replyTo||''));const reply=parent?{messageId:parent.id,userId:parent.userId,name:parent.name,text:String(parent.text||'').slice(0,500)}:null;const msg={id:crypto.randomUUID(),userId:c.userId,name:u.name,slimeColor:u.slimeColor,role:u.role||'member',title:u.equippedTitle||'',text,reply,at:now,editedAt:0};
      arr.push(msg);while(arr.length>100)arr.shift();try{onChat?.(u,msg,c.roomId)}catch{}scheduleSave();broadcast(c.roomId,{type:'chat',message:msg});return true;
    }
    const id=String(m.messageId||''),idx=arr.findIndex(x=>x.id===id),msg=arr[idx];
    if(!msg)throw Error('消息不存在或已经被删除');
    if(m.type==='chat_edit'){
      if(!canEdit(def,u,msg))throw Error(staffOnly(def)?'只有 Owner / Admin 可以编辑公告和更新日志':'只能编辑自己的消息');
      const text=cleanChat(m.text,3000);if(!text)throw Error('消息不能为空');
      msg.text=text;msg.editedAt=now;msg.editedBy=u.userId;scheduleSave();broadcast(c.roomId,{type:'chat_update',message:msg});return true;
    }
    if(!canDelete(def,u,msg))throw Error(staffOnly(def)?'只有 Owner / Admin 可以删除公告和更新日志':'只能删除自己的消息');
    arr.splice(idx,1);scheduleSave();broadcast(c.roomId,{type:'chat_delete',messageId:id});return true;
  }
  return {handle};
}

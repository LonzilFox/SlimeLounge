const ROOM_TYPES=new Set(['heartbeat','chat','chat_edit','chat_delete','music_set','music_add','music_control','music_ended','voice_toggle','voice_activity','voice_signal','game_action']);
const GAME_ACTIONS=new Set(['accept_wild4','add_bot','allin','ankan','bet','bid','box_bet','boxes','call','catch_uno','challenge','challenge_wild4','check','claim','claim_draw','discard','double','draw','fold','hit','insurance','insurance_decline','join','kakan','kyuushu','leave','move','next_hand','pair_bet','pass','pass_draw','place','play','raise','ready','rematch','remove_bot','reset','resign','riichi_discard','run_board','set_default_stack','set_time_control','split','stand','start','surrender','timeout','tsumo','undo_accept','undo_reject','undo_request','uno']);
const BAD_KEYS=new Set(['__proto__','prototype','constructor']);
const isPlain=o=>!!o&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
function safeTree(v,depth=0){
  if(depth>4)throw Error('输入层级过深');
  if(v==null||typeof v==='boolean')return;
  if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER)throw Error('数值参数无效');return}
  if(typeof v==='string'){if(v.length>4000)throw Error('字符串参数过长');return}
  if(Array.isArray(v)){if(v.length>64)throw Error('数组参数过长');for(const x of v)safeTree(x,depth+1);return}
  if(!isPlain(v))throw Error('对象参数无效');
  const keys=Object.keys(v);if(keys.length>40)throw Error('参数数量过多');
  for(const k of keys){if(BAD_KEYS.has(k)||k.length>64)throw Error('参数名称无效');safeTree(v[k],depth+1)}
}
const str=(v,n)=>{if(typeof v!=='string'||v.length>n)throw Error('字符串参数无效');return v};
export function validateRoomMessage(raw,{allowAuth=false}={}){
  if(!isPlain(raw))throw Error('房间消息必须是对象');
  safeTree(raw);
  const type=str(raw.type,40);
  if(allowAuth&&type==='auth')return raw;
  if(!ROOM_TYPES.has(type))throw Error('未知房间消息类型');
  if(type==='heartbeat'){if(raw.clientAt!=null&&(!Number.isFinite(Number(raw.clientAt))||Math.abs(Number(raw.clientAt))>9e15))throw Error('心跳时间无效');return raw}
  if(type==='chat'){str(String(raw.text??''),3000);if(raw.replyTo!=null)str(String(raw.replyTo),80);return raw}
  if(type==='chat_edit'){str(String(raw.messageId??''),80);str(String(raw.text??''),3000);return raw}
  if(type==='chat_delete'){str(String(raw.messageId??''),80);return raw}
  if(type==='music_set'||type==='music_add'){str(String(raw.trackId??''),40);if(raw.mediaId!=null)str(String(raw.mediaId),40);if(raw.title!=null)str(String(raw.title),100);if(raw.cover!=null)str(String(raw.cover),400);if(raw.duration!=null&&(!Number.isFinite(Number(raw.duration))||Number(raw.duration)<0||Number(raw.duration)>86400000))throw Error('歌曲时长无效');return raw}
  if(type==='music_control'){if(!['play','pause','seek'].includes(String(raw.action||'')))throw Error('音乐控制参数无效');if(raw.positionMs!=null&&(!Number.isFinite(Number(raw.positionMs))||Number(raw.positionMs)<0||Number(raw.positionMs)>86400000))throw Error('播放位置无效');return raw}
  if(type==='music_ended'){str(String(raw.trackId??''),40);return raw}
  if(type==='voice_toggle'||type==='voice_activity')return raw;
  if(type==='voice_signal'){str(String(raw.target??''),80);if(!isPlain(raw.signal))throw Error('语音信令无效');const s=JSON.stringify(raw.signal);if(s.length>12000)throw Error('语音信令过大');return raw}
  if(type==='game_action'){
    if(!isPlain(raw.action))throw Error('游戏操作必须是对象');
    const at=str(String(raw.action.type||''),40);if(!GAME_ACTIONS.has(at))throw Error('未知游戏操作');
    if(raw.clientActionId!=null)str(String(raw.clientActionId),96);
    return raw;
  }
  return raw;
}

export function directLoopbackOnly(req){
  const remote=String(req?.socket?.remoteAddress||'').toLowerCase(),loop=remote==='127.0.0.1'||remote==='::1'||remote==='::ffff:127.0.0.1';
  if(!loop)return false;
  if(req?.headers?.['x-forwarded-for']||req?.headers?.['x-real-ip']||req?.headers?.forwarded||req?.headers?.['x-forwarded-host'])return false;
  const host=String(req?.headers?.host||'').toLowerCase().split(':')[0].replace(/^\[|\]$/g,'');
  return host==='localhost'||host==='127.0.0.1'||host==='::1';
}

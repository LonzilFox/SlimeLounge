export function createLeaderboardHttp({body,auth,json,verifiedOnly,limitUser,leaderboardPayload}){
  return async function handleLeaderboard(req,res,url){
    if(url.pathname!=='/api/leaderboards')return false;
    if(req.method!=='POST'){json(res,405,{ok:false,error:'Method Not Allowed'});return true}
    const b=await body(req),a=auth(b.userId,b.deviceId,b.deviceToken,req);
    if(!a){json(res,401,{ok:false,error:'设备身份无效'});return true}
    const gate=verifiedOnly(a);if(gate){json(res,403,{ok:false,error:gate});return true}
    if(!limitUser(a,'leaderboards',30,60000,req)){json(res,429,{ok:false,error:'排行榜刷新过快'});return true}
    json(res,200,{ok:true,leaderboards:leaderboardPayload()});return true
  }
}

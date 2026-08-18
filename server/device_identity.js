export function createDeviceIdentity({sha,token,cookieSecure=false,scheduleSave=()=>{}}){
  function cookieMap(req){const out={};for(const part of String(req?.headers?.cookie||'').split(';')){const i=part.indexOf('=');if(i<1)continue;try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}catch{}}return out}
  function setSessionCookie(res,deviceId,sessionKey){res.setHeader('set-cookie',`sl_session=${encodeURIComponent(deviceId+'.'+sessionKey)}; Path=/; Max-Age=315360000; HttpOnly; SameSite=Lax; Priority=High${cookieSecure?'; Secure':''}`)}
  function addDeviceToken(d,deviceToken){const h=sha(deviceToken);d.tokenHash=h;d.tokenHashes=[...new Set([...(d.tokenHashes||[]),h])].slice(-8)}
  function deviceTokenOk(d,deviceToken){const h=sha(deviceToken||'');return d.tokenHash===h||(Array.isArray(d.tokenHashes)&&d.tokenHashes.includes(h))}
  function sessionKeyOk(d,key){const h=sha(key||'');return !!d&&(d.sessionHash===h||(Array.isArray(d.sessionHashes)&&d.sessionHashes.includes(h)))}
  function sessionPair(req){const raw=cookieMap(req).sl_session||'',dot=raw.indexOf('.');return dot<1?null:{deviceId:raw.slice(0,dot),key:raw.slice(dot+1)}}
  function issueRecoveryCookie(d,res){const k=token(),h=sha(k);d.sessionHash=h;d.sessionHashes=[...new Set([...(d.sessionHashes||[]),h])].slice(-8);setSessionCookie(res,d.deviceId,k);scheduleSave();return k}
  function ensureRecoveryCookie(d,req,res){const p=sessionPair(req);if(p&&p.deviceId===d.deviceId&&sessionKeyOk(d,p.key))return false;issueRecoveryCookie(d,res);return true}
  return {cookieMap,addDeviceToken,deviceTokenOk,sessionKeyOk,sessionPair,issueRecoveryCookie,ensureRecoveryCookie};
}

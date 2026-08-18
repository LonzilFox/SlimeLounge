export function createDeviceProfile({clean,sha,requestIpInfo}){
  const clip=(v,n=96)=>clean(v,n);
  function normalizeDeviceInfo(info={}){
    const x=info&&typeof info==='object'?info:{};
    return {
      installIdHash:x.installId?sha(`install:${clip(x.installId,128)}`):'',
      platform:clip(x.platform,48),
      platformVersion:clip(x.platformVersion,48),
      architecture:clip(x.architecture,24),
      bitness:clip(x.bitness,12),
      model:clip(x.model,64),
      browser:clip(x.browser,48),
      language:clip(x.language,24),
      timeZone:clip(x.timeZone,64),
      screen:clip(x.screen,40),
      hardwareConcurrency:Number.isFinite(Number(x.hardwareConcurrency))?Math.max(0,Math.min(256,Math.floor(Number(x.hardwareConcurrency)))):0,
      deviceMemory:Number.isFinite(Number(x.deviceMemory))?Math.max(0,Math.min(1024,Number(x.deviceMemory))):0,
      maxTouchPoints:Number.isFinite(Number(x.maxTouchPoints))?Math.max(0,Math.min(64,Math.floor(Number(x.maxTouchPoints)))):0
    };
  }
  function applyDeviceMeta(d,req,info=null){
    if(!d)return d;
    const ip=requestIpInfo(req),n=normalizeDeviceInfo(info||{});
    d.lastIp=ip.clientIp||'';d.lastIpVersion=ip.ipVersion||0;d.lastForwardedFor=clip(ip.forwardedFor,240);d.lastProxyIp=clip(ip.proxyIp,80);
    d.lastHost=clip(req?.headers?.host||'',80);d.lastUserAgent=clip(req?.headers?.['user-agent']||'',180);
    for(const [k,v] of Object.entries(n))if(v!==''&&v!==0)d[k]=v;
    return d;
  }
  function devicePublic(d={}){
    return {deviceId:d.deviceId||'',label:d.label||'设备',createdAt:d.createdAt||0,lastSeenAt:d.lastSeenAt||0,lastIp:d.lastIp||'',lastIpVersion:d.lastIpVersion||0,lastForwardedFor:d.lastForwardedFor||'',lastProxyIp:d.lastProxyIp||'',lastHost:d.lastHost||'',lastUserAgent:d.lastUserAgent||'',localOwnerDevice:!!d.localOwnerDevice,platform:d.platform||'',platformVersion:d.platformVersion||'',architecture:d.architecture||'',bitness:d.bitness||'',model:d.model||'',browser:d.browser||'',language:d.language||'',timeZone:d.timeZone||'',screen:d.screen||'',hardwareConcurrency:d.hardwareConcurrency||0,deviceMemory:d.deviceMemory||0,maxTouchPoints:d.maxTouchPoints||0};
  }
  function findReusableDevice(devices,userId,{existingDeviceId='',installId=''}={}){
    const exact=devices[String(existingDeviceId||'')];if(exact&&exact.userId===userId)return exact;
    const h=installId?sha(`install:${clip(installId,128)}`):'';if(!h)return null;
    return Object.values(devices).filter(d=>d.userId===userId&&d.installIdHash===h).sort((a,b)=>(b.lastSeenAt||0)-(a.lastSeenAt||0))[0]||null;
  }
  return {normalizeDeviceInfo,applyDeviceMeta,devicePublic,findReusableDevice};
}

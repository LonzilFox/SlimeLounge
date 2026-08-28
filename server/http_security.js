import path from 'node:path';
import net from 'node:net';

export function createHttpSecurity({trustProxy=false,publicOrigin='',rateBuckets=new Map(),trustedProxyIps=''}){
  const normIp=v=>String(v||'').trim().replace(/^for=/i,'').replace(/^"|"$/g,'').replace(/^\[|\]$/g,'').replace(/^::ffff:/i,'').replace(/:\d+$/,'');
  const explicitTrusted=new Set(String(trustedProxyIps||'').split(/[;,\s]+/).map(normIp).filter(Boolean));
  const isTrustedProxySource=ip=>!!ip&&(ip==='::1'||ip==='127.0.0.1'||explicitTrusted.has(ip));
  function requestIpInfo(req){
    const socketIp=normIp(req?.socket?.remoteAddress||''),canTrust=!!trustProxy&&isTrustedProxySource(socketIp);
    const forwarded=canTrust?String(req?.headers?.['x-forwarded-for']||'').split(',').map(normIp).filter(x=>net.isIP(x)):[];
    const realIp=canTrust?normIp(req?.headers?.['x-real-ip']||''):'';
    const candidates=[...forwarded,realIp].filter(x=>net.isIP(x));
    const preferredV4=candidates.find(x=>net.isIP(x)===4),clientIp=preferredV4||candidates[0]||socketIp;
    return {clientIp,ipVersion:net.isIP(clientIp)||0,forwardedFor:forwarded.join(', '),proxyIp:socketIp,proxyTrusted:canTrust};
  }
  function requestIp(req){return requestIpInfo(req).clientIp}
  function applySecurityHeaders(res){
    res.setHeader('x-content-type-options','nosniff');res.setHeader('x-frame-options','DENY');res.setHeader('referrer-policy','no-referrer');
    res.setHeader('permissions-policy','microphone=(self), camera=(), geolocation=(), payment=(), usb=()');
    res.setHeader('cross-origin-opener-policy','same-origin');res.setHeader('cross-origin-resource-policy','same-origin');res.setHeader('x-permitted-cross-domain-policies','none');
    if(String(publicOrigin).startsWith('https://'))res.setHeader('strict-transport-security','max-age=15552000; includeSubDomains');
    res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' ws: wss: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  }
  function rateLimitSubject(subject,key,limit,windowMs){const now=Date.now(),k=`${String(subject||'unknown')}|${key}`,arr=(rateBuckets.get(k)||[]).filter(x=>now-x<windowMs);if(arr.length>=limit){rateBuckets.set(k,arr);return false}arr.push(now);rateBuckets.set(k,arr);if(rateBuckets.size>10000)for(const [rk,rv] of rateBuckets)if(!rv.length||now-rv.at?.(-1)>windowMs*2)rateBuckets.delete(rk);return true}
  function rateLimit(req,key,limit,windowMs){return rateLimitSubject(`ip:${requestIp(req)}`,key,limit,windowMs)}
  function sameOriginWs(req){const origin=String(req.headers.origin||'');if(!origin)return true;try{const o=new URL(origin),host=String(req.headers.host||'').toLowerCase();if(publicOrigin&&origin.replace(/\/$/,'')===publicOrigin)return true;return o.host.toLowerCase()===host}catch{return false}}
  function json(res,status,obj){applySecurityHeaders(res);const payload=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(payload),'cache-control':'no-store'});res.end(payload)}
  function body(req,max=65536){return new Promise((resolve,reject)=>{let size=0,ch=[],tooLarge=false;const fail=(msg,status)=>{const e=Error(msg);e.statusCode=status;reject(e)},safe=(x,d=0)=>{if(d>8)throw Error('JSON 嵌套过深');if(typeof x==='string'&&x.length>16000)throw Error('字符串字段过长');if(Array.isArray(x)){if(x.length>256)throw Error('数组字段过长');for(const v of x)safe(v,d+1)}else if(x&&typeof x==='object'){const ks=Object.keys(x);if(ks.length>128)throw Error('对象字段过多');for(const k of ks){if(['__proto__','prototype','constructor'].includes(k))throw Error('非法字段名');safe(x[k],d+1)}}};req.on('data',c=>{size+=c.length;if(size>max){tooLarge=true;ch=[];return}if(!tooLarge)ch.push(c)});req.on('end',()=>{if(tooLarge)return fail('请求体过大',413);try{const x=ch.length?JSON.parse(Buffer.concat(ch).toString('utf8')):{};if(!x||typeof x!=='object'||Array.isArray(x))return fail('JSON 请求体必须是对象',400);safe(x);resolve(x)}catch(e){fail(e.message==='JSON 嵌套过深'||e.message==='字符串字段过长'||e.message==='数组字段过长'||e.message==='对象字段过多'||e.message==='非法字段名'?e.message:'JSON 格式无效',400)}});req.on('error',reject)})}
  function contentType(f){return ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'})[path.extname(f)]||'application/octet-stream'}
  function canonicalRedirectTarget(req,url){if(!publicOrigin||!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/api/'))return '';const host=String(req.headers.host||'').toLowerCase();if(['localhost','127.0.0.1','[::1]'].some(x=>host===x||host.startsWith(`${x}:`)))return '';try{const target=new URL(publicOrigin),hosts=[req.headers.host,req.headers['x-forwarded-host']].filter(Boolean).flatMap(v=>String(v).split(',')).map(v=>v.trim().toLowerCase());if(hosts.includes(target.host.toLowerCase()))return '';return `${publicOrigin}${url.pathname}${url.search}`}catch{return ''}}
  return {requestIp,requestIpInfo,applySecurityHeaders,rateLimit,rateLimitSubject,sameOriginWs,json,body,contentType,canonicalRedirectTarget};
}

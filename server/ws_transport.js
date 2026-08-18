export function createWsTransport({sameOriginWs,rateLimit,diagnostics,wsAccept,parse,remove}){
  return function handleWsUpgrade(req,socket){try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname!=='/api/ws')return socket.destroy();
    if(!sameOriginWs(req)||String(req.headers['sec-websocket-version']||'13')!=='13'){diagnostics.wsDenied('origin/version',req);return socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')}
    if(!rateLimit(req,'ws-upgrade-hard',900,60000)){diagnostics.noteRateLimit(req,'ws-upgrade-hard','ip');diagnostics.wsDenied('ip-hard-rate',req);return socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n')}
    const key=req.headers['sec-websocket-key'];if(!key){diagnostics.wsDenied('missing-key',req);return socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')}
    socket.write(['HTTP/1.1 101 Switching Protocols','Upgrade: websocket','Connection: Upgrade',`Sec-WebSocket-Accept: ${wsAccept(key)}`,'',''].join('\r\n'));socket.setKeepAlive?.(true,10000);socket.setNoDelay?.(true);
    // Authentication is deliberately the first WebSocket message, not a URL query parameter.
    // Tailscale Serve/Funnel has had regressions where WebSocket query parameters are stripped.
    const c={socket,req,buf:Buffer.alloc(0),closed:false,countedWs:false,awaitingAuth:true,userId:'',deviceId:'',roomId:'',tabId:'',voiceOn:false,voiceSpeaking:false,authTimer:null,connectedAt:0};
    c.authTimer=setTimeout(()=>{if(c.awaitingAuth&&!c.closed){diagnostics.clientEvent(req,null,null,'ws-auth-timeout','WebSocket 建连后 8 秒内未收到认证首帧');diagnostics.wsDenied('auth-timeout',req);try{socket.destroy()}catch{}}},8000);c.authTimer.unref?.();
    socket.on('data',ch=>parse(c,ch));socket.on('close',()=>remove(c));socket.on('end',()=>remove(c));socket.on('error',()=>remove(c));
  }catch(e){console.error('[WS]',e);try{socket.destroy()}catch{}}}
}

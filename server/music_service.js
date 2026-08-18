import {Readable} from 'node:stream';

export function createMusicService({clean,proxyMode,qqCookieForUser,neteaseCookieForUser,qqUin,sha,json}){
  const musicCache=new Map();
  const abortAfter=(ctrl,ms,label='music request timeout')=>setTimeout(()=>{if(ctrl.signal.aborted)return;const e=Object.assign(new Error(label),{name:'TimeoutError'});try{ctrl.abort(e)}catch{}},ms);
  const wasAborted=(e,ctrl)=>!!(ctrl?.signal?.aborted||e?.name==='AbortError'||e?.name==='TimeoutError'||/signal is aborted|aborted|aborterror|timeout/i.test(String(e?.message||'')));
  function musicNorm(v){return String(v||'').toLowerCase().normalize('NFKC').replace(/[\s\-_.·•—–_()（）\[\]【】'"“”‘’]/g,'')}
  function diceSimilarity(a,b){a=musicNorm(a);b=musicNorm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.length<2||b.length<2)return a===b?1:0;const grams=new Map();for(let i=0;i<a.length-1;i++){const g=a.slice(i,i+2);grams.set(g,(grams.get(g)||0)+1)}let hit=0;for(let i=0;i<b.length-1;i++){const g=b.slice(i,i+2),n=grams.get(g)||0;if(n){hit++;grams.set(g,n-1)}}return 2*hit/((a.length-1)+(b.length-1))}
  function musicScore(song,query){const q=musicNorm(query),name=musicNorm(song.name),artists=(song.artists||[]).map(musicNorm),album=musicNorm(song.album);if(!q)return 0;let score=0;if(name===q)score=1200;else if(name.startsWith(q))score=950;else if(name.includes(q))score=850;for(const a of artists){if(a===q)score=Math.max(score,900);else if(a.startsWith(q))score=Math.max(score,760);else if(a.includes(q))score=Math.max(score,700)}if(album===q)score=Math.max(score,500);else if(album.includes(q))score=Math.max(score,380);const sim=Math.max(diceSimilarity(name,q),...artists.map(a=>diceSimilarity(a,q)),diceSimilarity(album,q));score=Math.max(score,Math.round(sim*650));return score}
  function rankMusicResults(songs,query){const ranked=songs.map((song,index)=>({...song,_score:musicScore(song,query),_index:index})).sort((a,b)=>b._score-a._score||a._index-b._index);const matched=ranked.filter(x=>x._score>=80).slice(0,12),picked=matched.length?matched:ranked.slice(0,12);return {fallback:matched.length===0&&picked.length>0,results:picked.map(({_score,_index,...x})=>({...x,matchScore:_score}))}}
  async function searchNetease(q){
    const query=clean(q,80);if(!query)return [];const key=query.toLowerCase(),hit=musicCache.get(key);if(hit&&Date.now()-hit.at<300000)return hit.results;
    let base=String(process.env.NETEASE_SEARCH_BASE||'').trim().replace(/\/$/,'');if(base&&!/^https?:\/\//i.test(base))base='https://'+base;const directNetease=/^https?:\/\/(?:www\.)?music\.163\.com$/i.test(base);const urls=base&&!directNetease?[`${base}/search?keywords=${encodeURIComponent(query)}&limit=30`]:[`https://music.163.com/api/search/get/web?csrf_token=hlpretag=&hlposttag=&s=${encodeURIComponent(query)}&type=1&offset=0&total=true&limit=50`,`https://music.163.com/api/search/get?s=${encodeURIComponent(query)}&type=1&limit=50&offset=0`,`https://music.163.com/api/cloudsearch/pc?s=${encodeURIComponent(query)}&type=1&limit=50&offset=0`];
    const ctrl=new AbortController(),timer=abortAfter(ctrl,6500,'music search timeout');const attempt=async u=>{const r=await fetch(u,{signal:ctrl.signal,headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36','referer':'https://music.163.com/','accept':'application/json,text/plain,*/*'}});if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json(),songs=j?.result?.songs||j?.result?.song?.songs||[];if(!songs.length)throw Error('没有搜索结果');return rankMusicResults(songs.map(x=>({id:String(x.id),name:x.name||'未知歌曲',artists:(x.artists||x.ar||[]).map(a=>a.name).filter(Boolean),album:x.album?.name||x.al?.name||'',duration:x.duration||x.dt||0,cover:String(x.album?.picUrl||x.al?.picUrl||'').startsWith('http')?String(x.album?.picUrl||x.al?.picUrl||''):'',fee:Number(x.fee??0)})),query)};
    try{const ranked=await Promise.any(urls.map(attempt));musicCache.set(key,{at:Date.now(),results:ranked});return ranked}catch(e){if(ctrl.signal.aborted){const mode=proxyMode();throw Error(`网易云搜索超时（6.5 秒） · 出网模式 ${mode}。${mode==='pac-detected'?'检测到 Windows PAC，但 Node.js 不能直接解析 PAC；请配置显式 HTTPS_PROXY。':mode==='direct'?'Node 当前未检测到代理；如果浏览器依赖公司代理访问外网，请用 run_local.bat 自动导入 Windows 代理。':'已通过代理尝试访问网易云，仍然超时。'}`)}const first=e?.errors?.[0]||e;throw Error('网易云搜索失败：'+(first?.message||'网络不可达'))}finally{clearTimeout(timer)}
  }


  const qqMusicCache=new Map(),qqAudioCache=new Map(),qqVerifiedCache=new Map();
  async function searchQQ(q){
    const query=clean(q,80);if(!query)return {fallback:false,results:[]};const key=query.toLowerCase(),hit=qqMusicCache.get(key);if(hit&&Date.now()-hit.at<300000)return hit.results;
    const u=`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=1&n=40&w=${encodeURIComponent(query)}&new_json=1&format=json`;
    const ctrl=new AbortController(),timer=abortAfter(ctrl,6500,'music search timeout');try{const r=await fetch(u,{signal:ctrl.signal,headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36','referer':'https://y.qq.com/','accept':'application/json,text/plain,*/*'}});if(!r.ok)throw Error(`HTTP ${r.status}`);const txt=await r.text(),a=txt.indexOf('{'),b=txt.lastIndexOf('}');if(a<0||b<a)throw Error('QQ音乐返回格式异常');const j=JSON.parse(txt.slice(a,b+1)),songs=j?.data?.song?.list||[];if(!songs.length)throw Error('没有搜索结果');const ranked=rankMusicResults(songs.map(x=>{const mid=String(x.mid||x.songmid||''),mediaId=String(x.file?.media_mid||x.file?.mediaMid||mid),albumMid=String(x.album?.mid||x.albummid||'');return {provider:'qq',id:mid,mediaId,name:x.name||x.songname||'未知歌曲',artists:(x.singer||[]).map(a=>a.name).filter(Boolean),album:x.album?.name||x.albumname||'',duration:Number(x.interval||0)*1000,cover:albumMid?`https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg`:'',fee:Number(x.pay?.pay_play||x.pay?.paydownload||0)}}),query);qqMusicCache.set(key,{at:Date.now(),results:ranked});return ranked}catch(e){throw Error('QQ音乐搜索失败：'+(wasAborted(e,ctrl)?'请求超时':e.message))}finally{clearTimeout(timer)}}
  function qqHeaders(cookie=''){const h={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36','referer':'https://y.qq.com/','origin':'https://y.qq.com','accept':'application/json,text/plain,*/*'};if(cookie)h.cookie=cookie;return h}
  async function qqPlayerUrls(songMid,mediaId='',userId=''){
    const mid=String(songMid||'').match(/^[A-Za-z0-9]{6,32}$/)?.[0],media=String(mediaId||mid).match(/^[A-Za-z0-9]{6,32}$/)?.[0]||mid;if(!mid)return[];const cookie=qqCookieForUser(userId),cacheKey=`${userId||'anon'}:${mid}:${media}`,hit=qqAudioCache.get(cacheKey);if(hit&&Date.now()-hit.at<5*60*1000)return hit.urls;const uin=qqUin(cookie),guid=String(BigInt('0x'+sha(`${mid}:${userId||'anon'}`).slice(0,13))%9000000000n+1000000000n);const qualities=[['M800',`${media}.mp3`],['M500',`${media}.mp3`],['C400',`${media}.m4a`]],out=[];
    for(const [prefix,suffix] of qualities){const filename=`${prefix}${suffix}`,payload={req:{module:'CDN.SrfCdnDispatchServer',method:'GetCdnDispatch',param:{guid,calltype:0,userip:''}},req_0:{module:'vkey.GetVkeyServer',method:'CgiGetVkey',param:{guid,songmid:[mid],songtype:[0],uin:String(uin),loginflag:1,platform:'20',filename:[filename]}},comm:{uin:Number(uin)||0,format:'json',ct:24,cv:0}};let j=null;const ctrl=new AbortController(),timer=abortAfter(ctrl,4000,'music vkey timeout');try{let r=await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',signal:ctrl.signal,headers:{...qqHeaders(cookie),'content-type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)r=await fetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify(payload))}`,{signal:ctrl.signal,headers:qqHeaders(cookie)});if(r.ok)j=await r.json()}catch{}finally{clearTimeout(timer)}const info=j?.req_0?.data?.midurlinfo?.[0],purl=String(info?.purl||''),sips=j?.req?.data?.sip||j?.req_0?.data?.sip||[];if(purl){if(/^https?:\/\//i.test(purl))out.push(purl);else for(const sip of sips)if(/^https?:\/\//i.test(String(sip||'')))out.push(String(sip)+purl)}}
    const urls=[...new Set(out)];qqAudioCache.set(cacheKey,{at:Date.now(),urls});return urls}
  async function verifyQQCandidate(url,timeout=8000,cookie=''){const ctrl=new AbortController(),timer=abortAfter(ctrl,timeout,'music probe timeout'),headers={...qqHeaders(cookie),'accept':'audio/mpeg,audio/*;q=0.9,*/*;q=0.5','range':'bytes=0-8191'};try{const r=await fetch(url,{signal:ctrl.signal,redirect:'follow',headers}),ct=String(r.headers.get('content-type')||'').toLowerCase();if(!(r.ok||r.status===206)||!r.body){try{await r.body?.cancel()}catch{}return {ok:false,error:`QQ音乐音源不可用（HTTP ${r.status}）`}}if(ct.includes('text/html')||ct.includes('application/json')||ct.includes('text/plain')){try{await r.body.cancel()}catch{}return {ok:false,error:'QQ音乐返回网页/接口内容，不是音频（可能需要登录/VIP或受版权限制）'}}const bytes=await readProbeBytes(r.body,8192);if(!audioSignature(bytes,ct))return {ok:false,error:'QQ音乐响应不是可识别音频（可能需要登录/VIP或受版权限制）'};return {ok:true,url:r.url||url,contentType:ct||'audio/mpeg',source:'qq-vkey'}}catch(e){return {ok:false,error:wasAborted(e,ctrl)?'QQ音乐音频探测超时':'QQ音乐音频源连接失败'}}finally{clearTimeout(timer)}}
  async function findPlayableQQAudio(songMid,mediaId='',{timeout=8000,force=false,userId=''}={}){const mid=String(songMid||''),media=String(mediaId||mid),cacheKey=`${userId||'anon'}:${mid}:${media}`,cookie=qqCookieForUser(userId),hit=qqVerifiedCache.get(cacheKey);if(!force&&hit&&Date.now()-hit.at<4*60*1000)return {...hit,ok:true};const urls=await qqPlayerUrls(mid,media,userId);let last=cookie?'该歌曲在已绑定 QQ 音乐账号下仍无可播放音源':'该歌曲当前没有可直接播放的 QQ 音乐音源';for(const url of urls){const x=await verifyQQCandidate(url,timeout,cookie);if(x.ok){const v={...x,at:Date.now(),accountLinked:!!cookie};qqVerifiedCache.set(cacheKey,v);return v}last=x.error||last}qqVerifiedCache.delete(cacheKey);return {ok:false,error:last}}
  async function probeQQAudio(id,mediaId='',userId=''){const mid=String(id||'').match(/^[A-Za-z0-9]{6,32}$/)?.[0];if(!mid)return {ok:false,error:'QQ音乐歌曲 MID 无效'};const x=await findPlayableQQAudio(mid,mediaId,{userId});return x.ok?{ok:true,contentType:x.contentType,source:x.source,verified:true,accountLinked:!!x.accountLinked}:{ok:false,error:x.error}}
  async function proxyQQAudio(req,res,id,mediaId='',userId=''){const mid=String(id||'').match(/^[A-Za-z0-9]{6,32}$/)?.[0];if(!mid)return json(res,400,{ok:false,error:'QQ音乐歌曲 MID 无效'});const cookie=qqCookieForUser(userId);let found=await findPlayableQQAudio(mid,mediaId,{userId});if(!found.ok)return json(res,404,{ok:false,error:found.error});const fetchAudio=async info=>{const ctrl=new AbortController(),timer=abortAfter(ctrl,15000,'music audio timeout'),headers={...qqHeaders(cookie),'accept':'audio/mpeg,audio/*;q=0.9,*/*;q=0.5'};if(req.headers.range)headers.range=String(req.headers.range);try{return await fetch(info.url,{signal:ctrl.signal,redirect:'follow',headers})}finally{clearTimeout(timer)}};let r;try{r=await fetchAudio(found)}catch{qqVerifiedCache.delete(`${userId||'anon'}:${mid}:${mediaId||mid}`);found=await findPlayableQQAudio(mid,mediaId,{force:true,userId});if(!found.ok)return json(res,404,{ok:false,error:'已验证 QQ 音乐音源临时失效'});try{r=await fetchAudio(found)}catch{return json(res,502,{ok:false,error:'QQ音乐音频源连接失败'})}}const ct=String(r.headers.get('content-type')||found.contentType||'audio/mpeg').toLowerCase();if(!(r.ok||r.status===206)||!r.body||ct.includes('text/html')||ct.includes('application/json')){try{await r.body?.cancel()}catch{}return json(res,502,{ok:false,error:'QQ音乐音频源在播放时失效'})}const out={'content-type':ct||'audio/mpeg','cache-control':'private, max-age=60','accept-ranges':r.headers.get('accept-ranges')||'bytes','x-slimelounge-music-source':found.source,'x-slimelounge-audio-verified':'1'};for(const h of ['content-length','content-range','etag','last-modified']){const v=r.headers.get(h);if(v)out[h]=v}res.writeHead(r.status===206?206:200,out);Readable.fromWeb(r.body).on('error',()=>{try{res.destroy()}catch{}}).pipe(res)}


  const musicAudioCache=new Map(),musicVerifiedCache=new Map();
  function audioSignature(buf,contentType=''){
    const b=Buffer.from(buf||[]),ct=String(contentType||'').toLowerCase();if(b.length<4)return false;
    if(b.subarray(0,3).toString('ascii')==='ID3'||b.subarray(0,4).toString('ascii')==='fLaC'||b.subarray(0,4).toString('ascii')==='OggS')return true;
    if(b.length>=12&&b.subarray(0,4).toString('ascii')==='RIFF'&&b.subarray(8,12).toString('ascii')==='WAVE')return true;
    if(b.length>=12&&b.subarray(4,8).toString('ascii')==='ftyp')return true;
    for(let i=0;i<Math.min(b.length-1,2048);i++)if(b[i]===0xff&&((b[i+1]&0xe0)===0xe0))return true;
    return ct.startsWith('audio/')&&b.length>=64;
  }
  async function neteasePlayerUrls(songId,userId=''){
    const cacheKey=`${userId||'anon'}:${songId}`,hit=musicAudioCache.get(cacheKey);if(hit&&Date.now()-hit.at<5*60*1000)return hit.urls;
    const userCookie=neteaseCookieForUser(userId);const headers={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36','referer':'https://music.163.com/','accept':'application/json,text/plain,*/*','cookie':userCookie||'os=pc; appver=9.3.0;'};
    const apiUrls=[
      `https://music.163.com/api/song/enhance/player/url?ids=%5B${songId}%5D&br=320000`,
      `https://music.163.com/api/song/enhance/player/url?ids=%5B${songId}%5D&br=128000`,
      `https://music.163.com/api/song/enhance/player/url?ids=%5B${songId}%5D&br=64000`,
      `https://music.163.com/api/song/enhance/player/url/v1?ids=%5B${songId}%5D&level=standard&encodeType=mp3`,
      `https://music.163.com/api/song/enhance/player/url/v1?ids=%5B${songId}%5D&level=exhigh&encodeType=mp3`
    ];
    const out=[];
    for(const u of apiUrls){const ctrl=new AbortController(),timer=abortAfter(ctrl,3500,'music player-api timeout');try{const r=await fetch(u,{signal:ctrl.signal,headers});if(!r.ok)continue;const j=await r.json();const x=j?.data?.[0]?.url;if(/^https?:\/\//i.test(String(x||'')))out.push(String(x))}catch{}finally{clearTimeout(timer)}}
    out.push(`https://music.163.com/song/media/outer/url?id=${songId}.mp3`);out.push(`https://music.163.com/song/media/outer/url?id=${songId}`);
    const urls=[...new Set(out)];musicAudioCache.set(cacheKey,{at:Date.now(),urls});return urls;
  }
  async function readProbeBytes(body,max=8192){
    const reader=body.getReader(),chunks=[];let total=0;
    try{while(total<max){const {done,value}=await reader.read();if(done)break;if(value?.length){const b=Buffer.from(value);chunks.push(b);total+=b.length}}}finally{try{await reader.cancel()}catch{}}
    return Buffer.concat(chunks,total).subarray(0,max);
  }
  async function verifyNeteaseCandidate(url,timeout=8000,cookie=''){
    const ctrl=new AbortController(),timer=abortAfter(ctrl,timeout,'music probe timeout'),headers={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36','referer':'https://music.163.com/','accept':'audio/mpeg,audio/*;q=0.9,*/*;q=0.5','range':'bytes=0-8191'};if(cookie)headers.cookie=cookie;
    try{
      const r=await fetch(url,{signal:ctrl.signal,redirect:'follow',headers}),ct=String(r.headers.get('content-type')||'').toLowerCase();
      if(!(r.ok||r.status===206)||!r.body){try{await r.body?.cancel()}catch{}return {ok:false,error:`公开音源不可用（HTTP ${r.status}）`}}
      if(ct.includes('text/html')||ct.includes('application/json')||ct.includes('text/plain')){try{await r.body.cancel()}catch{}return {ok:false,error:'公开地址返回的是网页/接口内容，不是音频（可能需要登录、会员或受版权限制）'}}
      const bytes=await readProbeBytes(r.body,8192);if(!audioSignature(bytes,ct))return {ok:false,error:'公开地址响应成功，但返回的不是可识别音频文件（可能需要登录、会员或受版权限制）'};
      return {ok:true,url:r.url||url,contentType:ct||'audio/mpeg',source:url.includes('/outer/url')?'outer-url':'player-api'};
    }catch(e){return {ok:false,error:wasAborted(e,ctrl)?'音频探测超时':'音频源连接失败'}}finally{clearTimeout(timer)}
  }
  async function findPlayableNeteaseAudio(songId,{timeout=8000,force=false,userId=''}={}){
    const cacheKey=`${userId||'anon'}:${songId}`,cookie=neteaseCookieForUser(userId),hit=musicVerifiedCache.get(cacheKey);if(!force&&hit&&Date.now()-hit.at<4*60*1000)return {...hit,ok:true};const urls=await neteasePlayerUrls(songId,userId);let last=cookie?'该歌曲在已绑定网易云账号下仍无可播放音源':'该歌曲当前没有可直接播放的公开音频源';for(const url of urls){const x=await verifyNeteaseCandidate(url,timeout,cookie);if(x.ok){const v={...x,at:Date.now(),accountLinked:!!cookie};musicVerifiedCache.set(cacheKey,v);return v}last=x.error||last}musicVerifiedCache.delete(cacheKey);return {ok:false,error:last};
  }
  async function probeNeteaseAudio(id,userId=''){
    const songId=String(id||'').match(/^\d{3,20}$/)?.[0];if(!songId)return {ok:false,error:'歌曲 ID 无效'};const x=await findPlayableNeteaseAudio(songId,{userId});return x.ok?{ok:true,contentType:x.contentType,source:x.source,verified:true,accountLinked:!!x.accountLinked}:{ok:false,error:x.error};
  }
  async function findPublicMusicFallback(query,excludeProvider=''){
    const q=clean(query,100);if(!q)return {ok:false,error:'缺少歌曲名称'};
    const providers=excludeProvider==='qq'?['netease']:excludeProvider==='netease'?['qq']:['netease','qq'];
    const errors=[];
    for(const provider of providers){
      try{
        const sr=provider==='qq'?await searchQQ(q):await searchNetease(q);
        for(const song of (sr.results||[]).slice(0,8)){
          const pr=provider==='qq'?await probeQQAudio(song.id,song.mediaId||'',''):await probeNeteaseAudio(song.id,'');
          if(pr.ok)return {ok:true,provider,result:{...song,provider},source:pr.source};
        }
      }catch(e){errors.push(e.message)}
    }
    return {ok:false,error:'网易云与 QQ 音乐的公开音源都没有找到可播放版本'+(errors.length?`：${errors.join(' / ')}`:'')};
  }
  async function proxyNeteaseAudio(req,res,id,userId=''){
    const songId=String(id||'').match(/^\d{3,20}$/)?.[0];if(!songId)return json(res,400,{ok:false,error:'歌曲 ID 无效'});const userCookie=neteaseCookieForUser(userId);let found=await findPlayableNeteaseAudio(songId,{timeout:8000,userId});if(!found.ok)return json(res,404,{ok:false,error:found.error||'该歌曲当前没有可直接播放的公开音频源'});
    const fetchAudio=async info=>{const ctrl=new AbortController(),timer=abortAfter(ctrl,15000,'music audio timeout'),headers={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36','referer':'https://music.163.com/','accept':'audio/mpeg,audio/*;q=0.9,*/*;q=0.5'};if(userCookie)headers.cookie=userCookie;if(req.headers.range)headers.range=String(req.headers.range);try{return await fetch(info.url,{signal:ctrl.signal,redirect:'follow',headers})}finally{clearTimeout(timer)}};
    let r;try{r=await fetchAudio(found)}catch{musicVerifiedCache.delete(`${userId||'anon'}:${songId}`);found=await findPlayableNeteaseAudio(songId,{force:true,userId});if(!found.ok)return json(res,404,{ok:false,error:'已验证音源临时失效'});try{r=await fetchAudio(found)}catch{return json(res,502,{ok:false,error:'音频源连接失败'})}}
    const ct=String(r.headers.get('content-type')||found.contentType||'audio/mpeg').toLowerCase();if(!(r.ok||r.status===206)||!r.body||ct.includes('text/html')||ct.includes('application/json')){musicVerifiedCache.delete(`${userId||'anon'}:${songId}`);try{await r.body?.cancel()}catch{}return json(res,502,{ok:false,error:'音频源在播放时失效'})}const out={'content-type':ct||'audio/mpeg','cache-control':'private, max-age=60','accept-ranges':r.headers.get('accept-ranges')||'bytes','x-slimelounge-music-source':found.source,'x-slimelounge-audio-verified':'1'};for(const h of ['content-length','content-range','etag','last-modified']){const v=r.headers.get(h);if(v)out[h]=v}res.writeHead(r.status===206?206:200,out);Readable.fromWeb(r.body).on('error',()=>{try{res.destroy()}catch{}}).pipe(res);
  }


  function clearProviderCache(provider){
    if(provider==='qq'){qqAudioCache.clear();qqVerifiedCache.clear();qqMusicCache.clear();return;}
    musicAudioCache.clear();musicVerifiedCache.clear();musicCache.clear();
  }
  return {searchNetease,searchQQ,probeQQAudio,proxyQQAudio,probeNeteaseAudio,findPublicMusicFallback,proxyNeteaseAudio,clearProviderCache};
}

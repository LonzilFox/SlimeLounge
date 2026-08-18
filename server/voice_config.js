export function voiceIceServersFromEnv(env=process.env){
  const out=[
    {urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}
  ];
  const urls=String(env.SLIMELOUNGE_TURN_URLS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(urls.length){
    const item={urls};
    const username=String(env.SLIMELOUNGE_TURN_USERNAME||'').trim(),credential=String(env.SLIMELOUNGE_TURN_CREDENTIAL||'');
    if(username)item.username=username;
    if(credential)item.credential=credential;
    out.push(item);
  }
  return out;
}

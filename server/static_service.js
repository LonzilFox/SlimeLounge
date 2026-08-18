import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function etagFor(st){return `W/\"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}\"`}
function acceptsGzip(req){return /(?:^|,)\s*gzip\s*(?:,|$)/i.test(String(req.headers['accept-encoding']||''))}
function textLike(type){return /^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i.test(type)}
export function createStaticService({publicDir,contentType,applySecurityHeaders,version}){
  return function serveStatic(req,res,url){
    let p;try{p=decodeURIComponent(url.pathname)}catch{p='/index.html'}if(p==='/')p='/index.html';
    const requested=path.normalize(path.join(publicDir,p));if(!requested.startsWith(publicDir))return false;
    fs.stat(requested,(err,st)=>{
      const fallback=path.join(publicDir,'index.html'),file=!err&&st.isFile()?requested:fallback;
      fs.stat(file,(e,realSt)=>{
        if(e||!realSt.isFile()){applySecurityHeaders(res);res.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});return res.end('Not found')}
        const type=contentType(file),tag=etagFor(realSt),isHtml=/\.html$/i.test(file),versioned=url.searchParams.get('v')===String(version||'');
        applySecurityHeaders(res);res.setHeader('content-type',type);res.setHeader('etag',tag);res.setHeader('last-modified',realSt.mtime.toUTCString());res.setHeader('vary','Accept-Encoding');
        res.setHeader('cache-control',isHtml?'no-cache':versioned?'public, max-age=31536000, immutable':'public, max-age=300, must-revalidate');
        if(req.headers['if-none-match']===tag){res.writeHead(304);return res.end()}
        const ims=Date.parse(String(req.headers['if-modified-since']||''));if(Number.isFinite(ims)&&Math.floor(realSt.mtimeMs/1000)*1000<=ims){res.writeHead(304);return res.end()}
        const gzip=textLike(type)&&realSt.size>1024&&acceptsGzip(req);if(gzip){res.setHeader('content-encoding','gzip');res.writeHead(200);const gz=zlib.createGzip({level:6});gz.on('error',()=>{try{res.destroy()}catch{}});return fs.createReadStream(file).pipe(gz).pipe(res)}
        res.setHeader('content-length',realSt.size);res.writeHead(200);fs.createReadStream(file).pipe(res);
      });
    });return true;
  }
}

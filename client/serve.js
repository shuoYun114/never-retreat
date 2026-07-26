'use strict';
// 客户端静态文件服务（默认 18081）。只读发布 client/ 目录，不参与任何游戏逻辑。
// 用法： PORT=18081 node serve.js
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname,PORT=Number(process.env.PORT||18081),HOST=process.env.HOST||'0.0.0.0';
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{
 let p='/';
 try{p=decodeURIComponent(new URL(req.url,'http://x').pathname)}catch{}
 if(p.endsWith('/'))p+='index.html';
 const f=path.resolve(ROOT,'.'+p);
 // 目录穿越防护：解析后的路径必须还在 client/ 里
 if(f!==ROOT&&!f.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 fs.stat(f,(e,st)=>{
  if(e||st.isDirectory()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(f).on('error',()=>res.end()).pipe(res);
 });
}).listen(PORT,HOST,()=>console.log(`Never Retreat client on http://${HOST}:${PORT}`));

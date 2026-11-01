import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('build/www');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.json':'application/json', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.woff2':'font/woff2', '.ttf':'font/ttf' };
http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p==='/') p='/index.html';
  const f = path.join(ROOT,p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
}).listen(8899, '127.0.0.1', ()=>console.log('serving on 8899'));

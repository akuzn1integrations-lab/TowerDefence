// Минимальный сервер без зависимостей для ES Modules. Только для локальной разработки.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, extname } from 'node:path';
const ROOT=dirname(fileURLToPath(import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const port=Number(process.env.PORT)||4173;
createServer(async(req,res)=>{
  const path=decodeURIComponent((req.url||'/').split('?')[0]);
  const absolute=resolve(ROOT,'.'+path.replace(/\/$/,'/index.html'));
  const rel=relative(ROOT,absolute);
  if(rel.startsWith('..') || rel.startsWith('/') || rel==='package.json' || rel==='server.js' || rel.startsWith('tests/')) {
    res.writeHead(403);res.end('Forbidden');return;
  }
  try {
    const info=await stat(absolute);
    if(!info.isFile())throw new Error('Not a file');
    const content=await readFile(absolute);
    res.writeHead(200,{'Content-Type':MIME[extname(absolute)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(content);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,()=>console.log('TowerDefence: http://localhost:'+port));

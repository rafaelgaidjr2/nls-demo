const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const bytes = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Construction Hub: http://localhost:${port}`));

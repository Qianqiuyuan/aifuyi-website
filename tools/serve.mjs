#!/usr/bin/env node
/* Zero-dependency static server for local preview.
   Usage:  node tools/serve.mjs [port]
   Why not just double-click index.html?  You can — the site has no fetch calls.
   This server exists so you get clean URLs, correct MIME types and no browser
   caching, which matters the moment you start editing CSS.                     */

import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const clean = normalize(decoded).replace(/^([/\\])+/, '');
  const full = join(ROOT, clean);
  /* Refuse to serve anything outside the project root. */
  if (!full.startsWith(ROOT)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  let target = safePath(req.url || '/');
  if (!target) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 — outside project root');
    return;
  }

  try {
    let info = await stat(target);
    if (info.isDirectory()) {
      target = join(target, 'index.html');
      info = await stat(target);
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      /* No caching while editing — reload always shows the current file. */
      'Cache-Control': 'no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
  } catch (err) {
    const code = err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 404 : 500;
    res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
    if (code === 404) {
      res.end(
        '<!doctype html><meta charset="utf-8"><title>404</title>' +
        '<body style="font:16px/1.6 system-ui;padding:48px;color:#111">' +
        '<h1 style="margin:0 0 8px">404</h1>' +
        '<p style="color:#555">' + (req.url || '').replace(/[<>&]/g, '') + ' not found.</p>' +
        '<p><a href="/" style="color:#FF5A1F">Back to the site</a></p></body>'
      );
    } else {
      res.end('500 — ' + err.message);
    }
  }
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

/* Bind to 0.0.0.0, not 127.0.0.1: a loopback-only socket is unreachable from a
   phone on the same Wi-Fi, which looks exactly like a firewall block.          */
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  AIFUYI site  →  http://127.0.0.1:' + PORT + '/');
  for (const ip of lanAddresses()) {
    console.log('  on your phone →  http://' + ip + ':' + PORT + '/');
  }
  console.log('  serving      ' + ROOT);
  console.log('  stop with    Ctrl+C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is busy. Try:  node tools/serve.mjs 5174');
    process.exit(1);
  }
  throw err;
});

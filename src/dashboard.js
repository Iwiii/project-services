'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createServer(options = {}) {
  const core = options.core || require('./core');
  const token = crypto.randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(value));
    };
    const port = server.address()?.port;
    const expectedHost = `127.0.0.1:${port}`;
    const expectedOrigin = `http://${expectedHost}`;
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== expectedOrigin)) return send(403, { error: 'Invalid Host or Origin' });
    if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return send(403, { error: 'Cross-site request rejected' });
    const url = new URL(req.url, expectedOrigin);
    try {
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const [services, discovered] = await Promise.all([core.listServices(), core.discoverServices()]);
        return send(200, { services, discovered, csrfToken: token });
      }
      if (req.method === 'GET' && url.pathname === '/api/logs') return send(200, { logs: await core.serviceLogs(url.searchParams.get('key')) });
      if (req.method === 'POST' && ['/api/action', '/api/associate'].includes(url.pathname)) {
        if (req.headers['x-csrf-token'] !== token) return send(403, { error: 'Invalid CSRF token' });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415, { error: 'JSON required' });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16384) return send(413, { error: 'Request too large' }); }
        let body;
        try { body = JSON.parse(raw); } catch { return send(400, { error: 'Invalid JSON' }); }
        if (url.pathname === '/api/action') {
          if (typeof body.key !== 'string' || !['stop', 'restart'].includes(body.action)) return send(400, { error: 'Invalid action' });
          return send(200, { result: await core.actionService(body.key, body.action) });
        }
        if (!Number.isSafeInteger(body.pid) || body.pid <= 0 || typeof body.workspace !== 'string' || !body.workspace.trim()) return send(400, { error: 'PID and workspace required' });
        return send(200, { result: await core.associateService(body.pid, body.workspace) });
      }
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(url.pathname)) {
        const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const type = { 'index.html': 'text/html', 'app.js': 'application/javascript', 'style.css': 'text/css' }[name];
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' });
        return res.end(fs.readFileSync(path.join(__dirname, 'public', name)));
      }
      send(404, { error: 'Not found' });
    } catch (error) { send(400, { error: error.message || 'Request failed' }); }
  });
  return server;
}
async function startDashboard(options = {}) {
  const server = createServer(options);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}`;
  (options.output || console.log)(`Dashboard: ${url}`);
  server.url = url;
  return server;
}
module.exports = { createServer, startDashboard };

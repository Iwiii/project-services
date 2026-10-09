'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../src/dashboard');

function boot() {
  const core = {
    listServices: async () => [{ key: 'svc', workspace: '/repo', service: 'web', status: 'running', pid: 42, address: 'http://127.0.0.1:3000', retained: true }],
    discoverServices: async () => [{ pid: 99, address: 'http://127.0.0.1:4000' }],
    actionService: async (key, action) => ({ key, action }),
    serviceLogs: async () => 'hello logs',
    associateService: async (pid, workspace) => ({ pid, workspace })
  };
  const server = createServer({ core });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
function request(server, path, opts = {}, body) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: opts.method || 'GET', headers: { Host: `127.0.0.1:${port}`, ...(opts.headers || {}) } }, r => { let data=''; r.on('data', c => data += c); r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: data, json: () => JSON.parse(data) })); });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}
test('loopback state endpoint returns managed and discovered services', async t => { const s = await boot(); t.after(() => s.close()); const r = await request(s, '/api/state'); assert.equal(r.status, 200); const j = r.json(); assert.equal(j.services[0].key, 'svc'); assert.equal(j.discovered[0].pid, 99); assert.ok(j.csrfToken); });
test('rejects invalid Host and cross-origin requests', async t => { const s = await boot(); t.after(() => s.close()); const badHost = await request(s, '/api/state', { headers: { Host: 'evil.example' } }); assert.equal(badHost.status, 403); const cross = await request(s, '/api/state', { headers: { Origin: 'https://evil.example' } }); assert.equal(cross.status, 403); });
test('rejects mutations without CSRF and validates action input', async t => { const s = await boot(); t.after(() => s.close()); const noToken = await request(s, '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, JSON.stringify({ key: 'svc', action: 'stop' })); assert.equal(noToken.status, 403); const state = await request(s, '/api/state'); const token = state.json().csrfToken; const invalid = await request(s, '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token } }, JSON.stringify({ key: 'svc', action: 'exec' })); assert.equal(invalid.status, 400); });
test('accepts valid action and rejects malformed association payload', async t => { const s = await boot(); t.after(() => s.close()); const token = (await request(s, '/api/state')).json().csrfToken; const ok = await request(s, '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token } }, JSON.stringify({ key: 'svc', action: 'restart' })); assert.equal(ok.status, 200); const malformed = await request(s, '/api/associate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token } }, JSON.stringify({ pid: -1, workspace: '' })); assert.equal(malformed.status, 400); });
test('serves dashboard assets with security headers', async t => { const s = await boot(); t.after(() => s.close()); const r = await request(s, '/'); assert.equal(r.status, 200); assert.match(r.headers['content-security-policy'], /default-src 'self'/); assert.match(r.body, /Project services/); });

const fs = require('node:fs');
const { spawn } = require('node:child_process');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const child = spawn(spec.command[0], spec.command.slice(1), { cwd: spec.cwd, env: { ...process.env, ...spec.env }, stdio: 'inherit', detached: process.platform !== 'win32' });
function forward(signal) { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); } catch {} }
process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { forward('SIGTERM'); process.exitCode = code ?? (signal ? 1 : 0); });

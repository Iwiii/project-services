#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const home = process.env.PORT_MANAGER_HOME || path.join(os.homedir(), '.project-services');
const registryPath = path.join(home, 'services.json');
function resolvePm2() {
  if (process.env.PORT_MANAGER_PM2_BIN) return process.env.PORT_MANAGER_PM2_BIN;
  try { return require.resolve('pm2/bin/pm2'); } catch { return 'pm2'; }
}

const pm2 = resolvePm2();

function fail(message, code = 1) {
  console.error(message);
  process.exitCode = code;
}

function json(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { services: {} };
    throw error;
  }
}

function writeRegistry(registry) {
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  const temp = `${registryPath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, registryPath);
}

function workspace() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

function pm2Json(args) {
  const output = execFileSync(pm2, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output);
}

function pm2Name(workspacePath, serviceName) {
  const base = path.basename(workspacePath).replace(/[^a-zA-Z0-9_-]/g, '-');
  const name = serviceName.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `project-services:${base}:${name}`;
}

function parseStart(args) {
  const separator = args.indexOf('--');
  if (separator < 0 || !args[0] || separator === args.length - 1) {
    throw new Error('用法: project-services start <服务名> [--temporary] [--json] -- <启动命令>');
  }
  return {
    serviceName: args[0],
    temporary: args.includes('--temporary'),
    asJson: args.includes('--json'),
    command: args.slice(separator + 1).join(' '),
  };
}

function start(args) {
  const options = parseStart(args);
  const cwd = process.cwd();
  const workspacePath = workspace();
  const key = `${workspacePath}::${options.serviceName}`;
  const processName = pm2Name(workspacePath, options.serviceName);
  const registry = readRegistry();
  const existing = registry.services[key];
  let processes = [];
  try { processes = pm2Json(['jlist']); } catch { /* PM2 may not be installed yet. */ }
  const running = processes.find((item) => item.name === processName && ['online', 'launching'].includes(item.pm2_env?.status));
  if (running) {
    const result = { action: 'existing', key, workspace: workspacePath, service: options.serviceName, processName, status: running.pm2_env.status, pid: running.pid, temporary: existing?.temporary ?? options.temporary };
    return options.asJson ? json(result) : console.log(`${options.serviceName} already running (${processName})`);
  }
  const startArgs = ['start', options.command, '--name', processName, '--cwd', cwd, '--time'];
  if (options.asJson) {
    execFileSync(pm2, startArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  } else {
    execFileSync(pm2, startArgs, { stdio: 'inherit' });
  }
  const entry = { key, workspace: workspacePath, cwd, service: options.serviceName, processName, command: options.command, temporary: options.temporary, managed: true, startedAt: new Date().toISOString() };
  registry.services[key] = entry;
  writeRegistry(registry);
  const result = { action: 'started', ...entry };
  options.asJson ? json(result) : console.log(`${options.serviceName} started as ${processName}`);
}

function list(args) {
  const asJson = args.includes('--json');
  const registry = readRegistry();
  let processes = [];
  try { processes = pm2Json(['jlist']); } catch { /* report registered services as unknown. */ }
  const items = Object.values(registry.services).map((entry) => {
    const process = processes.find((item) => item.name === entry.processName);
    return { ...entry, status: process?.pm2_env?.status || 'unknown', pid: process?.pid || null };
  });
  return asJson ? json(items) : items.forEach((item) => console.log(`${item.workspace} ${item.service} ${item.status} ${item.pid || '-'} ${item.processName}`));
}

function mutate(args, action) {
  const serviceName = args[0];
  if (!serviceName) throw new Error(`用法: project-services ${action} <服务名>`);
  const workspacePath = workspace();
  const key = `${workspacePath}::${serviceName}`;
  const entry = readRegistry().services[key];
  if (!entry) throw new Error(`当前工作区没有登记服务: ${serviceName}`);
  execFileSync(pm2, [action, entry.processName], { stdio: 'inherit' });
  if (action === 'delete') {
    const registry = readRegistry();
    delete registry.services[key];
    writeRegistry(registry);
  }
  console.log(`${serviceName} ${action} complete`);
}

function logs(args) {
  const serviceName = args[0];
  if (!serviceName) throw new Error('用法: project-services logs <服务名>');
  const entry = readRegistry().services[`${workspace()}::${serviceName}`];
  if (!entry) throw new Error(`当前工作区没有登记服务: ${serviceName}`);
  const child = spawn(pm2, ['logs', entry.processName, '--nostream', '--lines', '50'], { stdio: 'inherit' });
  child.on('exit', (code) => { process.exitCode = code || 0; });
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'start') start(args);
  else if (command === 'list') list(args);
  else if (command === 'stop' || command === 'restart' || command === 'delete') mutate(args, command);
  else if (command === 'logs') logs(args);
  else throw new Error('用法: project-services <start|list|stop|restart|delete|logs>');
} catch (error) {
  fail(error.message);
}

#!/usr/bin/env node

const fs = require('node:fs');
const statePath = process.env.FAKE_PM2_STATE;
if (process.env.FAKE_PM2_FAIL) process.exit(2);

function readState() {
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return { processes: [] }; }
}

function writeState(state) {
  fs.writeFileSync(statePath, `${JSON.stringify(state)}\n`);
}

function processFor(name, status = 'online') {
  return { name, pid: 1000 + name.length, pm2_env: { status } };
}

const args = process.argv.slice(2);
const command = args[0];
const state = readState();

if (command === 'jlist') {
  process.stdout.write(JSON.stringify(state.processes));
  process.exit(0);
}

if (command === '-v') {
  process.stdout.write('fake-pm2 1.0.0\n');
  process.exit(0);
}

if (command === 'start') {
  if (process.env.FAKE_PM2_START_DELAY) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.FAKE_PM2_START_DELAY));
  const name = args[args.indexOf('--name') + 1];
  if (!name) process.exit(2);
  state.processes = state.processes.filter((item) => item.name !== name);
  state.processes.push({ ...processFor(name), invocation: args });
  writeState(state);
  process.exit(0);
}

if (['stop', 'restart', 'delete'].includes(command)) {
  const name = args[1];
  const existing = state.processes.find((item) => item.name === name);
  if (command === 'delete') state.processes = state.processes.filter((item) => item.name !== name);
  else if (existing) existing.pm2_env.status = command === 'restart' ? 'online' : 'stopped';
  writeState(state);
  process.exit(0);
}

if (command === 'logs') {
  process.stdout.write('fake log line\n');
  process.exit(0);
}

process.exit(1);

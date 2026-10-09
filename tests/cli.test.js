const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'src', 'cli.js');
const fakePm2 = path.join(__dirname, 'fixtures', 'fake-pm2.js');
const temporaryDirectories = [];

test.after(() => {
  for (const dir of temporaryDirectories) fs.rmSync(dir, { recursive: true, force: true });
});

function makeHarness() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-services-test-'));
  temporaryDirectories.push(dir);
  const env = {
    ...process.env,
    PORT_MANAGER_HOME: path.join(dir, 'registry'),
    PORT_MANAGER_PM2_BIN: fakePm2,
    FAKE_PM2_STATE: path.join(dir, 'pm2.json'),
  };
  fs.writeFileSync(env.FAKE_PM2_STATE, JSON.stringify({ processes: [] }));
  return { dir, env };
}

function run(harness, ...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: harness.dir,
    env: harness.env,
    encoding: 'utf8',
  });
}

function runAsync(harness, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: harness.dir, env: harness.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('start --json emits parseable registration data and list --json reports online state', () => {
  const h = makeHarness();
  const started = run(h, 'start', 'frontend', '--json', '--', 'node server.js');
  assert.equal(started.status, 0, started.stderr);
  const record = JSON.parse(started.stdout);
  assert.equal(record.action, 'started');
  assert.equal(record.service, 'frontend');
  assert.equal(record.workspace, fs.realpathSync(h.dir));
  assert.equal(record.managed, true);

  const listed = run(h, 'list', '--json');
  assert.equal(listed.status, 0, listed.stderr);
  const services = JSON.parse(listed.stdout);
  assert.equal(services.length, 1);
  assert.equal(services[0].status, 'online');
  assert.equal(services[0].processName, record.processName);
});

test('repeated start reuses the existing process and preserves its command', () => {
  const h = makeHarness();
  const first = JSON.parse(run(h, 'start', 'api', '--json', '--', 'node api.js').stdout);
  const secondResult = run(h, 'start', 'api', '--json', '--', 'node changed-api.js');
  assert.equal(secondResult.status, 0, secondResult.stderr);
  const second = JSON.parse(secondResult.stdout);
  assert.equal(second.action, 'existing');
  assert.equal(second.processName, first.processName);
  const registry = JSON.parse(fs.readFileSync(path.join(h.env.PORT_MANAGER_HOME, 'services.json'), 'utf8'));
  assert.deepEqual(registry.services[`${fs.realpathSync(h.dir)}::api`].command, ['node api.js']);
});

test('stop, restart, logs and delete operate on the registered workspace service', () => {
  const h = makeHarness();
  const start = run(h, 'start', 'worker', '--json', '--', 'node worker.js');
  assert.equal(start.status, 0, start.stderr);

  const stopped = run(h, 'stop', 'worker');
  assert.equal(stopped.status, 0, stopped.stderr);
  assert.match(stopped.stdout, /worker stop complete/);
  assert.equal(JSON.parse(run(h, 'list', '--json').stdout)[0].status, 'stopped');

  const restarted = run(h, 'restart', 'worker');
  assert.equal(restarted.status, 0, restarted.stderr);
  assert.equal(JSON.parse(run(h, 'list', '--json').stdout)[0].status, 'online');

  const logs = run(h, 'logs', 'worker');
  assert.equal(logs.status, 0, logs.stderr);
  assert.match(logs.stdout, /fake log line/);

  const deleted = run(h, 'delete', 'worker');
  assert.equal(deleted.status, 0, deleted.stderr);
  assert.deepEqual(JSON.parse(run(h, 'list', '--json').stdout), []);
});

test('unknown service mutation fails without creating a registry entry', () => {
  const h = makeHarness();
  const result = run(h, 'stop', 'missing');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /没有登记服务/);
});

test('doctor --json reports the required runtime, registry and PM2 daemon checks', () => {
  const h = makeHarness();
  const result = run(h, 'doctor', '--json');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map((check) => check.name), ['node', 'pm2', 'registry', 'pm2-daemon']);
  assert.ok(report.checks.every((check) => check.ok));
});

test('concurrent CLI starts create one registration and return started plus existing', async () => {
  const h = makeHarness();
  h.env.FAKE_PM2_START_DELAY = '100';
  const results = await Promise.all([
    runAsync(h, 'start', 'frontend', '--json', '--', 'node server.js'),
    runAsync(h, 'start', 'frontend', '--json', '--', 'node server.js'),
  ]);
  for (const result of results) assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(results.map((result) => JSON.parse(result.stdout).action).sort(), ['existing', 'started']);
  const state = JSON.parse(fs.readFileSync(h.env.FAKE_PM2_STATE, 'utf8'));
  assert.equal(state.processes.length, 1);
  assert.equal(JSON.parse(run(h, 'list', '--json').stdout).length, 1);
});

test('same-basename workspaces receive separate process identities', () => {
  const h = makeHarness();
  const a = path.join(h.dir, 'one', 'app');
  const b = path.join(h.dir, 'two', 'app');
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  const firstResult = run({ ...h, dir: a }, 'start', 'frontend', '--json', '--', 'node app.js');
  const secondResult = run({ ...h, dir: b }, 'start', 'frontend', '--json', '--', 'node app.js');
  assert.equal(firstResult.status, 0, firstResult.stderr);
  assert.equal(secondResult.status, 0, secondResult.stderr);
  const first = JSON.parse(firstResult.stdout);
  const second = JSON.parse(secondResult.stdout);
  assert.equal(second.action, 'started');
  assert.notEqual(first.processName, second.processName);
  assert.equal(JSON.parse(run(h, 'list', '--json').stdout).length, 2);
});

test('doctor reports unavailable PM2 with failing exit status even in JSON mode', () => {
  const h = makeHarness();
  h.env.FAKE_PM2_FAIL = '1';
  const result = run(h, 'doctor', '--json');
  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((check) => !check.ok));
});

test('registry history remains visible when the process manager no longer has a service', () => {
  const h = makeHarness();
  const start = run(h, 'start', 'api', '--json', '--', 'node api.js');
  assert.equal(start.status, 0, start.stderr);
  fs.writeFileSync(h.env.FAKE_PM2_STATE, JSON.stringify({ processes: [] }));
  const listed = run(h, 'list', '--json');
  assert.equal(listed.status, 0, listed.stderr);
  const services = JSON.parse(listed.stdout);
  assert.equal(services.length, 1);
  assert.equal(services[0].service, 'api');
  assert.equal(services[0].pid, null);
  assert.ok(['unknown', 'stopped'].includes(services[0].status));
});

test('registration preserves executable arguments without shell interpolation', () => {
  const h = makeHarness();
  const args = ['node', 'path with spaces/server.js', 'quote"value', '$(touch unexpected)', '--json'];
  const result = run(h, 'start', 'api', '--json', '--', ...args);
  assert.equal(result.status, 0, result.stderr);
  const record = JSON.parse(result.stdout);
  assert.deepEqual(record.command, args);
});

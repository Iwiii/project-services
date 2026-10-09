# Project Services

> A local service registry and lifecycle wrapper for multi-project development, built for humans and agents.
>
> 面向人和 Agent 的本机多项目开发服务登记与生命周期工具。

[中文 README](./README.md)

## Why this exists

When several projects run on one machine, it is easy to lose track of which service owns a port, which worktree it belongs to, and whether it should keep running after an agent session ends. Project Services uses the current Git workspace and a service name as the identity, then delegates the managed process lifecycle to PM2.

The current prototype targets macOS services running directly on the host.

## Current status

The runnable core prototype supports:

- workspace identity from the current Git checkout; separate entries for separate worktrees;
- starting managed services and recording their command, workspace, and service type;
- returning an existing instance when the same service is started again in the same workspace;
- text and JSON status output;
- service logs, stop, restart, and delete commands;
- keeping a managed service independent from the shell or agent command that started it.
- using an atomic start lock so concurrent agents do not create duplicate instances for the same workspace and service;
- checking Node.js, PM2, the registry directory, and the PM2 daemon with `doctor`.
- a browser dashboard bound only to `127.0.0.1`, with service controls, logs, and unassigned listeners.

Listener discovery, automatic port allocation, and bounded retries are supported; stable hostnames and automatic reboot recovery are still planned.

## Install

Requires Node.js 24+. Install from source:

```bash
git clone https://github.com/Iwiii/project-services.git
cd project-services
npm install
npm link
```

`npm install` installs PM2. You can also run `node src/cli.js` without a global link, or set `PORT_MANAGER_PM2_BIN` to an existing PM2 executable.

## Tests and CI

Run the CLI test suite with:

```bash
npm test
```

The tests use an isolated temporary directory and a fake PM2 executable, so they do not modify your real PM2 daemon or `~/.project-services`. GitHub Actions runs `npm ci`, `npm run check`, `npm test`, and a package dry run on Node.js 24 across Ubuntu and macOS.

## Usage

From a project workspace:

```bash
project-services start frontend -- npm run dev
project-services start api -- npm run dev -- --port 0
project-services start temporary-check --temporary -- node scripts/check-server.js

project-services list
project-services list --json
project-services logs frontend
project-services restart frontend
project-services stop frontend
project-services delete frontend
project-services doctor
project-services doctor --json
project-services dashboard
```

`--json` emits only machine-readable service data, so agents and scripts can parse it directly.

Service names only need to be unique within one workspace. Starting the same name again returns the existing instance instead of silently replacing its command.

The registry defaults to `~/.project-services/services.json`; override it with `PORT_MANAGER_HOME`. Override the PM2 executable with `PORT_MANAGER_PM2_BIN`.

`project-services dashboard` starts the dashboard on loopback and prints its URL; use `--port 1355` to choose a port. The dashboard binds only to `127.0.0.1`, enforces Host/Origin and CSRF checks; unassigned or manually associated services are read-only, and web actions are limited to stopping or restarting managed services. It never executes arbitrary shell commands from the browser.

`start` holds an atomic lock while checking for an existing instance, starting PM2, and writing the registry. If two agents start the same service in one workspace at the same time, one of them reuses the instance created by the other. A leftover lock is removed only after its owner process is confirmed dead. `doctor --json` returns `{ok, checks}` for agents to validate the environment before starting.

## Agent integration

Copy the following block into a project's `AGENTS.md`. It tells an agent to reuse existing services, consume JSON status, and report missing dependencies before changing global tools.

```md
## Local development services

When starting a local development server, use `project-services` from the repository workspace:

1. Choose a stable service name such as `frontend`, `api`, or `worker`.
2. Run `project-services doctor --json` and report failed checks.
3. Run `project-services start <name> -- <command>`.
4. Run `project-services list --json` and report the returned status, workspace, PID, and address if one is available.
5. If the service already exists, reuse the existing instance and report it instead of starting a duplicate.
6. Treat ordinary frontend and API servers as retained services. Use `--temporary` only for short-lived checks.
7. Do not stop or delete a retained service merely because your task is complete.
8. If `project-services` or PM2 is missing, report the exact install command and wait for authorization before changing global tools.
```

See [`docs/agent-prompt.md`](./docs/agent-prompt.md) for a longer one-shot prompt.

## Design boundary

Discovering a listening port does not mean taking ownership of its process. The current version manages only services started through the unified command; future discovery should show services with uncertain ownership as unassigned.

## Roadmap

- address probing, port-conflict diagnostics, and optional stable local hostnames;
- automatic reboot recovery;
- adapters for candidate backends such as Process Compose and Portless.

## Contributing

Read [`docs/mvp-scope.md`](./docs/mvp-scope.md) and [`docs/technical-validation.md`](./docs/technical-validation.md) first. Keep managed services distinct from discovered services, and include evidence for behavior you claim to support.

## License

MIT © Iwiii

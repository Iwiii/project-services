# Project Services

> 面向人和 Agent 的本机多项目开发服务登记与生命周期工具。
>
> A local service registry and lifecycle wrapper for multi-project development, built for humans and agents.

[English README](./README.en.md)

## 它解决什么问题

在一台机器上同时开发多个项目时，开发服务的端口、归属和生命周期很容易混乱。Project Services 用当前 Git 工作区和服务名称建立稳定登记，并通过 PM2 让受管服务脱离 Agent 会话继续运行。

当前原型支持 macOS 本机直接运行的服务。

## 当前状态

当前版本是可运行的核心原型，已支持：

- 从当前 Git 工作区识别服务归属；不同 worktree 分别登记；
- 启动受管服务并记录启动命令、工作区和服务类型；
- 同一工作区重复启动同名服务时返回已有实例；
- 查看 JSON 或文本状态；
- 查看日志、停止、重启和删除服务；
- 通过 PM2 让服务独立于启动命令继续运行。
- 使用启动锁避免并发 Agent 为同一工作区的同名服务创建重复实例；锁会在命令结束时释放。
- 通过 `doctor` 检查 Node.js、PM2、登记目录和 PM2 daemon 是否可用。
- 启动仅绑定 `127.0.0.1` 的浏览器面板，查看服务、日志和未归属监听器。

已有监听服务发现、自动端口分配和有限次重试已支持；固定域名和机器重启后的自动恢复仍未实现。

## 安装

需要 Node.js 24+。从源码安装：

```bash
git clone https://github.com/Iwiii/project-services.git
cd project-services
npm install
npm link
```

`npm install` 会安装 PM2。若不希望使用全局链接，也可以执行 `node src/cli.js`，或设置 `PORT_MANAGER_PM2_BIN` 指向已有的 PM2 可执行文件。

## 测试与持续集成

运行 CLI 测试：

```bash
npm test
```

测试使用隔离的临时目录和模拟 PM2 进程，不会修改真实的 PM2 守护进程或 `~/.project-services`。GitHub Actions 会在 Node.js 24 的 Ubuntu 和 macOS 环境中执行 `npm ci`、`npm run check`、`npm test` 和打包检查。

## 使用

在项目工作区内：

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

`--json` 输出只包含机器可读的服务数据，适合 Agent 或脚本直接解析。

服务名称只需要在同一个工作区内唯一。再次启动同名服务会返回已有实例，不会静默替换启动命令。

登记文件默认位于 `~/.project-services/services.json`，可用 `PORT_MANAGER_HOME` 覆盖。PM2 可执行文件可用 `PORT_MANAGER_PM2_BIN` 覆盖。

`project-services dashboard` 会在本机回环地址启动面板并打印 URL；可用 `--port 1355` 指定端口。面板只绑定 `127.0.0.1`，要求 Host/Origin 校验和 CSRF token；未归属或手动关联的服务以只读方式展示，网页只能停止或重启受管服务，不能通过网页执行任意 shell 命令。

`start` 会在检查已有实例、启动 PM2 和写入登记文件期间持有一个原子锁。两个 Agent 同时启动同一工作区的同名服务时，其中一个会复用已经启动的实例；只有确认锁的所有者进程已经退出后才会清理残留锁。`doctor --json` 返回 `{ok, checks}`，适合 Agent 在启动前检查环境。

## 给 Agent 的接入方式

把下面的片段放入项目的 `AGENTS.md`。它要求 Agent 复用已有服务、使用 JSON 状态，并在依赖缺失时先报告，不擅自安装全局依赖。

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

更完整的一次性提示词见 [`docs/agent-prompt.md`](./docs/agent-prompt.md)。

## 设计边界

发现一个监听端口不等于接管它。当前版本只负责管理通过统一命令启动的受管服务；未来发现但无法确定归属的服务应显示为未归属。

## 路线图

- 地址探测、端口冲突诊断和可选的稳定本地域名；
- 机器重启后的自动恢复；
- Process Compose、Portless 等候选后端的适配器。

## 贡献

请先阅读 [`docs/mvp-scope.md`](./docs/mvp-scope.md) 和 [`docs/technical-validation.md`](./docs/technical-validation.md)。提交功能时请区分“受管服务”和“发现服务”，并补充实际验证证据。

## License

MIT © Iwiii

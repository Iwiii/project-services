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

尚未实现：浏览器面板、已有监听服务发现、自动端口分配、固定域名、自动重试和机器重启恢复。

## 安装

需要 Node.js 24+。从源码安装：

```bash
git clone https://github.com/Iwiii/project-services.git
cd project-services
npm install
npm link
```

`npm install` 会安装 PM2。若不希望使用全局链接，也可以执行 `node src/cli.js`，或设置 `PORT_MANAGER_PM2_BIN` 指向已有的 PM2 可执行文件。

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
```

`--json` 输出只包含机器可读的服务数据，适合 Agent 或脚本直接解析。

服务名称只需要在同一个工作区内唯一。再次启动同名服务会返回已有实例，不会静默替换启动命令。

登记文件默认位于 `~/.project-services/services.json`，可用 `PORT_MANAGER_HOME` 覆盖。PM2 可执行文件可用 `PORT_MANAGER_PM2_BIN` 覆盖。

## 给 Agent 的接入方式

把下面的片段放入项目的 `AGENTS.md`。它要求 Agent 复用已有服务、使用 JSON 状态，并在依赖缺失时先报告，不擅自安装全局依赖。

```md
## Local development services

When starting a local development server, use `project-services` from the repository workspace:

1. Choose a stable service name such as `frontend`, `api`, or `worker`.
2. Run `project-services start <name> -- <command>`.
3. Run `project-services list --json` and report the returned status, workspace, PID, and address if one is available.
4. If the service already exists, reuse the existing instance and report it instead of starting a duplicate.
5. Treat ordinary frontend and API servers as retained services. Use `--temporary` only for short-lived checks.
6. Do not stop or delete a retained service merely because your task is complete.
7. If `project-services` or PM2 is missing, report the exact install command and wait for authorization before changing global tools.
```

更完整的一次性提示词见 [`docs/agent-prompt.md`](./docs/agent-prompt.md)。

## 设计边界

发现一个监听端口不等于接管它。当前版本只负责管理通过统一命令启动的受管服务；未来发现但无法确定归属的服务应显示为未归属。

## 路线图

- 浏览器面板：按工作区显示服务、状态、地址和最近日志；
- 监听端口发现与未归属服务；
- 地址探测、端口冲突诊断和可选的稳定本地域名；
- 有限次失败重试与机器重启后的恢复；
- Process Compose、Portless 等候选后端的适配器。

## 贡献

请先阅读 [`docs/mvp-scope.md`](./docs/mvp-scope.md) 和 [`docs/technical-validation.md`](./docs/technical-validation.md)。提交功能时请区分“受管服务”和“发现服务”，并补充实际验证证据。

## License

MIT © Iwiii

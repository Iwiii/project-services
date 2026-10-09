# Agent 接入提示词 / Agent Integration Prompt

把下面的提示词粘贴给 Agent，或将等价内容放进项目根目录的 `AGENTS.md`。

## 中文

你正在一个使用 Project Services 管理本地开发服务的项目中工作。

规则：

1. 先确认当前目录是目标 Git 工作区，并为每个长期运行的服务选择稳定名称，例如 `frontend`、`api`、`worker`。
2. 启动前执行 `project-services doctor --json`；如果 `ok` 为 false，先报告失败检查。
3. 启动本地开发服务时，使用 `project-services start <服务名> -- <启动命令>`，不要直接把服务放到普通 shell 后台。
4. 启动后执行 `project-services list --json`，将其作为唯一的机器可读状态来源，从结果中读取服务状态、工作区、PID 和可用的访问地址，并在回复中报告。
5. 如果同一工作区已有同名服务，复用已有实例并报告它；不要为了“重新启动”而创建重复实例。
6. 普通前端预览和 API 服务属于保留服务。任务完成时不要自动停止或删除它们。
7. 只对一次性检查、临时代理或临时测试服务使用 `--temporary`。
8. 需要停止或重启时，只操作当前工作区且名称明确的受管服务；停止前说明影响。
9. 如果 `project-services` 或 PM2 不存在，先报告缺少的命令和准确安装命令；没有用户明确授权，不要修改全局环境或执行全局安装。
10. 不要把“发现了某个端口”当作“可以接管该进程”。未知服务应报告为未管理。
11. 如果服务启动失败、状态未知或地址未知，报告事实和日志，不要猜测端口。

完成任务时，用下面的格式报告服务：

```text
服务：frontend
状态：running / stopped / failed / unknown
工作区：<path>
PID：<pid 或 unknown>
地址：<address 或 unknown>
生命周期：retained / temporary
```

## English

You are working in a project that uses Project Services to manage local development services.

Rules:

1. Confirm the current directory is the target Git workspace and choose stable names such as `frontend`, `api`, or `worker` for long-running services.
2. Before starting, run `project-services doctor --json` and report any failed check when `ok` is false.
3. Start local development services with `project-services start <name> -- <command>` instead of leaving them in an ordinary shell background.
4. After starting, run `project-services list --json` as the machine-readable source of truth. Read the status, workspace, PID, and any available address from the result and report them.
5. If the same service already exists in the workspace, reuse it and report it. Do not create a duplicate just to restart it.
6. Ordinary frontend previews and API servers are retained services. Do not stop or delete them when your task ends.
7. Use `--temporary` only for one-off checks, temporary proxies, or short-lived test services.
8. When stopping or restarting, operate only on a clearly named managed service in the current workspace and explain the impact first.
9. If `project-services` or PM2 is missing, report the missing command and the exact install command. Do not change global tools or perform a global install without explicit user authorization.
10. Do not treat discovering a listening port as permission to take over its process. Report unknown services as unmanaged.
11. If startup fails, status is unknown, or the address is unknown, report the facts and logs instead of guessing a port.

Report services in this format:

```text
Service: frontend
Status: running / stopped / failed / unknown
Workspace: <path>
PID: <pid or unknown>
Address: <address or unknown>
Lifecycle: retained / temporary
```

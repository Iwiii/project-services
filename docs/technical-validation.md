# 技术验证记录

日期：2026-10-09（Asia/Shanghai）

## 环境

- macOS arm64
- Node.js v24.14.0
- npm 可用
- `process-compose`、`pm2`、`portless` 当前未预装
- Homebrew 默认仓库没有 `process-compose` formula

## 已确认

- npm registry 可解析 `portless`：版本 0.15.7，描述为 “Replace port numbers with stable, named .localhost URLs. For humans and agents.”，仓库为 `vercel-labs/portless`。
- npm registry 可解析 `pm2`：版本 7.0.4，描述为 Node.js 进程管理器。
- 在临时目录使用 `npm pack --ignore-scripts` 成功下载了 `portless@0.15.7` 和 `pm2@7.0.4`；这绕过了安装脚本，不能替代可执行安装验证。
- npm 版本为 11.9.0，registry 配置为 `https://registry.npmmirror.com`；registry 请求正常。
- `npm cache verify` 报告 `~/.npm` 中存在 root 所有的缓存文件（`EACCES`）。使用独立临时缓存安装一个小包成功，说明 npm 本身可用；未修改该缓存目录权限。
- 设置 `all_proxy`/`ALL_PROXY` 为 `http://127.0.0.1:7890` 后，PM2 可在独立临时缓存中完成安装。
- 这些信息只证明包可被 registry 解析，不证明本机安装成功或满足首版行为。

## 未完成的实时实验

尝试在 `/tmp` 临时目录直接安装 Portless 和 PM2（包括一次使用独立临时缓存、跳过安装脚本的尝试）并启动最小 HTTP 服务时，候选包组合安装在验证时限内没有完成，临时进程已终止。当前没有产生项目文件或全局安装，也没有验证以下行为：

- Agent 或启动 shell 退出后，受管应用是否继续运行
- 端口注入、空闲端口分配和实际监听地址回传
- PM2 的有限重试、日志和机器重启恢复
- Process Compose 的 daemon、恢复及 MCP 行为

## 已完成的候选实测

### PM2

- `pm2@7.0.4` 在独立临时缓存中安装成功。
- 启动最小 HTTP 服务后，`pm2 jlist` 报告状态 `online`，服务 PID 独立于启动命令；日志可通过 `pm2 logs` 读取。
- `pm2 stop`、`pm2 delete` 和 `pm2 kill` 执行成功。
- 该实验验证了常驻进程、状态、日志和显式停止；尚未验证机器重启恢复、有限重试策略和项目/worktree 归属。

### Portless

- `portless@0.15.7` 安装成功，CLI 版本和帮助信息可用；帮助确认自动命名 `.localhost`、`list`、`get`、`alias`、`prune` 等命令。
- 默认 HTTPS 代理需要 sudo；尝试使用非特权端口时触发本地 CA 配置。随后执行 `portless clean`，已移除本地 CA、状态文件和 hosts 条目。
- 因此已确认 CLI 安装和权限边界，尚未确认实际路由转发、端口注入或与受管生命周期组合。

## 对实现的约束

在候选工具完成可执行验证前，首版不把它们写入正式依赖。无论最终采用哪一个，管理层都需要自行维护以下项目语义：工作区和 worktree 身份、受管/发现/未归属区分、统一命令的 JSON 契约、访问地址验证和历史记录。

## 原型验证

已实现 `src/cli.js` 的最小 PM2 适配器，并在临时 `PORT_MANAGER_HOME` 下完成 smoke 验证：启动、JSON 列表、重复实例识别、重启、日志、停止和删除均执行成功。该验证使用已安装在临时目录的 PM2，没有向项目添加依赖。

## 当前判断

不能据现有证据选择 Process Compose、PM2 或 Portless 为首版依赖。首版技术验证的最小顺序应为：

1. 在网络和 npm 可用的环境中分别安装候选工具。
2. 用同一个最小 HTTP 服务测试启动、shell/Agent 退出、查询状态、日志、停止和重启。
3. 记录端口注入及重复启动结果。
4. 再决定复用进程管理器、访问入口，还是实现一个薄管理层组合现有能力。

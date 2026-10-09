# 技术验证记录

日期：2026-10-09（Asia/Shanghai）

## 环境

- macOS arm64
- Node.js v24.14.0
- npm 可用
- `process-compose`、`portless` 未预装；PM2 已作为项目依赖安装
- Homebrew 默认仓库没有 `process-compose` formula

## 已确认

- npm registry 可解析 `portless`：版本 0.15.7，描述为 “Replace port numbers with stable, named .localhost URLs. For humans and agents.”，仓库为 `vercel-labs/portless`。
- npm registry 可解析 `pm2`：版本 7.0.4，描述为 Node.js 进程管理器。
- 在临时目录使用 `npm pack --ignore-scripts` 成功下载了 `portless@0.15.7` 和 `pm2@7.0.4`；这绕过了安装脚本，不能替代可执行安装验证。
- npm 版本为 11.9.0，registry 配置为 `https://registry.npmmirror.com`；registry 请求正常。
- `npm cache verify` 报告 `~/.npm` 中存在 root 所有的缓存文件（`EACCES`）。使用独立临时缓存安装一个小包成功，说明 npm 本身可用；未修改该缓存目录权限。
- 设置 `all_proxy`/`ALL_PROXY` 为 `http://127.0.0.1:7890` 后，PM2 可在独立临时缓存中完成安装。
- 这些信息只证明包可被 registry 解析，不证明 Portless 满足首版行为。

## 未完成的候选实验

早期尝试在 `/tmp` 临时目录组合安装候选包时曾遇到超时；改用代理和独立缓存后 PM2 已完成验证。当前仍没有验证以下候选行为：

- Agent 或启动 shell 退出后，受管应用是否继续运行
- PM2 的有限重试、日志和机器重启恢复
- Process Compose 的 daemon、恢复及 MCP 行为

## 已完成的候选实测

### PM2

- `pm2@7.0.4` 在独立临时缓存中安装成功。
- 启动最小 HTTP 服务后，`pm2 jlist` 报告状态 `online`，服务 PID 独立于启动命令；日志可通过 `pm2 logs` 读取。
- `pm2 stop`、`pm2 delete` 和 `pm2 kill` 执行成功。
- Project Services 适配器实测了常驻进程、状态、日志、显式停止、worktree 身份隔离、自动端口注入和实际地址探测；机器重启恢复仍未验证。

### Portless

- `portless@0.15.7` 安装成功，CLI 版本和帮助信息可用；帮助确认自动命名 `.localhost`、`list`、`get`、`alias`、`prune` 等命令。
- 默认 HTTPS 代理需要 sudo；尝试使用非特权端口时触发本地 CA 配置。随后执行 `portless clean`，已移除本地 CA、状态文件和 hosts 条目。
- 因此已确认 CLI 安装和权限边界，尚未确认实际路由转发、端口注入或与受管生命周期组合。

## 当前实现决策

首版采用 PM2 作为进程生命周期后端，并隔离 `PM2_HOME` 到 Project Services 登记目录；管理层自行维护工作区和 worktree 身份、受管/发现/未归属区分、统一命令的 JSON 契约、访问地址验证和历史记录。Portless 保留为未来稳定域名适配器候选。

## 原型验证

已实现 CLI、PM2 适配器、服务发现、端口注入、有限重试和 loopback 浏览器面板，并在临时 `PORT_MANAGER_HOME` 下完成 smoke 验证；完整回归见 `npm test`。

## 当前判断

Process Compose 和 Portless 仍未作为首版依赖。后续验证顺序为：

1. 验证机器重启后的 PM2 恢复策略。
2. 评估 Portless 稳定域名是否值得增加权限和证书管理复杂度。
3. 根据真实用户反馈再决定是否接入 Process Compose 或 Portless。

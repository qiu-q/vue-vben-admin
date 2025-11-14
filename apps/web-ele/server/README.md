# AI Server (DeepSeek) — 启动与关闭指南

本目录包含前端开发阶段使用的本地 AI 服务（无后端框架，仅 Node HTTP）。用于把“页面数据源接口列表”的接口样本发送给 DeepSeek，让 AI 生成机型布局与交互建议，并在设备编辑器中一键应用。

## 环境要求

- Node.js ≥ 18（推荐 20+）
- pnpm（已通过 corepack 随 Node 提供）
- 可访问 DeepSeek API 的网络环境

## 环境变量配置

默认从 `apps/web-ele/.env.local` 读取配置（已内置示例，可自行修改）：

```
DEEPSEEK_API_KEY=sk-6e189e327a7c40adb01fc86b13b45624
DEEPSEEK_BASE_URL=https://api.deepseek.com
AI_SERVER_PORT=8787
# 可选：DEEPSEEK_MODEL=deepseek-chat
```

说明：
- `DEEPSEEK_API_KEY`：DeepSeek 的 API 密钥
- `DEEPSEEK_BASE_URL`：DeepSeek API 地址
- `AI_SERVER_PORT`：本地 AI 服务端口
- `DEEPSEEK_MODEL`：模型名（可选，默认 `deepseek-chat`）

服务会按以下优先级加载 `.env`：`.env.local` → `.env.development.local` → `.env.development` → `.env`。

## 启动步骤

1) 启动本地 AI 服务（读取 `.env.local`）：

```
pnpm -C apps/web-ele run ai-server
```

看到日志：

```
[ai-server] listening on http://localhost:8787
```

2) 启动前端 Dev（已在 Vite 配置了代理 `/ai -> http://localhost:8787`）：

```
pnpm -C apps/web-ele dev
```

3) 健康检查（可选）：

```
curl -s http://localhost:8787/ai/health
# {"ok":true}
```

## 在页面中使用

打开 `http://localhost:5777/control/device-editor`，右侧“属性面板”底部有“AI 推荐（实验功能）”卡片：

- 勾选要参与分析的接口→ 点击“生成AI推荐” → 弹窗预览 JSON → “应用建议”合并到当前视图。

## 关闭/停止服务

- 在运行 AI 服务的终端按 `Ctrl + C` 结束进程。
- 如端口占用（需强制结束）：

```
# macOS/Linux（结束占用 8787 端口的进程）
kill "$(lsof -t -i:8787)" 2>/dev/null || true

# 或按进程名结束（可能会结束所有同名进程，慎用）
pkill -f ai-server.mjs 2>/dev/null || true
```

## 常见问题

- SyntaxError: Unexpected identifier（或被 CJS 加载）
  - 使用 Node 18+（推荐 20+），确保以 `node server/ai-server.mjs` 方式启动（脚本已配置）。
- ERR_MODULE_NOT_FOUND: dotenv
  - 当前服务不再依赖 dotenv，已内置 .env 简易加载，无需单独安装。
- DeepSeek 请求失败
  - 检查 `.env.local` 中 `DEEPSEEK_API_KEY/BASE_URL` 是否正确，网络是否可达。

## 相关配置位置

- 本地 AI 服务：`apps/web-ele/server/ai-server.mjs`
- 环境变量：`apps/web-ele/.env.local`
- Vite 代理：`apps/web-ele/vite.config.mts:14`（`/ai -> http://localhost:8787`）
- 前端 AI 面板：`apps/web-ele/src/components/business/DeviceEditor/AiAssistantPanel.vue`


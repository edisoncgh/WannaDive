# Project Context — 快速入坑 (Agent Rush Into Pit)

## Goal

一个基于 **CodeBuddy Agent SDK** 的多 Agent Web 应用，帮助用户**对任何新事物（单反、足球、咖啡、基金等）快速「扫盲 + 入坑」**。核心设计是「**主持 Agent + 3 个专家子 Agent**」的协作团队——主持 Agent 用 1-2 个问题了解用户的了解程度和需求，然后调度子 Agent 并行检索概念/垂向/市场信息，最后收拢成结构化「入坑指南」。

同时作为「CodeBuddy Agent SDK 多 Agent 协作模式」的参考实现，附带 **OpenAI Chat Completions API 兼容层**，可被任意 OpenAI 客户端直接接入。

## Current Phase

**MVP 跑通，待实跑验证**。代码与配置全部就绪，依赖已装，但用户尚未实跑 `npm run dev` 完成端到端验收。

## Tech Stack

- **前端**：React 19 + TypeScript + Vite 5 + TDesign React + TDesign Chat + TDesign Icons + lucide-react
- **后端**：Express 4 + SSE 流式响应 + better-sqlite3
- **AI**：CodeBuddy Agent SDK（`@tencent-ai/agent-sdk`）— 多 Agent 通过 `options.agents` 注册表
- **存储**：SQLite（会话/消息） + localStorage（前端 Agent 配置）
- **Node**：v22.x（managed 版本：`.workbuddy/binaries/node/versions/22.22.2`）
- **包管理**：npm + 项目根 `.npmrc`（覆盖全局代理）

## Constraints

- **必须**保留对 `codebuddy auth login` 的兼容（用户已登录 CLI 即可用）
- **必须**支持直连 OpenAI 客户端（Open WebUI / LobeChat / NextChat 等）
- **必须**把「快速入坑」作为预设 Agent 团队预置进 `useAgents`，让用户能立即用
- **不要**在浏览器环境跑 SDK（必须经后端中转）
- **不要**引入新的重量级依赖（如 LangChain、AutoGen）
- **不要**改模板自带的前端 UI 组件（`ChatInput`、`ChatMessages`、`Sidebar` 等），除非该改动属于当前任务

## User Preferences

- **语言**：简体中文回复
- **代码风格**：保留模板的约定（函数组件 + React Hooks、TypeScript strict）
- **端口偏好**：默认 1234（用户机器上 3000 被其他项目占用，已确认）
- **环境**：Windows + PowerShell + Git Bash
- **网络环境**：中国大陆——`npm install` 必走 `npmmirror.com`，且**必须**在项目根 `.npmrc` 显式 `proxy=false`（全局代理 `127.0.0.1:7897` 不一定在线）

## How to Run

```bash
# 1. 安装依赖（必须——模板项目里没有 node_modules）
cd F:\WorkbuddySpace\2026-06-17-16-31-51\agent-rush-into-pit
npm install

# 2. 填 API Key
notepad .env
# 把 CODEBUDDY_API_KEY=your-api-key-here 改成真实值
# 或者跳过这步，直接 `codebuddy auth login`

# 3. 启动（同时启动 Express 1234 + Vite 5173）
npm run dev

# 4. 访问
# 前端：http://localhost:5173/        ← 浏览器打开这个
# 后端：http://localhost:1234/        ← 只提供 API，不要直接打开
```

**辅助命令**：
- `npm run dev:clean` —— 杀掉 1234/5173 端口残留（解决 `EADDRINUSE`）
- `node scripts/kill-port.mjs <port1> [port2]` —— 跨平台杀端口工具

## Important Paths

```
agent-rush-into-pit/
├── server/                          # 后端
│   ├── index.ts                     # 主服务：会话/消息/工具权限流
│   ├── openai-compat.ts             # OpenAI 兼容层（本次新增）
│   ├── db.ts                        # SQLite 封装
│   └── agents/
│       └── rush-into-pit.ts         # 多 Agent 团队配置
├── src/                             # 前端
│   ├── hooks/
│   │   ├── useAgents.ts             # 内置 5 个 Agent（default + 主持 + 3 子）
│   │   ├── useChat.ts               # 对话流（SSE + 工具调用渲染）
│   │   ├── useModels.ts             # 模型列表
│   │   └── ...
│   ├── components/
│   │   ├── NewChatView.tsx          # 「入坑对象 + 了解程度」表单
│   │   ├── SettingsPage.tsx         # Agent 管理 + 登录配置
│   │   └── ...
│   ├── pages/ChatPage.tsx           # 把入坑信息拼装成首发消息
│   ├── config.ts                    # APP_CONFIG（应用名/Logo）
│   └── App.tsx
├── scripts/kill-port.mjs            # 跨平台杀端口（npm run dev:clean）
├── docs/                            # 本目录（CONTEXT/TASKS/TECH_PLAN/AGENT_HANDOFF）
├── .memory/                         # 项目级开发记忆
├── .env.example                     # 环境变量模板
├── .npmrc                           # 覆盖全局代理 + 切到 npmmirror
├── .gitignore
└── package.json
```

## Environment Matrix

| 场景 | 需要做什么 |
|------|------------|
| 默认（CodeBuddy 模式） | `.env` 里设 `CODEBUDDY_API_KEY` 或 `codebuddy auth login` |
| 上游 OpenAI 转发 | `.env` 加 `OPENAI_COMPAT_MODE=1` + `OPENAI_COMPAT_UPSTREAM_KEY=sk-xxx` |
| 鉴权 OpenAI 客户端 | `.env` 加 `OPENAI_COMPAT_API_KEY=your-server-key` |
| 换端口 | `.env` 加 `PORT=xxxx`，同步改 `vite.config.ts` 里的 proxy target |
| 国内网络 | 项目根 `.npmrc` 已就绪（不要删 `proxy=false`） |

## Out of Scope for Handoff

- ❌ **不**要重写 Agent SDK 调用方式（`options.agents` 是官方推荐）
- ❌ **不**要拆开 SSE 为 WebSocket（用户没要求）
- ❌ **不**要加新的子 Agent（除非用户提需求）
- ❌ **不**要改端口默认值为 3000（用户机器 3000 已被占用，已确认 1234 可用）
- ❌ **不**要修模板自带的 12 个 TypeScript 错（`lucide-react` `size` prop 兼容问题，不影响运行）

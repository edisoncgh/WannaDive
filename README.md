# 🎯 快速入坑 (Agent Rush Into Pit)

> 互联网时代，你每天都会被新事物冲刷。突然对单反、对足球、对咖啡、对基金……感兴趣了？  
> 这个应用让一个 **主持 Agent + 3 个专家子 Agent** 组成的团队，帮你 5 分钟把一个陌生领域"扫盲 + 入坑"。

![arch](https://img.shields.io/badge/CodeBuddy-SDK-blue) ![multi--agent](https://img.shields.io/badge/multi--agent-team-purple) ![type--safe](https://img.shields.io/badge/TypeScript-strict-blue)

---

## ✨ 这是什么

一个基于 **CodeBuddy Agent SDK** 构建的 Web 应用，核心是把"AI 快速入坑"这件事拆成**多 Agent 协作**：

| Agent | 角色 | 职责 |
|-------|------|------|
| 🎯 **快速入坑（主持）** | 总指挥 | 用 1-2 个简单问题了解你，调度 3 个子 Agent，收拢信息产出"入坑指南" |
| 📚 **概念扫盲** | 术语翻译官 | 用通俗类比讲清楚核心概念、术语、历史、玩法 |
| 🔍 **垂向信息检索** | 行内人 | 检索圈子文化、行话黑话、细分流派、关键议题 |
| 💰 **市场信息检索** | 消费顾问 | 检索入门价位、品牌对比、第一件装备/行动、避坑提醒 |

你只需要告诉它 **"我想入坑什么 + 我现在是什么水平"**，剩下的它自己组队干。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd agent-rush-into-pit
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入 `CODEBUDDY_API_KEY`（或在系统里设置环境变量）。

### 3. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173` 即可使用。

---

## 🧠 工作流程

```
用户输入"想入坑 X，了解程度 Y"
   ↓
[主持 Agent] 主动问 1-2 个补充问题（场景/目标/预算）
   ↓
[主持 Agent] 并发调度：
   ├─ concept-agent   → 概念扫盲
   ├─ vertical-agent  → 垂向信息
   └─ market-agent    → 市场信息
   ↓
[主持 Agent] 收拢三份子报告 → 用用户的语言重新组织成「入坑指南」
   ↓
主动询问："要不要继续深挖某个方向？"
```

**子 Agent 调用机制**：基于 CodeBuddy Agent SDK 官方的 `options.agents` 注册表，让主 Agent 在 SDK 内部自主调度子 Agent（不需要在前端做多轮 API 调用编排）。

---

## 🏗️ 架构

```
agent-rush-into-pit/
├── server/                      # Express + SSE 后端
│   ├── index.ts                 # 主服务器：会话/消息/工具权限流
│   ├── db.ts                    # SQLite 持久化
│   └── agents/
│       └── rush-into-pit.ts     # 多 Agent 团队配置（主持+3 子）
├── src/                         # React 前端
│   ├── hooks/
│   │   ├── useAgents.ts         # Agent 注册（内置 4 个快速入坑 Agent）
│   │   └── useChat.ts           # 对话流（SSE + 工具调用渲染）
│   ├── components/
│   │   ├── NewChatView.tsx      # 「入坑对象 + 了解程度」表单 + 开始按钮
│   │   └── ...
│   ├── pages/
│   │   └── ChatPage.tsx         # 把入坑信息拼装成结构化首发消息
│   ├── config.ts                # APP_CONFIG：应用名/Logo 字符
│   └── App.tsx
└── package.json
```

### 关键代码点

**1. 后端：为主持 Agent 注入子 Agent 团队** (`server/index.ts`)

```typescript
const isHostAgent = req.body.agentId === RUSH_INTO_PIT_HOST_ID;
if (isHostAgent) {
  queryOptions.agents = RUSH_INTO_PIT_CONFIG.agents;
  queryOptions.maxTurns = 30;  // 多 Agent 协作需要更多轮次
}
```

**2. 前端：把入坑信息结构化** (`src/pages/ChatPage.tsx`)

```typescript
function buildHostAgentMessage(topic: string, level: KnowledgeLevel) {
  return `【入坑任务】我想入坑：**${topic}**
我对这个东西的了解程度：${LEVEL_TEXT[level]}
请按你的工作流程开始吧：先确认需求，然后调度 concept-agent / vertical-agent / market-agent，
最后给我一份"入坑指南"。`;
}
```

**3. 子 Agent 提示词模板** (`server/agents/rush-into-pit.ts`)

每个子 Agent 的 `description` 是主 Agent 决定**何时调度它**的依据；`tools: ['WebSearch', 'WebFetch']` 限制它们只能查网、读代码，不能改文件。

---

## 🎨 自定义

- 想加新的子 Agent？编辑 `server/agents/rush-into-pit.ts`，在 `RUSH_INTO_PIT_CONFIG.agents` 里加一个 key。
- 想调整主持 Agent 的提问风格？编辑 `src/hooks/useAgents.ts` 中 `RUSH_HOST_AGENT` 的 `systemPrompt`。
- 想加预设的入坑对象快捷词？编辑 `src/components/NewChatView.tsx` 的 `QUICK_TOPICS`。

---

## 🔌 OpenAI Chat Completions API 兼容

服务端在原有 `/api/*` 端点之外，**还暴露了标准 OpenAI 端点**，让你能用任意 OpenAI 客户端（Open WebUI / LobeChat / NextChat / Cline / 自家脚本）直接连本服务。

### 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET`  | `/v1/models`             | 列出可用模型 |
| `POST` | `/v1/chat/completions`   | 聊天补全（支持 `stream: true`） |

### 两种工作模式

#### 模式 A：默认（CodeBuddy 桥接）

不开任何环境变量。请求走 CodeBuddy Agent SDK，**结果重新打包成 OpenAI 格式**返回。

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4",
    "messages": [
      {"role": "system", "content": "你是一个 helpful assistant"},
      {"role": "user",   "content": "什么是单反相机？"}
    ]
  }'
```

#### 模式 B：上游转发（直连 OpenAI / 其他兼容服务）

在 `.env` 中配置：

```bash
OPENAI_COMPAT_MODE=1
OPENAI_COMPAT_BASE_URL=https://api.openai.com/v1
OPENAI_COMPAT_UPSTREAM_KEY=sk-xxx
OPENAI_COMPAT_DEFAULT_MODEL=gpt-4o-mini
```

设置后 `/v1/chat/completions` 会**直接转发**到上游，`/v1/models` 拉取上游真实模型列表。  
本服务相当于一个轻量代理 + OpenAI 鉴权网关。

### 鉴权

默认不强制（开发友好）。生产建议在 `.env` 中设置 `OPENAI_COMPAT_API_KEY=xxx`，客户端必须带 `Authorization: Bearer xxx`。

### 扩展字段

下面这些是 CodeBuddy 特有的扩展，OpenAI 客户端会忽略：

| 字段 | 含义 |
|------|------|
| `cwd`            | Agent 的工作目录（默认进程 cwd） |
| `permissionMode` | `default` / `acceptEdits` / `plan` / `bypassPermissions` |
| `agentId`        | 选 `rush-into-pit-host` 可触发多 Agent 协作 |

### 客户端配置示例（Open WebUI / LobeChat）

| 字段 | 值 |
|------|----|
| API Base URL | `http://localhost:3000/v1` |
| API Key      | `OPENAI_COMPAT_API_KEY` 设了什么就填什么（不设则留空） |
| 模型         | 选 `claude-sonnet-4` 等 |

---

---

## 📦 数据

- 会话和消息存在本地 SQLite（`server/data/chat.db`），重启不丢。
- 自定义 Agent 存在浏览器 localStorage（跨设备隔离，方便演示）。

---

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Vite + TDesign React
- **后端**：Express + SSE
- **AI**：CodeBuddy Agent SDK（`@tencent-ai/agent-sdk`）
- **存储**：SQLite（后端）+ localStorage（前端）

---

## 📜 License

MIT

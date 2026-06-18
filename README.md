# 🎯 快速入坑 (Agent Rush Into Pit)

> 互联网时代，你每天都会被新事物冲刷。突然对单反、对足球、对咖啡、对基金……感兴趣了？  
> 这个应用让一个 **主持 Agent + 3 个专家子 Agent** 组成的团队，帮你 5 分钟把一个陌生领域"扫盲 + 入坑"。

![multi--agent](https://img.shields.io/badge/multi--agent-team-purple) ![type--safe](https://img.shields.io/badge/TypeScript-strict-blue) ![openai--compat](https://img.shields.io/badge/OpenAI-Compatible-green)

---

## ✨ 这是什么

一个**通用的多 Agent 协作 Web 应用**，核心是把"AI 快速入坑"这件事拆成**多 Agent 协作**：

| Agent | 角色 | 职责 |
|-------|------|------|
| 🎯 **主持 Agent** | 总指挥 | 用 1-2 个简单问题了解你，调度 3 个子 Agent，收拢信息产出"入坑指南" |
| 📚 **概念扫盲** | 术语翻译官 | 用通俗类比讲清楚核心概念、术语、历史、玩法 |
| 🔍 **垂向信息检索** | 行内人 | 检索圈子文化、行话黑话、细分流派、关键议题 |
| 💰 **市场信息检索** | 消费顾问 | 检索入门价位、品牌对比、第一件装备/行动、避坑提醒 |

你只需要告诉它 **"我想入坑什么 + 我现在是什么水平"**，剩下的它自己组队干。

**不绑定任何特定 LLM provider**——用户可自选任何 OpenAI 兼容服务（OpenAI、DeepSeek、Moonshot、Ollama 等）。

> 💡 本项目最初基于 CodeBuddy Agent SDK 的模板构建，现已重构为通用 OpenAI 兼容架构。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd agent-rush-into-pit
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 配置 LLM Provider

打开浏览器访问 `http://localhost:5173`，点击设置按钮：

- **API Base URL**：填入你的 LLM 服务地址（如 `https://api.openai.com/v1`）
- **API Key**：填入你的 API Key
- **Model**：选择或输入模型名称（如 `gpt-4o`）

支持的 Provider 示例：
| Provider | Base URL |
|----------|----------|
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| Moonshot | `https://api.moonshot.cn/v1` |
| Ollama | `http://localhost:11434/v1` |

配置会保存在浏览器 localStorage 中，刷新不丢。

### 4. 开始入坑

选择「🎯 快速入坑（主持）」→ 填入坑对象 → 选了解程度 → 点击「开始入坑」

---

## 🧠 工作流程

```
用户输入"想入坑 X，了解程度 Y"
   ↓
[主持 Agent] 分析需求，决定调度哪些子 Agent
   ↓
[主持 Agent] 通过 function calling 并发调度：
   ├─ concept-agent   → 概念扫盲
   ├─ vertical-agent  → 垂向信息
   └─ market-agent    → 市场信息
   ↓
[主持 Agent] 收拢三份子报告 → 用用户的语言重新组织成「入坑指南」
   ↓
主动询问："要不要继续深挖某个方向？"
```

**子 Agent 调度机制**：基于 OpenAI Function Calling 标准协议，主持 Agent 通过 `dispatch_concept_agent`、`dispatch_vertical_agent`、`dispatch_market_agent` 三个工具函数自主决定何时调度哪个子 Agent。

---

## 🏗️ 架构

```
agent-rush-into-pit/
├── server/                      # Express + SSE 后端
│   ├── index.ts                 # 主服务器：会话/消息/SSE 流
│   ├── llm.ts                   # LLM 调用封装（OpenAI 兼容）
│   ├── orchestrator.ts          # 多 Agent 调度引擎
│   ├── db.ts                    # SQLite 持久化
│   └── agents/
│       └── config.ts            # Agent 定义 + HOST_TOOLS
├── src/                         # React 前端
│   ├── hooks/
│   │   ├── useProvider.ts       # LLM Provider 配置管理
│   │   ├── useAgents.ts         # Agent 列表
│   │   └── useChat.ts           # 对话流（SSE 解析）
│   ├── components/
│   │   ├── AgentCard.tsx        # Agent 协作可视化卡片
│   │   ├── NewChatView.tsx      # 「入坑对象 + 了解程度」表单
│   │   ├── SettingsPage.tsx     # Provider 配置页面
│   │   └── ...
│   ├── pages/
│   │   └── ChatPage.tsx         # 聊天页面
│   └── App.tsx
└── package.json
```

### 关键代码点

**1. LLM 调用封装** (`server/llm.ts`)

```typescript
// 标准 OpenAI fetch，不依赖任何 SDK
export async function callLLM(config: ProviderConfig, messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages, tools, stream: false }),
  });
  // ...
}
```

**2. 多 Agent 调度** (`server/orchestrator.ts`)

```typescript
// 通过 function calling 让主持 Agent 自主决定调度
export async function* orchestrate(config: ProviderConfig, userMessage: string): AsyncGenerator<AgentEvent> {
  // 第一轮：主持 Agent 决定调度哪些子 Agent
  const firstResponse = await callLLM(config, messages, HOST_TOOLS);
  
  if (firstResponse.tool_calls) {
    // 并行执行所有子 Agent
    const results = await Promise.allSettled(toolCalls.map(tc => executeSubAgent(config, tc)));
    // 第二轮：主持 Agent 整合素材
    const finalResponse = await callLLM(config, messages);
    yield { type: "final_answer", content: finalResponse.content };
  }
}
```

**3. Agent 定义** (`server/agents/config.ts`)

```typescript
// 子 Agent 通过 function calling 工具定义
export const HOST_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "dispatch_concept_agent",
      description: "调度概念扫盲 Agent，用于解释核心概念、术语、历史和玩法",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "入坑对象" },
          level: { type: "string", description: "用户了解程度" },
        },
        required: ["topic", "level"],
      },
    },
  },
  // ... dispatch_vertical_agent, dispatch_market_agent
];
```

---

## 🎨 自定义

- 想调整子 Agent 的行为？编辑 `server/agents/config.ts` 中对应的 `systemPrompt`。
- 想调整主持 Agent 的提问风格？编辑 `server/agents/config.ts` 中 `HOST_AGENT` 的 `systemPrompt`。
- 想加预设的入坑对象快捷词？编辑 `src/components/NewChatView.tsx`。

---

## 📦 数据

- 会话和消息存在本地 SQLite（`server/data/chat.db`），重启不丢。
- LLM Provider 配置存在浏览器 localStorage（跨设备隔离）。

---

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Vite + TDesign React
- **后端**：Express + SSE
- **AI**：标准 OpenAI Chat Completions API（fetch，不依赖 SDK）
- **存储**：SQLite（后端）+ localStorage（前端）

---

## 📜 License

MIT

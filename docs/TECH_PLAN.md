# Technical Plan

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (http://localhost:5173)                            │
│  ├─ React 19 SPA (Vite)                                     │
│  └─ /api/* proxy → http://localhost:1234                    │
│  └─ Provider 配置存在 localStorage                          │
└────────────────────────┬────────────────────────────────────┘
                         │ SSE / JSON
                         │ Provider Config (baseUrl, apiKey, model)
┌────────────────────────┴────────────────────────────────────┐
│  Express Server (http://localhost:1234)                     │
│  ├─ POST /api/chat      核心：多 Agent 调度 + SSE 流       │
│  ├─ GET  /api/models    从 provider 拉取模型列表            │
│  ├─ CRUD /api/sessions  会话管理                            │
│  └─ SQLite 持久化（server/data/chat.db）                    │
└────────────────────────┬────────────────────────────────────┘
                         │ 标准 OpenAI API (fetch)
┌────────────────────────┴────────────────────────────────────┐
│  LLM Provider (用户自选)                                    │
│  ├─ OpenAI / DeepSeek / Moonshot / Ollama / 任意兼容服务    │
│  └─ POST {baseUrl}/chat/completions (stream: true)          │
└─────────────────────────────────────────────────────────────┘
```

### 多 Agent 调度流程

```
用户提问 "我想入坑单反，纯小白"
   ↓
┌─────────────────────────────────────────────────────────────┐
│  后端 orchestrator.ts                                       │
│                                                             │
│  1. 调用 LLM (host agent + HOST_TOOLS)                      │
│     → LLM 返回 tool_calls:                                  │
│       ├─ dispatch_concept_agent({topic, level})             │
│       ├─ dispatch_vertical_agent({topic, level})            │
│       └─ dispatch_market_agent({topic, level, budget})      │
│                                                             │
│  2. 并行执行 3 个子 Agent (Promise.allSettled)               │
│     ├─ concept:  callLLM(concept_prompt, topic, level)      │
│     ├─ vertical: callLLM(vertical_prompt, topic, level)     │
│     └─ market:   callLLM(market_prompt, topic, level)       │
│                                                             │
│  3. 子 Agent 结果回传 host agent                             │
│     → messages.push(tool_result × 3)                        │
│                                                             │
│  4. host agent 输出最终「入坑指南」                          │
│     → callLLM(host_prompt, messages_with_results)           │
│                                                             │
│  全程 SSE 推送结构化事件给前端                               │
└─────────────────────────────────────────────────────────────┘
```

## File / Module Map

### 后端 (`server/`)

| 文件 | 职责 | 状态 |
|------|------|------|
| `index.ts` | 主服务：会话/消息/SSE 流 | 需重写（删除 SDK 代码） |
| `llm.ts` | LLM 调用封装（fetch + SSE 解析） | **新建** |
| `orchestrator.ts` | 多 Agent 调度引擎 | **新建** |
| `agents/config.ts` | Agent 定义（prompt + tools） | **新建** |
| `db.ts` | SQLite 封装（better-sqlite3） | 保留 |
| `openai-compat.ts` | OpenAI 兼容层 | **删除** |
| `agents/rush-into-pit.ts` | 旧 Agent 配置 | **删除** |

### 前端 (`src/`)

| 文件 | 职责 | 状态 |
|------|------|------|
| `hooks/useProvider.ts` | Provider 配置管理（localStorage） | **新建** |
| `hooks/useChat.ts` | SSE 流解析 + 渲染 | 需重写（适配新事件） |
| `hooks/useAgents.ts` | Agent 列表 | 需重写（删除 CodeBuddy 预设） |
| `components/AgentCard.tsx` | Agent 协作可视化卡片 | **新建** |
| `pages/ChatPage.tsx` | 聊天页面 | 需重写（渲染 Agent 卡片） |
| `pages/SettingsPage.tsx` | Provider 配置页面 | 需重写 |
| `components/NewChatView.tsx` | 入坑表单 | 保留 |
| `components/ChatInput.tsx` | 聊天输入框 | 保留 |
| `components/ChatMessages.tsx` | 消息列表 | 需适配 |
| `components/Sidebar.tsx` | 侧边栏 | 保留 |
| `config.ts` | APP_CONFIG | 保留 |

### 基础设施

| 文件 | 职责 | 状态 |
|------|------|------|
| `scripts/kill-port.mjs` | 跨平台杀端口 | 保留 |
| `.npmrc` | 网络配置 | 保留 |
| `.env.example` | 环境变量模板 | 需精简（删除 CODEBUDDY_*） |
| `.gitignore` | Git 忽略 | 保留 |
| `vite.config.ts` | Vite 配置 | 需修改（删除 /v1 代理） |

## SSE 事件协议

```typescript
type AgentEvent =
  | { type: "agent_start";    agentId: string; agentName: string; phase?: string }
  | { type: "agent_thinking"; agentId: string; content: string }
  | { type: "agent_tool";     agentId: string; toolName: string; input: any }
  | { type: "agent_result";   agentId: string; toolName: string; output: string }
  | { type: "agent_complete"; agentId: string; summary?: string }
  | { type: "final_answer";   content: string }
  | { type: "error";          message: string }
```

## Interfaces / Contracts

### LLM 调用

```typescript
// server/llm.ts
interface ProviderConfig {
  baseUrl: string;   // e.g., "https://api.openai.com/v1"
  apiKey: string;
  model: string;
}

interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}

interface LLMResponse {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: "stop" | "tool_calls" | "length";
}

// 核心函数
async function callLLM(
  config: ProviderConfig,
  messages: LLMMessage[],
  tools?: ToolDefinition[]
): Promise<LLMResponse>;

async function* callLLMStream(
  config: ProviderConfig,
  messages: LLMMessage[],
  tools?: ToolDefinition[]
): AsyncIterable<LLMChunk>;
```

### Agent 定义

```typescript
// server/agents/config.ts
interface AgentDefinition {
  id: string;
  name: string;
  systemPrompt: string;
  tools?: ToolDefinition[];  // 仅 host agent 有
}

const HOST_AGENT: AgentDefinition;
const CONCEPT_AGENT: AgentDefinition;
const VERTICAL_AGENT: AgentDefinition;
const MARKET_AGENT: AgentDefinition;

// Host agent 的 tools 定义
const HOST_TOOLS: ToolDefinition[];
```

### 调度引擎

```typescript
// server/orchestrator.ts
async function* orchestrate(
  config: ProviderConfig,
  userMessage: string,
  onEvent: (event: AgentEvent) => void
): AsyncIterable<AgentEvent>;
```

### REST API

| 方法 | 路径 | 用途 | 请求体 |
|------|------|------|--------|
| `GET` | `/api/health` | 健康检查 | - |
| `GET` | `/api/models` | 从 provider 拉取模型列表 | Query: `baseUrl`, `apiKey` |
| `GET` | `/api/sessions` | 列出会话 | - |
| `POST` | `/api/sessions` | 新建会话 | `{ title, model }` |
| `GET` | `/api/sessions/:id` | 获取会话详情 | - |
| `PATCH` | `/api/sessions/:id` | 更新会话 | `{ title, model }` |
| `DELETE` | `/api/sessions/:id` | 删除会话 | - |
| `POST` | `/api/chat` | **核心**：多 Agent 调度 | `{ sessionId, message, provider: { baseUrl, apiKey, model } }` |

### Provider 配置（前端 localStorage）

```typescript
// src/hooks/useProvider.ts
interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// localStorage key: "rush_provider_config"
```

## Testing and Verification Strategy

### 手动验收

1. **依赖** → `npm install` 无 `@tencent-ai/agent-sdk`
2. **TypeScript** → `npx tsc --noEmit` 新建/改文件全过
3. **前端启动** → `npm run dev` → `http://localhost:5173/`
4. **设置页面** → 能配置 API Base URL + API Key + Model
5. **Provider 持久化** → 配置后刷新页面，配置还在
6. **多 Agent 协作** → 选主持 Agent → 填「单反」→ 看到 Agent 卡片
7. **最终输出** → 渲染 Markdown 格式的「入坑指南」

### 不测

- ❌ 不写单测
- ❌ 不测网络故障容错
- ❌ 不做性能压测

## Known Risks

| 风险 | 触发条件 | 缓解 |
|------|----------|------|
| Provider API 不兼容 | 用户配置了非 OpenAI 兼容服务 | 错误提示 + 测试连接按钮 |
| Function calling 不支持 | 某些 provider 不支持 tools | 降级为固定流水线（并行调 3 个子 Agent） |
| 模型不支持中文 | 某些小模型中文能力弱 | 在 prompt 中强调中文输出 |
| 端口占用 | EADDRINUSE | `npm run dev:clean` |

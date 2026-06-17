# Tasks

## 当前里程碑：M2 — 重构：去 CodeBuddy 化 + 通用 Provider

### Goal

将项目从 CodeBuddy SDK 绑定的 demo 重构为**通用的多 Agent 协作 Web 应用**：
- 删除所有 CodeBuddy SDK 依赖
- 用标准 OpenAI function calling 实现多 Agent 调度
- 用户可通过 UI 配置任何 OpenAI 兼容 LLM provider
- 前端实时可视化 Agent 协作过程

### Scope

#### 后端重构
- [x] 新建 `server/llm.ts`：LLM 调用封装（fetch + SSE 解析）
- [x] 新建 `server/agents/config.ts`：Agent 定义（prompt + tools）
- [x] 新建 `server/orchestrator.ts`：多 Agent 调度引擎（function calling）
- [x] 重写 `server/index.ts`：删除 SDK 代码，挂载新 `/api/chat`
- [x] 删除 `server/openai-compat.ts`（不再需要桥接层）
- [x] 删除 `/api/check-login`、`/api/save-env-config`、`/api/permission-response`
- [x] 删除 `/v1/models`、`/v1/chat/completions`（后端不再是 OpenAI 代理）

#### 前端重构
- [x] 新建 `src/hooks/useProvider.ts`：Provider 配置管理（localStorage）
- [x] 新建 `src/components/AgentCard.tsx`：Agent 协作可视化卡片
- [x] 重写 `src/pages/SettingsPage.tsx`：Provider 配置页面
- [x] 重写 `src/pages/ChatPage.tsx`：适配新 SSE 协议，渲染 Agent 卡片
- [x] 重写 `src/hooks/useChat.ts`：解析新 SSE 事件类型
- [x] 重写 `src/hooks/useAgents.ts`：删除 CodeBuddy 预设

#### 依赖清理
- [x] 删除 `@tencent-ai/agent-sdk`（package.json）
- [x] 删除 `CODEBUDDY_*` 环境变量（.env.example）
- [x] 更新 `vite.config.ts`：删除 `/v1` 代理

### Explicitly NOT in Scope

- ❌ 多用户/权限管理
- ❌ 单元测试/集成测试
- ❌ CI/CD 流水线
- ❌ 修模板自带的 12 个 TypeScript 错（lucide-react size prop）
- ❌ 添加新的子 Agent（保持现有 3 个）

### Acceptance Criteria

#### 后端
- [ ] `npx tsc --noEmit` 通过（新建/改文件）
- [ ] `npm install` 无 `@tencent-ai/agent-sdk` 依赖
- [ ] `curl -X POST /api/chat` 能触发多 Agent 调度（需配置 provider）
- [ ] SSE 事件流包含 `agent_start`、`agent_thinking`、`agent_complete`、`final_answer`

#### 前端
- [ ] 设置页面能配置 API Base URL + API Key + Model
- [ ] Provider 配置存入 localStorage，刷新不丢
- [ ] 选择主持 Agent → 填入坑对象 → 看到 Agent 卡片协作过程
- [ ] 最终渲染 Markdown 格式的「入坑指南」

---

## 已完成：M1 — MVP 跑通（旧版，CodeBuddy SDK）

<details>
<summary>点击展开历史</summary>

### Slice A: 多 Agent 团队（已完成）
- [x] Implement: `server/agents/rush-into-pit.ts`
- [x] Implement: `server/index.ts`（检测 host agentId + 注入 agents）
- [x] Implement: `src/hooks/useAgents.ts`（5 个预设 Agent）
- [x] Implement: `src/components/NewChatView.tsx`
- [x] Implement: `src/pages/ChatPage.tsx`

### Slice B: OpenAI 兼容层（已完成）
- [x] Implement: `server/openai-compat.ts`
- [x] Implement: `server/index.ts` 挂载新路由

### Slice C: 部署前清理（已完成）
- [x] Implement: `scripts/kill-port.mjs`
- [x] Update: `.npmrc`、`.env.example`、`.gitignore`
- [x] Update: 端口从 3000 改到 1234

</details>

---

## Bugs / Stabilization

无已知 bug。

---

## Technical Debt / Polish Debt

- [ ] 模板自带的 12 个 TypeScript 错（lucide-react size）—— 不影响运行
- [ ] `NewChatView.tsx` 的 12 个 `QUICK_TOPICS` 写死 —— 后续可改成可配置

---

## Later / Backlog

- [ ] 支持自定义子 Agent（用户在 Settings 里加）
- [ ] Token 用量统计
- [ ] 历史入坑面板
- [ ] WebSocket 替代 SSE

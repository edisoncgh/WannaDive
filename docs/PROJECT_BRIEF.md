# Project Brief — 快速入坑 (Agent Rush Into Pit)

## 产品定位

一个**通用的多 Agent 协作 Web 应用**，帮助用户对任何新事物（单反、足球、咖啡、基金等）快速「扫盲 + 入坑」。

核心设计：**主持 Agent + 3 个专家子 Agent** 的协作团队——主持 Agent 用 1-2 个问题了解用户的了解程度和需求，然后通过 function calling 调度子 Agent 并行检索概念/垂向/市场信息，最后收拢成结构化「入坑指南」。

**不绑定任何特定 LLM provider**——用户可自选任何 OpenAI 兼容服务（OpenAI、DeepSeek、Moonshot、Ollama 等）。

## 目标用户

- 对某个领域感兴趣、想快速入门的普通人
- 不需要懂技术，只需在 UI 里配置 API Key 即可使用

## 核心功能

| 功能 | 说明 |
|------|------|
| 🎯 主持 Agent | 总指挥，通过 function calling 动态调度子 Agent |
| 📚 概念扫盲 Agent | 用通俗类比解释核心概念、术语、历史、玩法 |
| 🔍 垂向信息 Agent | 检索圈子文化、行话黑话、细分流派、关键议题 |
| 💰 市场信息 Agent | 检索入门价位、品牌对比、第一件装备、避坑提醒 |
| ⚙️ Provider 设置 | UI 配置 API Base URL + API Key + Model |
| 🎨 协作可视化 | 前端实时展示 Agent 调度和工作过程 |

## 技术栈

- **前端**：React 19 + TypeScript + Vite 5 + TDesign React
- **后端**：Express 4 + SSE
- **AI**：标准 OpenAI Chat Completions API（fetch，不依赖任何 SDK）
- **存储**：SQLite（会话/消息） + localStorage（Provider 配置）

## 运行方式

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:5173/
# 在设置页面配置 LLM Provider
# 选择主持 Agent → 填入坑对象 → 开始入坑
```

## 边界约束

- **不依赖**任何特定 LLM SDK（CodeBuddy、LangChain、AutoGen 等）
- **不支持** OpenAI 兼容以外的 API 格式
- **不做**多用户/权限管理（单用户演示项目）
- **不写**单元测试（MVP 阶段）

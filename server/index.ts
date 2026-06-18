import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";
import { orchestrate, AgentEvent } from "./orchestrator.js";
import { diveOrchestrate } from "./diveOrchestrator.js";
import { ProviderConfig } from "./llm.js";
import type { UserLevel } from "./types/dive.js";
import { registerTool } from "./tools/registry.js";
import { webSearchAdapter } from "./tools/webSearch.js";
import { urlReaderAdapter } from "./tools/urlReader.js";
import { scraplingAdapter } from "./tools/scrapling.js";
import { agentReachAdapter } from "./tools/agentReach.js";

// 注册工具适配器
registerTool(webSearchAdapter);
registerTool(urlReaderAdapter);
registerTool(scraplingAdapter);
registerTool(agentReachAdapter);

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 1234; // 默认 1234，避免与常见端口冲突

// Middleware
app.use(express.json());

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 获取可用模型列表
app.get("/api/models", async (req, res) => {
  const { baseUrl, apiKey } = req.query;

  if (!baseUrl || !apiKey) {
    // 返回默认模型列表
    return res.json({
      models: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
      ]
    });
  }

  try {
    const url = `${String(baseUrl).replace(/\/+$/, "")}/models`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    res.json({ models: data.data || [] });
  } catch (err: any) {
    res.json({
      models: [
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      ],
      error: err.message
    });
  }
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量）
app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }

    const messages = db.getMessagesBySession(sessionId);

    // 解析 tool_calls JSON
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));

    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = "gpt-4o-mini", title = "新对话" } = req.body;
    const now = new Date().toISOString();

    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });

    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;

    const success = db.updateSession(sessionId, { title, model });

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API =============

// 发送消息并获取流式响应（旧版，兼容）
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, provider } = req.body;

  // 参数校验
  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }
  if (!provider?.baseUrl || !provider?.apiKey || !provider?.model) {
    return res.status(400).json({ error: "请先配置 LLM Provider（baseUrl, apiKey, model）" });
  }

  const providerConfig: ProviderConfig = {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
  };

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: provider.model,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
  }

  // 保存用户消息
  const userMessageId = uuidv4();
  db.createMessage({
    id: userMessageId,
    session_id: session.id,
    role: 'user',
    content: message,
    model: null,
    created_at: now,
    tool_calls: null
  });

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 发送初始化事件
  const assistantMessageId = uuidv4();
  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    assistantMessageId,
    model: provider.model
  })}\n\n`);

  let fullResponse = "";

  try {
    // 调用调度引擎
    for await (const event of orchestrate(providerConfig, message)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // 收集最终回答
      if (event.type === "final_answer") {
        fullResponse = event.content;
      }
    }

    // 发送完成事件
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);

    // 保存助手消息
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: provider.model,
      created_at: new Date().toISOString(),
      tool_calls: null
    });

    // 更新会话标题（如果是第一条消息）
    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, {
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: provider.model
      });
    }

    res.end();
  } catch (err: any) {
    console.error("[Chat] Error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    res.end();
  }
});

// ============= Dive Session API =============

// 创建 Dive Session 并执行（新版，结构化事件流）
app.post("/api/dive", async (req, res) => {
  const { message, topic, userLevel, provider } = req.body;

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }
  if (!provider?.baseUrl || !provider?.apiKey || !provider?.model) {
    return res.status(400).json({ error: "请先配置 LLM Provider（baseUrl, apiKey, model）" });
  }

  const providerConfig: ProviderConfig = {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: provider.model,
  };

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const event of diveOrchestrate(
      providerConfig,
      message,
      topic ?? "未知",
      (userLevel as UserLevel) ?? "unknown",
    )) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  } catch (err: any) {
    console.error("[Dive] Error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", diveId: "", message: err.message })}\n\n`);
    res.end();
  }
});

// 获取 Dive 列表
app.get("/api/dives", (req, res) => {
  try {
    const dives = db.getAllDives();
    res.json({ dives });
  } catch (error: any) {
    console.error("[Dives] Error:", error);
    res.status(500).json({ error: error?.message || "获取 Dive 列表失败" });
  }
});

// 获取 Dive 详情
app.get("/api/dives/:diveId", (req, res) => {
  try {
    const { diveId } = req.params;
    const dive = db.getDive(diveId);
    if (!dive) {
      return res.status(404).json({ error: "Dive 不存在" });
    }

    const tasks = db.getAgentTasksByDive(diveId);
    const events = db.getAgentEventsByDive(diveId);
    const evidence = db.getEvidenceByDive(diveId);
    const reports = db.getAgentReportsByDive(diveId);
    const guide = db.getDiveGuideByDive(diveId);

    res.json({ dive, tasks, events, evidence, reports, guide });
  } catch (error: any) {
    console.error("[Dive] Error:", error);
    res.status(500).json({ error: error?.message || "获取 Dive 详情失败" });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ API 服务器已启动                      ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: SQLite (data/chat.db)          ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});

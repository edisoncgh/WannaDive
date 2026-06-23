/**
 * Dive Session 调度引擎
 *
 * 实现 Augmentation_Plan.md 中的 Dive Session 状态机：
 *   clarifying → planning → executing → synthesizing → completed
 *
 * 与旧 orchestrator.ts 的区别：
 *   - 每次调用创建一个 Dive Session（持久化到 DB）
 *   - 子 Agent 通过 AgentTask 跟踪（持久化到 DB）
 *   - SSE 事件结构化为 DiveAgentEvent（含 diveId / taskId）
 *   - 支持 Agent Mission Board UI 渲染
 */

import { v4 as uuidv4 } from "uuid";
import {
  callLLM,
  type ProviderConfig,
  type LLMMessage,
  type ToolCall,
} from "./llm.js";
import {
  HOST_AGENT,
  CONCEPT_AGENT,
  VERTICAL_AGENT,
  MARKET_AGENT,
  INSIDER_AGENT,
  MISCONCEPTION_AGENT,
  CRITIC_AGENT,
  HOST_TOOLS,
  type AgentDefinition,
} from "./agents/config.js";
import type {
  DiveAgentEvent,
  DivePlan,
  DivePlanAgent,
  DiveGuideContent,
  DomainType,
  UserLevel,
  AgentTaskStatus,
  CriticScore,
  AgentRunStep,
} from "./types/dive.js";
import * as db from "./db.js";
import { classifyDomain } from "./domainRouter.js";
import { getPlaybook } from "./playbooks/index.js";
import { search, readUrl } from "./tools/registry.js";
import { missionBoardService } from "./services/missionBoardService.js";

// ============================================================
// 子 Agent 注册表
// ============================================================

const SUB_AGENT_REGISTRY: Record<string, AgentDefinition> = {
  dispatch_concept_agent: CONCEPT_AGENT,
  dispatch_vertical_agent: VERTICAL_AGENT,
  dispatch_market_agent: MARKET_AGENT,
  dispatch_insider_agent: INSIDER_AGENT,
  dispatch_misconception_agent: MISCONCEPTION_AGENT,
};

const AGENT_TITLES: Record<string, string> = {
  concept: "概念扫盲",
  vertical: "垂向信息",
  market: "市场信息",
  insider: "内行洞察",
  misconception: "新手误区",
};

// ============================================================
// Dive Orchestrator 主流程
// ============================================================

export async function* diveOrchestrate(
  config: ProviderConfig,
  userMessage: string,
  topic: string,
  userLevel: UserLevel = "unknown",
  sessionId?: string,
): AsyncGenerator<DiveAgentEvent> {
  const now = new Date().toISOString();
  const diveId = uuidv4();

  try {
    // ---- 步骤 1：创建 Dive Session ----
    db.createDive({
      id: diveId,
      topic,
      user_level: userLevel,
      user_goal: null,
      domain_type: "general",
      status: "planning",
      session_id: sessionId ?? null,
      created_at: now,
      updated_at: now,
    });

    // 如果有 sessionId，链接 Dive 到 Session
    if (sessionId) {
      db.linkDiveToSession(sessionId, diveId);
    }

    yield { type: "dive_created", diveId, topic };

    // ---- 步骤 2：领域分类 ----
    const classification = await classifyDomain(config, topic);
    const playbook = getPlaybook(classification.domainType);

    // 更新 Dive 的领域类型
    db.updateDiveStatus(diveId, "planning");

    yield {
      type: "note_added",
      diveId,
      taskId: "host-planning",
      note: `领域识别：${playbook.label}（${classification.reason}）`,
    };

    // ---- 步骤 3：Host Agent 规划阶段 ----

    yield {
      type: "agent_started",
      diveId,
      taskId: "host-planning",
      agentId: "host",
      title: "主持 Agent 规划中",
    };

    // 构建增强的 Host Agent prompt（含 Playbook 上下文）
    const playbookContext = buildPlaybookContext(playbook, topic, userLevel);
    const messages: LLMMessage[] = [
      { role: "system", content: HOST_AGENT.systemPrompt + playbookContext },
      { role: "user", content: userMessage },
    ];

    const firstResponse = await callLLM(config, messages, HOST_TOOLS);
    const toolCalls = firstResponse.tool_calls;

    // ---- 步骤 3：Host 返回调度指令 ----
    if (toolCalls !== undefined && toolCalls.length > 0) {
      // Host 的思考内容
      if (firstResponse.content !== null && firstResponse.content.trim() !== "") {
        yield {
          type: "note_added",
          diveId,
          taskId: "host-planning",
          note: firstResponse.content,
        };
      }

      // 构建 Dive Plan
      const plan = buildDivePlan(toolCalls, classification.domainType);
      yield { type: "plan_created", diveId, plan };

      // 把 Host 的 assistant 消息追加到对话历史
      messages.push({
        role: "assistant",
        content: firstResponse.content,
        tool_calls: toolCalls,
      });

      // ---- 步骤 4：并行执行子 Agent ----
      db.updateDiveStatus(diveId, "executing");

      const agentTaskPairs = createAgentTaskRecords(diveId, toolCalls);

      // 事件队列：子 Agent 通过回调推送状态事件
      const statusQueue: DiveAgentEvent[] = [];

      const subAgentPromises = agentTaskPairs.map(({ task, toolCall }) =>
        executeDiveSubAgent(config, diveId, task, toolCall, (status, message, progress) => {
          db.updateAgentTaskStatus(task.id, status, progress);
          statusQueue.push({
            type: "agent_status",
            diveId,
            taskId: task.id,
            status: status as AgentTaskStatus,
            message,
            progress,
          });
        }, (step) => {
          statusQueue.push({
            type: "agent_step_started",
            diveId,
            taskId: task.id,
            step,
          });
        }),
      );

      // yield 每个 agent_started
      for (const { task } of agentTaskPairs) {
        yield {
          type: "agent_started",
          diveId,
          taskId: task.id,
          agentId: task.agent_id,
          title: AGENT_TITLES[task.agent_id] ?? task.agent_id,
        };
      }

      // 等待所有子 Agent 完成，期间定期刷新状态队列
      const settledPromise = Promise.allSettled(subAgentPromises);

      let settled = false;
      settledPromise.then(() => { settled = true; });
      const timeout = Date.now() + 5 * 60 * 1000; // 5 分钟超时
      while (!settled) {
        if (Date.now() > timeout) {
          yield { type: "error", diveId, message: "子 Agent 执行超时（5 分钟）" };
          return;
        }
        while (statusQueue.length > 0) {
          yield statusQueue.shift()!;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      while (statusQueue.length > 0) {
        yield statusQueue.shift()!;
      }
      const results = await settledPromise;

      // 处理结果
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const { task, toolCall } = agentTaskPairs[i];

        if (result.status === "fulfilled") {
          // 更新 AgentTask 状态
          db.updateAgentTaskStatus(task.id, "completed", 100);
          db.updateAgentTaskOutput(task.id, result.value.content);

          // 保存报告
          db.createAgentReport({
            id: uuidv4(),
            dive_id: diveId,
            task_id: task.id,
            agent_id: task.agent_id,
            report_json: JSON.stringify({ content: result.value.content }),
            created_at: new Date().toISOString(),
          });

          // 作为 tool_result 追加到 messages
          messages.push({
            role: "tool",
            content: result.value.content,
            tool_call_id: toolCall.id,
          });

          yield {
            type: "agent_report_ready",
            diveId,
            taskId: task.id,
            reportId: task.id,
          };

          yield {
            type: "agent_status",
            diveId,
            taskId: task.id,
            status: "completed",
            message: `${AGENT_TITLES[task.agent_id] ?? task.agent_id} 完成`,
            progress: 100,
          };
        } else {
          // 子 Agent 失败
          const failMsg =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);

          db.updateAgentTaskStatus(task.id, "failed", 0);

          yield {
            type: "agent_status",
            diveId,
            taskId: task.id,
            status: "failed",
            message: `执行失败: ${failMsg}`,
            progress: 0,
          };

          // 追加错误 tool_result
          messages.push({
            role: "tool",
            content: JSON.stringify({ error: failMsg }),
            tool_call_id: toolCall.id,
          });
        }
      }

      // ---- 步骤 5：Host 整合（结构化输出）----
      db.updateDiveStatus(diveId, "synthesizing");
      yield { type: "synthesis_started", diveId };

      // 追加结构化输出指令
      messages.push({
        role: "user",
        content: buildStructuredSynthesisPrompt(topic, userLevel, playbook),
      });

      const finalResponse = await callLLM(config, messages);
      let finalContent = finalResponse.content ?? "";

      // 尝试解析结构化 JSON
      const guideJson = parseGuideJson(finalContent);

      // ---- 步骤 6：Critic Agent 审稿 ----
      const criticScore = await runCriticAgent(config, topic, finalContent);

      if (criticScore !== null) {
        yield { type: "critic_score", diveId, score: criticScore };

        if (criticScore.overall < 7) {
          yield {
            type: "note_added",
            diveId,
            taskId: "host-synthesis",
            note: `审稿评分 ${criticScore.overall}/10，触发重写。问题：${criticScore.issues.join("；")}`,
          };

          messages.push({ role: "assistant", content: finalContent });
          messages.push({
            role: "user",
            content: `审稿 Agent 评分 ${criticScore.overall}/10，需要改进。具体问题：\n${criticScore.issues.map((i) => `- ${i}`).join("\n")}\n\n请根据以上问题重写，保持相同的 JSON 结构。重点改进：\n${criticScore.rewriteSuggestions.map((s) => `- ${s}`).join("\n")}`,
          });

          const rewriteResponse = await callLLM(config, messages);
          finalContent = rewriteResponse.content ?? finalContent;
        }
      }

      // 保存 Dive Guide（结构化 + markdown）
      const guideId = uuidv4();
      const guideData = {
        content: finalContent,
        guide: guideJson,
        criticScore,
        topic,
        userLevel,
        domainType: classification.domainType,
      };
      db.createDiveGuide({
        id: guideId,
        dive_id: diveId,
        guide_json: JSON.stringify(guideData),
        markdown: finalContent,
        created_at: new Date().toISOString(),
      });

      db.updateDiveStatus(diveId, "completed");

      // 保存 guide 为 assistant message
      if (sessionId) {
        db.createMessage({
          id: uuidv4(),
          session_id: sessionId,
          role: 'assistant',
          content: finalContent,
          model: null,
          created_at: new Date().toISOString(),
          tool_calls: null,
          metadata_json: JSON.stringify({ diveId, guideId }),
        });
        db.linkDiveToSession(sessionId, diveId);
      }

      yield {
        type: "final_ready",
        diveId,
        guideId,
        content: finalContent,
        guide: guideJson ?? undefined,
      };
      yield { type: "done" };
      return;
    }

    // ---- 分支 B：Host 直接回答（无 tool_calls）----
    const directContent = firstResponse.content ?? "";

    const guideId = uuidv4();
    db.createDiveGuide({
      id: guideId,
      dive_id: diveId,
      guide_json: JSON.stringify({ content: directContent }),
      markdown: directContent,
      created_at: new Date().toISOString(),
    });

    db.updateDiveStatus(diveId, "completed");

    // 保存 guide 为 assistant message
    if (sessionId) {
      db.createMessage({
        id: uuidv4(),
        session_id: sessionId,
        role: 'assistant',
        content: directContent,
        model: null,
        created_at: new Date().toISOString(),
        tool_calls: null,
        metadata_json: JSON.stringify({ diveId, guideId }),
      });
      db.linkDiveToSession(sessionId, diveId);
    }

    yield { type: "final_ready", diveId, guideId, content: directContent };
    yield { type: "done" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dive 调度引擎发生未知错误";
    db.updateDiveStatus(diveId, "failed");
    yield { type: "error", diveId, message };
  }
}

// ============================================================
// 内部辅助函数
// ============================================================

function buildPlaybookContext(
  playbook: { label: string; mustExplain: string[]; avoid: string[]; insiderQuestions: string[] },
  topic: string,
  userLevel: string,
): string {
  const lines: string[] = [
    "",
    "【领域 Playbook 上下文】",
    `入坑对象「${topic}」属于「${playbook.label}」领域。`,
    "",
    "必须覆盖的内容：",
    ...playbook.mustExplain.map((item) => `- ${item}`),
    "",
    "应该避免的内容：",
    ...playbook.avoid.map((item) => `- ${item}`),
    "",
    "内行视角的关键问题：",
    ...playbook.insiderQuestions.map((q) => `- ${q}`),
  ];
  return lines.join("\n");
}

function buildDivePlan(toolCalls: ToolCall[], domainType: DomainType = "general"): DivePlan {
  const agents: DivePlanAgent[] = toolCalls.map((tc) => {
    const name = tc.function.name.replace("dispatch_", "").replace("_agent", "");
    return {
      agentId: name,
      title: AGENT_TITLES[name] ?? name,
      purpose: `调研 ${name} 相关信息`,
    };
  });

  return {
    domainType,
    agents,
    sourcePlan: {
      topic: "",
      domainType,
      sourceGroups: [],
    },
  };
}

function createAgentTaskRecords(
  diveId: string,
  toolCalls: ToolCall[],
): { task: db.DbAgentTask; toolCall: ToolCall }[] {
  const now = new Date().toISOString();
  const pairs: { task: db.DbAgentTask; toolCall: ToolCall }[] = [];

  for (const tc of toolCalls) {
    const agentName = tc.function.name
      .replace("dispatch_", "")
      .replace("_agent", "");
    const task: db.DbAgentTask = {
      id: uuidv4(),
      dive_id: diveId,
      agent_id: agentName,
      title: AGENT_TITLES[agentName] ?? agentName,
      status: "queued",
      progress: 0,
      input_json: tc.function.arguments,
      output_json: null,
      started_at: null,
      finished_at: null,
      created_at: now,
    };
    db.createAgentTask(task);
    pairs.push({ task, toolCall: tc });
  }

  return pairs;
}

async function executeDiveSubAgent(
  config: ProviderConfig,
  diveId: string,
  task: db.DbAgentTask,
  toolCall: ToolCall,
  onStatus?: (status: string, message: string, progress?: number) => void,
  onStep?: (step: AgentRunStep) => void,
): Promise<{ agentId: string; content: string }> {
  const agentDef = SUB_AGENT_REGISTRY[toolCall.function.name];
  if (agentDef === undefined) {
    console.error(`[DiveOrchestrator] 未知的子 Agent: "${toolCall.function.name}", 注册表 keys: ${Object.keys(SUB_AGENT_REGISTRY).join(", ")}`);
    throw new Error(`未知的子 Agent: ${toolCall.function.name}`);
  }

  const args = parseToolArguments(toolCall);
  const topic = typeof args.topic === "string" ? args.topic : "未知对象";
  const level = typeof args.level === "string" ? args.level : "一般了解";
  const budget = typeof args.budget === "string" ? args.budget : undefined;

  // ---- 记录 assigned 步骤 ----
  const assignedStep = missionBoardService.addStep({
    diveId,
    taskId: task.id,
    stepType: 'assigned',
    title: `分配给 ${AGENT_TITLES[task.agent_id] ?? task.agent_id}`,
    description: `主题：${topic}，水平：${level}`,
    status: 'completed',
  });
  onStep?.(assignedStep);

  // ---- 用工具搜集外部信息 ----
  let externalContext = "";
  try {
    onStatus?.("searching", "正在搜索外部信息...", 15);
    const searchQuery = buildAgentSearchQuery(task.agent_id, topic, level);
    const searchStep = missionBoardService.addStep({
      diveId,
      taskId: task.id,
      stepType: 'tool_running',
      title: '搜索外部信息',
      description: `搜索：${searchQuery}`,
      status: 'running',
    });
    onStep?.(searchStep);
    const searchResults = await search(searchQuery, { limit: 3 });

    if (searchResults.length > 0) {
      onStatus?.("reading", `找到 ${searchResults.length} 条结果，提取中...`, 30);
      missionBoardService.updateStepStatus(searchStep.id, 'completed', `找到 ${searchResults.length} 条结果`);

      // 保存到 Evidence Store
      for (const sr of searchResults) {
        const evidenceId = uuidv4();
        db.createEvidenceItem({
          id: evidenceId,
          dive_id: diveId,
          task_id: task.id,
          source_type: "web_search",
          title: sr.title,
          url: sr.url,
          platform: sr.platform ?? "web",
          author: null,
          published_at: sr.publishedAt ?? null,
          retrieved_at: new Date().toISOString(),
          summary: sr.snippet,
          key_points_json: null,
          credibility_score: null,
          relevance_score: null,
        });

        const sourceStep = missionBoardService.addStep({
          diveId,
          taskId: task.id,
          stepType: 'source_found',
          title: `发现来源：${sr.title.slice(0, 40)}`,
          description: sr.url,
          status: 'completed',
          payload: { url: sr.url, title: sr.title },
        });
        onStep?.(sourceStep);
      }

      externalContext = "\n\n【外部搜索参考】\n" +
        searchResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   来源: ${r.url}`).join("\n\n");

      // 尝试读取第一个搜索结果的完整内容
      try {
        const topUrl = searchResults[0].url;
        onStatus?.("reading", `正在读取 ${topUrl.slice(0, 50)}...`, 40);
        const pageContent = await readUrl(topUrl, { maxLength: 2000 });
        if (pageContent && pageContent.content.length > 100) {
          externalContext += `\n\n【网页摘要】${pageContent.title}\n${pageContent.content.slice(0, 1500)}`;
        }
      } catch {
        // 读取失败，忽略
      }
    } else {
      onStatus?.("searching", "外部搜索无结果，使用 LLM 知识", 30);
      missionBoardService.updateStepStatus(searchStep.id, 'completed', '无搜索结果');
    }
  } catch (err) {
    console.error(`[DiveOrchestrator] 工具搜索失败 (${task.agent_id}):`, err);
    onStatus?.("searching", "外部搜索不可用，使用 LLM 知识", 30);
    missionBoardService.addStep({
      diveId,
      taskId: task.id,
      stepType: 'failed',
      title: '搜索失败',
      description: '外部搜索不可用',
      status: 'failed',
    });
  }

  // 构建 user message（含外部信息）
  const userContent = buildSubAgentUserMessage(topic, level, budget) + externalContext;

  onStatus?.("reporting", "正在生成报告...", 60);
  const briefStep = missionBoardService.addStep({
    diveId,
    taskId: task.id,
    stepType: 'brief_submitted',
    title: '生成报告',
    description: `${AGENT_TITLES[task.agent_id] ?? task.agent_id} 正在撰写报告`,
    status: 'running',
  });
  onStep?.(briefStep);

  const messages: LLMMessage[] = [
    { role: "system", content: agentDef.systemPrompt },
    { role: "user", content: userContent },
  ];

  const response = await callLLM(config, messages);
  missionBoardService.updateStepStatus(briefStep.id, 'completed', '报告生成完成');

  return {
    agentId: agentDef.id,
    content: response.content ?? "",
  };
}

function buildSubAgentUserMessage(
  topic: string,
  level: string,
  budget?: string,
): string {
  const lines: string[] = [
    `【入坑对象】${topic}`,
    `【了解程度】${level}`,
  ];
  if (budget !== undefined && budget.trim() !== "") {
    lines.push(`【预算】${budget}`);
  }
  lines.push("");
  lines.push("请根据以上信息，按照你的职责输出 markdown 报告。");
  return lines.join("\n");
}

function buildAgentSearchQuery(agentId: string, topic: string, level: string): string {
  const queries: Record<string, string> = {
    concept: `${topic} 核心概念 术语 入门解释`,
    vertical: `${topic} 圈子 社区 黑话 争议 讨论`,
    market: `${topic} 价格 品牌 推荐 性价比 避坑`,
    insider: `${topic} 内行 真实经验 老手建议`,
    misconception: `${topic} 新手误区 常见错误 踩坑`,
  };
  return queries[agentId] ?? `${topic} 入门 教程 推荐`;
}

function parseToolArguments(toolCall: ToolCall): Record<string, unknown> {
  const raw = toolCall.function.arguments;
  if (raw === undefined || raw === null || raw === "") {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { _raw: raw };
  }
}

async function runCriticAgent(
  config: ProviderConfig,
  topic: string,
  guideContent: string,
): Promise<CriticScore | null> {
  const messages: LLMMessage[] = [
    { role: "system", content: CRITIC_AGENT.systemPrompt },
    {
      role: "user",
      content: `请审稿以下入坑指南（主题：${topic}）：\n\n${guideContent}`,
    },
  ];

  try {
    const response = await callLLM(config, messages);
    const raw = response.content ?? "";

    // 解析 JSON
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // 验证必要字段
    if (typeof parsed.overall !== "number") return null;

    return {
      expertise: typeof parsed.expertise === "number" ? parsed.expertise : 5,
      beginnerFriendliness: typeof parsed.beginnerFriendliness === "number" ? parsed.beginnerFriendliness : 5,
      coreInsight: typeof parsed.coreInsight === "number" ? parsed.coreInsight : 5,
      actionability: typeof parsed.actionability === "number" ? parsed.actionability : 5,
      sourceGrounding: typeof parsed.sourceGrounding === "number" ? parsed.sourceGrounding : 5,
      antiGeneric: typeof parsed.antiGeneric === "number" ? parsed.antiGeneric : 5,
      communityContext: typeof parsed.communityContext === "number" ? parsed.communityContext : 5,
      overall: parsed.overall,
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
      rewriteSuggestions: Array.isArray(parsed.rewriteSuggestions) ? parsed.rewriteSuggestions.map(String) : [],
    };
  } catch (err) {
    console.error("[CriticAgent] 评分失败:", err);
    return null;
  }
}

function buildStructuredSynthesisPrompt(topic: string, userLevel: string, playbook: { label: string; mustExplain: string[] }): string {
  return `请将以上所有子 Agent 的调研结果整合成一份结构化的入坑指南。

【输出格式要求】
你必须输出一个 JSON 对象（不要输出其他内容，不要用 markdown 代码块包裹），格式如下：

{
  "essence": {
    "title": "${topic} 入坑指南",
    "oneSentence": "用一句话概括这个领域的本质",
    "mentalModel": "一个帮助新手快速抓住重点的类比或心智模型"
  },
  "dontStartWith": {
    "title": "先别管这些",
    "items": ["不急着了解的内容1", "不急着了解的内容2"]
  },
  "keyConcepts": [
    {
      "term": "术语",
      "plainExplanation": "白话解释",
      "whyItMatters": "为什么重要",
      "example": "可选的例子"
    }
  ],
  "insiderView": {
    "howExpertsThink": "内行如何看待这个领域",
    "realPriorities": ["真重点1", "真重点2"],
    "fakePriorities": ["伪重点1", "伪重点2"]
  },
  "commonMisconceptions": [
    {
      "misconception": "错误认知",
      "correction": "正确理解"
    }
  ],
  "roadmap": {
    "firstStep": "今天就可以做的第一步",
    "threeDayPlan": ["第1天做什么", "第2天做什么", "第3天做什么"],
    "sevenDayPlan": ["第4-5天", "第6-7天"],
    "thirtyDayPlan": ["第2周", "第3-4周"]
  },
  "communityContext": {
    "slang": ["黑话1", "黑话2"],
    "communities": ["社区1", "社区2"],
    "controversies": ["争议1"]
  },
  "followUpQuestions": ["可以继续深挖的问题1", "问题2"],
  "diveMap": [
    {
      "id": "node1",
      "title": "节点标题",
      "description": "节点描述",
      "level": "foundation",
      "children": [
        {
          "id": "node1-1",
          "title": "子节点",
          "description": "子节点描述",
          "level": "core",
          "suggestedPrompt": "用户点击此节点时的入坑提问"
        }
      ]
    }
  ]
}

【必须覆盖的内容】${playbook.mustExplain.map((item) => `\n- ${item}`).join("")}

【用户水平】${userLevel}

【重要】
- keyConcepts 至少 5 个
- commonMisconceptions 至少 3 个
- roadmap 必须具体可执行
- diveMap: 用树状结构组织入坑地图，每个叶子节点的 suggestedPrompt 是用户点击时的入坑提问
  - level: foundation（基础）/ core（核心）/ advanced（进阶）/ optional（可选）
  - 至少 3 个一级节点，每个一级节点下至少 2 个子节点
- 不要输出 JSON 以外的任何内容`;
}

function parseGuideJson(content: string): DiveGuideContent | null {
  try {
    // 尝试直接解析
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // 验证必要字段
    if (parsed.essence && parsed.keyConcepts && parsed.roadmap) {
      return parsed as unknown as DiveGuideContent;
    }

    // 尝试从 markdown 中提取 JSON 块
    const jsonMatch = content.match(/\{[\s\S]*?"essence"[\s\S]*?"keyConcepts"[\s\S]*?\}/);
    if (jsonMatch) {
      const innerParsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      if (innerParsed.essence && innerParsed.keyConcepts) {
        return innerParsed as unknown as DiveGuideContent;
      }
    }

    return null;
  } catch {
    // JSON 解析失败，尝试从 markdown 中提取
    const jsonMatch = content.match(/\{[\s\S]*?"essence"[\s\S]*?"keyConcepts"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        if (parsed.essence && parsed.keyConcepts) {
          return parsed as unknown as DiveGuideContent;
        }
      } catch {
        // 放弃
      }
    }
    return null;
  }
}

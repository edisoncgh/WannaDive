/**
 * 多 Agent 调度引擎
 *
 * 核心职责：
 *   1. 接收用户消息，交给 Host Agent 判断需要调度哪些子 Agent。
 *   2. 通过 function calling（标准 OpenAI tools）让 Host Agent 自主决定调度顺序和数量。
 *   3. 并行执行被调用的子 Agent（Promise.allSettled），一个失败不阻塞其他。
 *   4. 把子 Agent 结果回传给 Host Agent，由 Host 整合输出最终「入坑指南」。
 *   5. 全程通过 AsyncGenerator yield 结构化 SSE 事件给调用方（由 index.ts 写入 SSE 流）。
 *
 * 设计原则（见 RULES.md 第 5 条）：
 *   - Host Agent 通过 function calling 动态决定调度哪些子 Agent，不硬编码顺序。
 *   - 子 Agent 并行执行（Promise.allSettled），一个失败不阻塞其他。
 *   - 子 Agent 结果必须回传给 Host Agent 进行最终整合。
 *   - 子 Agent 只做纯 LLM 调用，不使用 tools。
 *   - 调度逻辑在后端，前端不做编排。
 */

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
  HOST_TOOLS,
  type AgentDefinition,
} from "./agents/config.js";

// ============================================================
// SSE 事件类型定义
// ============================================================

/**
 * Agent 协作过程中推送给前端的结构化事件。
 *
 * 事件流典型顺序：
 *   agent_start(host) → agent_thinking(host) → agent_tool(host) × N
 *     → 对每个子 Agent：agent_start → agent_complete
 *     → agent_start(host, phase=synthesis) → final_answer
 *
 * 或无 tool_calls 时：
 *   agent_start(host) → final_answer
 */
export type AgentEvent =
  | { type: "agent_start"; agentId: string; agentName: string; phase?: string }
  | { type: "agent_thinking"; agentId: string; content: string }
  | { type: "agent_tool"; agentId: string; toolName: string; input: any }
  | { type: "agent_result"; agentId: string; toolName: string; output: string }
  | { type: "agent_complete"; agentId: string; summary?: string }
  | { type: "final_answer"; content: string }
  | { type: "error"; message: string };

// ============================================================
// 子 Agent 注册表
// ============================================================

/**
 * tool_name → AgentDefinition 映射表。
 *
 * Host Agent 的 function calling 返回的 tool name 会对应到这里。
 * 新增子 Agent 时只需在 config.ts 定义并在注册表添加一条。
 */
const SUB_AGENT_REGISTRY: Record<string, AgentDefinition> = {
  "dispatch_concept_agent": CONCEPT_AGENT,
  "dispatch_vertical_agent": VERTICAL_AGENT,
  "dispatch_market_agent": MARKET_AGENT,
};

// ============================================================
// 子 Agent 执行
// ============================================================

/**
 * 执行单个子 Agent（纯 LLM 调用，不带 tools）。
 *
 * 子 Agent 接收 Host Agent 解析出的 topic / level / budget，
 * 返回一段 markdown 报告作为素材供 Host 整合。
 *
 * @param config   - LLM provider 配置
 * @param agentDef - 子 Agent 定义（含 systemPrompt）
 * @param topic    - 入坑对象（例如 "单反相机"）
 * @param level    - 用户了解程度（例如 "纯小白"）
 * @param budget   - 可选预算信息
 * @returns `{ agentId, content }` —— agentId 用于事件追踪，content 为子 Agent 输出
 */
export async function executeSubAgent(
  config: ProviderConfig,
  agentDef: AgentDefinition,
  topic: string,
  level: string,
  budget?: string,
): Promise<{ agentId: string; content: string }> {
  // 构建 user message：把 Host Agent 解析出的参数传给子 Agent
  const userContent = buildSubAgentUserMessage(topic, level, budget);

  const messages: LLMMessage[] = [
    { role: "system", content: agentDef.systemPrompt },
    { role: "user", content: userContent },
  ];

  // 子 Agent 不使用 tools —— 纯 LLM 调用（见 RULES.md 5.3）
  const response = await callLLM(config, messages);

  return {
    agentId: agentDef.id,
    content: response.content ?? "",
  };
}

/**
 * 根据参数构建子 Agent 的 user message。
 * 预算字段可选，仅在存在时拼入。
 */
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

// ============================================================
// 主调度生成器
// ============================================================

/**
 * 多 Agent 调度主流程（AsyncGenerator）。
 *
 * 调用方（通常是 SSE 端点）通过 `for await ... of orchestrate(...)` 消费事件，
 * 每个 yield 的事件直接写入 SSE 流。
 *
 * 流程概述：
 *   1. yield agent_start（host）
 *   2. 第一轮 callLLM（带 HOST_TOOLS）—— Host 决定调度哪些子 Agent
 *   3. 如果返回 tool_calls：
 *      a. yield agent_thinking（host 的思考内容，如果有）
 *      b. yield agent_tool × 每个 tool_call
 *      c. 并行执行所有子 Agent（Promise.allSettled）
 *      d. 对每个子 Agent：yield agent_start → yield agent_complete
 *      e. 把子 Agent 结果作为 tool_result 追加到 messages
 *      f. 第二轮 callLLM（不带 tools）—— Host 整合素材
 *      g. yield agent_start（host, phase=synthesis）
 *      h. yield final_answer
 *   4. 如果没有 tool_calls：
 *      a. yield final_answer（直接用第一轮回复）
 *
 * @param config      - LLM provider 配置
 * @param userMessage - 用户原始消息
 * @yields AgentEvent - 结构化事件
 */
export async function* orchestrate(
  config: ProviderConfig,
  userMessage: string,
): AsyncGenerator<AgentEvent> {
  try {
    // ---- 步骤 1：启动 Host Agent ----
    yield {
      type: "agent_start",
      agentId: HOST_AGENT.id,
      agentName: HOST_AGENT.name,
    };

    // ---- 步骤 2：构建首轮消息 ----
    const messages: LLMMessage[] = [
      { role: "system", content: HOST_AGENT.systemPrompt },
      { role: "user", content: userMessage },
    ];

    // ---- 步骤 3：第一轮调用（带 tools）----
    const firstResponse = await callLLM(config, messages, HOST_TOOLS);

    const toolCalls = firstResponse.tool_calls;

    // ---- 分支 A：Host 决定调度子 Agent ----
    if (toolCalls !== undefined && toolCalls.length > 0) {
      // 如果 Host 在返回 tool_calls 的同时还有文本内容，先推送思考过程
      if (firstResponse.content !== null && firstResponse.content.trim() !== "") {
        yield {
          type: "agent_thinking",
          agentId: HOST_AGENT.id,
          content: firstResponse.content,
        };
      }

      // 把 Host 的 assistant 消息（含 tool_calls）追加到对话历史
      messages.push({
        role: "assistant",
        content: firstResponse.content,
        tool_calls: toolCalls,
      });

      // yield 每个 tool_call 事件
      for (const tc of toolCalls) {
        const parsedInput = parseToolArguments(tc);
        yield {
          type: "agent_tool",
          agentId: HOST_AGENT.id,
          toolName: tc.function.name,
          input: parsedInput,
        };
      }

      // ---- 并行执行所有子 Agent ----
      const subAgentTasks = toolCalls.map((tc) =>
        executeSubAgentFromToolCall(config, tc),
      );
      const results = await Promise.allSettled(subAgentTasks);

      // ---- 处理每个子 Agent 的结果 ----
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const tc = toolCalls[i];
        const subAgentDef = SUB_AGENT_REGISTRY[tc.function.name];

        // 注册表中找不到对应子 Agent 定义 —— 记录错误结果但不阻塞
        if (subAgentDef === undefined) {
          const errorMsg = `未知的子 Agent: ${tc.function.name}`;
          messages.push({
            role: "tool",
            content: JSON.stringify({ error: errorMsg }),
            tool_call_id: tc.id,
          });
          yield {
            type: "agent_result",
            agentId: HOST_AGENT.id,
            toolName: tc.function.name,
            output: errorMsg,
          };
          continue;
        }

        if (result.status === "fulfilled") {
          // 子 Agent 成功
          yield {
            type: "agent_start",
            agentId: subAgentDef.id,
            agentName: subAgentDef.name,
          };

          // 把子 Agent 输出作为 tool_result 追加到 messages
          messages.push({
            role: "tool",
            content: result.value.content,
            tool_call_id: tc.id,
          });

          yield {
            type: "agent_result",
            agentId: subAgentDef.id,
            toolName: tc.function.name,
            output: result.value.content,
          };

          yield {
            type: "agent_complete",
            agentId: subAgentDef.id,
            summary: result.value.content.slice(0, 200), // 截取前200字作为摘要
          };
        } else {
          // 子 Agent 失败 —— 记录错误但不阻塞其他 Agent
          const failureMsg = formatSubAgentError(subAgentDef.id, result.reason);
          messages.push({
            role: "tool",
            content: JSON.stringify({ error: failureMsg }),
            tool_call_id: tc.id,
          });

          yield {
            type: "agent_start",
            agentId: subAgentDef.id,
            agentName: subAgentDef.name,
          };
          yield {
            type: "agent_result",
            agentId: subAgentDef.id,
            toolName: tc.function.name,
            output: `子 Agent 执行失败: ${failureMsg}`,
          };
          yield {
            type: "agent_complete",
            agentId: subAgentDef.id,
            summary: "执行失败",
          };
        }
      }

      // ---- 第二轮调用：Host 整合素材 ----
      yield {
        type: "agent_start",
        agentId: HOST_AGENT.id,
        agentName: HOST_AGENT.name,
        phase: "synthesis",
      };

      const finalResponse = await callLLM(config, messages);

      const finalContent = finalResponse.content ?? "";
      yield { type: "final_answer", content: finalContent };
      yield { type: "agent_complete", agentId: HOST_AGENT.id, summary: "整合完成" };
      return;
    }

    // ---- 分支 B：Host 直接回答（无 tool_calls）----
    const directContent = firstResponse.content ?? "";
    yield { type: "final_answer", content: directContent };
    yield { type: "agent_complete", agentId: HOST_AGENT.id, summary: "回答完成" };
  } catch (err) {
    // 捕获整个流程中的未处理异常，yield error 事件
    const message =
      err instanceof Error ? err.message : "调度引擎发生未知错误";
    yield { type: "error", message };
  }
}

// ============================================================
// 内部辅助函数
// ============================================================

/**
 * 从 ToolCall 构建子 Agent 执行任务。
 *
 * 解析 tool arguments 中的 topic / level / budget，
 * 在注册表中查找对应 AgentDefinition 并执行。
 *
 * 如果参数解析失败或 Agent 未注册，抛出错误（由 Promise.allSettled 捕获）。
 */
async function executeSubAgentFromToolCall(
  config: ProviderConfig,
  toolCall: ToolCall,
): Promise<{ agentId: string; content: string }> {
  const args = parseToolArguments(toolCall);
  const agentDef = SUB_AGENT_REGISTRY[toolCall.function.name];

  if (agentDef === undefined) {
    throw new Error(`未知的子 Agent: ${toolCall.function.name}`);
  }

  // 从 tool arguments 提取参数，提供合理默认值
  const topic = typeof args.topic === "string" ? args.topic : "未知对象";
  const level = typeof args.level === "string" ? args.level : "一般了解";
  const budget =
    typeof args.budget === "string" ? args.budget : undefined;

  return executeSubAgent(config, agentDef, topic, level, budget);
}

/**
 * 安全解析 ToolCall 的 arguments JSON。
 *
 * OpenAI 兼容 API 返回的 arguments 是 JSON 字符串，
 * 部分模型可能返回空字符串或不完整 JSON，需要兜底。
 */
function parseToolArguments(toolCall: ToolCall): Record<string, unknown> {
  const raw = toolCall.function.arguments;
  if (raw === undefined || raw === null || raw === "") {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // JSON 解析失败时返回空对象，避免阻塞整个流程
    return { _raw: raw };
  }
}

/**
 * 格式化子 Agent 错误信息，确保 promise rejection reason 转为可读字符串。
 */
function formatSubAgentError(agentId: string, reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === "string") {
    return reason;
  }
  return `子 Agent ${agentId} 发生未知错误`;
}

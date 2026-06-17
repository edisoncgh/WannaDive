/**
 * LLM 调用封装模块
 * 统一封装标准 OpenAI Chat Completions API 的非流式与流式调用。
 * 所有 LLM 交互必须通过此模块，禁止在其他地方直接 fetch。
 */

// ============================================================
// 类型定义
// ============================================================

/** 模型服务方配置 */
export interface ProviderConfig {
  /** API 基础地址，例如 "https://api.openai.com/v1" */
  baseUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 模型名称，例如 "gpt-4o" */
  model: string;
}

/** 对话消息 */
export interface LLMMessage {
  /** 角色 */
  role: "system" | "user" | "assistant" | "tool";
  /** 消息内容，tool 角色可为 null */
  content: string | null;
  /** 助手消息中的工具调用列表 */
  tool_calls?: ToolCall[];
  /** tool 角色消息对应的工具调用 ID */
  tool_call_id?: string;
}

/** 工具调用 */
export interface ToolCall {
  /** 调用 ID，由 LLM 生成 */
  id: string;
  /** 调用类型，目前固定为 "function" */
  type: "function";
  /** 函数详情 */
  function: {
    /** 函数名 */
    name: string;
    /** 函数参数（JSON 字符串） */
    arguments: string;
  };
}

/** 工具定义，传给 LLM 让它知道有哪些工具可用 */
export interface ToolDefinition {
  /** 类型，固定为 "function" */
  type: "function";
  /** 函数描述 */
  function: {
    /** 函数名 */
    name: string;
    /** 函数说明，帮助 LLM 理解何时调用 */
    description: string;
    /** JSON Schema 参数定义 */
    parameters: Record<string, any>;
  };
}

/** 非流式调用返回结果 */
export interface LLMResponse {
  /** 文本回复内容 */
  content: string | null;
  /** 工具调用列表 */
  tool_calls?: ToolCall[];
  /** 结束原因 */
  finish_reason: "stop" | "tool_calls" | "length";
}

/** 流式调用返回的单个 chunk */
export interface LLMChunk {
  /** chunk ID */
  id: string;
  /** 对象类型 */
  object: string;
  /** 选项数组 */
  choices: Array<{
    /** 选项索引 */
    index: number;
    /** 增量内容 */
    delta: {
      role?: string;
      content?: string;
      tool_calls?: any[];
    };
    /** 结束原因，未结束时为 null */
    finish_reason: string | null;
  }>;
}

// ============================================================
// 核心调用函数
// ============================================================

/**
 * 非流式调用 LLM Chat Completions API
 *
 * @param config - 模型服务方配置
 * @param messages - 对话消息列表
 * @param tools - 可选，工具定义列表
 * @returns LLM 响应
 * @throws 网络错误或响应非 200 时抛出异常
 */
export async function callLLM(
  config: ProviderConfig,
  messages: LLMMessage[],
  tools?: ToolDefinition[],
): Promise<LLMResponse> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const body: Record<string, any> = {
    model: config.model,
    messages,
    stream: false,
  };
  if (tools !== undefined && tools.length > 0) {
    body.tools = tools;
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `LLM 请求失败（网络错误）: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(
      `LLM 请求失败（HTTP ${resp.status} ${resp.statusText}）: ${errText}`,
    );
  }

  let data: any;
  try {
    data = await resp.json();
  } catch (err) {
    throw new Error(
      `LLM 响应 JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const choice = data?.choices?.[0];
  if (choice === undefined) {
    throw new Error("LLM 响应中没有 choices 字段");
  }

  const message = choice.message;
  const finishReason = choice.finish_reason ?? "stop";

  // 将 finish_reason 映射到我们的类型
  let mappedFinishReason: LLMResponse["finish_reason"];
  if (finishReason === "tool_calls") {
    mappedFinishReason = "tool_calls";
  } else if (finishReason === "length") {
    mappedFinishReason = "length";
  } else {
    mappedFinishReason = "stop";
  }

  const result: LLMResponse = {
    content: message?.content ?? null,
    finish_reason: mappedFinishReason,
  };

  if (message?.tool_calls !== undefined && message.tool_calls !== null) {
    result.tool_calls = message.tool_calls as ToolCall[];
  }

  return result;
}

/**
 * 流式调用 LLM Chat Completions API
 *
 * 返回一个异步迭代器，逐个 yield SSE 解析出的 chunk。
 *
 * @param config - 模型服务方配置
 * @param messages - 对话消息列表
 * @param tools - 可选，工具定义列表
 * @returns 异步迭代器，每次返回一个 LLMChunk
 * @throws 网络错误、响应非 200 或 SSE 解析错误时抛出异常
 */
export async function* callLLMStream(
  config: ProviderConfig,
  messages: LLMMessage[],
  tools?: ToolDefinition[],
): AsyncIterable<LLMChunk> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const body: Record<string, any> = {
    model: config.model,
    messages,
    stream: true,
  };
  if (tools !== undefined && tools.length > 0) {
    body.tools = tools;
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `LLM 流式请求失败（网络错误）: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(
      `LLM 流式请求失败（HTTP ${resp.status} ${resp.statusText}）: ${errText}`,
    );
  }

  if (resp.body === null) {
    throw new Error("LLM 流式响应 body 为空");
  }

  // 读取 SSE 流并解析
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以双换行分隔
      const lines = buffer.split("\n");
      // 最后一段可能不完整，放回 buffer
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();

        // 空行或注释行跳过
        if (line === "") {
          continue;
        }

        // 只处理 data: 开头的行
        if (!line.startsWith("data:")) {
          continue;
        }

        // 提取 data: 后面的 JSON 内容
        const dataStr = line.slice(5).trim();

        // 结束标记
        if (dataStr === "[DONE]") {
          return;
        }

        // 解析 JSON
        let chunk: LLMChunk;
        try {
          chunk = JSON.parse(dataStr);
        } catch (err) {
          throw new Error(
            `SSE JSON 解析失败: ${err instanceof Error ? err.message : String(err)} | 原始数据: ${dataStr}`,
          );
        }

        yield chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

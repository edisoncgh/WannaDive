/**
 * Agent 定义 + Host Agent 工具（OpenAI function calling 格式）
 *
 * 本文件定义了「快速入坑」应用的 4 个 Agent 和主持 Agent 使用的工具集。
 *
 * 设计要点：
 *   - Host Agent 拥有 tools（function calling），负责调度子 Agent
 *   - 子 Agent 不持有 tools，只做纯 LLM 调用
 *   - 所有 prompt 保持通用，不硬编码具体的入坑对象
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** OpenAI function calling 工具定义 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
        }
      >;
      required: string[];
    };
  };
}

/** Agent 定义 */
export interface AgentDefinition {
  id: string;
  name: string;
  systemPrompt: string;
  /** 仅 host agent 携带 tools，子 Agent 不持有 */
  tools?: ToolDefinition[];
}

// ---------------------------------------------------------------------------
// Host Agent（主持 Agent）
// ---------------------------------------------------------------------------

export const HOST_AGENT: AgentDefinition = {
  id: "host",
  name: "主持 Agent",
  systemPrompt: `你是“快速入坑”应用的主持 Agent（总指挥），负责帮助用户快速了解一个全新领域并给出可操作的入坑指南。

【你的工作流程】

1. **了解用户**：用户会告诉你“想入坑什么”以及“当前了解程度”。如果用户已经提供了入坑对象和了解程度（如“纯小白”“听过一点”等），**直接进入下一步，不要重复询问**。只有当信息明显不足时（比如用户只说了“我想入坑”但没说具体对象），才提 1-2 个简短问题。

2. **调度子 Agent**：你拥有三个 function calling 工具，分别对应三个专家子 Agent。根据用户需求选择调用哪些（可以并发全部调用，也可以按需选调）：

   - **dispatch_concept_agent**：调度“概念扫盲 Agent”。当用户基础较弱（纯小白 / 听过一点）时必调。它会用通俗类比讲清核心概念、术语、历史和玩法。

   - **dispatch_vertical_agent**：调度“垂向信息 Agent”。当用户需要融入圈子、了解“内行”在关心什么时调用。它检索圈子文化、行话、细分流派、关键议题。

   - **dispatch_market_agent**：调度“市场信息 Agent”。当用户有行动意图（“想买”“想试”“多少钱”）时调用。它检索入门价位、品牌对比、第一件装备、避坑提醒。

3. **整合报告**：收到子 Agent 返回的素材后，你必须用用户能听懂的语言重新组织成一份连贯的「入坑指南」，而不是简单拼接三份报告。

4. **跟进**：最后主动询问“要不要继续深挖某个方向？”，引导下一步。

【消息格式说明】
用户的首条消息通常是结构化的，包含：
- 【入坑任务】我想入坑：**{对象}**
- 我对这个东西的了解程度：{程度}（如“纯小白（完全没接触过）”）
请从消息中提取“入坑对象”和“了解程度”，**不要重复询问这些已知信息**。

【调度纪律】
- 调用工具时，把用户的入坑对象和了解程度通过参数传递给子 Agent。
- 三个子 Agent 可以在一次回复中并发调用（多 tool_call），也可以分轮次串行。
- 用户基础越弱，越要少用术语、多用类比。
- 不要逐字复述工具描述，根据上下文自然决策。
- 子 Agent 的报告只是素材，最终输出必须是你重新整合后的指南。`,
  tools: [], // 在文件末尾通过 HOST_TOOLS 赋值
};

// ---------------------------------------------------------------------------
// Concept Agent（概念扫盲 Agent）
// ---------------------------------------------------------------------------

export const CONCEPT_AGENT: AgentDefinition = {
  id: "concept",
  name: "概念扫盲 Agent",
  systemPrompt: `你是一个"概念扫盲"专家，专门把复杂的东西用通俗类比讲明白。

【任务】
主持 Agent 会给你一个"入坑对象"和用户了解程度。你需要用通俗易懂的方式解释该对象的核心概念。

【输出格式】（markdown，500 字以内）

1. **一句话定义**：用最直白的语言说清这是什么。
2. **简明来历**：这个东西怎么来的、怎么发展的（最多 3 句）。
3. **核心术语速查**（5-8 个）：每条包含术语名 + 1-2 句解释 + 一个生活类比。
4. **主要玩法 / 使用场景**（3-5 个）：列出最常见的入门玩法。

【风格要求】
- 用类比、举例、对比，让零基础用户也能秒懂。
- 避免学术腔和专业黑话。
- 只输出最终报告，不要寒暄。`,
};

// ---------------------------------------------------------------------------
// Vertical Agent（垂向信息 Agent）
// ---------------------------------------------------------------------------

export const VERTICAL_AGENT: AgentDefinition = {
  id: "vertical",
  name: "垂向信息 Agent",
  systemPrompt: `你是一个"垂向信息检索"专家，专注于细分领域的圈内信息和优质内容挖掘。

【任务】
主持 Agent 会给你一个"入坑对象"。你需要检索该领域的垂向信息，帮助用户快速从"外行"变"内行"。

【输出格式】（markdown，600 字以内）

1. **圈子文化 / 行话速查表**：列出该领域最常见的圈内黑话、缩写、口头禅（带解释）。
2. **关键细分维度**（3-5 个）：该领域有哪些主要流派 / 风格 / 玩法分支。
3. **用户最关心的 5 个问题**（带简明回答）：圈内新人常问的高频问题。
4. **推荐内容来源**：值得关注的社区、KOL、网站、书籍、播客、视频频道等。

【风格要求】
- 信息密度高、结构清晰。
- 行话部分要标注"正式说法 vs 圈内俗称"。
- 只输出最终报告，不要寒暄。`,
};

// ---------------------------------------------------------------------------
// Market Agent（市场信息 Agent）
// ---------------------------------------------------------------------------

export const MARKET_AGENT: AgentDefinition = {
  id: "market",
  name: "市场信息 Agent",
  systemPrompt: `你是一个"市场信息检索"专家，专注于消费决策和入门路径建议。

【任务】
主持 Agent 会给你一个"入坑对象"和用户了解程度 / 预算。你需要检索消费、入门相关信息，帮助用户做出第一步行动决策。

【输出格式】（markdown，500 字以内）

1. **入门价位区间**：按"低 / 中 / 高"三档给出价格参考（非消费类则给出时间/精力成本）。
2. **主流品牌 / 品类对比**：列出该领域主要品牌或品类的定位、优劣势。
3. **推荐的第一件入坑装备 / 第一步行动**：给新手一个具体可操作的起点。
4. **新手最容易踩的 3 个坑**：常见的消费陷阱、认知误区、被割韭菜场景。

【风格要求】
- 客观中立，尽量有数据或事实支撑。
- 避免带货口吻，不推荐特定商家。
- 只输出最终报告，不要寒暄。`,
};

// ---------------------------------------------------------------------------
// Host Agent 工具集（OpenAI function calling 格式）
// ---------------------------------------------------------------------------

export const HOST_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "dispatch_concept_agent",
      description:
        "调度概念扫盲 Agent，用于解释核心概念、术语、历史和玩法。当用户基础较弱时使用。",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "入坑对象，如'单反相机'、'咖啡'、'基金'等",
          },
          level: {
            type: "string",
            description: "用户了解程度，如'纯小白'、'听过一点'、'有一定了解'",
          },
        },
        required: ["topic", "level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dispatch_vertical_agent",
      description:
        "调度垂向信息 Agent，用于检索圈子文化、行话、细分流派、关键议题和优质内容来源。当用户需要快速融入圈子时使用。",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "入坑对象，如'足球'、'汉服'、'骑行'等",
          },
          level: {
            type: "string",
            description: "用户了解程度，如'纯小白'、'听过一点'、'有一定了解'",
          },
        },
        required: ["topic", "level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dispatch_market_agent",
      description:
        "调度市场信息 Agent，用于检索入门价位、品牌对比、推荐第一件装备和避坑提醒。当用户有行动或消费意图时使用。",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "入坑对象，如'机械键盘'、'露营'、'滑雪'等",
          },
          level: {
            type: "string",
            description: "用户了解程度，如'纯小白'、'听过一点'、'有一定了解'",
          },
        },
        required: ["topic", "level"],
      },
    },
  },
];

// 把工具集挂载到 Host Agent
HOST_AGENT.tools = HOST_TOOLS;

// ---------------------------------------------------------------------------
// 统一导出
// ---------------------------------------------------------------------------

export const ALL_AGENTS: Record<string, AgentDefinition> = {
  host: HOST_AGENT,
  concept: CONCEPT_AGENT,
  vertical: VERTICAL_AGENT,
  market: MARKET_AGENT,
};

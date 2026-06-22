/**
 * AgentBrief — 子 Agent 结构化输出
 *
 * 子 Agent 不直接输出大段 Markdown，而是输出结构化的 AgentBrief，
 * 由主持 Agent / 综合层消费并整合为最终入坑指南。
 *
 * 基于 stage3development.md §10 定义。
 */

// ---------------------------------------------------------------------------
// 入坑地图节点草稿（AgentBrief 中引用）
// ---------------------------------------------------------------------------

export interface DiveMapNodeDraft {
  title: string;
  description: string;
  level: "foundation" | "core" | "advanced" | "optional";
  children?: DiveMapNodeDraft[];
  suggestedPrompt?: string;
}

// ---------------------------------------------------------------------------
// AgentBrief 主结构
// ---------------------------------------------------------------------------

export interface AgentBrief {
  agentId: string;
  roleName: string;
  summary: string;
  keyFindings: {
    title: string;
    explanation: string;
    importance: "high" | "medium" | "low";
    evidenceIds: string[];
  }[];
  misconceptions?: {
    wrongIdea: string;
    correction: string;
    whyItMatters: string;
  }[];
  recommendedActions?: string[];
  mapNodeSuggestions?: DiveMapNodeDraft[];
  openQuestions?: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// 验证 / 解析
// ---------------------------------------------------------------------------

const VALID_IMPORTANCE = new Set(["high", "medium", "low"]);
const VALID_LEVEL = new Set(["foundation", "core", "advanced", "optional"]);

function isDiveMapNodeDraft(obj: unknown): obj is DiveMapNodeDraft {
  if (typeof obj !== "object" || obj === null) return false;
  const node = obj as Record<string, unknown>;
  if (typeof node.title !== "string" || !node.title) return false;
  if (typeof node.description !== "string") return false;
  if (typeof node.level !== "string" || !VALID_LEVEL.has(node.level)) return false;
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) return false;
    if (!node.children.every(isDiveMapNodeDraft)) return false;
  }
  if (node.suggestedPrompt !== undefined && typeof node.suggestedPrompt !== "string") {
    return false;
  }
  return true;
}

export function validateAgentBrief(brief: unknown): brief is AgentBrief {
  if (typeof brief !== "object" || brief === null) return false;
  const b = brief as Record<string, unknown>;

  if (typeof b.agentId !== "string" || !b.agentId) return false;
  if (typeof b.roleName !== "string" || !b.roleName) return false;
  if (typeof b.summary !== "string") return false;
  if (typeof b.confidence !== "number") return false;

  if (!Array.isArray(b.keyFindings)) return false;
  for (const f of b.keyFindings) {
    if (typeof f !== "object" || f === null) return false;
    const finding = f as Record<string, unknown>;
    if (typeof finding.title !== "string" || !finding.title) return false;
    if (typeof finding.explanation !== "string") return false;
    if (typeof finding.importance !== "string" || !VALID_IMPORTANCE.has(finding.importance)) {
      return false;
    }
    if (!Array.isArray(finding.evidenceIds) || !finding.evidenceIds.every((e: unknown) => typeof e === "string")) {
      return false;
    }
  }

  if (b.misconceptions !== undefined) {
    if (!Array.isArray(b.misconceptions)) return false;
    for (const m of b.misconceptions) {
      if (typeof m !== "object" || m === null) return false;
      const mis = m as Record<string, unknown>;
      if (typeof mis.wrongIdea !== "string" || !mis.wrongIdea) return false;
      if (typeof mis.correction !== "string") return false;
      if (typeof mis.whyItMatters !== "string") return false;
    }
  }

  if (b.recommendedActions !== undefined) {
    if (!Array.isArray(b.recommendedActions) || !b.recommendedActions.every((a: unknown) => typeof a === "string")) {
      return false;
    }
  }

  if (b.mapNodeSuggestions !== undefined) {
    if (!Array.isArray(b.mapNodeSuggestions) || !b.mapNodeSuggestions.every(isDiveMapNodeDraft)) {
      return false;
    }
  }

  if (b.openQuestions !== undefined) {
    if (!Array.isArray(b.openQuestions) || !b.openQuestions.every((q: unknown) => typeof q === "string")) {
      return false;
    }
  }

  return true;
}

/**
 * 解析 JSON 字符串为 AgentBrief。
 *
 * 返回 null 表示解析失败或验证不通过，不会抛出异常。
 */
export function parseAgentBrief(jsonString: string): AgentBrief | null {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    if (validateAgentBrief(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

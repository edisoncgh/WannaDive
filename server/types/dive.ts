/**
 * Dive Session 核心数据结构
 *
 * 基于 Augmentation_Plan.md 定义的类型系统。
 * 一次 Dive Session = 用户发起的一次完整入坑任务。
 */

// ============================================================
// 领域类型
// ============================================================

export type DomainType =
  | "competitive_game"
  | "gear_hobby"
  | "spectator_sport"
  | "technical_knowledge"
  | "fictional_universe"
  | "cultural_scene"
  | "financial"
  | "general";

export type UserLevel = "zero" | "beginner" | "intermediate" | "unknown";

// ============================================================
// Dive Session
// ============================================================

export interface Dive {
  id: string;
  topic: string;
  user_level: UserLevel;
  user_goal: string | null;
  domain_type: DomainType;
  status: DiveStatus;
  created_at: string;
  updated_at: string;
}

export type DiveStatus =
  | "clarifying"
  | "planning"
  | "executing"
  | "synthesizing"
  | "completed"
  | "failed";

// ============================================================
// Agent Task
// ============================================================

export interface AgentTask {
  id: string;
  dive_id: string;
  agent_id: string;
  title: string;
  status: AgentTaskStatus;
  progress: number;
  input_json: string | null;
  output_json: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export type AgentTaskStatus =
  | "queued"
  | "planning"
  | "searching"
  | "reading"
  | "extracting"
  | "reporting"
  | "completed"
  | "failed";

// ============================================================
// Agent Run Step（Agent 执行步骤）
// ============================================================

export type AgentRunStepType =
  | 'assigned'
  | 'planning'
  | 'tool_selected'
  | 'tool_running'
  | 'source_found'
  | 'finding_added'
  | 'brief_submitted'
  | 'reviewed'
  | 'failed'
  | 'skipped';

export interface AgentRunStep {
  id: string;
  dive_id: string;
  task_id: string;
  step_type: AgentRunStepType;
  title: string;
  description: string | null;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  payload_json: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Agent Event（结构化 SSE 事件）
// ============================================================

export type DiveAgentEvent =
  | { type: "dive_created"; diveId: string; topic: string }
  | { type: "host_question"; diveId: string; questions: string[] }
  | { type: "plan_created"; diveId: string; plan: DivePlan }
  | { type: "agent_started"; diveId: string; taskId: string; agentId: string; title: string }
  | { type: "agent_step_started"; diveId: string; taskId: string; step: AgentRunStep }
  | { type: "agent_step_updated"; diveId: string; taskId: string; stepId: string; status: string; description?: string }
  | { type: "agent_status"; diveId: string; taskId: string; status: AgentTaskStatus; message: string; progress?: number }
  | { type: "source_found"; diveId: string; taskId: string; source: EvidenceItem }
  | { type: "note_added"; diveId: string; taskId: string; note: string }
  | { type: "agent_report_ready"; diveId: string; taskId: string; reportId: string }
  | { type: "critic_score"; diveId: string; score: CriticScore }
  | { type: "synthesis_started"; diveId: string }
  | { type: "final_ready"; diveId: string; guideId: string; content: string; guide?: DiveGuideContent }
  | { type: "error"; diveId: string; taskId?: string; message: string }
  | { type: "done" };

// ============================================================
// Dive Plan（主持 Agent 生成的调研计划）
// ============================================================

export interface DivePlan {
  domainType: DomainType;
  agents: DivePlanAgent[];
  sourcePlan: SourcePlan;
}

export interface DivePlanAgent {
  agentId: string;
  title: string;
  purpose: string;
}

export interface SourcePlan {
  topic: string;
  domainType: DomainType;
  sourceGroups: SourceGroup[];
}

export interface SourceGroup {
  group: "official" | "community" | "market" | "video" | "academic" | "github" | "news" | "social";
  purpose: string;
  suggestedTools: string[];
  queries: string[];
}

// ============================================================
// Evidence Item（资料来源）
// ============================================================

export interface EvidenceItem {
  id: string;
  dive_id: string;
  task_id: string | null;
  source_type: string;
  title: string;
  url: string | null;
  platform: string | null;
  author: string | null;
  published_at: string | null;
  retrieved_at: string;
  summary: string;
  key_points: string[];
  credibility_score: number | null;
  relevance_score: number | null;
}

// ============================================================
// Agent Report（子 Agent 结构化报告）
// ============================================================

export interface AgentReport {
  id: string;
  dive_id: string;
  task_id: string;
  agent_id: string;
  report_json: string;
  created_at: string;
}

// ============================================================
// Critic Score（审稿评分）
// ============================================================

export interface CriticScore {
  expertise: number;
  beginnerFriendliness: number;
  coreInsight: number;
  actionability: number;
  sourceGrounding: number;
  antiGeneric: number;
  communityContext: number;
  overall: number;
  issues: string[];
  rewriteSuggestions: string[];
}

// ============================================================
// Dive Guide（最终入坑手册）
// ============================================================

export interface DiveGuide {
  id: string;
  dive_id: string;
  guide_json: string;
  markdown: string | null;
  created_at: string;
}

export interface DiveGuideContent {
  topic: string;
  userLevel: UserLevel;
  domainType: DomainType;

  essence: {
    title: string;
    oneSentence: string;
    mentalModel: string;
  };

  dontStartWith: {
    title: string;
    items: string[];
  };

  keyConcepts: {
    term: string;
    plainExplanation: string;
    whyItMatters: string;
    example?: string;
  }[];

  insiderView: {
    howExpertsThink: string;
    realPriorities: string[];
    fakePriorities: string[];
  };

  commonMisconceptions: {
    misconception: string;
    correction: string;
  }[];

  roadmap: {
    firstStep: string;
    threeDayPlan: string[];
    sevenDayPlan: string[];
    thirtyDayPlan?: string[];
  };

  costAndResources?: {
    timeCost?: string;
    moneyCost?: string;
    tools?: string[];
    recommendedResources?: string[];
  };

  communityContext?: {
    slang: string[];
    communities: string[];
    controversies: string[];
  };

  diveMap: DiveMapNode[];
  followUpQuestions: string[];
  evidenceSummary: {
    sourceCount: number;
    sourceTypes: string[];
    caveats: string[];
  };
}

// ============================================================
// Dive Map（入坑地图）
// ============================================================

export interface DiveMapNode {
  id: string;
  title: string;
  description: string;
  level: "foundation" | "core" | "advanced" | "optional";
  children?: DiveMapNode[];
  suggestedPrompt?: string;
}

// ============================================================
// Agent Task Contract（子 Agent 任务合同）
// ============================================================

export interface AgentTaskContract {
  diveId: string;
  taskId: string;
  agentId: string;
  topic: string;
  domainType: DomainType;
  userLevel: UserLevel;
  userGoal?: string;
  constraints?: {
    budget?: string;
    region?: string;
    timeCost?: string;
    hardware?: string;
    platform?: string;
  };
  playbookHints: string[];
  requiredOutputs: string[];
  allowedTools: string[];
  sourcePolicy: "must_cite" | "optional_cite" | "no_external_required";
}

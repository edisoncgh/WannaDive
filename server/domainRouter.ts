/**
 * Domain Router — 领域路由器
 *
 * 通过 LLM 判断入坑对象属于哪类领域，返回 DomainType。
 * 用于在 Dive Session 开始时自动选择合适的 Agent 阵容和 Playbook。
 *
 * 参见 Augmentation_Plan.md §3.2（领域识别）
 */

import { callLLM, type ProviderConfig, type LLMMessage } from "./llm.js";
import type { DomainType } from "./types/dive.js";

// ============================================================
// 领域分类 prompt
// ============================================================

const DOMAIN_CLASSIFIER_PROMPT = `你是一个领域分类器。用户会告诉你一个"入坑对象"，你需要判断它属于哪个领域类型。

可选的领域类型：
- competitive_game：竞技游戏（MOBA、FPS、RTS、格斗等）
- gear_hobby：消费装备爱好（单反、HiFi、机械键盘、咖啡、露营等）
- technical_knowledge：知识/技术（编程、AI、机器学习、工具链等）
- spectator_sport：赛事观看（足球、NBA、F1、电竞赛事等）
- fictional_universe：作品宇宙（高达、漫威、战锤、宝可梦等）
- cultural_scene：圈层文化（说唱、二次元、潮玩、桌游等）
- financial：金融理财（基金、股票、保险等）
- general：其他/无法归类

请只返回一个 JSON 对象，格式如下：
{"domain_type": "xxx", "confidence": 0.9, "reason": "简短理由"}

不要返回其他任何内容。`;

// ============================================================
// Domain Router 接口
// ============================================================

export interface DomainClassification {
  domainType: DomainType;
  confidence: number;
  reason: string;
}

// ============================================================
// 分类函数
// ============================================================

/**
 * 使用 LLM 判断入坑对象的领域类型。
 *
 * @param config - LLM provider 配置
 * @param topic - 入坑对象（如"英雄联盟"、"单反相机"）
 * @returns DomainClassification
 */
export async function classifyDomain(
  config: ProviderConfig,
  topic: string,
): Promise<DomainClassification> {
  const messages: LLMMessage[] = [
    { role: "system", content: DOMAIN_CLASSIFIER_PROMPT },
    { role: "user", content: `入坑对象：${topic}` },
  ];

  try {
    const response = await callLLM(config, messages);
    const content = response.content ?? "";

    // 解析 JSON 响应
    const parsed = parseClassification(content);
    return parsed;
  } catch (err) {
    console.error("[DomainRouter] Classification failed:", err);
    // 降级到 general
    return {
      domainType: "general",
      confidence: 0,
      reason: "分类失败，使用通用模板",
    };
  }
}

// ============================================================
// 内部辅助
// ============================================================

const VALID_DOMAIN_TYPES: DomainType[] = [
  "competitive_game",
  "gear_hobby",
  "technical_knowledge",
  "spectator_sport",
  "fictional_universe",
  "cultural_scene",
  "financial",
  "general",
];

function parseClassification(raw: string): DomainClassification {
  // 尝试从响应中提取 JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      domainType: "general",
      confidence: 0,
      reason: "无法解析分类结果",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      domain_type?: string;
      confidence?: number;
      reason?: string;
    };

    const domainType = parsed.domain_type;
    if (typeof domainType === "string" && VALID_DOMAIN_TYPES.includes(domainType as DomainType)) {
      return {
        domainType: domainType as DomainType,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }

    return {
      domainType: "general",
      confidence: 0,
      reason: `未知的领域类型: ${domainType}`,
    };
  } catch {
    return {
      domainType: "general",
      confidence: 0,
      reason: "JSON 解析失败",
    };
  }
}

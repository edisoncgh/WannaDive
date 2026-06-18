/**
 * Domain Playbook 系统
 *
 * 每个 Playbook 定义了一类领域的：
 *   - default_agents：默认 Agent 阵容
 *   - must_explain：必须解释的内容
 *   - avoid：应该避免的内容
 *   - insider_questions：内行视角的关键问题
 *   - output_structure：输出结构指引
 *
 * 参见 Augmentation_Plan.md §6 + §7
 */

import type { DomainType } from "../types/dive.js";

// ============================================================
// Playbook 类型定义
// ============================================================

export interface DomainPlaybook {
  domainType: DomainType;
  label: string;
  description: string;
  defaultAgents: string[];
  mustExplain: string[];
  avoid: string[];
  insiderQuestions: string[];
  outputStructure: string[];
}

// ============================================================
// Playbook 注册表
// ============================================================

const PLAYBOOKS: Record<DomainType, DomainPlaybook> = {
  competitive_game: {
    domainType: "competitive_game",
    label: "竞技游戏",
    description: "MOBA、FPS、RTS、格斗等竞技类游戏",
    defaultAgents: ["concept", "insider", "community", "knowledge", "roadmap", "critic"],
    mustExplain: [
      "基本胜利目标",
      "位置/角色分工",
      "核心资源系统",
      "节奏与版本",
      "新手第一步",
      "观赛视角",
      "常见误区",
    ],
    avoid: [
      "一上来堆所有角色/英雄",
      "只解释规则，不解释为什么重要",
      "把职业比赛和普通玩家体验混为一谈",
      "忽略版本变化",
      "只讲百科定义",
    ],
    insiderQuestions: [
      "这个游戏真正考验的是什么？",
      "新手最容易误判的强弱标准是什么？",
      "看比赛时应该先看哪里？",
      "哪些东西可以以后再学？",
    ],
    outputStructure: [
      "核心心智模型（不是背技能，而是线权/资源/节奏）",
      "位置分工与新手推荐",
      "版本理解",
      "看比赛的观察方法",
      "新手第一周练习路线",
      "常见误区",
    ],
  },

  gear_hobby: {
    domainType: "gear_hobby",
    label: "消费装备",
    description: "单反、HiFi、机械键盘、咖啡、露营等装备型爱好",
    defaultAgents: ["concept", "market", "community", "insider", "misconception", "roadmap", "critic"],
    mustExplain: [
      "核心参数与选购逻辑",
      "价格区间（低/中/高）",
      "第一件装备推荐",
      "新手不要买什么",
      "品牌生态",
      "二手/升级坑",
      "真实社区体验",
    ],
    avoid: [
      "只列参数不讲为什么重要",
      "推荐最贵的",
      "忽略预算分层",
      "不讲二手市场",
      "只讲品牌不讲型号",
    ],
    insiderQuestions: [
      "内行通常怎么判断好坏？",
      "哪些参数是营销噱头？",
      "新手最容易被什么忽悠？",
      "什么价位才是真正的入门？",
    ],
    outputStructure: [
      "核心概念与选购逻辑",
      "预算分层方案",
      "第一件装备推荐",
      "品牌/型号对比",
      "新手避坑清单",
      "社区与资源入口",
    ],
  },

  technical_knowledge: {
    domainType: "technical_knowledge",
    label: "知识/技术",
    description: "大模型微调、ComfyUI、机器学习、编程框架等技术领域",
    defaultAgents: ["concept", "knowledge", "insider", "roadmap", "critic"],
    mustExplain: [
      "这个领域解决什么问题",
      "核心概念之间的关系",
      "先修知识",
      "工具链",
      "最小可运行路线",
      "学习路径",
      "常见误区",
      "推荐资源",
    ],
    avoid: [
      "一上来堆论文/术语",
      "把高级概念放在第一步",
      "只给教程链接，不解释学习顺序",
      "忽略环境配置难度",
      "忽略硬件/成本限制",
    ],
    insiderQuestions: [
      "新手最容易卡在哪里？",
      "哪些概念必须先懂？",
      "哪些概念可以先跳过？",
      "最小闭环是什么？",
      "什么情况下不适合入坑？",
    ],
    outputStructure: [
      "先修知识",
      "核心概念地图",
      "技术栈与工具链",
      "最小可运行路线",
      "3天/7天/30天学习计划",
      "推荐资源",
      "常见误区",
    ],
  },

  spectator_sport: {
    domainType: "spectator_sport",
    label: "赛事观看",
    description: "足球、NBA、F1、电竞赛事等观赛型领域",
    defaultAgents: ["concept", "community", "insider", "roadmap", "critic"],
    mustExplain: [
      "赛制与基本规则",
      "重要队伍/选手",
      "看第一场应该看什么",
      "如何选择主队/支持对象",
      "圈内梗和争议",
      "近期赛事入口",
    ],
    avoid: [
      "只讲规则不讲看点",
      "忽略历史和文化",
      "不区分联赛和杯赛",
      "只讲当前赛季",
    ],
    insiderQuestions: [
      "看比赛时应该先关注什么？",
      "新手最容易忽略的关键看点？",
      "圈内人怎么选主队？",
      "哪些比赛值得追？",
    ],
    outputStructure: [
      "赛制与规则速览",
      "核心看点（不是人头/比分）",
      "重要队伍/选手",
      "圈内文化与梗",
      "第一场观赛指南",
      "近期赛事入口",
    ],
  },

  fictional_universe: {
    domainType: "fictional_universe",
    label: "作品宇宙",
    description: "高达、漫威、战锤、型月、宝可梦等虚构宇宙",
    defaultAgents: ["concept", "community", "insider", "roadmap", "critic"],
    mustExplain: [
      "世界观入口",
      "作品观看/游玩顺序",
      "正作/外传关系",
      "粉丝圈黑话",
      "新手从哪一部开始",
      "哪些内容可以跳过",
    ],
    avoid: [
      "一上来讲完整编年史",
      "不区分主线和外传",
      "忽略不同媒介（动画/漫画/游戏）",
      "只讲剧情不讲为什么好看",
    ],
    insiderQuestions: [
      "新手从哪里入坑最不劝退？",
      "哪些作品是必看/可以跳过的？",
      "圈内人最看重什么？",
      "哪些衍生作品质量最高？",
    ],
    outputStructure: [
      "世界观一句话概括",
      "推荐入坑顺序",
      "必看/可跳过清单",
      "核心概念与术语",
      "粉丝圈文化",
      "社区入口",
    ],
  },

  cultural_scene: {
    domainType: "cultural_scene",
    label: "圈层文化",
    description: "说唱、二次元、潮玩、桌游、街舞等圈层文化",
    defaultAgents: ["concept", "community", "insider", "roadmap", "critic"],
    mustExplain: [
      "圈层文化",
      "黑话",
      "重要人物/作品",
      "流派",
      "社区入口",
      "新手如何不尴尬地参与",
    ],
    avoid: [
      "只讲历史不讲当下",
      "忽略亚文化内部的分歧",
      "不区分主流和地下",
      "只推荐入门级内容",
    ],
    insiderQuestions: [
      "圈内人最看重什么？",
      "新手最容易犯的错？",
      "哪些入门推荐其实被圈内人看不起？",
      "怎么找到自己的位置？",
    ],
    outputStructure: [
      "圈层文化概览",
      "核心人物/作品",
      "黑话速查",
      "流派与分歧",
      "社区入口",
      "新手参与指南",
    ],
  },

  financial: {
    domainType: "financial",
    label: "金融理财",
    description: "基金、股票、保险等金融领域",
    defaultAgents: ["concept", "insider", "roadmap", "critic"],
    mustExplain: [
      "基本概念（风险/收益/流动性）",
      "常见产品类型",
      "入门门槛",
      "风险提示",
      "新手第一步",
      "需要避开的坑",
    ],
    avoid: [
      "推荐具体产品",
      "给出确定性收益预测",
      "忽略风险",
      "用过于专业的术语",
      "暗示某种策略一定赚钱",
    ],
    insiderQuestions: [
      "新手最容易被什么忽悠？",
      "哪些产品风险被严重低估？",
      "内行怎么评估风险？",
      "什么情况下不应该投资？",
    ],
    outputStructure: [
      "核心概念（风险/收益/流动性）",
      "产品类型概览",
      "入门方案",
      "风险清单",
      "新手避坑",
      "学习资源",
    ],
  },

  general: {
    domainType: "general",
    label: "通用",
    description: "无法归类到特定领域的通用入坑",
    defaultAgents: ["concept", "vertical", "market", "roadmap"],
    mustExplain: [
      "核心概念",
      "入门路径",
      "常见误区",
      "推荐资源",
    ],
    avoid: [
      "信息过载",
      "没有优先级",
      "只讲定义不讲为什么重要",
    ],
    insiderQuestions: [
      "新手最应该先了解什么？",
      "哪些信息可以以后再看？",
    ],
    outputStructure: [
      "核心概念",
      "入门路径",
      "常见误区",
      "推荐资源",
    ],
  },
};

// ============================================================
// Playbook 查询接口
// ============================================================

export function getPlaybook(domainType: DomainType): DomainPlaybook {
  return PLAYBOOKS[domainType] ?? PLAYBOOKS.general;
}

export function getAllPlaybooks(): DomainPlaybook[] {
  return Object.values(PLAYBOOKS);
}

export function getPlaybookAgents(domainType: DomainType): string[] {
  return getPlaybook(domainType).defaultAgents;
}

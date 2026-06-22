/**
 * DiveGuide 结构化数据 schema
 *
 * P3.5: 与 DiveGuideContent（dive.ts）并存的增强版结构。
 * 前端通过 convertDiveGuide() 做向后兼容转换。
 */

import type { DomainType, UserLevel } from "./dive.js";

export interface DiveGuide {
  topic: string;
  userLevel: UserLevel | "unknown";
  domainType: string;
  guideTitle: string;
  entryGuide: {
    title: string;
    metaphor?: string;
    summary: string;
    mentalModel: string;
  };
  dontStartWith: {
    title: string;
    items: { title: string; reason: string }[];
  };
  keyConcepts: {
    term: string;
    plainExplanation: string;
    whyItMatters: string;
    example?: string;
  }[];
  insiderView: {
    summary: string;
    realPriorities: string[];
    fakePriorities: string[];
    judgmentFramework?: string[];
  };
  commonMisconceptions: {
    misconception: string;
    correction: string;
    whyItMatters?: string;
  }[];
  roadmap: {
    firstStep: string;
    threeDayPlan: string[];
    sevenDayPlan: string[];
    thirtyDayPlan?: string[];
  };
  communityContext?: {
    slang: string[];
    communities: string[];
    controversies: string[];
  };
  fitAssessment?: {
    suitableFor: string[];
    notSuitableFor: string[];
  };
  followUpQuestions: string[];
  mapId?: string;
}

import { Card, Tag } from 'tdesign-react';
import { DiveMap, DiveMapNode } from './DiveMap';

export type { DiveMapNode };

// ============================================================
// DiveGuideContent 类型（与 server/types/dive.ts 一致）
// ============================================================

export interface DiveGuideContent {
  topic: string;
  userLevel: string;
  domainType: string;
  essence: { title: string; oneSentence: string; mentalModel: string };
  dontStartWith: { title: string; items: string[] };
  keyConcepts: { term: string; plainExplanation: string; whyItMatters: string; example?: string }[];
  insiderView: { howExpertsThink: string; realPriorities: string[]; fakePriorities: string[] };
  commonMisconceptions: { misconception: string; correction: string }[];
  roadmap: { firstStep: string; threeDayPlan: string[]; sevenDayPlan: string[]; thirtyDayPlan?: string[] };
  costAndResources?: { timeCost?: string; moneyCost?: string; tools?: string[]; recommendedResources?: string[] };
  communityContext?: { slang: string[]; communities: string[]; controversies: string[] };
  followUpQuestions: string[];
  diveMap?: DiveMapNode[];
  evidenceSummary?: { sourceCount: number; sourceTypes: string[]; caveats: string[] };
}

// ============================================================
// 卡片容器
// ============================================================

function GuideCard({ icon, title, accent, children }: {
  icon: string;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      bordered
      size="small"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: accent ?? 'var(--td-brand-color)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
          {title}
        </span>
      </div>
      {children}
    </Card>
  );
}

// ============================================================
// 各模块卡片
// ============================================================

function EssenceCard({ essence }: { essence: DiveGuideContent['essence'] }) {
  return (
    <GuideCard icon="🎯" title={essence.title} accent="#7c3aed">
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--td-text-color-primary)' }}>
        {essence.oneSentence}
      </p>
      <p className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
        💡 心智模型：{essence.mentalModel}
      </p>
    </GuideCard>
  );
}

function DontStartCard({ dontStartWith }: { dontStartWith: DiveGuideContent['dontStartWith'] }) {
  return (
    <GuideCard icon="🚫" title={dontStartWith.title} accent="#ef4444">
      <ul className="space-y-1">
        {dontStartWith.items.map((item, i) => (
          <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
            • {item}
          </li>
        ))}
      </ul>
    </GuideCard>
  );
}

function KeyConceptsCard({ concepts }: { concepts: DiveGuideContent['keyConcepts'] }) {
  return (
    <GuideCard icon="📚" title="核心概念" accent="#f59e0b">
      <div className="space-y-3">
        {concepts.map((c, i) => (
          <div key={i} className="pb-2" style={{ borderBottom: i < concepts.length - 1 ? '1px solid var(--td-component-stroke)' : 'none' }}>
            <div className="flex items-center gap-2 mb-1">
              <Tag theme="primary" variant="light" size="small">{c.term}</Tag>
            </div>
            <p className="text-xs mb-1" style={{ color: 'var(--td-text-color-primary)' }}>
              {c.plainExplanation}
            </p>
            <p className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
              为什么重要：{c.whyItMatters}
            </p>
            {c.example && (
              <p className="text-xs mt-1" style={{ color: 'var(--td-text-color-placeholder)' }}>
                例：{c.example}
              </p>
            )}
          </div>
        ))}
      </div>
    </GuideCard>
  );
}

function InsiderCard({ insiderView }: { insiderView: DiveGuideContent['insiderView'] }) {
  return (
    <GuideCard icon="🧠" title="内行视角" accent="#8b5cf6">
      <p className="text-xs mb-3" style={{ color: 'var(--td-text-color-primary)' }}>
        {insiderView.howExpertsThink}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: '#22c55e' }}>✅ 真重点</p>
          <ul className="space-y-1">
            {insiderView.realPriorities.map((item, i) => (
              <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>• {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: '#ef4444' }}>❌ 伪重点</p>
          <ul className="space-y-1">
            {insiderView.fakePriorities.map((item, i) => (
              <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </GuideCard>
  );
}

function MisconceptionsCard({ misconceptions }: { misconceptions: DiveGuideContent['commonMisconceptions'] }) {
  return (
    <GuideCard icon="⚠️" title="常见误区" accent="#f59e0b">
      <div className="space-y-2">
        {misconceptions.map((m, i) => (
          <div key={i} className="p-2 rounded" style={{ backgroundColor: 'var(--td-bg-color-secondarycontainer)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--td-error-color)' }}>
              ❌ {m.misconception}
            </p>
            <p className="text-xs" style={{ color: '#22c55e' }}>
              ✅ {m.correction}
            </p>
          </div>
        ))}
      </div>
    </GuideCard>
  );
}

function RoadmapCard({ roadmap }: { roadmap: DiveGuideContent['roadmap'] }) {
  return (
    <GuideCard icon="🗺️" title="入坑路线" accent="#0ea5e9">
      <div className="mb-3 p-2 rounded" style={{ backgroundColor: 'var(--td-bg-color-secondarycontainer)' }}>
        <p className="text-xs font-medium mb-1">🚀 第一步</p>
        <p className="text-xs" style={{ color: 'var(--td-text-color-primary)' }}>{roadmap.firstStep}</p>
      </div>
      <div className="space-y-3">
        <RoadmapPhase label="3 天体验" items={roadmap.threeDayPlan} color="#22c55e" />
        <RoadmapPhase label="7 天入门" items={roadmap.sevenDayPlan} color="#0ea5e9" />
        {roadmap.thirtyDayPlan && roadmap.thirtyDayPlan.length > 0 && (
          <RoadmapPhase label="30 天深入" items={roadmap.thirtyDayPlan} color="#8b5cf6" />
        )}
      </div>
    </GuideCard>
  );
}

function RoadmapPhase({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
        <p className="text-xs font-medium mb-1" style={{ color }}>📅 {label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
            {i + 1}. {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommunityCard({ communityContext }: { communityContext: NonNullable<DiveGuideContent['communityContext']> }) {
  return (
    <GuideCard icon="💬" title="圈内语境" accent="#10b981">
      {communityContext.slang.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-1">🗣️ 黑话速查</p>
          <div className="flex flex-wrap gap-1">
            {communityContext.slang.map((s, i) => (
              <Tag key={i} size="small" variant="light">{s}</Tag>
            ))}
          </div>
        </div>
      )}
      {communityContext.communities.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-1">🏠 社区入口</p>
          <ul className="space-y-1">
            {communityContext.communities.map((c, i) => (
              <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>• {c}</li>
            ))}
          </ul>
        </div>
      )}
      {communityContext.controversies.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1">🔥 争议话题</p>
          <ul className="space-y-1">
            {communityContext.controversies.map((c, i) => (
              <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>• {c}</li>
            ))}
          </ul>
        </div>
      )}
    </GuideCard>
  );
}

function FollowUpCard({ questions }: { questions: string[] }) {
  return (
    <GuideCard icon="❓" title="继续深挖" accent="#6366f1">
      <ul className="space-y-1">
        {questions.map((q, i) => (
          <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
            {i + 1}. {q}
          </li>
        ))}
      </ul>
    </GuideCard>
  );
}

function EvidenceCard({ evidenceSummary }: { evidenceSummary: NonNullable<DiveGuideContent['evidenceSummary']> }) {
  return (
    <GuideCard icon="📊" title="来源摘要" accent="#64748b">
      <p className="text-xs mb-1" style={{ color: 'var(--td-text-color-secondary)' }}>
        共引用 {evidenceSummary.sourceCount} 条来源，类型：{evidenceSummary.sourceTypes.join('、')}
      </p>
      {evidenceSummary.caveats.length > 0 && (
        <ul className="space-y-1 mt-2">
          {evidenceSummary.caveats.map((c, i) => (
            <li key={i} className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>⚠️ {c}</li>
          ))}
        </ul>
      )}
    </GuideCard>
  );
}

// ============================================================
// 主组件
// ============================================================

interface DiveGuideViewProps {
  guide: DiveGuideContent;
  markdown?: string;
  onExplore?: (prompt: string) => void;
}

export function DiveGuideView({ guide, markdown, onExplore }: DiveGuideViewProps) {
  if (!guide) return null;

  return (
    <div className="space-y-3">
      {/* 一句话抓住本质 */}
      {guide.essence && <EssenceCard essence={guide.essence} />}

      {/* 先别管什么 */}
      {guide.dontStartWith.items.length > 0 && (
        <DontStartCard dontStartWith={guide.dontStartWith} />
      )}

      {/* 核心概念 */}
      {guide.keyConcepts.length > 0 && (
        <KeyConceptsCard concepts={guide.keyConcepts} />
      )}

      {/* 内行视角 */}
      {guide.insiderView && <InsiderCard insiderView={guide.insiderView} />}

      {/* 常见误区 */}
      {guide.commonMisconceptions.length > 0 && (
        <MisconceptionsCard misconceptions={guide.commonMisconceptions} />
      )}

      {/* 入坑路线 */}
      {guide.roadmap && <RoadmapCard roadmap={guide.roadmap} />}

      {/* 圈内语境 */}
      {guide.communityContext && (
        <CommunityCard communityContext={guide.communityContext} />
      )}

      {/* 继续深挖 */}
      {guide.followUpQuestions.length > 0 && (
        <FollowUpCard questions={guide.followUpQuestions} />
      )}

      {/* 来源摘要 */}
      {guide.evidenceSummary && (
        <EvidenceCard evidenceSummary={guide.evidenceSummary} />
      )}

      {/* 入坑地图 */}
      {guide.diveMap && guide.diveMap.length > 0 && (
        <DiveMap nodes={guide.diveMap} onExplore={onExplore} />
      )}
    </div>
  );
}

/**
 * 兼容旧格式：如果内容是纯 markdown，显示为简单卡片
 */
export function DiveGuideFallback({ content }: { content: string }) {
  return (
    <GuideCard icon="📋" title="入坑指南" accent="#7c3aed">
      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--td-text-color-primary)' }}>
        {content}
      </div>
    </GuideCard>
  );
}

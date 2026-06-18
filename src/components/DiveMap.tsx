import { useState } from 'react';
import { Tag } from 'tdesign-react';

// ============================================================
// DiveMapNode 类型（与 server/types/dive.ts 一致）
// ============================================================

export interface DiveMapNode {
  id: string;
  title: string;
  description: string;
  level: 'foundation' | 'core' | 'advanced' | 'optional';
  children?: DiveMapNode[];
  suggestedPrompt?: string;
}

// ============================================================
// 样式配置
// ============================================================

const LEVEL_CONFIG: Record<DiveMapNode['level'], { color: string; label: string; icon: string }> = {
  foundation: { color: '#22c55e', label: '基础', icon: '🟢' },
  core: { color: '#0ea5e9', label: '核心', icon: '🔵' },
  advanced: { color: '#8b5cf6', label: '进阶', icon: '🟣' },
  optional: { color: '#94a3b8', label: '可选', icon: '⚪' },
};

// ============================================================
// 单个节点
// ============================================================

function MapNode({ node, depth, onExplore }: {
  node: DiveMapNode;
  depth: number;
  onExplore?: (prompt: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const config = LEVEL_CONFIG[node.level];

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      {/* 节点卡片 */}
      <div
        className="flex items-start gap-2 py-1.5 px-2 rounded-md mb-1 cursor-pointer"
        style={{
          backgroundColor: depth === 0 ? 'var(--td-bg-color-secondarycontainer)' : 'transparent',
          transition: 'background-color 0.2s',
        }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          else if (node.suggestedPrompt && onExplore) onExplore(node.suggestedPrompt);
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--td-bg-color-secondarycontainer)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = depth === 0 ? 'var(--td-bg-color-secondarycontainer)' : 'transparent'; }}
      >
        {/* 展开/折叠图标 */}
        <span className="text-xs mt-0.5" style={{ width: 16, textAlign: 'center' }}>
          {hasChildren ? (expanded ? '▼' : '▶') : '•'}
        </span>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{config.icon}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
              {node.title}
            </span>
            <Tag size="small" variant="light" style={{ color: config.color, borderColor: `${config.color}40` }}>
              {config.label}
            </Tag>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--td-text-color-secondary)' }}>
            {node.description}
          </p>
          {node.suggestedPrompt && !hasChildren && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--td-brand-color)', cursor: 'pointer' }}>
              🔍 点击继续探索 →
            </p>
          )}
        </div>
      </div>

      {/* 子节点 */}
      {hasChildren && expanded && (
        <div className="ml-2" style={{ borderLeft: '1px solid var(--td-component-stroke)', paddingLeft: 4 }}>
          {node.children!.map((child) => (
            <MapNode key={child.id} node={child} depth={depth + 1} onExplore={onExplore} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DiveMap 主组件
// ============================================================

interface DiveMapProps {
  nodes: DiveMapNode[];
  onExplore?: (prompt: string) => void;
}

export function DiveMap({ nodes, onExplore }: DiveMapProps) {
  if (nodes.length === 0) return null;

  return (
    <div
      className="p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--td-bg-color-container)',
        border: '1px solid var(--td-component-stroke)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🗺️</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
          入坑地图
        </span>
        <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
          点击节点继续探索
        </span>
      </div>

      <div className="space-y-1">
        {nodes.map((node) => (
          <MapNode key={node.id} node={node} depth={0} onExplore={onExplore} />
        ))}
      </div>

      {/* 图例 */}
      <div className="flex gap-3 mt-3 pt-2" style={{ borderTop: '1px solid var(--td-component-stroke)' }}>
        {Object.entries(LEVEL_CONFIG).map(([key, config]) => (
          <span key={key} className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
            {config.icon} {config.label}
          </span>
        ))}
      </div>
    </div>
  );
}

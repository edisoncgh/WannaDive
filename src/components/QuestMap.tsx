import { useState, useEffect, useCallback } from 'react';
import { Tag, Button, Dialog, Input } from 'tdesign-react';

type QuestNodeStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'fork_available' | 'forked';
type QuestNodeType = 'foundation' | 'concept' | 'practice' | 'gear' | 'technical' | 'market' | 'community' | 'advanced' | 'fork';

interface QuestNode {
  id: string;
  diveId: string;
  parentNodeId: string | null;
  nodeType: QuestNodeType;
  title: string;
  description: string | null;
  status: QuestNodeStatus;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface QuestEdge {
  id: string;
  diveId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
  label: string | null;
  createdAt: string;
}

interface QuestBranch {
  id: string;
  diveId: string;
  forkNodeId: string;
  name: string;
  description: string | null;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
}

interface QuestMapData {
  nodes: QuestNode[];
  edges: QuestEdge[];
  branches: QuestBranch[];
}

const STATUS_CONFIG: Record<QuestNodeStatus, { color: string; label: string; icon: string }> = {
  locked: { color: '#94a3b8', label: '锁定', icon: '🔒' },
  available: { color: '#3b82f6', label: '可探索', icon: '🔵' },
  in_progress: { color: '#f59e0b', label: '进行中', icon: '⚡' },
  completed: { color: '#22c55e', label: '已完成', icon: '✅' },
  fork_available: { color: '#8b5cf6', label: '可分叉', icon: '🔀' },
  forked: { color: '#ec4899', label: '已分叉', icon: '🌸' },
};

const NODE_TYPE_CONFIG: Record<QuestNodeType, { color: string; label: string }> = {
  foundation: { color: '#22c55e', label: '基础' },
  concept: { color: '#0ea5e9', label: '概念' },
  practice: { color: '#f59e0b', label: '实践' },
  gear: { color: '#94a3b8', label: '装备' },
  technical: { color: '#8b5cf6', label: '技术' },
  market: { color: '#ec4899', label: '市场' },
  community: { color: '#06b6d4', label: '社区' },
  advanced: { color: '#ef4444', label: '进阶' },
  fork: { color: '#a855f7', label: '分叉' },
};

interface TreeNode extends QuestNode {
  children: TreeNode[];
}

function buildTree(nodes: QuestNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentNodeId && nodeMap.has(node.parentNodeId)) {
      nodeMap.get(node.parentNodeId)!.children.push(treeNode);
    } else if (!node.parentNodeId) {
      roots.push(treeNode);
    }
  }

  return roots;
}

function QuestNodeCard({
  node,
  branches,
  depth,
  onContinue,
  onFork,
  onSelectBranch,
}: {
  node: TreeNode;
  branches: QuestBranch[];
  depth: number;
  onContinue: (nodeId: string) => void;
  onFork: (nodeId: string, branches: { name: string; description?: string }[]) => void;
  onSelectBranch: (branchId: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [showForkDialog, setShowForkDialog] = useState(false);
  const [forkBranches, setForkBranches] = useState<{ name: string; description: string }[]>([
    { name: '', description: '' },
  ]);

  const hasChildren = node.children.length > 0;
  const statusConfig = STATUS_CONFIG[node.status];
  const typeConfig = NODE_TYPE_CONFIG[node.nodeType];
  const nodeBranches = branches.filter(b => b.forkNodeId === node.id);
  const isClickable = node.status === 'available' || node.status === 'in_progress' || node.status === 'fork_available';

  const handleAddBranch = () => {
    setForkBranches([...forkBranches, { name: '', description: '' }]);
  };

  const handleForkSubmit = () => {
    const validBranches = forkBranches.filter(b => b.name.trim());
    if (validBranches.length >= 2) {
      onFork(node.id, validBranches);
      setShowForkDialog(false);
      setForkBranches([{ name: '', description: '' }]);
    }
  };

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <div
        className="flex items-start gap-2 py-2 px-3 rounded-lg mb-1.5"
        style={{
          backgroundColor: depth === 0 ? 'var(--td-bg-color-secondarycontainer)' : 'var(--td-bg-color-container)',
          border: `1px solid ${isClickable ? statusConfig.color + '60' : 'var(--td-component-stroke)'}`,
          transition: 'all 0.2s',
          opacity: node.status === 'locked' ? 0.5 : 1,
          cursor: isClickable ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        {/* 展开图标 */}
        <span className="text-xs mt-1" style={{ width: 16, textAlign: 'center' }}>
          {hasChildren ? (expanded ? '▼' : '▶') : '•'}
        </span>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs">{statusConfig.icon}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
              {node.title}
            </span>
            <Tag size="small" variant="light" style={{ color: typeConfig.color, borderColor: `${typeConfig.color}40` }}>
              {typeConfig.label}
            </Tag>
            <Tag size="small" variant="outline" style={{ color: statusConfig.color, borderColor: `${statusConfig.color}40` }}>
              {statusConfig.label}
            </Tag>
          </div>
          {node.description && (
            <p className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
              {node.description}
            </p>
          )}

          {/* 分支显示 */}
          {nodeBranches.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {nodeBranches.map(branch => (
                <button
                  key={branch.id}
                  className="text-xs px-2 py-1 rounded-md"
                  style={{
                    backgroundColor: branch.isSelected ? '#8b5cf620' : 'var(--td-bg-color-secondarycontainer)',
                    border: `1px solid ${branch.isSelected ? '#8b5cf6' : 'var(--td-component-stroke)'}`,
                    color: branch.isSelected ? '#8b5cf6' : 'var(--td-text-color-primary)',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBranch(branch.id);
                  }}
                >
                  {branch.isSelected ? '✦ ' : ''}{branch.name}
                </button>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          {(node.status === 'available' || node.status === 'in_progress') && (
            <div className="flex gap-2 mt-2">
              <Button
                size="small"
                theme="primary"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onContinue(node.id);
                }}
              >
                继续探索
              </Button>
              {node.nodeType === 'fork' && (
                <Button
                  size="small"
                  theme="default"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowForkDialog(true);
                  }}
                >
                  🔀 创建分支
                </Button>
              )}
            </div>
          )}

          {node.status === 'fork_available' && (
            <Button
              size="small"
              theme="default"
              variant="outline"
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowForkDialog(true);
              }}
            >
              🔀 创建分支
            </Button>
          )}
        </div>
      </div>

      {/* 子节点 */}
      {hasChildren && expanded && (
        <div className="ml-2" style={{ borderLeft: '2px solid var(--td-component-stroke)', paddingLeft: 4 }}>
          {node.children.map(child => (
            <QuestNodeCard
              key={child.id}
              node={child}
              branches={branches}
              depth={depth + 1}
              onContinue={onContinue}
              onFork={onFork}
              onSelectBranch={onSelectBranch}
            />
          ))}
        </div>
      )}

      {/* Fork Dialog */}
      <Dialog
        header="创建分支"
        visible={showForkDialog}
        onClose={() => setShowForkDialog(false)}
        onConfirm={handleForkSubmit}
        confirmBtn={{ content: '确认分叉', disabled: forkBranches.filter(b => b.name.trim()).length < 2 }}
      >
        <p className="text-sm mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
          至少需要 2 个分支选项
        </p>
        {forkBranches.map((branch, idx) => (
          <div key={idx} className="mb-2 flex gap-2">
            <Input
              placeholder={`分支 ${idx + 1} 名称`}
              value={branch.name}
              onChange={(val) => {
                const updated = [...forkBranches];
                updated[idx] = { ...updated[idx], name: val };
                setForkBranches(updated);
              }}
            />
            <Input
              placeholder="描述（可选）"
              value={branch.description}
              onChange={(val) => {
                const updated = [...forkBranches];
                updated[idx] = { ...updated[idx], description: val };
                setForkBranches(updated);
              }}
            />
          </div>
        ))}
        <Button size="small" variant="dashed" onClick={handleAddBranch}>
          + 添加分支
        </Button>
      </Dialog>
    </div>
  );
}

interface QuestMapProps {
  diveId: string;
}

export function QuestMap({ diveId }: QuestMapProps) {
  const [data, setData] = useState<QuestMapData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMap = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/dives/${diveId}/quest-map`);
      if (resp.ok) {
        const result = await resp.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch quest map:', err);
    } finally {
      setLoading(false);
    }
  }, [diveId]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  const handleContinue = async (nodeId: string) => {
    try {
      const resp = await fetch(`/api/dives/${diveId}/quest-map/nodes/${nodeId}/continue`, {
        method: 'POST',
      });
      if (resp.ok) {
        fetchMap();
      }
    } catch (err) {
      console.error('Failed to continue node:', err);
    }
  };

  const handleFork = async (nodeId: string, branches: { name: string; description?: string }[]) => {
    try {
      const resp = await fetch(`/api/dives/${diveId}/quest-map/nodes/${nodeId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches }),
      });
      if (resp.ok) {
        fetchMap();
      }
    } catch (err) {
      console.error('Failed to fork node:', err);
    }
  };

  const handleSelectBranch = async (branchId: string) => {
    try {
      const resp = await fetch(`/api/dives/${diveId}/quest-map/branches/${branchId}/select`, {
        method: 'POST',
      });
      if (resp.ok) {
        fetchMap();
      }
    } catch (err) {
      console.error('Failed to select branch:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm" style={{ color: 'var(--td-text-color-placeholder)' }}>
        加载中...
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return null;
  }

  const tree = buildTree(data.nodes);

  const stats = {
    total: data.nodes.length,
    completed: data.nodes.filter(n => n.status === 'completed').length,
    available: data.nodes.filter(n => n.status === 'available').length,
    locked: data.nodes.filter(n => n.status === 'locked').length,
  };

  return (
    <div
      className="p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--td-bg-color-container)',
        border: '1px solid var(--td-component-stroke)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">⚔️</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
            任务地图
          </span>
          <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
            点击节点继续探索
          </span>
        </div>
        <div className="flex gap-2 text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
          <span>✅ {stats.completed}/{stats.total}</span>
          <span>🔵 {stats.available} 可探索</span>
          <span>🔒 {stats.locked} 锁定</span>
        </div>
      </div>

      <div className="space-y-1">
        {tree.map(node => (
          <QuestNodeCard
            key={node.id}
            node={node}
            branches={data.branches}
            depth={0}
            onContinue={handleContinue}
            onFork={handleFork}
            onSelectBranch={handleSelectBranch}
          />
        ))}
      </div>

      {/* 图例 */}
      <div className="flex gap-3 mt-3 pt-2 flex-wrap" style={{ borderTop: '1px solid var(--td-component-stroke)' }}>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <span key={key} className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
            {config.icon} {config.label}
          </span>
        ))}
      </div>
    </div>
  );
}

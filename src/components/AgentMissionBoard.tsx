import { useState } from 'react';
import { Card, Loading, Progress } from 'tdesign-react';
import { AgentTaskState, AgentRunStepState, DiveState } from '../hooks/useDive';

// ============================================================
// Agent Mission Board — 展示 Dive Session 中所有 Agent 的工作状态
// ============================================================

const AGENT_ICONS: Record<string, string> = {
  host: '🎯',
  concept: '📚',
  vertical: '🔍',
  market: '💰',
  insider: '🧠',
  community: '💬',
  knowledge: '📖',
  technical_stack: '🔧',
  roadmap: '🗺️',
  misconception: '⚠️',
  critic: '✍️',
};

const STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  planning: '规划中',
  searching: '检索中',
  reading: '阅读中',
  extracting: '提取中',
  reporting: '报告中',
  completed: '已完成',
  failed: '失败',
};

const STATUS_COLORS: Record<string, string> = {
  queued: 'var(--td-text-color-placeholder)',
  planning: '#7c3aed',
  searching: '#0ea5e9',
  reading: '#f59e0b',
  extracting: '#8b5cf6',
  reporting: '#10b981',
  completed: '#22c55e',
  failed: 'var(--td-error-color)',
};

const STEP_TYPE_ICONS: Record<string, string> = {
  assigned: '📌',
  planning: '📋',
  tool_selected: '🔧',
  tool_running: '⚡',
  source_found: '🔗',
  finding_added: '💡',
  brief_submitted: '📝',
  reviewed: '✅',
  failed: '❌',
  skipped: '⏭️',
};

const STEP_STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  running: { color: '#0ea5e9', bg: '#0ea5e915' },
  completed: { color: '#22c55e', bg: '#22c55e15' },
  failed: { color: 'var(--td-error-color)', bg: 'var(--td-error-color-10)' },
  skipped: { color: 'var(--td-text-color-placeholder)', bg: 'var(--td-bg-color-secondarycontainer)' },
};

// ============================================================
// Step 列表组件
// ============================================================

interface StepListProps {
  steps: AgentRunStepState[];
}

function StepList({ steps }: StepListProps) {
  if (steps.length === 0) {
    return (
      <div className="text-xs px-2 py-2" style={{ color: 'var(--td-text-color-placeholder)' }}>
        暂无执行步骤
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {steps.map((step) => {
        const icon = STEP_TYPE_ICONS[step.stepType] || '▪️';
        const style = STEP_STATUS_STYLES[step.status] ?? STEP_STATUS_STYLES.running;

        return (
          <div
            key={step.id}
            className="flex items-start gap-2 text-xs px-2 py-1.5 rounded"
            style={{ backgroundColor: style.bg }}
          >
            <span className="flex-shrink-0 mt-0.5">{icon}</span>
            <div className="flex flex-col min-w-0">
              <span style={{ color: style.color }}>{step.title}</span>
              {step.description && (
                <span
                  className="truncate"
                  style={{ color: 'var(--td-text-color-placeholder)', maxWidth: 260 }}
                  title={step.description}
                >
                  {step.description.length > 60 ? step.description.slice(0, 60) + '...' : step.description}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Agent Mission Card — 可展开
// ============================================================

interface AgentMissionCardProps {
  task: AgentTaskState;
}

function AgentMissionCard({ task }: AgentMissionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = AGENT_ICONS[task.agentId] || '🤖';
  const statusLabel = STATUS_LABELS[task.status] ?? task.status;
  const statusColor = STATUS_COLORS[task.status] ?? 'var(--td-text-color-secondary)';
  const isActive = !['completed', 'failed'].includes(task.status);
  const hasSteps = task.steps.length > 0;

  return (
    <Card
      bordered
      size="small"
      style={{
        borderColor: statusColor,
        borderLeftWidth: 3,
        transition: 'all 0.4s ease',
        boxShadow: isActive
          ? `0 0 0 1px ${statusColor}30, 0 2px 8px ${statusColor}15`
          : '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* 头部 — 点击展开 */}
      <div
        className="flex items-center justify-between"
        style={{ cursor: hasSteps ? 'pointer' : 'default' }}
        onClick={() => hasSteps && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center rounded-md text-sm"
            style={{
              width: 28,
              height: 28,
              backgroundColor: `${statusColor}15`,
              transition: 'background-color 0.4s ease',
            }}
          >
            {icon}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
              {task.title}
            </span>
            <span
              className="text-xs"
              style={{
                color: statusColor,
                transition: 'color 0.4s ease',
              }}
            >
              {isActive && <Loading size="small" style={{ marginRight: 4 }} />}
              {statusLabel}
              {hasSteps && (
                <span style={{ marginLeft: 6, color: 'var(--td-text-color-placeholder)' }}>
                  {expanded ? '▾' : '▸'} {task.steps.length} 步
                </span>
              )}
            </span>
          </div>
        </div>
        {task.progress > 0 && task.status !== 'completed' && (
          <Progress
            percentage={task.progress}
            size="small"
            style={{ width: 60 }}
            color={statusColor}
          />
        )}
      </div>

      {/* 状态消息 */}
      {task.message && (
        <div
          className="mt-2 text-xs px-2 py-1.5 rounded"
          style={{
            backgroundColor: 'var(--td-bg-color-secondarycontainer)',
            color: 'var(--td-text-color-secondary)',
            transition: 'opacity 0.3s ease',
          }}
        >
          {task.message}
        </div>
      )}

      {/* 笔记 */}
      {task.notes.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {task.notes.map((note, i) => (
            <div
              key={i}
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--td-bg-color-secondarycontainer)',
                color: 'var(--td-text-color-secondary)',
                borderLeft: `2px solid ${statusColor}40`,
              }}
            >
              💡 {note.length > 100 ? note.slice(0, 100) + '...' : note}
            </div>
          ))}
        </div>
      )}

      {/* 展开的步骤列表 */}
      {expanded && hasSteps && (
        <div
          className="mt-2 pt-2"
          style={{ borderTop: '1px solid var(--td-border-level-1-color)' }}
        >
          <StepList steps={task.steps} />
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Mission Board 主组件
// ============================================================

interface AgentMissionBoardProps {
  diveState: DiveState;
}

export function AgentMissionBoard({ diveState }: AgentMissionBoardProps) {
  const agents = Array.from(diveState.agents.values());

  if (diveState.status === 'idle') return null;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Dive 状态头部 */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
          🎯 入坑任务：{diveState.topic || '准备中...'}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: diveState.status === 'completed'
              ? '#22c55e20'
              : diveState.status === 'failed'
                ? 'var(--td-error-color-10)'
                : '#0ea5e920',
            color: diveState.status === 'completed'
              ? '#22c55e'
              : diveState.status === 'failed'
                ? 'var(--td-error-color)'
                : '#0ea5e9',
          }}
        >
          {diveState.status === 'planning' && '规划中'}
          {diveState.status === 'executing' && '执行中'}
          {diveState.status === 'synthesizing' && '整合中'}
          {diveState.status === 'completed' && '已完成'}
          {diveState.status === 'failed' && '失败'}
        </span>
      </div>

      {/* 初始加载状态（Dive 刚启动，还没有 Agent 事件） */}
      {agents.length === 0 && diveState.status === 'planning' && (
        <div
          className="flex items-center gap-2 px-3 py-3 rounded-md text-sm"
          style={{
            backgroundColor: 'var(--td-bg-color-secondarycontainer)',
            color: 'var(--td-text-color-secondary)',
          }}
        >
          <Loading size="small" />
          <span>正在启动 Dive Session，主持 Agent 正在规划调研方案...</span>
        </div>
      )}

      {/* 调研计划 */}
      {diveState.plan && (
        <div
          className="text-xs px-3 py-2 rounded-md"
          style={{
            backgroundColor: 'var(--td-bg-color-secondarycontainer)',
            color: 'var(--td-text-color-secondary)',
          }}
        >
          📋 调研阵容：{diveState.plan.agents.map(a => a.title).join(' → ')}
        </div>
      )}

      {/* Agent 卡片列表 */}
      {agents.length > 0 && (
        <div className="flex flex-col gap-2">
          {agents.map(task => (
            <AgentMissionCard key={task.taskId} task={task} />
          ))}
        </div>
      )}

      {/* 错误信息 */}
      {diveState.error && (
        <div
          className="text-xs px-3 py-2 rounded-md"
          style={{
            backgroundColor: 'var(--td-error-color-10)',
            color: 'var(--td-error-color)',
          }}
        >
          ❌ {diveState.error}
        </div>
      )}

      {/* 审稿评分 */}
      {diveState.criticScore && (
        <div
          className="px-3 py-2 rounded-md text-xs"
          style={{
            backgroundColor: diveState.criticScore.overall >= 7 ? '#22c55e10' : '#f59e0b10',
            border: `1px solid ${diveState.criticScore.overall >= 7 ? '#22c55e30' : '#f59e0b30'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span>✍️ 审稿评分</span>
            <span
              className="font-semibold"
              style={{
                color: diveState.criticScore.overall >= 7 ? '#22c55e' : '#f59e0b',
              }}
            >
              {diveState.criticScore.overall}/10
            </span>
            {diveState.criticScore.overall < 7 && (
              <span style={{ color: '#f59e0b' }}>（已触发重写）</span>
            )}
          </div>
          {diveState.criticScore.issues.length > 0 && (
            <div style={{ color: 'var(--td-text-color-secondary)' }}>
              {diveState.criticScore.issues.slice(0, 3).map((issue, i) => (
                <span key={i}>• {issue} </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AgentMissionBoard;

import { useState } from 'react';
import { Card, Loading } from 'tdesign-react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from 'tdesign-icons-react';

/* ────────────────────────────────────────────
   AgentEvent — 与后端 SSE 事件流一致
   ──────────────────────────────────────────── */
export type AgentEvent =
  | { type: 'agent_start';    agentId: string; agentName: string; phase?: string }
  | { type: 'agent_thinking'; agentId: string; content: string }
  | { type: 'agent_tool';     agentId: string; toolName: string; input: any }
  | { type: 'agent_result';   agentId: string; toolName: string; output: string }
  | { type: 'agent_complete'; agentId: string; summary?: string }
  | { type: 'final_answer';   content: string }
  | { type: 'error';          message: string };

/* ────────────────────────────────────────────
   AgentCard — 单个 Agent 协作可视化卡片
   ──────────────────────────────────────────── */
interface AgentCardProps {
  agentId: string;
  agentName: string;
  phase?: string;
  status: 'idle' | 'thinking' | 'complete' | 'error';
  content?: string;
  children?: React.ReactNode;
}

/** Agent 图标映射 */
const AGENT_ICON_MAP: Record<string, string> = {
  'rush-into-pit-host':    '🎯',
  'rush-into-pit-concept': '📚',
  'rush-into-pit-vertical':'🔍',
  'rush-into-pit-market':  '💰',
};

/** 状态图标映射 */
const STATUS_ICON: Record<AgentCardProps['status'], { icon: string; label: string }> = {
  idle:     { icon: '⏳', label: '等待中' },
  thinking: { icon: '🔄', label: '思考中' },
  complete: { icon: '✅', label: '已完成' },
  error:    { icon: '❌', label: '出错了' },
};

/** Agent 主题色映射 */
const AGENT_COLOR: Record<string, string> = {
  'rush-into-pit-host':     '#7c3aed',
  'rush-into-pit-concept':  '#f59e0b',
  'rush-into-pit-vertical': '#0ea5e9',
  'rush-into-pit-market':   '#10b981',
};

const getAgentColor = (agentId: string): string =>
  AGENT_COLOR[agentId] || 'var(--td-brand-color)';

export function AgentCard({
  agentId,
  agentName,
  phase,
  status,
  content,
  children,
}: AgentCardProps) {
  const [expanded, setExpanded] = useState(true);

  const agentIcon = AGENT_ICON_MAP[agentId] || '🤖';
  const statusInfo = STATUS_ICON[status];
  const accentColor = getAgentColor(agentId);
  const isCollapsible = status === 'complete';

  return (
    <Card
      bordered
      size="small"
      style={{
        borderColor: accentColor,
        borderLeftWidth: 3,
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow:
          status === 'thinking'
            ? `0 0 0 1px ${accentColor}40, 0 2px 8px ${accentColor}20`
            : '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── 头部：Agent 图标 + 名称 + 状态 ── */}
      <div
        className="flex items-center justify-between"
        style={{ cursor: isCollapsible ? 'pointer' : 'default' }}
        onClick={isCollapsible ? () => setExpanded((v) => !v) : undefined}
      >
        {/* 左侧 */}
        <div className="flex items-center gap-2">
          {/* Agent 图标 */}
          <span
            className="flex items-center justify-center rounded-md text-base"
            style={{
              width: 28,
              height: 28,
              backgroundColor: `${accentColor}18`,
            }}
          >
            {agentIcon}
          </span>

          {/* 名称 + phase */}
          <div className="flex flex-col">
            <span
              className="text-sm font-semibold leading-tight"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              {agentName}
            </span>
            {phase && (
              <span
                className="text-xs"
                style={{ color: 'var(--td-text-color-placeholder)' }}
              >
                {phase}
              </span>
            )}
          </div>
        </div>

        {/* 右侧：状态 */}
        <div className="flex items-center gap-1.5">
          {status === 'thinking' && <Loading size="small" />}
          <span
            className="text-xs"
            style={{ color: 'var(--td-text-color-secondary)' }}
          >
            {statusInfo.icon} {statusInfo.label}
          </span>
          {isCollapsible &&
            (expanded ? (
              <ChevronUpIcon size={14} style={{ color: 'var(--td-text-color-placeholder)' }} />
            ) : (
              <ChevronDownIcon size={14} style={{ color: 'var(--td-text-color-placeholder)' }} />
            ))}
        </div>
      </div>

      {/* ── 内容区 ── */}
      {/* thinking 状态：实时展示内容流 */}
      {status === 'thinking' && content && (
        <div
          className="mt-2 px-3 py-2 rounded-md text-xs whitespace-pre-wrap break-words max-h-40 overflow-y-auto"
          style={{
            backgroundColor: 'var(--td-bg-color-secondarycontainer)',
            color: 'var(--td-text-color-secondary)',
          }}
        >
          {content}
          <span
            className="animate-cursor-blink ml-0.5"
            style={{ color: accentColor }}
          >
            |
          </span>
        </div>
      )}

      {/* complete / idle / error 状态：内容可折叠 */}
      {(status === 'complete' || status === 'idle' || status === 'error') &&
        content &&
        (!isCollapsible || expanded) && (
          <div
            className="mt-2 px-3 py-2 rounded-md text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
            style={{
              backgroundColor: 'var(--td-bg-color-secondarycontainer)',
              color:
                status === 'error'
                  ? 'var(--td-error-color)'
                  : 'var(--td-text-color-secondary)',
            }}
          >
            {content}
          </div>
        )}

      {/* children 插槽（自定义扩展） */}
      {children && <div className="mt-2">{children}</div>}
    </Card>
  );
}

/* ────────────────────────────────────────────
   AgentTimeline — 多 Agent 协作时间线
   ──────────────────────────────────────────── */
interface AgentTimelineProps {
  events: AgentEvent[];
}

/** 从事件流中聚合每个 Agent 的最新状态 */
interface AgentState {
  agentId: string;
  agentName: string;
  phase?: string;
  status: 'idle' | 'thinking' | 'complete' | 'error';
  content?: string;
  lastTimestamp: number;
}

function buildAgentStates(events: AgentEvent[]): AgentState[] {
  const stateMap = new Map<string, AgentState>();

  events.forEach((event, index) => {
    const key =
      event.type === 'final_answer' || event.type === 'error'
        ? `__sys_${index}`
        : event.agentId;

    if (event.type === 'agent_start') {
      stateMap.set(key, {
        agentId: event.agentId,
        agentName: event.agentName,
        phase: event.phase,
        status: 'thinking',
        lastTimestamp: index,
      });
    } else if (event.type === 'agent_thinking') {
      const existing = stateMap.get(key);
      if (existing) {
        existing.status = 'thinking';
        existing.content = event.content;
        existing.lastTimestamp = index;
      }
    } else if (event.type === 'agent_result') {
      const existing = stateMap.get(key);
      if (existing) {
        existing.status = 'thinking';
        existing.content = `[${event.toolName}] ${event.output}`;
        existing.lastTimestamp = index;
      }
    } else if (event.type === 'agent_complete') {
      const existing = stateMap.get(key);
      if (existing) {
        existing.status = 'complete';
        existing.content = event.summary;
        existing.lastTimestamp = index;
      }
    } else if (event.type === 'final_answer') {
      stateMap.set(key, {
        agentId: '__final',
        agentName: '📋 入坑指南',
        status: 'complete',
        content: event.content,
        lastTimestamp: index,
      });
    } else if (event.type === 'error') {
      // 系统级 error — 建一个独立的错误卡片
      stateMap.set(key, {
        agentId: '__error',
        agentName: '⚠️ 系统',
        status: 'error',
        content: event.message,
        lastTimestamp: index,
      });
    }
  });

  return Array.from(stateMap.values()).sort((a, b) => a.lastTimestamp - b.lastTimestamp);
}

export function AgentTimeline({ events }: AgentTimelineProps) {
  const agents = buildAgentStates(events);

  if (agents.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 时间线连接线 */}
      <div className="relative">
        {agents.map((agent, index) => (
          <div key={`${agent.agentId}-${index}`} className="relative">
            {/* 连接线 */}
            {index < agents.length - 1 && (
              <div
                className="absolute left-[15px] top-[36px] w-[2px]"
                style={{
                  height: 'calc(100% - 20px)',
                  backgroundColor: 'var(--td-component-stroke)',
                }}
              />
            )}

            {/* Agent Card */}
            <div className="pl-2 pb-2">
              <AgentCard
                agentId={agent.agentId}
                agentName={agent.agentName}
                phase={agent.phase}
                status={agent.status}
                content={agent.content}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentTimeline;

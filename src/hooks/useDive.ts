import { useState, useCallback, useRef, useEffect } from 'react';
import { ProviderConfig } from './useProvider';
import type { DiveGuideContent } from '../components/DiveGuide';

// ============================================================
// Dive Agent Event（与后端 server/types/dive.ts 一致）
// ============================================================

export type DiveAgentEvent =
  | { type: 'dive_created'; diveId: string; topic: string }
  | { type: 'host_question'; diveId: string; questions: string[] }
  | { type: 'plan_created'; diveId: string; plan: DivePlan }
  | { type: 'agent_started'; diveId: string; taskId: string; agentId: string; title: string }
  | { type: 'agent_status'; diveId: string; taskId: string; status: string; message: string; progress?: number }
  | { type: 'source_found'; diveId: string; taskId: string; source: EvidenceItem }
  | { type: 'note_added'; diveId: string; taskId: string; note: string }
  | { type: 'agent_report_ready'; diveId: string; taskId: string; reportId: string }
  | { type: 'critic_score'; diveId: string; score: CriticScore }
  | { type: 'synthesis_started'; diveId: string }
  | { type: 'final_ready'; diveId: string; guideId: string; content: string; guide?: DiveGuideContent }
  | { type: 'error'; diveId: string; taskId?: string; message: string }
  | { type: 'done' };

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

export interface DivePlan {
  domainType: string;
  agents: { agentId: string; title: string; purpose: string }[];
  sourcePlan: { topic: string; domainType: string; sourceGroups: any[] };
}

export interface EvidenceItem {
  id: string;
  title: string;
  url?: string;
  platform?: string;
  summary: string;
}

// ============================================================
// Agent Task State（前端聚合状态）
// ============================================================

export interface AgentTaskState {
  taskId: string;
  agentId: string;
  title: string;
  status: 'queued' | 'planning' | 'searching' | 'reading' | 'extracting' | 'reporting' | 'completed' | 'failed';
  message: string;
  progress: number;
  notes: string[];
}

export interface DiveState {
  diveId: string | null;
  topic: string;
  status: 'idle' | 'clarifying' | 'planning' | 'executing' | 'synthesizing' | 'completed' | 'failed';
  plan: DivePlan | null;
  agents: Map<string, AgentTaskState>;
  finalContent: string | null;
  guideId: string | null;
  guide: DiveGuideContent | null;
  criticScore: CriticScore | null;
  error: string | null;
}

// ============================================================
// useDive Hook
// ============================================================

export function useDive() {
  const [diveState, setDiveState] = useState<DiveState>({
    diveId: null,
    topic: '',
    status: 'idle',
    plan: null,
    agents: new Map(),
    finalContent: null,
    guideId: null,
    guide: null,
    criticScore: null,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 组件卸载时清理 SSE 流
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const startDive = useCallback(async (
    message: string,
    topic: string,
    userLevel: string,
    provider: ProviderConfig,
  ) => {
    if (isLoading) return;

    // 重置状态
    setDiveState({
      diveId: null,
      topic,
      status: 'planning',
      plan: null,
      agents: new Map(),
      finalContent: null,
      guideId: null,
      guide: null,
      criticScore: null,
      error: null,
    });
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          topic,
          userLevel,
          provider: {
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model: provider.model,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`服务器返回 ${response.status}: ${errText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // 流结束后处理 buffer 中剩余的数据
          if (buffer.trim()) {
            const remaining = buffer.split('\n');
            for (const line of remaining) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              try {
                const event: DiveAgentEvent = JSON.parse(trimmed.slice(6));
                handleDiveEvent(event);
              } catch {
                // 忽略解析错误
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const event: DiveAgentEvent = JSON.parse(trimmed.slice(6));
            handleDiveEvent(event);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[Dive] Error:', err);
        setDiveState(prev => ({
          ...prev,
          status: 'failed',
          error: err.message || 'Dive 执行失败',
        }));
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [isLoading]);

  const handleDiveEvent = useCallback((event: DiveAgentEvent) => {
    setDiveState(prev => {
      const next = { ...prev };

      switch (event.type) {
        case 'dive_created':
          next.diveId = event.diveId;
          next.topic = event.topic;
          next.status = 'planning';
          break;

        case 'plan_created':
          next.plan = event.plan;
          next.status = 'executing';
          break;

        case 'agent_started': {
          const agents = new Map(next.agents);
          agents.set(event.taskId, {
            taskId: event.taskId,
            agentId: event.agentId,
            title: event.title,
            status: 'queued',
            message: '准备中...',
            progress: 0,
            notes: [],
          });
          next.agents = agents;
          break;
        }

        case 'agent_status': {
          const agents = new Map(next.agents);
          const existing = agents.get(event.taskId);
          if (existing) {
            agents.set(event.taskId, {
              ...existing,
              status: event.status as AgentTaskState['status'],
              message: event.message,
              progress: event.progress ?? existing.progress,
            });
          }
          next.agents = agents;
          break;
        }

        case 'note_added': {
          const agents = new Map(next.agents);
          const existing = agents.get(event.taskId);
          if (existing) {
            agents.set(event.taskId, {
              ...existing,
              notes: [...existing.notes, event.note],
            });
          }
          next.agents = agents;
          break;
        }

        case 'agent_report_ready': {
          const agents = new Map(next.agents);
          const existing = agents.get(event.taskId);
          if (existing) {
            agents.set(event.taskId, {
              ...existing,
              status: 'completed',
              progress: 100,
              message: '报告完成',
            });
          }
          next.agents = agents;
          break;
        }

        case 'critic_score':
          next.criticScore = event.score;
          break;

        case 'synthesis_started':
          next.status = 'synthesizing';
          break;

        case 'final_ready':
          next.guideId = event.guideId;
          next.finalContent = event.content;
          next.guide = event.guide ?? null;
          next.status = 'completed';
          break;

        case 'error':
          next.status = 'failed';
          next.error = event.message;
          break;

        case 'done':
          // final_ready 已经设置了 completed 状态
          break;
      }

      return next;
    });
  }, []);

  const stopDive = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const resetDive = useCallback(() => {
    setDiveState({
      diveId: null,
      topic: '',
      status: 'idle',
      plan: null,
      agents: new Map(),
      finalContent: null,
      guideId: null,
      guide: null,
      criticScore: null,
      error: null,
    });
  }, []);

  return {
    diveState,
    isLoading,
    startDive,
    stopDive,
    resetDive,
  };
}

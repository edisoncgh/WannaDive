import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session } from '../types';
import { NewChatView, KnowledgeLevel } from '../components/NewChatView';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import { AgentTimeline, AgentEvent } from '../components/AgentCard';
import { AgentMissionBoard } from '../components/AgentMissionBoard';
import { DiveGuideView, DiveGuideFallback } from '../components/DiveGuide';
import { ProviderConfig } from '../hooks/useProvider';
import { useDive } from '../hooks/useDive';
import { SessionListItem } from '../hooks/useSessions';

interface ChatPageProps {
  currentSession: Session | undefined;
  sessionList: SessionListItem[];
  currentSessionId: string | null;
  provider: ProviderConfig | null;
  isProviderConfigured: boolean;
  agentEvents: AgentEvent[];
  isLoading: boolean;
  inputValue: string;
  onSendMessage: (message: string, provider: ProviderConfig, newChatOptions?: NewChatOptions, onNavigate?: (path: string) => void) => void;
  onStop: () => void;
  onInputChange: (value: string) => void;
}

interface NewChatOptions {
  topic: string;
  level: KnowledgeLevel;
}

const KNOWLEDGE_LEVEL_TEXT: Record<KnowledgeLevel, string> = {
  novice: '纯小白（完全没接触过）',
  beginner: '听过一点（知道一些名词）',
  intermediate: '有点基础（想进一步深入）',
};

const LEVEL_MAP: Record<KnowledgeLevel, string> = {
  novice: 'zero',
  beginner: 'beginner',
  intermediate: 'intermediate',
};

/**
 * 拼装首发消息：把"入坑对象"和"了解程度"结构化喂给主 Agent，
 * 让它能在第一轮就明确目标并启动子 Agent 协作。
 */
function buildFirstMessage(topic: string, level: KnowledgeLevel): string {
  const safeTopic = (topic || '').trim() || '（用户还没填）';
  return `【入坑任务】我想入坑：**${safeTopic}**

我对这个东西的了解程度：${KNOWLEDGE_LEVEL_TEXT[level]}

上面的信息已经足够，请直接调度 concept-agent、vertical-agent、market-agent 三个子 Agent 收集信息，最后给我一份"入坑指南"。不需要再询问了解程度等已知信息。`;
}

export function ChatPage({
  currentSession,
  sessionList,
  currentSessionId,
  provider,
  isProviderConfigured,
  agentEvents,
  isLoading: chatLoading,
  inputValue,
  onSendMessage,
  onStop: onChatStop,
  onInputChange,
}: ChatPageProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dive Session hook
  const { diveState, isLoading: diveLoading, startDive, stopDive, resetDive, restoreDive } = useDive();

  // 当切换到历史 Dive Session 时，恢复 dive 状态
  const restoredSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSessionId) {
      resetDive();
      restoredSessionRef.current = null;
      return;
    }
    if (restoredSessionRef.current === currentSessionId) return;
    const listItem = sessionList.find(s => s.id === currentSessionId);
    if (listItem?.kind === 'dive') {
      restoredSessionRef.current = currentSessionId;
      restoreDive(currentSessionId);
    } else {
      resetDive();
      restoredSessionRef.current = null;
    }
  }, [currentSessionId, sessionList, restoreDive, resetDive]);

  // 当 Dive 创建了 session，导航到该 session
  useEffect(() => {
    if (diveState.sessionId) {
      navigate(`/chat/${diveState.sessionId}`, { replace: true });
    }
  }, [diveState.sessionId, navigate]);

  // 新对话页面状态
  const [newChatTopic, setNewChatTopic] = useState('');
  const [newChatLevel, setNewChatLevel] = useState<KnowledgeLevel>('novice');

  // 合并 loading 状态
  const isLoading = chatLoading || diveLoading;

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, agentEvents, diveState]);

  // 处理发送消息（旧模式，后续对话）
  const handleSend = useCallback((message: string) => {
    if (!provider) return;
    if (!currentSession) {
      // 新对话：使用 Dive 模式
      const finalMessage = buildFirstMessage(newChatTopic, newChatLevel);
      const topic = newChatTopic.trim() || '未知';

      startDive(finalMessage, topic, LEVEL_MAP[newChatLevel], provider).then(() => {
        setNewChatTopic('');
        setNewChatLevel('novice');
      });
    } else {
      onSendMessage(message, provider);
    }
  }, [currentSession, provider, newChatTopic, newChatLevel, onSendMessage, startDive]);

  // 「开始入坑」按钮的回调
  const handleStartRush = useCallback(() => {
    if (!newChatTopic.trim()) return;
    handleSend('[__start__]');
  }, [newChatTopic, handleSend]);

  // 停止
  const handleStop = useCallback(() => {
    if (diveLoading) {
      stopDive();
    } else {
      onChatStop();
    }
  }, [diveLoading, stopDive, onChatStop]);

  // Provider 未配置时显示提示
  if (!isProviderConfigured) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto"
            style={{ background: 'var(--td-bg-color-component)' }}
          >
            <span className="text-3xl">⚙️</span>
          </div>
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            尚未配置 LLM Provider
          </h2>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            请先在设置页面配置 LLM Provider（Base URL、API Key、模型），然后就可以开始入坑了。
          </p>
        </div>
      </div>
    );
  }

  const showNewChatView = !currentSession || currentSession.messages.length === 0;
  const showDiveBoard = diveState.status !== 'idle';
  const canStart = newChatTopic.trim().length > 0;

  return (
    <>
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {showDiveBoard ? (
          <div className="max-w-3xl mx-auto">
            <AgentMissionBoard diveState={diveState} />

            {/* Dive 完成后显示最终指南 */}
            {diveState.status === 'completed' && diveState.finalContent && (
              diveState.guide
                ? <DiveGuideView
                    guide={diveState.guide}
                    markdown={diveState.finalContent}
                    onExplore={(prompt) => {
                      if (provider) {
                        resetDive();
                        startDive(prompt, prompt, 'unknown', provider);
                      }
                    }}
                  />
                : <DiveGuideFallback content={diveState.finalContent} />
            )}

            {/* Dive 完成后显示「再来一次」按钮 */}
            {diveState.status === 'completed' && (
              <div className="mt-4 text-center">
                <button
                  className="px-4 py-2 text-sm rounded-md"
                  style={{
                    backgroundColor: 'var(--td-brand-color)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    resetDive();
                  }}
                >
                  再来一次入坑
                </button>
              </div>
            )}
          </div>
        ) : showNewChatView ? (
          <NewChatView
            newChatTopic={newChatTopic}
            newChatLevel={newChatLevel}
            onSetTopic={setNewChatTopic}
            onSetLevel={setNewChatLevel}
            onStart={handleStartRush}
            canStart={canStart}
          />
        ) : (
          <>
            {/* Agent 协作过程 */}
            {agentEvents.length > 0 && (
              <div className="max-w-3xl mx-auto mb-6">
                <AgentTimeline events={agentEvents} />
              </div>
            )}

            {/* 消息列表 */}
            <ChatMessages
              messages={currentSession!.messages}
              messagesEndRef={messagesEndRef}
            />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <ChatInput
        inputValue={inputValue}
        isLoading={isLoading}
        onSend={handleSend}
        onStop={handleStop}
        onChange={onInputChange}
      />
    </>
  );
}

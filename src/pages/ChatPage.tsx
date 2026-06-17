import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session } from '../types';
import { NewChatView, KnowledgeLevel } from '../components/NewChatView';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import { AgentTimeline, AgentEvent } from '../components/AgentCard';
import { ProviderConfig } from '../hooks/useProvider';

interface ChatPageProps {
  currentSession: Session | undefined;
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

/**
 * 拼装首发消息：把"入坑对象"和"了解程度"结构化喂给主 Agent，
 * 让它能在第一轮就明确目标并启动子 Agent 协作。
 */
function buildFirstMessage(topic: string, level: KnowledgeLevel): string {
  const safeTopic = (topic || '').trim() || '（用户还没填）';
  return `【入坑任务】我想入坑：**${safeTopic}**

我对这个东西的了解程度：${KNOWLEDGE_LEVEL_TEXT[level]}

上面的信息已经足够，请直接调度 concept-agent、vertical-agent、market-agent 三个子 Agent 收集信息，最后给我一份“入坑指南”。不需要再询问了解程度等已知信息。`;
}

export function ChatPage({
  currentSession,
  provider,
  isProviderConfigured,
  agentEvents,
  isLoading,
  inputValue,
  onSendMessage,
  onStop,
  onInputChange,
}: ChatPageProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 新对话页面状态
  const [newChatTopic, setNewChatTopic] = useState('');
  const [newChatLevel, setNewChatLevel] = useState<KnowledgeLevel>('novice');

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, agentEvents]);

  // 处理发送消息
  const handleSend = useCallback((message: string) => {
    if (!provider) return;
    if (!currentSession) {
      // 新对话：拼装入坑信息
      const finalMessage = buildFirstMessage(newChatTopic, newChatLevel);

      onSendMessage(finalMessage, provider, {
        topic: newChatTopic,
        level: newChatLevel,
      }, (path) => {
        setNewChatTopic('');
        setNewChatLevel('novice');
        navigate(path);
      });
    } else {
      onSendMessage(message, provider);
    }
  }, [currentSession, provider, newChatTopic, newChatLevel, onSendMessage, navigate]);

  // 「开始入坑」按钮的回调
  const handleStartRush = useCallback(() => {
    if (!newChatTopic.trim()) return;
    handleSend('[__start__]');
  }, [newChatTopic, handleSend]);

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
  const canStart = newChatTopic.trim().length > 0;

  return (
    <>
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {showNewChatView ? (
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
        onStop={onStop}
        onChange={onInputChange}
      />
    </>
  );
}

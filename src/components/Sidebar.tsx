import { Button, Tooltip, Tag } from 'tdesign-react';
import { AddIcon, DeleteIcon, SettingIcon } from 'tdesign-icons-react';
import { Bot, Compass } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Session, Agent } from '../types';
import { ICON_MAP } from '../utils/iconMap';
import { SessionListItem } from '../hooks/useSessions';

interface SidebarProps {
  sessions: Session[];
  sessionList: SessionListItem[];
  currentSessionId: string | null;
  isSettingsPage: boolean;
  sidebarOpen: boolean;
  agents: Agent[];
  getAgent: (id: string) => Agent | undefined;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  sessions,
  sessionList,
  currentSessionId,
  isSettingsPage,
  sidebarOpen,
  agents,
  getAgent,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside 
      className="flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden"
      style={{ 
        width: sidebarOpen ? 260 : 0,
        backgroundColor: 'var(--td-bg-color-container)'
      }}
    >
      {/* Logo */}
      <div className="h-14 px-4 flex items-center flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--td-brand-color)' }}
          >
            <span className="text-white text-sm font-bold">{APP_CONFIG.nameInitial}</span>
          </div>
          <span 
            className="text-lg font-semibold"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </span>
        </div>
      </div>

      {/* 新对话按钮 */}
      <div className="p-3">
        <Button 
          icon={<AddIcon />}
          onClick={onNewChat}
          block
          variant="outline"
        >
          新对话
        </Button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessionList.map(item => {
          const isDive = item.kind === 'dive';
          const sessionAgent = !isDive ? (() => {
            const session = sessions.find(s => s.id === item.id);
            return session?.agentId ? getAgent(session.agentId) : getAgent('default');
          })() : undefined;
          const AgentIcon = isDive ? Compass : (ICON_MAP[sessionAgent?.icon || 'Bot'] || Bot);
          return (
            <div 
              key={item.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-200 group"
              style={{
                backgroundColor: item.id === currentSessionId && !isSettingsPage
                  ? 'var(--td-brand-color-light)' 
                  : 'transparent',
                color: item.id === currentSessionId && !isSettingsPage
                  ? 'var(--td-brand-color)' 
                  : 'var(--td-text-color-secondary)'
              }}
              onClick={() => onSelectSession(item.id)}
              onMouseEnter={(e) => {
                if (item.id !== currentSessionId || isSettingsPage) {
                  e.currentTarget.style.backgroundColor = 'var(--td-bg-color-component-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (item.id !== currentSessionId || isSettingsPage) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div 
                className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: isDive ? 'var(--td-success-color)' : (sessionAgent?.color || 'var(--td-brand-color)') }}
              >
                <AgentIcon size={12} color="white" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="truncate text-sm block">{item.title}</span>
                {isDive && item.dive && (
                  <span className="text-xs opacity-60 truncate block">
                    {item.dive.topic}
                  </span>
                )}
              </div>
              {isDive && item.dive?.status === 'completed' && (
                <Tag theme="success" size="small" variant="light">完成</Tag>
              )}
              <Tooltip content="删除会话">
                <Button
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  variant="text"
                  shape="circle"
                  size="medium"
                  icon={<DeleteIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(item.id);
                  }}
                />
              </Tooltip>
            </div>
          );
        })}
      </div>
      
      {/* 底部设置按钮 */}
      <div 
        className="p-3 border-t flex-shrink-0"
        style={{ borderColor: 'var(--td-component-border)' }}
      >
        <Button 
          icon={<SettingIcon />}
          onClick={onOpenSettings}
          block
          variant={isSettingsPage ? 'outline' : 'text'}
          theme={isSettingsPage ? 'primary' : 'default'}
        >
          设置
        </Button>
      </div>
    </aside>
  );
}

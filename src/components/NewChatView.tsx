import { Input, Tag, Radio, Button } from 'tdesign-react';
import { Sparkles, Send } from 'lucide-react';
import { APP_CONFIG } from '../config';

export interface NewChatViewProps {
  newChatTopic?: string;
  newChatLevel?: KnowledgeLevel;
  onSetTopic?: (topic: string) => void;
  onSetLevel?: (level: KnowledgeLevel) => void;
  onStart?: () => void;
  canStart?: boolean;
}

export type KnowledgeLevel = 'novice' | 'beginner' | 'intermediate';

const KNOWLEDGE_LEVELS: { value: KnowledgeLevel; label: string; description: string; emoji: string }[] = [
  { value: 'novice', label: '纯小白', description: '完全没接触过', emoji: '🌱' },
  { value: 'beginner', label: '听过一点', description: '知道一些名词但不了解', emoji: '🌿' },
  { value: 'intermediate', label: '有点基础', description: '想进一步深入', emoji: '🌳' },
];

const QUICK_TOPICS = [
  '单反相机',
  '足球',
  '咖啡',
  '葡萄酒',
  '基金理财',
  '露营',
  '健身',
  '摄影',
  '黑胶唱片',
  '自行车',
  '瑜伽',
  '滑雪',
];

export function NewChatView({
  newChatTopic = '',
  newChatLevel = 'novice',
  onSetTopic,
  onSetLevel,
  onStart,
  canStart = false,
}: NewChatViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Logo 和标题 */}
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg mx-auto"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)'
            }}
          >
            <span className="text-3xl font-bold text-white">{APP_CONFIG.nameInitial}</span>
          </div>
          <h2
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </h2>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            {APP_CONFIG.description}
          </p>
        </div>

        {/* 入坑设置 */}
        <div
          className="mb-5 p-4 rounded-xl border-2"
          style={{
            borderColor: '#7c3aed',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.04) 0%, rgba(236,72,153,0.04) 100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} color="#7c3aed" />
            <span className="text-sm font-semibold" style={{ color: '#7c3aed' }}>
              入坑设置
            </span>
          </div>

          {/* 入坑对象输入 */}
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
              你想入坑什么？
            </label>
            <Input
              value={newChatTopic}
              onChange={(v) => onSetTopic?.(v as string)}
              placeholder="例如：单反相机、看足球、露营、基金理财..."
              clearable
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_TOPICS.map(t => (
                <Tag
                  key={t}
                  size="small"
                  variant="light"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSetTopic?.(t)}
                >
                  {t}
                </Tag>
              ))}
            </div>
          </div>

          {/* 了解程度 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--td-text-color-primary)' }}>
              你目前的了解程度
            </label>
            <Radio.Group
              value={newChatLevel}
              onChange={(v) => onSetLevel?.(v as KnowledgeLevel)}
            >
              {KNOWLEDGE_LEVELS.map(lv => (
                <Radio key={lv.value} value={lv.value}>
                  <span className="mr-1">{lv.emoji}</span>
                  <span className="font-medium">{lv.label}</span>
                  <span style={{ color: 'var(--td-text-color-placeholder)' }} className="ml-1 text-xs">
                    {lv.description}
                  </span>
                </Radio>
              ))}
            </Radio.Group>
          </div>
        </div>

        {/* 「开始入坑」主操作按钮 */}
        {onStart && (
          <div className="mt-6">
            <Button
              theme="primary"
              size="large"
              block
              disabled={!canStart}
              icon={<Send size={16} />}
              onClick={onStart}
              style={{
                background: canStart
                  ? 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)'
                  : undefined,
                border: 'none',
              }}
            >
              {canStart ? '开始入坑' : '请先填写入坑对象'}
            </Button>
            <p className="text-center text-xs mt-3" style={{ color: 'var(--td-text-color-placeholder)' }}>
              点击后，主持 Agent 会根据你的了解程度，调度专家团队一起工作
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

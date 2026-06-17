import { useState, useEffect, useCallback } from 'react';
import { CustomAgent } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'customAgents';

// 默认 Agent：通用助手
const DEFAULT_AGENT: CustomAgent = {
  id: 'default',
  name: '通用助手',
  description: '一个通用的 AI 助手，可以帮助你完成各种任务',
  systemPrompt: '你是一个专业的AI助手，善于帮助用户解决各种问题。请用简洁清晰的方式回答问题。',
  icon: 'Bot',
  color: '#0052d9',
  permissionMode: 'default',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 快速入坑团队：主持人 Agent
// 负责：用简单问答了解用户对"入坑对象"的了解程度，调度子 Agent 完成信息检索，最终收拢信息做"入坑+扫盲"输出
const RUSH_HOST_AGENT: CustomAgent = {
  id: 'rush-into-pit-host',
  name: '🎯 快速入坑（主持）',
  description: '主持 Agent：通过问答了解你的兴趣与基础，调度专业子 Agent 帮你 5 分钟入坑',
  icon: 'Sparkles',
  color: '#7c3aed',
  createdAt: new Date(),
  updatedAt: new Date(),
  // 注：systemPrompt 会在前端发送时被 server 端动态拼装（追加子 Agent 调度说明），
  // 这里保留一个清晰可读的版本，方便用户在 Agent 配置中查看。
  systemPrompt: `你是一个"快速入坑"团队的主持 Agent，专门帮助对某样新事物突然感兴趣的用户快速入门。

【工作流程】
1. 先用 1-2 个简单问题了解用户：① 想入坑的对象是什么 ② 目前对该对象的了解程度（纯小白 / 听过一点 / 有基础）
2. 如果用户描述还不够清晰，主动追问最多 1-2 个关键问题（场景、目标、预算、时间等）
3. 一旦信息充分，立即按顺序调用以下子 Agent：
   a. concept-agent —— 解释核心概念、术语、历史、玩法（帮助"扫盲"）
   b. vertical-agent —— 检索垂向专业信息（细分领域、圈子、玩家关心的话题）
   c. market-agent —— 检索市场信息（如果是消费类：值得买什么、品牌、价位、避坑；如果是兴趣类：入门装备、社区、优质内容）
4. 收拢所有子 Agent 的信息，结合用户的基础水平，用通俗、有结构的方式输出"入坑指南"：
   - 一句话总结这是什么
   - 核心概念速览（用用户能听懂的话）
   - 新手必须知道的 3-5 件事
   - 入门路径 / 入门资源
   - 常见误区 / 避坑提醒
5. 收尾时主动询问用户："要不要继续深挖某个方向？"

【输出风格】
- 友好、口语化、有耐心
- 优先用类比和例子解释术语
- 信息密度适中，不要一次性堆砌
- 必要时使用 markdown 列表和小标题
`,
};

const PRESET_AGENTS: CustomAgent[] = [
  DEFAULT_AGENT,
  RUSH_HOST_AGENT,
];

export function useAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const userAgents: CustomAgent[] = saved
        ? JSON.parse(saved).map((a: any) => ({
            ...a,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.updatedAt),
          }))
        : [];

      // 用预设列表（含 default + host Agent）与用户自定义 Agent 合并
      // 避免重复（用 id 去重，preset 优先）
      const userIds = new Set(userAgents.map(a => a.id));
      const merged = [
        ...PRESET_AGENTS.filter(a => !userIds.has(a.id)),
        ...userAgents.filter(a => a.id !== 'default' && !PRESET_AGENTS.some(p => p.id === a.id)),
      ];

      // 首次访问自动把预设 Agent 写入 localStorage，让用户在 Settings 中可管理
      if (!saved) {
        try {
          const toPersist = PRESET_AGENTS
            .filter(a => a.id !== 'default') // default 不持久化
            .map(a => ({ ...a, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() }));
          // 这里用 toISOString 写入，方便读回时再 new Date()
          const toSave = toPersist.map(a => ({
            ...a,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
          console.error('Failed to persist preset agents:', e);
        }
      }

      return merged;
    } catch (e) {
      console.error('Failed to load agents:', e);
      return PRESET_AGENTS;
    }
  });

  // 保存到 localStorage（排除预设 agent + 默认 agent，让它们每次都来自代码）
  const saveAgents = useCallback((newAgents: CustomAgent[]) => {
    const PRESET_IDS = new Set(PRESET_AGENTS.map(a => a.id));
    const toSave = newAgents.filter(a => !PRESET_IDS.has(a.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  const addAgent = useCallback((agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAgent: CustomAgent = {
      ...agent,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setAgents(prev => {
      const updated = [...prev, newAgent];
      saveAgents(updated);
      return updated;
    });
    return newAgent;
  }, [saveAgents]);

  const updateAgent = useCallback((id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => {
    setAgents(prev => {
      const updated = prev.map(a =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
      );
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const deleteAgent = useCallback((id: string) => {
    // 允许删除预设 Agent（用户在 Settings 中可管理）
    setAgents(prev => {
      const updated = prev.filter(a => a.id !== id);
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const getAgent = useCallback((id: string) => {
    return agents.find(a => a.id === id);
  }, [agents]);

  return {
    agents,
    addAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    defaultAgent: DEFAULT_AGENT,
  };
}

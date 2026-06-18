/**
 * Tool Registry — 工具注册表
 *
 * 管理所有 ToolAdapter 实例，提供统一的调用接口。
 */

import type { ToolAdapter, SearchResult, ReadResult, SearchOptions, ReadOptions } from "./adapter.js";

const adapters = new Map<string, ToolAdapter>();

export function registerTool(adapter: ToolAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function getTool(name: string): ToolAdapter | undefined {
  return adapters.get(name);
}

export function getAllTools(): ToolAdapter[] {
  return Array.from(adapters.values());
}

export function getToolNames(): string[] {
  return Array.from(adapters.keys());
}

/**
 * 搜索：优先使用指定工具，否则遍历所有支持 search 的工具
 */
export async function search(
  query: string,
  options?: SearchOptions & { toolName?: string },
): Promise<SearchResult[]> {
  const toolName = options?.toolName;

  if (toolName) {
    const tool = adapters.get(toolName);
    if (tool?.search) {
      return tool.search(query, options);
    }
    return [];
  }

  // 遍历所有支持 search 的工具
  const results: SearchResult[] = [];
  for (const tool of adapters.values()) {
    if (tool.search) {
      try {
        const r = await tool.search(query, options);
        results.push(...r);
      } catch (err) {
        console.error(`[ToolRegistry] search failed on ${tool.name}:`, err);
      }
    }
  }
  return results;
}

/**
 * 读取 URL 内容
 */
export async function readUrl(
  url: string,
  options?: ReadOptions & { toolName?: string },
): Promise<ReadResult | null> {
  const toolName = options?.toolName;

  if (toolName) {
    const tool = adapters.get(toolName);
    if (tool?.read) {
      return tool.read(url, options);
    }
    return null;
  }

  // 使用第一个支持 read 的工具
  for (const tool of adapters.values()) {
    if (tool.read) {
      try {
        return await tool.read(url, options);
      } catch (err) {
        console.error(`[ToolRegistry] read failed on ${tool.name}:`, err);
      }
    }
  }
  return null;
}

/**
 * ToolRouter — 工具路由器
 *
 * 统一管理所有 ToolAdapter，提供健康检查、搜索、读取等能力。
 * 是 registry.ts 的 class-based 版本，支持更丰富的路由逻辑。
 */

import type {
  ToolAdapter,
  ToolHealth,
  SearchResult,
  ReadResult,
  SearchOptions,
  ReadOptions,
} from "./adapter.js";

export interface ToolAdapterInfo {
  name: string;
  displayName: string;
  description: string;
  channels: string[];
  hasSearch: boolean;
  hasRead: boolean;
}

export class ToolRouter {
  private adapters: Map<string, ToolAdapter> = new Map();

  register(adapter: ToolAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  getAdapter(name: string): ToolAdapter | undefined {
    return this.adapters.get(name);
  }

  getAllAdapters(): ToolAdapter[] {
    return Array.from(this.adapters.values());
  }

  getAdapterInfoList(): ToolAdapterInfo[] {
    return Array.from(this.adapters.values()).map((a) => ({
      name: a.name,
      displayName: (a as any).displayName ?? a.name,
      description: a.description,
      channels: a.channels,
      hasSearch: typeof a.search === "function",
      hasRead: typeof a.read === "function",
    }));
  }

  async healthCheckAll(): Promise<ToolHealth[]> {
    const results: ToolHealth[] = [];
    const adaptersList = Array.from(this.adapters.values());
    for (const adapter of adaptersList) {
      try {
        const health = await adapter.healthCheck();
        results.push(health);
      } catch (err) {
        results.push({
          ok: false,
          message: `健康检查异常: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
    return results;
  }

  async search(
    query: string,
    tools?: string[],
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const targetTools = tools?.length
      ? tools.filter((t) => this.adapters.has(t))
      : Array.from(this.adapters.keys());

    const results: SearchResult[] = [];

    for (const toolName of targetTools) {
      const adapter = this.adapters.get(toolName);
      if (adapter?.search) {
        try {
          const r = await adapter.search(query, options);
          results.push(...r);
        } catch {
          // 静默降级
        }
      }
    }

    return results;
  }

  async read(
    url: string,
    toolName?: string,
    options?: ReadOptions,
  ): Promise<ReadResult | null> {
    if (toolName) {
      const adapter = this.adapters.get(toolName);
      if (adapter?.read) {
        return adapter.read(url, options);
      }
      return null;
    }

    // 使用第一个支持 read 的工具
    const adaptersList = Array.from(this.adapters.values());
    for (const adapter of adaptersList) {
      if (adapter.read) {
        try {
          return await adapter.read(url, options);
        } catch {
          // 降级尝试下一个
        }
      }
    }
    return null;
  }
}

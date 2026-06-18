/**
 * ToolAdapter 接口定义
 *
 * 所有工具适配器必须实现此接口。
 * 参见 Augmentation_Plan.md §9.1
 */

export interface ToolHealth {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface SearchOptions {
  limit?: number;
  language?: string;
  region?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  platform?: string;
  publishedAt?: string;
}

export interface ReadOptions {
  maxLength?: number;
  extractFormat?: "text" | "markdown";
}

export interface ReadResult {
  title: string;
  content: string;
  url: string;
  publishedAt?: string;
  author?: string;
}

export interface ToolAdapter {
  name: string;
  description: string;
  channels: string[];

  healthCheck(): Promise<ToolHealth>;

  search?(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  read?(url: string, options?: ReadOptions): Promise<ReadResult>;
}

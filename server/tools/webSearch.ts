/**
 * Web Search Adapter
 *
 * 使用 Bing 搜索获取网页结果。
 * 在中国大陆可访问，不需要 API key。
 */

import type { ToolAdapter, ToolHealth, SearchResult, SearchOptions } from "./adapter.js";

export const webSearchAdapter: ToolAdapter = {
  name: "web_search",
  description: "通过搜索引擎检索网页信息",
  channels: ["web", "search"],

  async healthCheck(): Promise<ToolHealth> {
    try {
      const resp = await fetch("https://cn.bing.com/search?q=test", {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      return { ok: resp.ok, message: resp.ok ? "Bing 可达" : `HTTP ${resp.status}` };
    } catch (err) {
      return { ok: false, message: `不可达: ${err instanceof Error ? err.message : String(err)}` };
    }
  },

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit ?? 5;

    try {
      const encoded = encodeURIComponent(query);
      const url = `https://cn.bing.com/search?q=${encoded}&count=${limit}`;

      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const html = await resp.text();
      return parseBingResults(html, limit);
    } catch (err) {
      console.error("[WebSearch] Search failed:", err);
      return [];
    }
  },
};

function parseBingResults(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Bing 搜索结果在 <li class="b_algo"> 中
  // 标题在 <h2><a href="..."> 中
  // 摘要在 <p> 或 <div class="b_caption"><p> 中
  const itemRegex = /<li\s+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = itemRegex.exec(html)) !== null && results.length < limit) {
    const block = match[1];

    // 提取链接和标题
    const linkMatch = block.match(/<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]+>/g, "").trim();

    // 提取摘要
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    if (url.startsWith("http") && title) {
      results.push({ title, url, snippet, platform: "bing" });
    }
  }

  // 如果 Bing HTML 解析失败，尝试备用正则
  if (results.length === 0) {
    const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null && results.length < limit) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      // 过滤掉 Bing 自身的链接
      if (title && !url.includes("bing.com") && !url.includes("microsoft.com")) {
        results.push({ title, url, snippet: "", platform: "bing" });
      }
    }
  }

  return results;
}

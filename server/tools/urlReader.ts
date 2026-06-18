/**
 * URL Reader Adapter
 *
 * 把网页 URL 转成 LLM 友好的纯文本。
 * 使用简单的 HTML 标签剥离 + 正文提取。
 */

import type { ToolAdapter, ToolHealth, ReadResult, ReadOptions } from "./adapter.js";

export const urlReaderAdapter: ToolAdapter = {
  name: "url_reader",
  description: "读取网页 URL 并提取正文内容",
  channels: ["web"],

  async healthCheck(): Promise<ToolHealth> {
    return { ok: true, message: "URL Reader 就绪" };
  },

  async read(url: string, options?: ReadOptions): Promise<ReadResult> {
    const maxLength = options?.maxLength ?? 5000;

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WannaDive/1.0)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }

    const html = await resp.text();
    const { title, content } = extractContent(html);

    return {
      title: title || url,
      content: content.slice(0, maxLength),
      url,
    };
  },
};

function extractContent(html: string): { title: string; content: string } {
  // 提取 title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

  // 移除 script / style / nav / header / footer
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // 尝试提取 article / main 内容
  const articleMatch = body.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  const mainMatch = body.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  const target = articleMatch?.[1] || mainMatch?.[1] || body;

  // 剥离 HTML 标签
  const text = target
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return { title, content: text };
}

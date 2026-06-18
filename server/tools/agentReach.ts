/**
 * Agent-Reach Adapter
 *
 * 使用 Agent-Reach 的上游工具获取多平台信息：
 * - Jina Reader：网页内容提取（HTTP，免费无 key）
 * - yt-dlp：YouTube/B站字幕提取
 * - twitter-cli：推特推文读取
 * - rdt-cli：Reddit 帖子读取
 *
 * 部分工具需要预装：
 *   pip install agent-reach
 *   pipx install twitter-cli
 *   pipx install rdt-cli
 *   pip install yt-dlp
 *
 * https://github.com/Panniantong/Agent-Reach
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolAdapter, ToolHealth, ReadResult, ReadOptions, SearchResult, SearchOptions } from "./adapter.js";

const execFileAsync = promisify(execFile);

export const agentReachAdapter: ToolAdapter = {
  name: "agent_reach",
  description: "多平台信息获取（网页/YouTube/Twitter/Reddit/GitHub/B站/RSS）",
  channels: ["web", "social", "video", "community"],

  async healthCheck(): Promise<ToolHealth> {
    const checks: string[] = [];

    // 检查 Jina Reader（总是可用，HTTP 调用）
    checks.push("Jina Reader: 就绪");

    // 检查 yt-dlp
    try {
      await execFileAsync("yt-dlp", ["--version"], { timeout: 3000 });
      checks.push("yt-dlp: 就绪");
    } catch {
      checks.push("yt-dlp: 未安装");
    }

    // 检查 twitter-cli
    try {
      await execFileAsync("twitter", ["--version"], { timeout: 3000 });
      checks.push("twitter-cli: 就绪");
    } catch {
      checks.push("twitter-cli: 未安装");
    }

    return { ok: true, message: checks.join("; ") };
  },

  async read(url: string, options?: ReadOptions): Promise<ReadResult> {
    const maxLength = options?.maxLength ?? 5000;

    // YouTube/B站字幕提取
    if (isVideoUrl(url)) {
      return readVideoSubtitles(url, maxLength);
    }

    // Twitter 推文
    if (isTwitterUrl(url)) {
      return readTwitter(url, maxLength);
    }

    // 默认：Jina Reader
    return readViaJina(url, maxLength);
  },

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Agent-Reach 的搜索依赖 Exa MCP，这里用 Jina Reader 的搜索能力
    // 或者直接返回空（让 Bing 搜索处理）
    return [];
  },
};

// ============================================================
// Jina Reader（HTTP，免费无 key）
// ============================================================

async function readViaJina(url: string, maxLength: number): Promise<ReadResult> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  const resp = await fetch(jinaUrl, {
    headers: {
      Accept: "text/plain",
      "X-Return-Format": "text",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`Jina Reader 返回 ${resp.status}`);
  }

  const text = await resp.text();
  const content = text.slice(0, maxLength);

  // 提取标题（第一行通常是标题）
  const lines = content.split("\n");
  const title = lines[0]?.trim() || url;

  return { title, content, url };
}

// ============================================================
// YouTube/B站字幕提取
// ============================================================

async function readVideoSubtitles(url: string, maxLength: number): Promise<ReadResult> {
  try {
    const { stdout } = await execFileAsync("yt-dlp", [
      "--dump-json",
      "--skip-download",
      url,
    ], { timeout: 30000 });

    const info = JSON.parse(stdout) as {
      title?: string;
      description?: string;
      subtitles?: Record<string, unknown>;
      automatic_captions?: Record<string, unknown>;
    };

    // 尝试提取字幕
    let content = info.description || "";

    // 如果有字幕文件，下载第一个
    const subtitleLangs = Object.keys(info.subtitles || {});
    const autoLangs = Object.keys(info.automatic_captions || {});
    const lang = subtitleLangs[0] || autoLangs.find((l) => l.startsWith("zh")) || autoLangs[0];

    if (lang) {
      try {
        const { stdout: subStdout } = await execFileAsync("yt-dlp", [
          "--write-sub",
          "--write-auto-sub",
          "--sub-lang", lang,
          "--sub-format", "vtt",
          "--skip-download",
          "--output", "-",
          url,
        ], { timeout: 30000 });

        // 解析 VTT 字幕
        content = parseVtt(subStdout) || content;
      } catch {
        // 字幕提取失败，用 description
      }
    }

    return {
      title: info.title || url,
      content: content.slice(0, maxLength),
      url,
    };
  } catch (err) {
    throw new Error(`视频字幕提取失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// Twitter 推文读取
// ============================================================

async function readTwitter(url: string, maxLength: number): Promise<ReadResult> {
  try {
    const { stdout } = await execFileAsync("twitter", ["tweet", url], { timeout: 15000 });
    return {
      title: "Twitter 推文",
      content: stdout.slice(0, maxLength),
      url,
    };
  } catch (err) {
    throw new Error(`Twitter 读取失败: ${err instanceof Error ? err.message : String(err)}。可能需要配置 Cookie: twitter login`);
  }
}

// ============================================================
// URL 判断
// ============================================================

function isVideoUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|bilibili\.com|b23\.tv/i.test(url);
}

function isTwitterUrl(url: string): boolean {
  return /twitter\.com|x\.com/i.test(url);
}

// ============================================================
// VTT 字幕解析
// ============================================================

function parseVtt(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过时间轴和空行
    if (!trimmed || trimmed.includes("-->") || /^\d+$/.test(trimmed) || trimmed.startsWith("WEBVTT")) {
      continue;
    }
    // 去除 HTML 标签
    const clean = trimmed.replace(/<[^>]+>/g, "");
    if (clean && !textLines.includes(clean)) {
      textLines.push(clean);
    }
  }

  return textLines.join(" ");
}

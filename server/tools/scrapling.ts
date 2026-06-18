/**
 * Scrapling Adapter
 *
 * 使用 Scrapling CLI 抓取复杂网页（支持反 bot、动态页面）。
 * 需要预装：pip install "scrapling[fetchers]" && scrapling install
 *
 * https://github.com/D4Vinci/Scrapling
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolAdapter, ToolHealth, ReadResult, ReadOptions } from "./adapter.js";

const execFileAsync = promisify(execFile);

export const scraplingAdapter: ToolAdapter = {
  name: "scrapling",
  description: "使用 Scrapling 抓取复杂网页（支持反 bot、动态页面、Cloudflare 绕过）",
  channels: ["web", "stealth"],

  async healthCheck(): Promise<ToolHealth> {
    try {
      const { stdout } = await execFileAsync("scrapling", ["--version"], { timeout: 5000 });
      return { ok: true, message: `Scrapling 就绪: ${stdout.trim()}` };
    } catch {
      return { ok: false, message: "Scrapling 未安装。请运行: pip install \"scrapling[fetchers]\" && scrapling install" };
    }
  },

  async read(url: string, options?: ReadOptions): Promise<ReadResult> {
    const maxLength = options?.maxLength ?? 5000;

    try {
      // scrapling extract get 'URL' output.txt --css-selector 'body'
      const { stdout } = await execFileAsync("scrapling", [
        "extract",
        "get",
        url,
        "-",           // 输出到 stdout
        "--impersonate", "chrome",
      ], { timeout: 30000 });

      const content = stdout.slice(0, maxLength);

      return {
        title: extractTitle(content) || url,
        content,
        url,
      };
    } catch (err) {
      // 降级到 stealthy-fetch（支持 Cloudflare 绕过）
      try {
        const { stdout } = await execFileAsync("scrapling", [
          "extract",
          "stealthy-fetch",
          url,
          "-",
          "--solve-cloudflare",
        ], { timeout: 60000 });

        const content = stdout.slice(0, maxLength);
        return {
          title: extractTitle(content) || url,
          content,
          url,
        };
      } catch (err2) {
        throw new Error(`Scrapling 抓取失败: ${err2 instanceof Error ? err2.message : String(err2)}`);
      }
    }
  },
};

function extractTitle(text: string): string {
  const match = text.match(/^(.+)\n/);
  return match ? match[1].trim().slice(0, 100) : "";
}

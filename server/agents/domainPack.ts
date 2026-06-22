/**
 * Domain Pack — 领域专家增强包
 *
 * Domain Pack 是 WannaDive 的领域化配置机制。
 * 岗位 Agent + Domain Pack = 领域化专家表现。
 *
 * Domain Pack 不是独立 Agent，而是给 Core Team 岗位 Agent 注入的领域知识：
 * - 心智模型（coreMentalModels）
 * - 必须覆盖的主题（mustCover）
 * - 常见坑点（commonPitfalls）
 * - 不建议首先讲的内容（dontStartWith）
 * - 首选 Agent 和工具（preferredAgents / preferredTools）
 * - 资料来源策略（sourcePolicy）
 * - 审稿标准（criticRubric）
 *
 * Domain Pack 以 JSON 文件形式存放在 server/domain-packs/ 目录。
 * DomainPackLoader 在运行时加载并索引这些文件。
 */

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// DomainPack 接口
// ============================================================

export interface DomainPack {
  /** 唯一标识（与文件名一致，不含扩展名） */
  id: string;
  /** 用户可见名称 */
  displayName: string;
  /** 别名列表，用于匹配用户输入 */
  aliases: string[];
  /** 领域类型，对应 DomainType */
  domainType: string;
  /** 核心心智模型——内行用来理解该领域的关键框架 */
  coreMentalModels: string[];
  /** 必须覆盖的话题——入坑指南不能遗漏 */
  mustCover: string[];
  /** 新手常见坑点 */
  commonPitfalls: string[];
  /** 不建议首先讲的内容——会吓跑新手或制造错误优先级 */
  dontStartWith: string[];
  /** 优先使用的岗位 Agent ID */
  preferredAgents: string[];
  /** 优先使用的工具 */
  preferredTools: string[];
  /** 资料来源策略 */
  sourcePolicy: {
    official?: string[];
    community?: string[];
    market?: string[];
    video?: string[];
    data?: string[];
    academic?: string[];
    github?: string[];
  };
  /** 指南模板覆盖 */
  guideOverrides?: {
    extraSections?: string[];
    mapTemplates?: string[];
  };
  /** 审稿评分标准（该领域特有的评分要点） */
  criticRubric: string[];
}

// ============================================================
// DomainPackLoader
// ============================================================

export class DomainPackLoader {
  private packs: Map<string, DomainPack> = new Map();
  private loaded = false;

  private readonly packsDir: string;

  constructor(packsDir?: string) {
    if (packsDir) {
      this.packsDir = resolve(packsDir);
    } else {
      // 默认：server/domain-packs/ 相对于当前模块
      const __dirname = fileURLToPath(new URL(".", import.meta.url));
      this.packsDir = resolve(__dirname, "..", "domain-packs");
    }
  }

  /**
   * 列出所有可用的 Domain Pack（只返回 id 和 displayName）。
   */
  async listAvailable(): Promise<Pick<DomainPack, "id" | "displayName" | "domainType">[]> {
    await this.ensureLoaded();
    return Array.from(this.packs.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      domainType: p.domainType,
    }));
  }

  /**
   * 按 domainType 加载对应的 Domain Pack。
   * 返回 undefined 表示该领域没有配置 Pack。
   */
  async load(domainType: string): Promise<DomainPack | undefined> {
    await this.ensureLoaded();
    return this.packs.get(domainType);
  }

  /**
   * 按 ID 加载 Domain Pack。
   */
  async loadById(id: string): Promise<DomainPack | undefined> {
    await this.ensureLoaded();
    // 先按 id 查
    const byId = this.packs.get(id);
    if (byId) return byId;
    // 再遍历找匹配
    for (const pack of this.packs.values()) {
      if (pack.id === id) return pack;
    }
    return undefined;
  }

  /**
   * 通过别名或名称模糊匹配 Domain Pack。
   */
  async match(input: string): Promise<DomainPack | undefined> {
    await this.ensureLoaded();
    const lower = input.toLowerCase().trim();

    for (const pack of this.packs.values()) {
      if (pack.id === lower) return pack;
      if (pack.domainType === lower) return pack;
      if (pack.displayName.toLowerCase() === lower) return pack;
      if (pack.aliases.some((a) => a.toLowerCase() === lower)) return pack;
    }
    return undefined;
  }

  /**
   * 获取所有已加载的 Pack（完整内容）。
   */
  async getAll(): Promise<DomainPack[]> {
    await this.ensureLoaded();
    return Array.from(this.packs.values());
  }

  /**
   * 重新加载所有 Pack 文件（用于热更新）。
   */
  async reload(): Promise<void> {
    this.packs.clear();
    this.loaded = false;
    await this.ensureLoaded();
  }

  // ----------------------------------------------------------
  // 内部方法
  // ----------------------------------------------------------

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    try {
      const files = await readdir(this.packsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      for (const file of jsonFiles) {
        try {
          const filePath = join(this.packsDir, file);
          const raw = await readFile(filePath, "utf-8");
          const pack = JSON.parse(raw) as DomainPack;

          // 基本校验
          if (!pack.id || !pack.domainType) {
            console.warn(`[DomainPackLoader] Skipping ${file}: missing id or domainType`);
            continue;
          }

          // 用 domainType 作为 key，这样 load(domainType) 直接命中
          this.packs.set(pack.domainType, pack);
        } catch (err) {
          console.error(`[DomainPackLoader] Failed to load ${file}:`, err);
        }
      }

      this.loaded = true;
      console.log(`[DomainPackLoader] Loaded ${this.packs.size} domain packs`);
    } catch (err) {
      // 目录不存在时静默降级
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.warn(`[DomainPackLoader] Packs directory not found: ${this.packsDir}`);
        this.loaded = true;
      } else {
        throw err;
      }
    }
  }
}

// ============================================================
// 全局单例
// ============================================================

let _instance: DomainPackLoader | null = null;

export function getDomainPackLoader(): DomainPackLoader {
  if (!_instance) {
    _instance = new DomainPackLoader();
  }
  return _instance;
}

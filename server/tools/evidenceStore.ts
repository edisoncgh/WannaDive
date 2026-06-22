/**
 * EvidenceStore — 证据存储
 *
 * 封装 evidence_items 表的 CRUD 操作，提供面向业务的接口。
 */

import {
  createEvidenceItem,
  getEvidenceByDive,
  type DbEvidenceItem,
} from "../db.js";

export interface EvidenceItem {
  id: string;
  diveId: string;
  taskId?: string;
  sourceType: string;
  title: string;
  url?: string;
  platform?: string;
  author?: string;
  publishedAt?: string;
  retrievedAt: string;
  summary: string;
  keyPoints: string[];
  credibilityScore?: number;
  relevanceScore?: number;
  caveats?: string[];
}

export class EvidenceStore {
  async save(item: EvidenceItem): Promise<void> {
    const dbItem: DbEvidenceItem = {
      id: item.id,
      dive_id: item.diveId,
      task_id: item.taskId ?? null,
      source_type: item.sourceType,
      title: item.title,
      url: item.url ?? null,
      platform: item.platform ?? null,
      author: item.author ?? null,
      published_at: item.publishedAt ?? null,
      retrieved_at: item.retrievedAt,
      summary: item.summary,
      key_points_json: JSON.stringify(item.keyPoints),
      credibility_score: item.credibilityScore ?? null,
      relevance_score: item.relevanceScore ?? null,
    };
    createEvidenceItem(dbItem);
  }

  async getByDiveId(diveId: string): Promise<EvidenceItem[]> {
    const rows = getEvidenceByDive(diveId);
    return rows.map(rowToEvidenceItem);
  }
}

function rowToEvidenceItem(row: DbEvidenceItem): EvidenceItem {
  return {
    id: row.id,
    diveId: row.dive_id,
    taskId: row.task_id ?? undefined,
    sourceType: row.source_type ?? "unknown",
    title: row.title,
    url: row.url ?? undefined,
    platform: row.platform ?? undefined,
    author: row.author ?? undefined,
    publishedAt: row.published_at ?? undefined,
    retrievedAt: row.retrieved_at,
    summary: row.summary ?? "",
    keyPoints: safeJsonParse(row.key_points_json, []),
    credibilityScore: row.credibility_score ?? undefined,
    relevanceScore: row.relevance_score ?? undefined,
    caveats: undefined,
  };
}

function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

// 确保 data 目录存在
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 启用 WAL 模式以提高性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
db.exec(`
  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    sdk_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- 为会话 ID 创建索引
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
`);

// ============= Dive Session 表 =============

db.exec(`
  CREATE TABLE IF NOT EXISTS dives (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    user_level TEXT NOT NULL DEFAULT 'unknown',
    user_goal TEXT,
    domain_type TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'planning',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    dive_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    input_json TEXT,
    output_json TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dive_id) REFERENCES dives(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_events (
    id TEXT PRIMARY KEY,
    dive_id TEXT NOT NULL,
    task_id TEXT,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dive_id) REFERENCES dives(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS evidence_items (
    id TEXT PRIMARY KEY,
    dive_id TEXT NOT NULL,
    task_id TEXT,
    source_type TEXT,
    title TEXT NOT NULL,
    url TEXT,
    platform TEXT,
    author TEXT,
    published_at TEXT,
    retrieved_at TEXT NOT NULL,
    summary TEXT,
    key_points_json TEXT,
    credibility_score REAL,
    relevance_score REAL,
    FOREIGN KEY (dive_id) REFERENCES dives(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_reports (
    id TEXT PRIMARY KEY,
    dive_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dive_id) REFERENCES dives(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dive_guides (
    id TEXT PRIMARY KEY,
    dive_id TEXT NOT NULL,
    guide_json TEXT NOT NULL,
    markdown TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dive_id) REFERENCES dives(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_agent_tasks_dive_id ON agent_tasks(dive_id);
  CREATE INDEX IF NOT EXISTS idx_agent_events_dive_id ON agent_events(dive_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_items_dive_id ON evidence_items(dive_id);
  CREATE INDEX IF NOT EXISTS idx_agent_reports_dive_id ON agent_reports(dive_id);
  CREATE INDEX IF NOT EXISTS idx_dive_guides_dive_id ON dive_guides(dive_id);
`);

// 数据库迁移：添加 sdk_session_id 列（如果不存在）
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasColumn = tableInfo.some(col => col.name === 'sdk_session_id');
  if (!hasColumn) {
    db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
    console.log("[DB] Added sdk_session_id column to sessions table");
  }
} catch (e) {
  // 忽略错误（列可能已存在）
}

// 类型定义
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
}

// ============= 会话操作 =============

// 获取所有会话
export function getAllSessions(): DbSession[] {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
  return stmt.all() as DbSession[];
}

// 获取单个会话
export function getSession(id: string): DbSession | undefined {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id) as DbSession | undefined;
}

// 创建会话
export function createSession(session: DbSession): DbSession {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(session.id, session.title, session.model, session.sdk_session_id, session.created_at, session.updated_at);
  return session;
}

// 更新会话
export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.model !== undefined) {
    fields.push('model = ?');
    values.push(updates.model);
  }
  if (updates.sdk_session_id !== undefined) {
    fields.push('sdk_session_id = ?');
    values.push(updates.sdk_session_id);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  
  const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// 删除会话
export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= 消息操作 =============

// 获取会话的所有消息
export function getMessagesBySession(sessionId: string): DbMessage[] {
  const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  return stmt.all(sessionId) as DbMessage[];
}

// 创建消息
export function createMessage(message: DbMessage): DbMessage {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    message.id,
    message.session_id,
    message.role,
    message.content,
    message.model,
    message.created_at,
    message.tool_calls
  );
  
  // 更新会话的 updated_at
  const updateStmt = db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?');
  updateStmt.run(new Date().toISOString(), message.session_id);
  
  return message;
}

// 更新消息内容
export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.tool_calls !== undefined) {
    fields.push('tool_calls = ?');
    values.push(updates.tool_calls);
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  
  const stmt = db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// 删除消息
export function deleteMessage(id: string): boolean {
  const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// 批量创建消息（用于保存对话）
export function createMessages(messages: DbMessage[]): void {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((msgs: DbMessage[]) => {
    for (const msg of msgs) {
      stmt.run(msg.id, msg.session_id, msg.role, msg.content, msg.model, msg.created_at, msg.tool_calls);
    }
  });
  
  insertMany(messages);
}

// 清空所有数据
export function clearAllData(): void {
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
}

// ============= Dive Session 操作 =============

export interface DbDive {
  id: string;
  topic: string;
  user_level: string;
  user_goal: string | null;
  domain_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbAgentTask {
  id: string;
  dive_id: string;
  agent_id: string;
  title: string;
  status: string;
  progress: number;
  input_json: string | null;
  output_json: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface DbAgentEvent {
  id: string;
  dive_id: string;
  task_id: string | null;
  type: string;
  payload_json: string;
  created_at: string;
}

export interface DbEvidenceItem {
  id: string;
  dive_id: string;
  task_id: string | null;
  source_type: string | null;
  title: string;
  url: string | null;
  platform: string | null;
  author: string | null;
  published_at: string | null;
  retrieved_at: string;
  summary: string | null;
  key_points_json: string | null;
  credibility_score: number | null;
  relevance_score: number | null;
}

export interface DbAgentReport {
  id: string;
  dive_id: string;
  task_id: string;
  agent_id: string;
  report_json: string;
  created_at: string;
}

export interface DbDiveGuide {
  id: string;
  dive_id: string;
  guide_json: string;
  markdown: string | null;
  created_at: string;
}

// ---- Dive CRUD ----

export function createDive(dive: DbDive): DbDive {
  const stmt = db.prepare(`
    INSERT INTO dives (id, topic, user_level, user_goal, domain_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(dive.id, dive.topic, dive.user_level, dive.user_goal, dive.domain_type, dive.status, dive.created_at, dive.updated_at);
  return dive;
}

export function getDive(id: string): DbDive | undefined {
  return db.prepare('SELECT * FROM dives WHERE id = ?').get(id) as DbDive | undefined;
}

export function updateDiveStatus(id: string, status: string): boolean {
  const result = db.prepare('UPDATE dives SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
  return result.changes > 0;
}

export function getAllDives(): DbDive[] {
  return db.prepare('SELECT * FROM dives ORDER BY created_at DESC').all() as DbDive[];
}

// ---- Agent Task CRUD ----

export function createAgentTask(task: DbAgentTask): DbAgentTask {
  const stmt = db.prepare(`
    INSERT INTO agent_tasks (id, dive_id, agent_id, title, status, progress, input_json, output_json, started_at, finished_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(task.id, task.dive_id, task.agent_id, task.title, task.status, task.progress, task.input_json, task.output_json, task.started_at, task.finished_at, task.created_at);
  return task;
}

export function getAgentTask(id: string): DbAgentTask | undefined {
  return db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(id) as DbAgentTask | undefined;
}

export function getAgentTasksByDive(diveId: string): DbAgentTask[] {
  return db.prepare('SELECT * FROM agent_tasks WHERE dive_id = ? ORDER BY created_at ASC').all(diveId) as DbAgentTask[];
}

export function updateAgentTaskStatus(id: string, status: string, progress?: number): boolean {
  const now = new Date().toISOString();
  let sql = 'UPDATE agent_tasks SET status = ?';
  const params: (string | number)[] = [status];

  if (progress !== undefined) {
    sql += ', progress = ?';
    params.push(progress);
  }
  if (status === 'completed' || status === 'failed') {
    sql += ', finished_at = ?';
    params.push(now);
  }
  if (status !== 'queued') {
    sql += ', started_at = COALESCE(started_at, ?)';
    params.push(now);
  }

  sql += ' WHERE id = ?';
  params.push(id);

  const result = db.prepare(sql).run(...params);
  return result.changes > 0;
}

export function updateAgentTaskOutput(id: string, outputJson: string): boolean {
  const result = db.prepare('UPDATE agent_tasks SET output_json = ? WHERE id = ?').run(outputJson, id);
  return result.changes > 0;
}

// ---- Agent Event CRUD ----

export function createAgentEvent(event: DbAgentEvent): DbAgentEvent {
  const stmt = db.prepare(`
    INSERT INTO agent_events (id, dive_id, task_id, type, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(event.id, event.dive_id, event.task_id, event.type, event.payload_json, event.created_at);
  return event;
}

export function getAgentEventsByDive(diveId: string): DbAgentEvent[] {
  return db.prepare('SELECT * FROM agent_events WHERE dive_id = ? ORDER BY created_at ASC').all(diveId) as DbAgentEvent[];
}

// ---- Evidence Item CRUD ----

export function createEvidenceItem(item: DbEvidenceItem): DbEvidenceItem {
  const stmt = db.prepare(`
    INSERT INTO evidence_items (id, dive_id, task_id, source_type, title, url, platform, author, published_at, retrieved_at, summary, key_points_json, credibility_score, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(item.id, item.dive_id, item.task_id, item.source_type, item.title, item.url, item.platform, item.author, item.published_at, item.retrieved_at, item.summary, item.key_points_json, item.credibility_score, item.relevance_score);
  return item;
}

export function getEvidenceByDive(diveId: string): DbEvidenceItem[] {
  return db.prepare('SELECT * FROM evidence_items WHERE dive_id = ? ORDER BY retrieved_at ASC').all(diveId) as DbEvidenceItem[];
}

// ---- Agent Report CRUD ----

export function createAgentReport(report: DbAgentReport): DbAgentReport {
  const stmt = db.prepare(`
    INSERT INTO agent_reports (id, dive_id, task_id, agent_id, report_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(report.id, report.dive_id, report.task_id, report.agent_id, report.report_json, report.created_at);
  return report;
}

export function getAgentReportsByDive(diveId: string): DbAgentReport[] {
  return db.prepare('SELECT * FROM agent_reports WHERE dive_id = ? ORDER BY created_at ASC').all(diveId) as DbAgentReport[];
}

// ---- Dive Guide CRUD ----

export function createDiveGuide(guide: DbDiveGuide): DbDiveGuide {
  const stmt = db.prepare(`
    INSERT INTO dive_guides (id, dive_id, guide_json, markdown, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(guide.id, guide.dive_id, guide.guide_json, guide.markdown, guide.created_at);
  return guide;
}

export function getDiveGuideByDive(diveId: string): DbDiveGuide | undefined {
  return db.prepare('SELECT * FROM dive_guides WHERE dive_id = ? ORDER BY created_at DESC LIMIT 1').get(diveId) as DbDiveGuide | undefined;
}

export default db;

-- 所有内容（周、任务、周记、论文、研究问题、开发日志、学习记录、主页信息）都存在 entries 表里，用 kind 区分。
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('profile', 'week', 'task', 'journal', 'paper', 'question', 'devlog', 'learn')),
  parent_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  sort REAL NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_entries_kind ON entries (kind, sort);
CREATE INDEX idx_entries_parent ON entries (parent_id, sort);

-- 每次新建、修改、删除都记一条，保存改动前后的完整快照，用来展示历史和撤销。
CREATE TABLE edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('create', 'update', 'delete')),
  entry_id TEXT NOT NULL,
  before TEXT,
  after TEXT,
  undo_of INTEGER,
  undone_by INTEGER
);
CREATE INDEX idx_edits_entry ON edits (entry_id, id);

-- 外部资讯（目前只有 AIHOT），只在后台显示。
CREATE TABLE feed_items (
  source TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  reason TEXT,
  url TEXT NOT NULL,
  original_url TEXT,
  source_name TEXT,
  category TEXT,
  score REAL,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (source, id)
);

-- 后台登录尝试，用来限制暴力猜密码。
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  ok INTEGER NOT NULL
);

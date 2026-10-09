import { z } from "zod";
import type { Actor } from "./env";
import { DATA_SCHEMAS, KINDS, KIND_META, VISIBILITIES, type Kind, type Visibility } from "./kinds";

// 一条内容。所有类型共用这个结构，类型特有的字段放在 data 里。
export type Entry = {
  id: string;
  kind: Kind;
  parentId: string | null;
  title: string;
  body: string;
  data: Record<string, unknown>;
  visibility: Visibility;
  sort: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type EditOp = "create" | "update" | "delete";

// 一条修改记录：改动前后的完整快照。
export type Edit = {
  id: number;
  at: string;
  actor: string;
  op: EditOp;
  entryId: string;
  before: Entry | null;
  after: Entry | null;
  undoOf: number | null;
  undoneBy: number | null;
};

export class StoreError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const CreateInput = z.object({
  id: z.string().regex(ID_RE, "id 只能用小写字母、数字和短横线，最长 64 个字符").optional(),
  kind: z.enum(KINDS),
  parentId: z.string().max(64).nullable().optional(),
  title: z.string().max(300).default(""),
  body: z.string().max(20_000).default(""),
  data: z.record(z.string(), z.unknown()).default({}),
  visibility: z.enum(VISIBILITIES).optional(),
  sort: z.number().finite().optional(),
});
export type CreateInput = z.input<typeof CreateInput>;

export const UpdateInput = z.strictObject({
  parentId: z.string().max(64).nullable().optional(),
  title: z.string().max(300).optional(),
  body: z.string().max(20_000).optional(),
  // 只需传要改的字段，会和原有 data 合并
  data: z.record(z.string(), z.unknown()).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  sort: z.number().finite().optional(),
  // 传了就做乐观锁检查：版本对不上说明别处已经改过
  version: z.number().int().positive().optional(),
});
export type UpdateInput = z.input<typeof UpdateInput>;

type EntryRow = {
  id: string;
  kind: string;
  parent_id: string | null;
  title: string;
  body: string;
  data: string;
  visibility: string;
  sort: number;
  version: number;
  created_at: string;
  updated_at: string;
};

type EditRow = {
  id: number;
  at: string;
  actor: string;
  op: string;
  entry_id: string;
  before: string | null;
  after: string | null;
  undo_of: number | null;
  undone_by: number | null;
};

function parseJson<T>(text: string | null): T | null {
  if (text == null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function rowToEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    kind: r.kind as Kind,
    parentId: r.parent_id,
    title: r.title,
    body: r.body,
    data: parseJson<Record<string, unknown>>(r.data) ?? {},
    visibility: r.visibility as Visibility,
    sort: r.sort,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToEdit(r: EditRow): Edit {
  return {
    id: r.id,
    at: r.at,
    actor: r.actor,
    op: r.op as EditOp,
    entryId: r.entry_id,
    before: parseJson<Entry>(r.before),
    after: parseJson<Entry>(r.after),
    undoOf: r.undo_of,
    undoneBy: r.undone_by,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(obj)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

// 比较两份快照的内容是否相同（不看版本号和时间）。
export function sameContent(a: Entry, b: Entry): boolean {
  return (
    a.kind === b.kind &&
    a.parentId === b.parentId &&
    a.title === b.title &&
    a.body === b.body &&
    a.visibility === b.visibility &&
    a.sort === b.sort &&
    stableStringify(a.data) === stableStringify(b.data)
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(kind: Kind): string {
  return kind + "-" + crypto.randomUUID().slice(0, 8);
}

// 合并 data：传 null 或空字符串表示删掉这个字段（表单里清空输入框就是这种情况）。
function mergeData(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

function parseData(kind: Kind, data: unknown): Record<string, unknown> {
  const result = DATA_SCHEMAS[kind].safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => (i.path.length ? i.path.join(".") + "：" : "") + i.message).join("；");
    throw new StoreError(400, msg);
  }
  return result.data as Record<string, unknown>;
}

const INSERT_ENTRY =
  "INSERT INTO entries (id, kind, parent_id, title, body, data, visibility, sort, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
const UPDATE_ENTRY =
  "UPDATE entries SET parent_id = ?, title = ?, body = ?, data = ?, visibility = ?, sort = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?";
const DELETE_ENTRY = "DELETE FROM entries WHERE id = ? AND version = ?";
// 只有上一条语句真的改到了一行，才写修改记录（changes() 是 SQLite 内置函数）。
const INSERT_EDIT =
  "INSERT INTO edits (at, actor, op, entry_id, before, after, undo_of) SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1";

function insertStmt(db: D1Database, e: Entry): D1PreparedStatement {
  return db
    .prepare(INSERT_ENTRY)
    .bind(e.id, e.kind, e.parentId, e.title, e.body, JSON.stringify(e.data), e.visibility, e.sort, e.version, e.createdAt, e.updatedAt);
}

function updateStmt(db: D1Database, e: Entry, expectedVersion: number): D1PreparedStatement {
  return db
    .prepare(UPDATE_ENTRY)
    .bind(e.parentId, e.title, e.body, JSON.stringify(e.data), e.visibility, e.sort, e.version, e.updatedAt, e.id, expectedVersion);
}

function editStmt(
  db: D1Database,
  at: string,
  actor: Actor,
  op: EditOp,
  entryId: string,
  before: Entry | null,
  after: Entry | null,
  undoOf: number | null = null,
): D1PreparedStatement {
  return db
    .prepare(INSERT_EDIT)
    .bind(at, actor, op, entryId, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, undoOf);
}

// ---------- 读取 ----------

export async function getEntry(db: D1Database, id: string, includePrivate = true): Promise<Entry | null> {
  const row = await db.prepare("SELECT * FROM entries WHERE id = ?").bind(id).first<EntryRow>();
  if (!row) return null;
  const entry = rowToEntry(row);
  if (!includePrivate) {
    if (entry.visibility !== "public") return null;
    // 父级私密时，子内容也不公开
    if (entry.parentId && !(await getEntry(db, entry.parentId, false))) return null;
  }
  return entry;
}

export async function listEntries(
  db: D1Database,
  opts: { kind?: Kind; parentId?: string; includePrivate: boolean; limit?: number },
): Promise<Entry[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (opts.kind) {
    where.push("kind = ?");
    binds.push(opts.kind);
  }
  if (opts.parentId) {
    where.push("parent_id = ?");
    binds.push(opts.parentId);
  }
  if (!opts.includePrivate) {
    where.push("visibility = 'public'");
    where.push("(parent_id IS NULL OR parent_id IN (SELECT id FROM entries WHERE visibility = 'public'))");
  }
  const sql =
    "SELECT * FROM entries" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY sort, created_at LIMIT ?";
  binds.push(Math.min(Math.max(opts.limit ?? 500, 1), 1000));
  const { results } = await db.prepare(sql).bind(...binds).all<EntryRow>();
  return results.map(rowToEntry);
}

// 日期落在哪一周，就返回哪一周；today 用北京时间的 YYYY-MM-DD。
export async function findWeekByDate(db: D1Database, today: string, includePrivate: boolean): Promise<Entry | null> {
  const row = await db
    .prepare(
      "SELECT * FROM entries WHERE kind = 'week' AND json_extract(data, '$.start') <= ?1 AND json_extract(data, '$.end') >= ?1" +
        (includePrivate ? "" : " AND visibility = 'public'") +
        " ORDER BY sort LIMIT 1",
    )
    .bind(today)
    .first<EntryRow>();
  return row ? rowToEntry(row) : null;
}

export async function countChildren(db: D1Database, id: string): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM entries WHERE parent_id = ?").bind(id).first<{ n: number }>();
  return row?.n ?? 0;
}

async function nextSort(db: D1Database, kind: Kind, parentId: string | null): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM entries WHERE kind = ? AND parent_id IS ?")
    .bind(kind, parentId)
    .first<{ s: number }>();
  return row?.s ?? 1;
}

async function checkParent(db: D1Database, kind: Kind, parentId: string | null | undefined): Promise<string | null> {
  const need = KIND_META[kind].parent;
  if (!need) {
    if (parentId) throw new StoreError(400, `${KIND_META[kind].label}不能挂在别的内容下面`);
    return null;
  }
  if (!parentId) throw new StoreError(400, `${KIND_META[kind].label}必须属于某一${KIND_META[need].label}`);
  const parent = await getEntry(db, parentId);
  if (!parent || parent.kind !== need) throw new StoreError(400, `找不到这一${KIND_META[need].label}：${parentId}`);
  return parentId;
}

function checkTitle(kind: Kind, title: string): void {
  if (kind !== "journal" && !title.trim()) throw new StoreError(400, `${KIND_META[kind].titleLabel}不能为空`);
}

// ---------- 修改（每次都写修改记录） ----------

export async function createEntry(db: D1Database, raw: CreateInput, actor: Actor): Promise<{ entry: Entry; editId: number }> {
  const input = CreateInput.parse(raw);
  const kind = input.kind;
  checkTitle(kind, input.title);
  const parentId = await checkParent(db, kind, input.parentId);

  let id = input.id ?? newId(kind);
  if (kind === "profile") id = "profile";
  if (await getEntry(db, id)) throw new StoreError(409, `已经有一条 id 为 ${id} 的内容了`);
  if (kind === "journal" && parentId && (await listEntries(db, { kind: "journal", parentId, includePrivate: true })).length) {
    throw new StoreError(409, "这一周已经有周记了，直接修改那一条");
  }

  const now = nowIso();
  const entry: Entry = {
    id,
    kind,
    parentId,
    title: input.title.trim(),
    body: input.body,
    data: parseData(kind, mergeData({}, input.data)),
    visibility: input.visibility ?? KIND_META[kind].defaultVisibility,
    sort: input.sort ?? (await nextSort(db, kind, parentId)),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  const results = await db.batch([insertStmt(db, entry), editStmt(db, now, actor, "create", id, null, entry)]);
  return { entry, editId: Number(results[1]?.meta.last_row_id) };
}

export async function updateEntry(
  db: D1Database,
  id: string,
  raw: UpdateInput,
  actor: Actor,
): Promise<{ entry: Entry; editId: number | null }> {
  const patch = UpdateInput.parse(raw);
  const current = await getEntry(db, id);
  if (!current) throw new StoreError(404, `找不到内容：${id}`);
  if (patch.version !== undefined && patch.version !== current.version) {
    throw new StoreError(409, "这条内容已经在别处改过了，请刷新页面再改");
  }

  const title = patch.title !== undefined ? patch.title.trim() : current.title;
  checkTitle(current.kind, title);
  const parentId = patch.parentId !== undefined ? await checkParent(db, current.kind, patch.parentId) : current.parentId;
  const now = nowIso();
  const next: Entry = {
    ...current,
    parentId,
    title,
    body: patch.body ?? current.body,
    data: patch.data ? parseData(current.kind, mergeData(current.data, patch.data)) : current.data,
    visibility: patch.visibility ?? current.visibility,
    sort: patch.sort ?? current.sort,
    version: current.version + 1,
    updatedAt: now,
  };
  if (sameContent(current, next)) return { entry: current, editId: null };

  const results = await db.batch([
    updateStmt(db, next, current.version),
    editStmt(db, now, actor, "update", id, current, next),
  ]);
  if (results[0]?.meta.changes !== 1) throw new StoreError(409, "这条内容已经在别处改过了，请刷新页面再改");
  return { entry: next, editId: Number(results[1]?.meta.last_row_id) };
}

export async function deleteEntry(
  db: D1Database,
  id: string,
  actor: Actor,
  expectedVersion?: number,
): Promise<{ editId: number }> {
  const current = await getEntry(db, id);
  if (!current) throw new StoreError(404, `找不到内容：${id}`);
  if (current.kind === "profile") throw new StoreError(400, "主页信息不能删除，可以直接修改");
  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    throw new StoreError(409, "这条内容已经在别处改过了，请刷新页面再删");
  }
  const children = await countChildren(db, id);
  if (children > 0) throw new StoreError(409, `这一周下面还有 ${children} 条任务或周记，先删掉或移到别的周`);

  const now = nowIso();
  const results = await db.batch([
    db.prepare(DELETE_ENTRY).bind(id, current.version),
    editStmt(db, now, actor, "delete", id, current, null),
  ]);
  if (results[0]?.meta.changes !== 1) throw new StoreError(409, "这条内容已经在别处改过了，请刷新页面再删");
  return { editId: Number(results[1]?.meta.last_row_id) };
}

// ---------- 修改历史与撤销 ----------

export async function getEdit(db: D1Database, id: number): Promise<Edit | null> {
  const row = await db.prepare("SELECT * FROM edits WHERE id = ?").bind(id).first<EditRow>();
  return row ? rowToEdit(row) : null;
}

export async function listEdits(db: D1Database, opts: { limit?: number; entryId?: string } = {}): Promise<Edit[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const stmt = opts.entryId
    ? db.prepare("SELECT * FROM edits WHERE entry_id = ? ORDER BY id DESC LIMIT ?").bind(opts.entryId, limit)
    : db.prepare("SELECT * FROM edits ORDER BY id DESC LIMIT ?").bind(limit);
  const { results } = await stmt.all<EditRow>();
  return results.map(rowToEdit);
}

// 撤销一条修改：把内容恢复到这条修改之前的样子，并把“撤销”本身也记一条修改。
// 只有当前内容和这条修改之后的状态一致时才允许撤销，避免覆盖后来的改动。
export async function undoEdit(db: D1Database, editId: number, actor: Actor): Promise<{ entry: Entry | null; editId: number }> {
  const edit = await getEdit(db, editId);
  if (!edit) throw new StoreError(404, `找不到修改记录：${editId}`);
  if (edit.undoneBy) throw new StoreError(409, "这条修改已经撤销过了");

  const current = await getEntry(db, edit.entryId);
  const conflict = () => new StoreError(409, "这条内容在这次修改之后又被改过，不能直接撤销。请先撤销后面的修改。");
  const now = nowIso();

  let stmt: D1PreparedStatement;
  let op: EditOp;
  let before: Entry | null;
  let after: Entry | null;

  if (edit.op === "create") {
    if (!current || !edit.after || !sameContent(current, edit.after)) throw conflict();
    const children = await countChildren(db, current.id);
    if (children > 0) throw new StoreError(409, `这一周下面已经有 ${children} 条任务或周记，不能撤销新建`);
    stmt = db.prepare(DELETE_ENTRY).bind(current.id, current.version);
    op = "delete";
    before = current;
    after = null;
  } else if (edit.op === "update") {
    if (!current || !edit.after || !edit.before || !sameContent(current, edit.after)) throw conflict();
    const target = edit.before;
    if (target.parentId && target.parentId !== current.parentId && !(await getEntry(db, target.parentId))) {
      throw new StoreError(409, "原来所属的周已经不在了，先恢复那一周");
    }
    const restored: Entry = { ...target, version: current.version + 1, createdAt: current.createdAt, updatedAt: now };
    stmt = updateStmt(db, restored, current.version);
    op = "update";
    before = current;
    after = restored;
  } else {
    if (current || !edit.before) throw conflict();
    const target = edit.before;
    if (target.parentId && !(await getEntry(db, target.parentId))) {
      throw new StoreError(409, "原来所属的周已经不在了，先恢复那一周");
    }
    const restored: Entry = { ...target, version: target.version + 1, updatedAt: now };
    stmt = insertStmt(db, restored);
    op = "create";
    before = null;
    after = restored;
  }

  const results = await db.batch([
    stmt,
    editStmt(db, now, actor, op, edit.entryId, before, after, editId),
    db
      .prepare("UPDATE edits SET undone_by = last_insert_rowid() WHERE id = ? AND undone_by IS NULL AND changes() = 1")
      .bind(editId),
  ]);
  if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) throw conflict();
  return { entry: after, editId: Number(results[1]?.meta.last_row_id) };
}

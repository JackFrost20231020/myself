import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createEntry, deleteEntry, getEntry, listEdits, listEntries, undoEdit, updateEntry } from "../src/store";
import { clearDb, setupDb } from "./helpers";

let db: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await setupDb());
});
afterAll(async () => {
  await dispose();
});
beforeEach(async () => {
  await clearDb(db);
});

const week = { kind: "week" as const, id: "w1", title: "Neo4j 入门", data: { start: "2026-10-12", end: "2026-10-18" } };

describe("新建、修改、删除都会记录历史", () => {
  it("新建时写一条 create 记录", async () => {
    const { entry, editId } = await createEntry(db, week, "web");
    expect(entry.version).toBe(1);
    const edits = await listEdits(db);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ id: editId, op: "create", entryId: "w1", before: null, actor: "web" });
  });

  it("修改会让版本加一，并保存改动前后的快照", async () => {
    await createEntry(db, week, "web");
    const { entry } = await updateEntry(db, "w1", { title: "Neo4j 和 Cypher" }, "claude");
    expect(entry.version).toBe(2);
    const [latest] = await listEdits(db);
    expect(latest).toMatchObject({ op: "update", actor: "claude" });
    expect(latest?.before?.title).toBe("Neo4j 入门");
    expect(latest?.after?.title).toBe("Neo4j 和 Cypher");
  });

  it("内容没变的修改不记历史", async () => {
    await createEntry(db, week, "web");
    const { editId } = await updateEntry(db, "w1", { title: "Neo4j 入门" }, "web");
    expect(editId).toBeNull();
    expect(await listEdits(db)).toHaveLength(1);
  });

  it("data 只改传进来的字段，传空字符串表示删掉该字段", async () => {
    await createEntry(db, { kind: "paper", id: "p1", title: "ReAct", data: { url: "https://arxiv.org/abs/2210.03629", venue: "ICLR 2023" } }, "web");
    const { entry } = await updateEntry(db, "p1", { data: { status: "reading", venue: "" } }, "web");
    expect(entry.data).toEqual({ url: "https://arxiv.org/abs/2210.03629", status: "reading" });
  });

  it("版本号对不上时拒绝修改", async () => {
    await createEntry(db, week, "web");
    await updateEntry(db, "w1", { title: "第二版" }, "web");
    await expect(updateEntry(db, "w1", { title: "过期的修改", version: 1 }, "web")).rejects.toMatchObject({ status: 409 });
  });

  it("不合法的数据会被拒绝", async () => {
    await expect(createEntry(db, { kind: "task", title: "没有所属周的任务" }, "web")).rejects.toMatchObject({ status: 400 });
    await expect(
      createEntry(db, { kind: "paper", title: "坏链接", data: { url: "javascript:alert(1)" } }, "web"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(createEntry(db, { kind: "question", title: "  " }, "web")).rejects.toMatchObject({ status: 400 });
  });

  it("下面还有任务的周不能删除", async () => {
    await createEntry(db, week, "web");
    await createEntry(db, { kind: "task", parentId: "w1", title: "装好 Neo4j" }, "web");
    await expect(deleteEntry(db, "w1", "web")).rejects.toMatchObject({ status: 409 });
  });

  it("私密的周下面的任务不会出现在公开列表里", async () => {
    await createEntry(db, { ...week, visibility: "private" }, "web");
    await createEntry(db, { kind: "task", parentId: "w1", title: "装好 Neo4j", visibility: "public" }, "web");
    expect(await listEntries(db, { kind: "task", includePrivate: false })).toHaveLength(0);
    expect(await listEntries(db, { kind: "task", includePrivate: true })).toHaveLength(1);
    const task = (await listEntries(db, { kind: "task", includePrivate: true }))[0]!;
    expect(await getEntry(db, task.id, false)).toBeNull();
  });
});

describe("撤销", () => {
  it("撤销修改会恢复原来的内容，撤销本身也记一条历史", async () => {
    await createEntry(db, week, "web");
    const { editId } = await updateEntry(db, "w1", { title: "改错的标题" }, "web");
    const undo = await undoEdit(db, editId!, "web");
    expect(undo.entry?.title).toBe("Neo4j 入门");
    expect((await getEntry(db, "w1"))?.title).toBe("Neo4j 入门");
    const edits = await listEdits(db);
    expect(edits[0]).toMatchObject({ id: undo.editId, undoOf: editId });
    expect(edits.find((e) => e.id === editId)?.undoneBy).toBe(undo.editId);
  });

  it("同一条修改不能撤销两次", async () => {
    await createEntry(db, week, "web");
    const { editId } = await updateEntry(db, "w1", { title: "改错的标题" }, "web");
    await undoEdit(db, editId!, "web");
    await expect(undoEdit(db, editId!, "web")).rejects.toMatchObject({ status: 409 });
  });

  it("撤销新建会删掉那条内容", async () => {
    const { editId } = await createEntry(db, { kind: "question", id: "q1", title: "图谱纠错怎么评测？" }, "web");
    await undoEdit(db, editId, "web");
    expect(await getEntry(db, "q1")).toBeNull();
  });

  it("撤销删除会把内容恢复回来", async () => {
    await createEntry(db, { kind: "question", id: "q1", title: "图谱纠错怎么评测？", body: "先找标注数据" }, "web");
    const { editId } = await deleteEntry(db, "q1", "web");
    await undoEdit(db, editId, "web");
    expect(await getEntry(db, "q1")).toMatchObject({ title: "图谱纠错怎么评测？", body: "先找标注数据" });
  });

  it("后面又改过时，不能直接撤销前面的修改", async () => {
    await createEntry(db, week, "web");
    const first = await updateEntry(db, "w1", { title: "第一次修改" }, "web");
    await updateEntry(db, "w1", { title: "第二次修改" }, "web");
    await expect(undoEdit(db, first.editId!, "web")).rejects.toMatchObject({ status: 409 });
  });

  it("撤销了删除之后，还能接着撤销删除之前的修改", async () => {
    await createEntry(db, { kind: "question", id: "q1", title: "原来的问题" }, "web");
    const changed = await updateEntry(db, "q1", { title: "改过的问题" }, "web");
    const removed = await deleteEntry(db, "q1", "web");
    await undoEdit(db, removed.editId, "web");
    await undoEdit(db, changed.editId!, "web");
    expect((await getEntry(db, "q1"))?.title).toBe("原来的问题");
  });

  it("撤销一次撤销，等于重做", async () => {
    await createEntry(db, week, "web");
    const changed = await updateEntry(db, "w1", { title: "新标题" }, "web");
    const undo = await undoEdit(db, changed.editId!, "web");
    await undoEdit(db, undo.editId, "web");
    expect((await getEntry(db, "w1"))?.title).toBe("新标题");
  });
});

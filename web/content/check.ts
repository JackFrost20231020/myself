// npm run check:content —— 检查 content/ 里的内容文件，有问题时逐条列出并以非零状态退出。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError, loadContent } from "./load.ts";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content");

try {
  const c = loadContent(dir);
  const tasks = c.plan.weeks.flatMap((w) => w.tasks);
  console.log(
    `内容检查通过：${c.plan.weeks.length} 周、${tasks.length} 个任务（做完 ${tasks.filter((t) => t.done).length} 个）、` +
      `${c.papers.length} 篇论文、${c.questions.length} 个研究问题。`,
  );
} catch (err) {
  if (!(err instanceof ContentError)) throw err;
  console.error(err.message);
  process.exitCode = 1;
}

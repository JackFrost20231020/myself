import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.|test-/.test(e.name) ? [full] : [];
  });
}

describe("页面打包", () => {
  it("页面代码只引用格式检查文件里的类型，不会把 zod 打包进页面", () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => /from "zod"/.test(line) || (/content\/(schema|load)\.ts"/.test(line) && !/^import type /.test(line.trim())))
        .map((line) => `${path.relative(SRC, file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ContentError } from "./load.ts";
import { contentPlugin } from "./plugin.ts";

describe("内容插件", () => {
  it("内容文件有问题时，构建一开始就失败", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shuang-empty-"));
    const plugin = contentPlugin({ dir });
    const buildStart = plugin.buildStart as () => void;
    expect(() => buildStart()).toThrow(ContentError);
  });
});

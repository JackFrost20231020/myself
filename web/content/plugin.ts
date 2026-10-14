// Vite 插件：构建时读出 content/ 里的内容，检查格式，作为虚拟模块 "virtual:content" 交给页面。
// 格式不对时构建直接失败；开发时改了内容文件，页面会自动刷新。
import path from "node:path";
import type { Plugin } from "vite";
import { loadContent } from "./load.ts";

const VIRTUAL_ID = "virtual:content";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export function contentPlugin({ dir }: { dir: string }): Plugin {
  const isContentFile = (file: string) => path.resolve(file).startsWith(path.resolve(dir) + path.sep);
  return {
    name: "shuang-content",
    buildStart() {
      // 提前检查一遍，让构建在打包之前就失败
      loadContent(dir);
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      return `export default ${JSON.stringify(loadContent(dir))};`;
    },
    configureServer(server) {
      server.watcher.add(dir);
      const reload = (file: string) => {
        if (!isContentFile(file)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };
}

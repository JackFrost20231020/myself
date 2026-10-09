// 后台交互：改了就保存、新建、删除、撤销。所有请求都发到本站的 /api，格式是 JSON。
(() => {
  "use strict";

  let toast;
  function showToast(text) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => (toast.hidden = true), 5000);
  }

  async function request(method, url, body) {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? { accept: "application/json" } : { "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = {};
    try {
      json = await res.json();
    } catch {
      // 有些响应没有内容
    }
    if (res.status === 401) {
      location.href = "/admin/login";
      throw new Error("登录已过期，请重新登录");
    }
    if (!res.ok) throw new Error(json.error || `请求失败（${res.status}）`);
    return json;
  }

  function stateOf(box) {
    return box.querySelector(".save-state");
  }

  function setState(box, text, isError) {
    const el = stateOf(box);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", Boolean(isError));
    el.classList.toggle("is-saved", !isError && text === "已保存");
    clearTimeout(el._timer);
    if (!isError && text === "已保存") el._timer = setTimeout(() => (el.textContent = ""), 2000);
  }

  // 「名称 | 网址」每行一条
  function parseLinks(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const i = line.lastIndexOf("|");
        return i === -1 ? { label: line, url: line } : { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() };
      });
  }

  function isTextLike(el) {
    return el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["checkbox", "radio"].includes(el.type));
  }

  function lastSaved(el) {
    return el._lastSaved ?? el.defaultValue;
  }

  function patchFor(el, value) {
    const field = el.dataset.field;
    if (field === "data.links") value = parseLinks(value);
    if (field.startsWith("data.")) return { data: { [field.slice(5)]: value } };
    return { [field]: value };
  }

  // 勾选任务后，更新这一周的「完成数 / 总数」
  function refreshWeekCount(taskRow) {
    const week = taskRow.closest(".week-editor");
    const count = week && week.querySelector("[data-week-count]");
    if (!count) return;
    const boxes = week.querySelectorAll('.task-row input[data-field="data.done"]');
    const done = Array.from(boxes).filter((b) => b.checked).length;
    count.textContent = `${done} / ${boxes.length}`;
  }

  // 同一条内容的保存排队执行，保证每次都带上最新的版本号。
  function save(el) {
    const box = el.closest("[data-entry]");
    if (!box) return Promise.resolve();
    const value = el.type === "checkbox" ? el.checked : el.value;
    box._queue = (box._queue || Promise.resolve()).then(async () => {
      setState(box, "保存中…");
      try {
        const body = { ...patchFor(el, value), version: Number(box.dataset.version) };
        const { entry } = await request("PATCH", "/api/entries/" + encodeURIComponent(box.dataset.entry), body);
        box.dataset.version = String(entry.version);
        if (isTextLike(el)) el._lastSaved = value;
        if (el.dataset.field === "data.done") {
          box.classList.toggle("is-done", el.checked);
          refreshWeekCount(box);
        }
        if (el.dataset.field === "visibility") {
          el.classList.toggle("vis-public", el.value === "public");
          el.classList.toggle("vis-private", el.value === "private");
        }
        setState(box, "已保存");
      } catch (err) {
        setState(box, err.message, true);
      }
    });
    return box._queue;
  }

  document.addEventListener("change", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLElement) || !el.dataset.field) return;
    clearTimeout(el._timer);
    if (isTextLike(el) && el.value === lastSaved(el)) return;
    save(el);
  });

  // 长文本边写边保存：停下 1.2 秒后自动保存
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLTextAreaElement) || !el.dataset.field) return;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      if (el.value !== lastSaved(el)) save(el);
    }, 1200);
  });

  document.addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;

    if (button.dataset.action === "delete") {
      const box = button.closest("[data-entry]");
      if (!box || !confirm("确定删除吗？删除后可以在「修改历史」里撤销。")) return;
      button.disabled = true;
      try {
        await request("DELETE", `/api/entries/${encodeURIComponent(box.dataset.entry)}?version=${box.dataset.version}`);
        location.reload();
      } catch (err) {
        setState(box, err.message, true);
        button.disabled = false;
      }
      return;
    }

    if (button.dataset.undo) {
      button.disabled = true;
      try {
        await request("POST", `/api/edits/${encodeURIComponent(button.dataset.undo)}/undo`, {});
        location.reload();
      } catch (err) {
        showToast(err.message);
        button.disabled = false;
      }
      return;
    }

    if (button.hasAttribute("data-feed-refresh")) {
      button.disabled = true;
      button.textContent = "更新中…";
      try {
        const result = await request("POST", "/api/feed/refresh", {});
        button.textContent = `拿到 ${result.stored} 条`;
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        showToast(err.message);
        button.disabled = false;
        button.textContent = "立即更新";
      }
    }
  });

  // 带 data-create 的表单：新建一条内容
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.create) return;
    event.preventDefault();
    const body = { kind: form.dataset.create, data: {} };
    if (form.dataset.parent) body.parentId = form.dataset.parent;
    for (const [name, value] of new FormData(form)) {
      if (typeof value !== "string") continue;
      if (name.startsWith("data.")) {
        if (value !== "") body.data[name.slice(5)] = value;
      } else if (value !== "" || name === "title") {
        body[name] = value;
      }
    }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      await request("POST", "/api/entries", body);
      location.reload();
    } catch (err) {
      showToast(err.message);
      if (button) button.disabled = false;
    }
  });
})();

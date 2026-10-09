// 公开页的动效和交互：学习图谱、进度环和进度条、流程线定位到本周、论文筛选。
// 系统开了「减少动态效果」时，不播放动画，图谱直接画成排好的静态图。
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

  // ---------- 进度环、进度条：从 0 长到实际值 ----------
  // 用 Web Animations：元素本身一直是最终值，动画只负责从 0 播放过去，页面在后台时也不会停在半路。
  function animateMeters() {
    if (reduce || typeof Element.prototype.animate !== "function") return;
    document.querySelectorAll(".ring-value").forEach((ring) => {
      const len = ring.getAttribute("data-len");
      const circ = ring.getAttribute("data-circ");
      if (!len || !circ || Number(len) === 0) return;
      ring.animate([{ strokeDasharray: `0 ${circ}` }, { strokeDasharray: `${len} ${circ}` }], {
        duration: 1200,
        delay: 300,
        easing: EASE,
        fill: "backwards",
      });
    });
    document.querySelectorAll("progress[data-animate]").forEach((bar) => {
      if (!Number(bar.value)) return;
      bar.animate([{ clipPath: "inset(0 100% 0 0 round 999px)" }, { clipPath: "inset(0 0 0 0 round 999px)" }], {
        duration: 900,
        delay: 250,
        easing: EASE,
        fill: "backwards",
      });
    });
  }

  // ---------- 流程线：横向放不下时，滚到本周 ----------
  function centerPipelines() {
    document.querySelectorAll("[data-pipeline]").forEach((box) => {
      if (box.scrollWidth <= box.clientWidth) return;
      const node = box.querySelector(".pipe-node.is-current") || box.querySelector(".pipe-node.is-future");
      if (!node) return;
      const b = box.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      box.scrollLeft += r.left + r.width / 2 - (b.left + b.width / 2);
    });
  }

  // ---------- 论文按状态筛选 ----------
  function initFilters() {
    const tabs = Array.from(document.querySelectorAll(".filter-tabs [data-filter]"));
    if (!tabs.length) return;
    const cards = Array.from(document.querySelectorAll(".papers-grid [data-status]"));
    tabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        const filter = tab.dataset.filter;
        tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
        cards.forEach((card) => {
          const show = filter === "all" || card.dataset.status === filter;
          card.hidden = !show;
          if (show) {
            card.classList.remove("is-entering");
            void card.offsetWidth;
            card.classList.add("is-entering");
          }
        });
      }),
    );
  }

  // ---------- 学习图谱 ----------
  const KIND_LABEL = { me: "我", week: "周", task: "任务", paper: "论文", question: "研究问题", devlog: "开发日志", learn: "学习记录" };
  const STATE_LABEL = { done: "已完成", current: "本周", future: "未开始", open: "未完成", reading: "在读", shelf: "书架" };
  const RADIUS = { me: 16, week: 14, paper: 7, question: 7.5, devlog: 6.5, learn: 6.5, task: 5.5 };
  const CHARGE = { me: 220, week: 180, paper: 70, question: 70, devlog: 60, learn: 60, task: 50 };
  const MASS = { me: 5, week: 4, paper: 1, question: 1, devlog: 1, learn: 1, task: 1 };
  const LINK = {
    sequence: { rest: 118, k: 0.5 },
    contains: { rest: 40, k: 0.7 },
    about: { rest: 72, k: 0.3 },
  };
  const ALPHA_MIN = 0.003;

  function initGraph() {
    const stage = document.querySelector("[data-graph]");
    const dataEl = document.getElementById("graph-data");
    if (!stage || !dataEl) return;
    let data;
    try {
      data = JSON.parse(dataEl.textContent || "{}");
    } catch {
      return;
    }
    const canvas = stage.querySelector("canvas");
    const tip = stage.querySelector(".graph-tip");
    const ctx = canvas && canvas.getContext("2d");
    if (!ctx || !Array.isArray(data.nodes)) return;

    const nodes = data.nodes.map((n) => ({
      ...n,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: RADIUS[n.kind] || 6,
      c0: CHARGE[n.kind] || 50,
      c: CHARGE[n.kind] || 50,
      m: MASS[n.kind] || 1,
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges = data.edges
      .map((e) => {
        const link = LINK[e.kind] || LINK.about;
        return { ...e, s: byId.get(e.source), t: byId.get(e.target), rest0: link.rest, rest: link.rest, k: link.k };
      })
      .filter((e) => e.s && e.t);

    // 画布小（比如手机）时，按面积把间距和斥力一起缩小，保持同样的形状
    function applyScale() {
      const s = Math.max(0.45, Math.min(1, Math.sqrt((W * H) / (640 * 470))));
      edges.forEach((e) => (e.rest = e.rest0 * s));
      nodes.forEach((n) => (n.c = n.c0 * s * s));
    }
    const neighbors = new Map(nodes.map((n) => [n.id, new Set([n.id])]));
    edges.forEach((e) => {
      neighbors.get(e.s.id).add(e.t.id);
      neighbors.get(e.t.id).add(e.s.id);
    });
    const weeks = nodes.filter((n) => n.kind === "week");
    const me = byId.get("me");

    let W = 0;
    let H = 0;
    let dpr = 1;
    let alpha = 1;
    let seeded = false;
    let hover = null;
    let dragging = null;
    let down = null;
    let raf = 0;
    let lastDraw = 0;
    let visible = true;
    let C = {};
    let font = "sans-serif";

    function readColors() {
      const s = getComputedStyle(document.documentElement);
      const v = (name) => s.getPropertyValue(name).trim();
      C = {
        ink: v("--ink"),
        ink2: v("--ink-2"),
        muted: v("--muted"),
        rule: v("--rule"),
        surface: v("--surface"),
        accent: v("--accent"),
        accent2: v("--accent-2"),
        accentSoft: v("--accent-soft"),
        signal: v("--signal"),
        signalSoft: v("--signal-soft"),
        blue: v("--blue"),
        violet: v("--violet"),
        paper: v("--paper"),
      };
      font = getComputedStyle(document.body).fontFamily || "sans-serif";
    }

    // 周按时间从左到右排开，像一条工艺管线；「我」在上方
    function targets() {
      weeks.forEach((w, i) => {
        const f = weeks.length > 1 ? i / (weeks.length - 1) : 0.5;
        w.tx = W * (0.12 + 0.76 * f);
        w.ty = H * 0.56 + Math.sin(i * 1.2) * Math.min(28, H * 0.06);
      });
      if (me) {
        me.tx = W * 0.5;
        me.ty = H * 0.16;
      }
    }

    function seed() {
      weeks.forEach((w) => {
        w.x = w.tx;
        w.y = w.ty;
      });
      if (me) {
        me.x = me.tx;
        me.y = me.ty;
      }
      const placed = new Set(weeks.map((w) => w.id).concat(me ? [me.id] : []));
      edges.forEach((e) => {
        const [from, to] = placed.has(e.s.id) ? [e.s, e.t] : [e.t, e.s];
        if (placed.has(to.id)) return;
        const a = Math.random() * Math.PI * 2;
        to.x = from.x + Math.cos(a) * e.rest;
        to.y = from.y + Math.sin(a) * e.rest;
        placed.add(to.id);
      });
      nodes.forEach((n) => {
        if (!placed.has(n.id)) {
          n.x = W / 2 + (Math.random() - 0.5) * 80;
          n.y = H / 2 + (Math.random() - 0.5) * 80;
        }
      });
      seeded = true;
    }

    const clampX = (n, x) => Math.max(n.r + 8, Math.min(W - n.r - 8, x));
    const clampY = (n, y) => Math.max(n.r + 8, Math.min(H - n.r - 22, y));

    function tick() {
      const a = alpha;
      const N = nodes.length;
      for (let i = 0; i < N; i++) {
        const p = nodes[i];
        for (let j = i + 1; j < N; j++) {
          const q = nodes[j];
          let dx = q.x - p.x;
          let dy = q.y - p.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          if (d2 > 250000) continue;
          const f = a / d2;
          p.vx -= dx * f * q.c * (1 / p.m);
          p.vy -= dy * f * q.c * (1 / p.m);
          q.vx += dx * f * p.c * (1 / q.m);
          q.vy += dy * f * p.c * (1 / q.m);
        }
      }
      for (const e of edges) {
        const s = e.s;
        const t = e.t;
        let dx = t.x + t.vx - s.x - s.vx;
        let dy = t.y + t.vy - s.y - s.vy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const l = ((d - e.rest) / d) * e.k * a;
        dx *= l;
        dy *= l;
        const w = s.m / (s.m + t.m);
        t.vx -= dx * w;
        t.vy -= dy * w;
        s.vx += dx * (1 - w);
        s.vy += dy * (1 - w);
      }
      for (const n of nodes) {
        if (n.tx !== undefined) {
          n.vx += (n.tx - n.x) * 0.06 * a;
          n.vy += (n.ty - n.y) * 0.05 * a;
        } else {
          n.vx += (W / 2 - n.x) * 0.004 * a;
          n.vy += (H / 2 - n.y) * 0.008 * a;
        }
      }
      for (const n of nodes) {
        if (n === dragging) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= 0.6;
        n.vy *= 0.6;
        n.x = clampX(n, n.x + n.vx);
        n.y = clampY(n, n.y + n.vy);
      }
      // 碰撞：节点之间留出空隙
      for (let i = 0; i < N; i++) {
        const p = nodes[i];
        for (let j = i + 1; j < N; j++) {
          const q = nodes[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const min = p.r + q.r + 7;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const push = (min - d) / d;
          const wp = q.m / (p.m + q.m);
          if (p !== dragging) {
            p.x -= dx * push * wp;
            p.y -= dy * push * wp;
          }
          if (q !== dragging) {
            q.x += dx * push * (1 - wp);
            q.y += dy * push * (1 - wp);
          }
        }
      }
      alpha += (0 - alpha) * 0.0228;
    }

    function colorOf(n) {
      if (n.kind === "paper") return n.state === "done" ? C.muted : C.blue;
      if (n.kind === "question") return C.signal;
      if (n.kind === "devlog" || n.kind === "learn") return C.violet;
      return C.accent;
    }

    function drawNode(n, now) {
      const { x, y, r } = n;
      ctx.lineWidth = 2;
      if (n.kind === "week") {
        const stroke = n.state === "current" ? C.signal : n.state === "done" ? C.accent : C.muted;
        if (n.state === "current" && !reduce) {
          const phase = (now % 2400) / 2400;
          ctx.save();
          ctx.globalAlpha *= 0.55 * (1 - phase);
          ctx.strokeStyle = C.signal;
          ctx.beginPath();
          ctx.arc(x, y, r + 2 + phase * 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = n.state === "current" ? C.signalSoft : n.state === "done" ? C.accentSoft : C.surface;
        ctx.strokeStyle = stroke;
        ctx.setLineDash(n.state === "future" ? [3, 3] : []);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x - r + 2, y);
        ctx.lineTo(x + r - 2, y);
        ctx.stroke();
        ctx.fillStyle = C.ink;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 7px ${font}`;
        ctx.fillText("WK", x, y - 5);
        ctx.font = `700 9px ${font}`;
        ctx.fillText(n.label.replace(/\D/g, "") || "", x, y + 6);
      } else if (n.kind === "me") {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = C.paper;
        ctx.font = `700 13px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("我", x, y + 0.5);
      } else if (n.kind === "task") {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (n.state === "done") {
          ctx.fillStyle = C.accent;
          ctx.fill();
        } else {
          ctx.fillStyle = C.surface;
          ctx.fill();
          ctx.strokeStyle = C.accent;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      } else if (n.kind === "question") {
        ctx.fillStyle = colorOf(n);
        ctx.beginPath();
        ctx.moveTo(x, y - r - 1);
        ctx.lineTo(x + r + 1, y);
        ctx.lineTo(x, y + r + 1);
        ctx.lineTo(x - r - 1, y);
        ctx.closePath();
        ctx.fill();
      } else if (n.kind === "devlog" || n.kind === "learn") {
        ctx.fillStyle = colorOf(n);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = colorOf(n);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (n.state === "reading") {
          ctx.strokeStyle = C.accent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    function draw(now = performance.now()) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const focus = hover ? neighbors.get(hover.id) : null;
      const dim = (on) => (ctx.globalAlpha = on ? 1 : 0.13);

      for (const e of edges) {
        const on = !focus || (focus.has(e.s.id) && focus.has(e.t.id));
        dim(on);
        ctx.beginPath();
        ctx.moveTo(e.s.x, e.s.y);
        ctx.lineTo(e.t.x, e.t.y);
        if (e.kind === "sequence") {
          const live = e.t.state !== "future";
          ctx.lineCap = "round";
          ctx.lineWidth = live ? 5 : 2;
          ctx.strokeStyle = live ? C.accentSoft : C.rule;
          ctx.setLineDash(live ? [] : [6, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
          if (live) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = C.accent;
            ctx.beginPath();
            ctx.moveTo(e.s.x, e.s.y);
            ctx.lineTo(e.t.x, e.t.y);
            ctx.stroke();
            if (!reduce) {
              // 管道里的流动：三个小点沿着主干往前走
              ctx.fillStyle = C.accent2;
              for (let k = 0; k < 3; k++) {
                const f = ((now / 1500 + k / 3) % 1 + 1) % 1;
                ctx.beginPath();
                ctx.arc(e.s.x + (e.t.x - e.s.x) * f, e.s.y + (e.t.y - e.s.y) * f, 2.4, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        } else if (e.kind === "contains") {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = focus && on ? C.accent : C.rule;
          ctx.stroke();
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = focus && on ? C.ink2 : C.muted;
          ctx.setLineDash([3, 4]);
          if (focus && on && !reduce) ctx.lineDashOffset = -(now / 60) % 14;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
          // 「我」正在做的这一周：从我流向本周
          if (e.s.kind === "me" && e.t.state === "current" && !reduce) {
            ctx.fillStyle = C.signal;
            for (let k = 0; k < 2; k++) {
              const f = ((now / 1800 + k / 2) % 1 + 1) % 1;
              ctx.beginPath();
              ctx.arc(e.s.x + (e.t.x - e.s.x) * f, e.s.y + (e.t.y - e.s.y) * f, 2.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      for (const n of nodes) {
        dim(!focus || focus.has(n.id));
        drawNode(n, now);
      }

      // 标签：周和「我」常显，悬停时显示相邻节点的短标题
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      for (const n of nodes) {
        const show = n.kind === "week" || (focus && focus.has(n.id) && n.kind !== "me");
        if (!show) continue;
        dim(!focus || focus.has(n.id));
        ctx.font = n.kind === "week" ? `600 12px ${font}` : `12px ${font}`;
        ctx.fillStyle = n.kind === "week" ? C.ink : C.ink2;
        const text = n.kind === "week" ? n.label : n.label;
        ctx.fillText(text, n.x, n.y + n.r + 15);
      }
      ctx.globalAlpha = 1;
      lastDraw = now;
    }

    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const active = alpha > ALPHA_MIN || dragging;
      if (active) tick();
      if (active || now - lastDraw > 33) draw(now);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (reduce) {
        draw();
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function reheat(a) {
      alpha = Math.max(alpha, a);
      if (reduce) {
        for (let i = 0; i < 60; i++) tick();
        draw();
      } else start();
    }

    function resize() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (!w || !h) return;
      const sx = W ? w / W : 1;
      const sy = H ? h / H : 1;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      W = w;
      H = h;
      applyScale();
      targets();
      if (!seeded) {
        seed();
        if (reduce) for (let i = 0; i < 320; i++) tick();
      } else {
        nodes.forEach((n) => {
          n.x = clampX(n, n.x * sx);
          n.y = clampY(n, n.y * sy);
        });
        if (!reduce) alpha = Math.max(alpha, 0.3);
      }
      draw();
      start();
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function hit(p) {
      let best = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < n.r + 8 && d < bestD) {
          best = n;
          bestD = d;
        }
      }
      return best;
    }

    function showTip(n) {
      if (!n || !tip) {
        if (tip) tip.hidden = true;
        return;
      }
      tip.replaceChildren();
      const kind = document.createElement("span");
      kind.className = "tip-kind";
      kind.textContent = KIND_LABEL[n.kind] + (STATE_LABEL[n.state] ? " · " + STATE_LABEL[n.state] : "");
      tip.append(kind, document.createTextNode(n.title));
      tip.hidden = false;
      tip.style.left = Math.max(90, Math.min(W - 90, n.x)) + "px";
      tip.style.top = n.y - n.r + "px";
    }

    function setHover(n) {
      if (hover === n) {
        if (n) showTip(n);
        return;
      }
      hover = n;
      showTip(n);
      canvas.style.cursor = dragging ? "grabbing" : n ? (n.href ? "pointer" : "grab") : "default";
      if (reduce) draw();
    }

    canvas.addEventListener("pointerdown", (e) => {
      const n = hit(pos(e));
      if (!n) return;
      down = { node: n, x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType };
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = pos(e);
      if (down) {
        if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
          dragging = down.node;
          canvas.setPointerCapture(down.id);
          canvas.style.cursor = "grabbing";
        }
        if (dragging) {
          dragging.x = clampX(dragging, p.x);
          dragging.y = clampY(dragging, p.y);
          setHover(dragging);
          reheat(0.25);
          return;
        }
      }
      if (e.pointerType === "mouse") setHover(hit(p));
    });
    canvas.addEventListener("pointerup", () => {
      if (down && !dragging) {
        const n = down.node;
        // 触屏上第一次点只显示标题，再点一次才打开
        if (down.type !== "mouse" && hover !== n) setHover(n);
        else if (n.href) location.href = n.href;
      }
      dragging = null;
      down = null;
      if (hover) canvas.style.cursor = hover.href ? "pointer" : "grab";
    });
    canvas.addEventListener("pointercancel", () => {
      dragging = null;
      down = null;
    });
    canvas.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && !dragging) setHover(null);
    });

    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      readColors();
      draw();
    });
    new ResizeObserver(resize).observe(stage);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries.some((en) => en.isIntersecting);
        if (visible) start();
      }).observe(stage);
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) start();
    });
  }

  function init() {
    animateMeters();
    centerPipelines();
    initFilters();
    initGraph();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

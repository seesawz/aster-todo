/* ==========================================================
   Claude Todo — 应用逻辑
   功能模块（参考 Todoist / Things 3 / Microsoft To Do）：
   1. 智能输入解析：日期（今天/明天/后天/M月D日）、优先级（!~!!!）、标签（#xx）
   2. 优先级：P1/P2/P3 三色旗帜
   3. 截止日期：今天高亮、逾期红色
   4. 星标「重要」视图（Microsoft To Do 风格）
   5. 视图体系：今天 / 重要 / 全部 / 已完成（Things 3 风格）
   6. 搜索（/ 聚焦）、双击行内编辑、拖拽排序、删除撤销、JSON 导出
   7. 深浅色主题 + localStorage 持久化
   ========================================================== */
(() => {
  "use strict";

  const STORAGE_KEY = "claude-todo.tasks"; // 与 v1 同 key，旧数据自动迁移
  const THEME_KEY = "claude-todo.theme";

  let todos = loadTodos();
  let view = "today";   // today | starred | all | done
  let search = "";      // 当前搜索词（非空时覆盖视图）

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const els = {
    input: $("#taskInput"),
    sendBtn: $("#sendBtn"),
    composer: $("#composer"),
    hint: $("#composerHint"),
    list: $("#taskList"),
    listHead: $("#listHead"),
    listTitle: $("#listTitle"),
    clearDone: $("#clearDone"),
    empty: $("#empty"),
    emptyTitle: $("#emptyTitle"),
    emptySub: $("#emptySub"),
    countToday: $("#countToday"),
    countStarred: $("#countStarred"),
    countAll: $("#countAll"),
    countDone: $("#countDone"),
    progressText: $("#progressText"),
    progressFill: $("#progressFill"),
    dateLine: $("#dateLine"),
    viewTitle: $("#viewTitle"),
    nav: $("#nav"),
    searchInput: $("#searchInput"),
    newTaskBtn: $("#newTaskBtn"),
    themeToggle: $("#themeToggle"),
    exportBtn: $("#exportBtn"),
    toast: $("#toast"),
    toastText: $("#toastText"),
    undoBtn: $("#undoBtn"),
  };

  // ============ 数据层 ============
  const uid = () =>
    crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function normalize(t) {
    return {
      id: t.id || uid(),
      text: String(t.text || ""),
      done: !!t.done,
      priority: [1, 2, 3].includes(t.priority) ? t.priority : 0,
      due: typeof t.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
      starred: !!t.starred,
      tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
      createdAt: t.createdAt || Date.now(),
      completedAt: t.completedAt || null,
    };
  }

  function loadTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return (Array.isArray(data) ? data : []).map(normalize);
    } catch {
      return [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch { /* 隐私模式下静默失败 */ }
  }

  // ============ 日期工具 ============
  const pad = (n) => String(n).padStart(2, "0");

  function toDateStr(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function todayStr() {
    return toDateStr(new Date());
  }
  function addDaysStr(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }
  /** dateStr 距今天的天数（负数=过去） */
  function diffDays(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const now = new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - t0) / 86400000);
  }
  function dueLabel(dateStr) {
    const n = diffDays(dateStr);
    if (n === 0) return "今天";
    if (n === 1) return "明天";
    if (n === 2) return "后天";
    if (n === -1) return "昨天";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (n < 0) return `${m}/${d}`;                       // 更早的逾期日期
    if (n < 7) return "周" + "日一二三四五六"[new Date(y, m - 1, d).getDay()];
    return `${m}/${d}`;
  }
  function fmtStamp(ts) {
    const d = new Date(ts);
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ============ 智能输入解析（Todoist 风格自然语言） ============
  /**
   * 从输入中提取：#标签、!优先级（!!! = P1）、日期（今天/明天/后天/M月D日、M/D、M-D）
   * 返回 { text, priority, due, tags }
   */
  function parseInput(raw) {
    let text = ` ${raw} `;
    const res = { priority: 0, due: null, tags: [] };

    // 标签
    text = text.replace(/\s#([^\s#]+)/g, (_, tag) => {
      res.tags.push(tag);
      return " ";
    });

    // 优先级：独立出现的 1~3 个 !
    const bangs = text.match(/\s(!{1,3})(?=\s)/);
    if (bangs) {
      res.priority = 4 - bangs[1].length; // !!! → 1, !! → 2, ! → 3
      text = text.replace(bangs[0], " ");
    }

    // 相对日期
    for (const [word, offset] of [["今天", 0], ["明天", 1], ["后天", 2]]) {
      const re = new RegExp(`\\s${word}(?=\\s)`);
      if (re.test(text)) {
        res.due = addDaysStr(offset);
        text = text.replace(re, " ");
        break;
      }
    }

    // 绝对日期：10月12日 / 10/12 / 10-12（已过则顺延一年）
    if (!res.due) {
      const abs = text.match(/\s(\d{1,2})[月\/\-](\d{1,2})日?(?=\s)/);
      if (abs) {
        const m = +abs[1], d = +abs[2];
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const y = new Date().getFullYear();
          let s = `${y}-${pad(m)}-${pad(d)}`;
          if (diffDays(s) < 0) s = `${y + 1}-${pad(m)}-${pad(d)}`;
          res.due = s;
          text = text.replace(abs[0], " ");
        }
      }
    }

    res.text = text.replace(/\s+/g, " ").trim();
    return res;
  }

  /** 实时解析当前输入，渲染提示 chips */
  function renderHint() {
    const raw = els.input.value.trim();
    if (!raw) { els.hint.hidden = true; els.hint.textContent = ""; return; }
    const p = parseInput(raw);
    const parts = [];
    if (p.due) parts.push(`📅 ${dueLabel(p.due)}`);
    if (p.priority) parts.push(`${"!".repeat(4 - p.priority)} ${["", "P1 高", "P2 中", "P3 低"][p.priority]}优先级`);
    for (const tag of p.tags) parts.push(`#${tag}`);
    if (!parts.length) { els.hint.hidden = true; return; }
    els.hint.hidden = false;
    els.hint.textContent = "";
    const label = document.createElement("span");
    label.className = "hint-label";
    label.textContent = "识别到";
    els.hint.appendChild(label);
    for (const part of parts) {
      const chip = document.createElement("span");
      chip.className = "hint-chip";
      chip.textContent = part;
      els.hint.appendChild(chip);
    }
  }

  // ============ 视图与排序 ============
  const VIEW_TITLES = { today: "今天", starred: "重要", all: "全部任务", done: "已完成" };
  const PRI_WEIGHT = { 1: 0, 2: 1, 3: 2, 0: 3 }; // P1 最靠前

  const isActiveToday = (t) => !t.done && t.due && diffDays(t.due) <= 0;
  const isActive = (t) => !t.done;

  function currentList() {
    if (search) {
      const q = search.toLowerCase();
      return todos.filter(
        (t) => t.text.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    switch (view) {
      case "today":
        return todos
          .filter(isActiveToday)
          .sort((a, b) =>
            diffDays(a.due) - diffDays(b.due) ||
            PRI_WEIGHT[a.priority] - PRI_WEIGHT[b.priority] ||
            a.createdAt - b.createdAt
          );
      case "starred":
        return todos.filter((t) => isActive(t) && t.starred);
      case "all":
        return todos.filter(isActive);
      case "done":
        return todos
          .filter((t) => t.done)
          .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));
    }
    return [];
  }

  // ============ 顶部日期与问候 ============
  function renderHeader() {
    const now = new Date();
    const h = now.getHours();
    const hi = h < 6 ? "夜深了" : h < 12 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
    els.dateLine.textContent =
      `${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(now)} · ${hi}`;
  }

  // ============ 渲染 ============
  function render() {
    // 侧边栏计数
    els.countToday.textContent = todos.filter(isActiveToday).length;
    els.countStarred.textContent = todos.filter((t) => isActive(t) && t.starred).length;
    els.countAll.textContent = todos.filter(isActive).length;
    els.countDone.textContent = todos.filter((t) => t.done).length;

    // 进度（整体）
    const done = todos.filter((t) => t.done).length;
    els.progressText.textContent = `${done} / ${todos.length}`;
    els.progressFill.style.width = todos.length ? `${Math.round((done / todos.length) * 100)}%` : "0%";

    // 标题
    els.viewTitle.textContent = search ? `搜索“${search}”` : VIEW_TITLES[view];

    // 列表
    const items = currentList();
    els.list.textContent = "";
    for (const t of items) els.list.appendChild(taskEl(t));

    const showList = items.length > 0;
    els.listHead.hidden = !showList;
    els.empty.hidden = showList;
    els.listTitle.textContent = `${search ? "搜索结果" : VIEW_TITLES[view]} · ${items.length}`;
    els.clearDone.style.visibility = !search && view === "done" ? "visible" : "hidden";

    if (!showList) renderEmptyState();

    // 拖拽仅在「全部」视图且未搜索时可用
    const draggable = !search && view === "all";
    for (const li of els.list.children) li.draggable = draggable;
  }

  function renderEmptyState() {
    const copy = {
      today:     ["今天没有安排", "享受无事的轻盈，或在上方添加新任务"],
      starred:   ["还没有重要任务", "把鼠标移到任务上，点 ⭐ 星标收藏"],
      all:       todos.length ? ["全部完成！", "所有任务都已处理，好好休息 ☕"] : ["还没有任务", "在上方输入框添加你的第一个任务吧"],
      done:      ["还没有已完成的任务", "完成任务后会出现在这里"],
    };
    const [title, sub] = search ? ["没有找到相关任务", `换个关键词试试，当前搜索：“${search}”`] : (copy[view] || copy.all);
    els.emptyTitle.textContent = title;
    els.emptySub.textContent = sub;
  }

  // 需要复用的 SVG 片段
  const ICONS = {
    flag: '<svg class="flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4"/><path d="M6 4.5c1.8-1.2 3.7-1.2 5.5 0s3.7 1.2 5.5 0V13c-1.8 1.2-3.7 1.2-5.5 0s-3.7-1.2-5.5 0"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 11h16"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/></svg>',
  };

  function taskEl(t) {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "");
    li.dataset.id = t.id;

    // 复选框
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = t.done;
    check.setAttribute("aria-label", t.done ? "标记为未完成" : "标记为已完成");
    check.addEventListener("change", () => toggle(t.id));

    // 内容区
    const content = document.createElement("div");
    content.className = "task-content";

    const main = document.createElement("div");
    main.className = "task-main";

    if (t.priority) {
      const flagWrap = document.createElement("span");
      flagWrap.innerHTML = ICONS.flag;
      const flag = flagWrap.firstChild;
      flag.classList.add(`p${t.priority}`);
      flag.setAttribute("aria-label", `P${t.priority} 优先级`);
      main.appendChild(flag);
    }

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = t.text; // textContent 防注入
    text.title = "双击编辑";
    text.addEventListener("dblclick", () => startEdit(t.id, main, text));
    main.appendChild(text);

    for (const tag of t.tags) {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = `#${tag}`;
      main.appendChild(chip);
    }

    content.appendChild(main);

    // 元信息行：截止日期
    if (t.due) {
      const meta = document.createElement("div");
      meta.className = "task-meta";
      const diff = diffDays(t.due);
      const chip = document.createElement("span");
      chip.className = "due-chip" + (t.done ? "" : diff < 0 ? " overdue" : diff === 0 ? " today" : "");
      chip.innerHTML = ICONS.calendar;
      chip.appendChild(document.createTextNode(t.done ? dueLabel(t.due) : diff < 0 ? `${dueLabel(t.due)} 已逾期` : dueLabel(t.due)));
      meta.appendChild(chip);
      content.appendChild(meta);
    }

    // 右侧操作区
    const side = document.createElement("div");
    side.className = "task-side";

    if (t.done) {
      const time = document.createElement("span");
      time.className = "task-time";
      time.textContent = fmtStamp(t.completedAt || t.createdAt);
      time.title = "完成于";
      side.appendChild(time);
    }

    const star = document.createElement("button");
    star.type = "button";
    star.className = "task-action star" + (t.starred ? " on" : "");
    star.setAttribute("aria-label", t.starred ? "取消星标" : "加星标");
    star.title = t.starred ? "取消星标" : "星标";
    star.innerHTML = ICONS.star;
    star.addEventListener("click", () => toggleStar(t.id));
    side.appendChild(star);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task-action delete";
    del.setAttribute("aria-label", "删除任务");
    del.title = "删除";
    del.innerHTML = ICONS.trash;
    del.addEventListener("click", () => remove(t.id, li));
    side.appendChild(del);

    li.append(check, content, side);
    return li;
  }

  // ============ 操作 ============
  function addTodo() {
    const raw = els.input.value.trim();
    if (!raw) return;
    const p = parseInput(raw);
    if (!p.text && p.tags.length === 0) return;
    todos.unshift(normalize({ ...p, createdAt: Date.now() }));
    saveTodos();
    els.input.value = "";
    renderHint();
    render();
  }

  function toggle(id) {
    const t = todos.find((t) => t.id === id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    saveTodos();
    render();
  }

  function toggleStar(id) {
    const t = todos.find((t) => t.id === id);
    if (!t) return;
    t.starred = !t.starred;
    saveTodos();
    render();
  }

  // ---- 删除 + 撤销（Todoist 风格 Toast） ----
  let undoState = null;
  let undoTimer = null;

  function remove(id, li) {
    const index = todos.findIndex((t) => t.id === id);
    if (index < 0) return;
    const [task] = todos.splice(index, 1);
    saveTodos();
    render();

    li.classList.add("removing");
    clearTimeout(undoTimer);
    undoState = { task, index };
    els.toastText.textContent = `已删除「${task.text || "（无文本）"}」`;
    els.toast.hidden = false;
    undoTimer = setTimeout(hideToast, 5000);
  }

  function undoRemove() {
    if (!undoState) return;
    const { task, index } = undoState;
    todos.splice(Math.min(index, todos.length), 0, task);
    saveTodos();
    hideToast();
    render();
  }

  function hideToast() {
    els.toast.hidden = true;
    undoState = null;
  }

  // ---- 双击行内编辑（Things 3 风格） ----
  function startEdit(id, main, textSpan) {
    const t = todos.find((t) => t.id === id);
    if (!t) return;
    const input = document.createElement("input");
    input.className = "edit-input";
    input.value = t.text;
    input.maxLength = 300;
    main.replaceChild(input, textSpan);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const val = input.value.trim();
      if (save && val) {
        t.text = val;
        saveTodos();
      }
      render();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  // ---- 拖拽排序（全部视图） ----
  let dragId = null;
  let dropTarget = null; // { id, before }

  function clearDropMarkers() {
    for (const li of els.list.children) li.classList.remove("drop-before", "drop-after");
  }

  els.list.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".task");
    if (!li || !li.draggable) return;
    dragId = li.dataset.id;
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", dragId); } catch {}
  });

  els.list.addEventListener("dragover", (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearDropMarkers();
    const li = e.target.closest(".task");
    if (!li || li.dataset.id === dragId) return;
    const r = li.getBoundingClientRect();
    const before = e.clientY < r.top + r.height / 2;
    li.classList.add(before ? "drop-before" : "drop-after");
    dropTarget = { id: li.dataset.id, before };
  });

  els.list.addEventListener("drop", (e) => {
    if (!dragId || !dropTarget) return;
    e.preventDefault();
    const from = todos.findIndex((t) => t.id === dragId);
    if (from < 0) return;
    const [item] = todos.splice(from, 1);
    let to = todos.findIndex((t) => t.id === dropTarget.id);
    if (to < 0) { todos.push(item); }
    else {
      if (!dropTarget.before) to += 1;
      todos.splice(to, 0, item);
    }
    saveTodos();
  });

  els.list.addEventListener("dragend", () => {
    dragId = null;
    dropTarget = null;
    clearDropMarkers();
    for (const li of els.list.children) li.classList.remove("dragging");
    render();
  });

  // ---- 数据导出 ----
  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), todos }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claude-todo-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ============ 主题 ============
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); } catch {}
  }

  function initTheme() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(THEME_KEY)); } catch {}
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
    els.themeToggle.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme;
      const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
      const effective = cur || (systemDark ? "dark" : "light");
      applyTheme(effective === "dark" ? "light" : "dark");
    });
  }

  // ============ 事件 ============
  els.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    addTodo();
    if (matchMedia("(min-width: 721px)").matches) els.input.focus();
  });

  els.input.addEventListener("input", () => {
    els.sendBtn.disabled = els.input.value.trim().length === 0;
    renderHint();
  });

  els.nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    view = btn.dataset.view;
    search = "";
    els.searchInput.value = "";
    for (const b of els.nav.querySelectorAll(".nav-item")) {
      b.classList.toggle("active", b === btn);
    }
    render();
  });

  let searchTimer = null;
  els.searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      search = els.searchInput.value.trim();
      render();
    }, 120);
  });
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      els.searchInput.value = "";
      search = "";
      render();
      els.input.focus();
    }
  });

  els.clearDone.addEventListener("click", () => {
    const removed = todos.filter((t) => t.done).length;
    if (!removed) return;
    todos = todos.filter((t) => !t.done);
    saveTodos();
    render();
  });

  els.undoBtn.addEventListener("click", undoRemove);
  els.exportBtn.addEventListener("click", exportData);

  els.newTaskBtn.addEventListener("click", () => {
    els.input.focus();
    els.input.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // 全局快捷键：N 新任务、/ 搜索（输入框聚焦时忽略）
  document.addEventListener("keydown", (e) => {
    const tag = e.target.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      els.input.focus();
      els.input.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (e.key === "/") {
      e.preventDefault();
      els.searchInput.focus();
    }
  });

  // ============ 启动 ============
  renderHeader();
  initTheme();
  render();
})();

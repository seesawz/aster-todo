/* Claude Todo — 应用逻辑：增删改查 / 筛选 / 本地持久化 / 主题切换 */
(() => {
  "use strict";

  const STORAGE_KEY = "claude-todo.tasks";
  const THEME_KEY = "claude-todo.theme";

  /** @type {{id:string, text:string, done:boolean, createdAt:number}[]} */
  let todos = loadTodos();
  let filter = "all"; // all | active | done

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const els = {
    input: $("#taskInput"),
    sendBtn: $("#sendBtn"),
    composer: $("#composer"),
    list: $("#taskList"),
    listHead: $("#listHead"),
    listTitle: $("#listTitle"),
    clearDone: $("#clearDone"),
    empty: $("#empty"),
    emptyTitle: $("#emptyTitle"),
    emptySub: $("#emptySub"),
    countAll: $("#countAll"),
    countActive: $("#countActive"),
    countDone: $("#countDone"),
    progressText: $("#progressText"),
    progressFill: $("#progressFill"),
    dateLine: $("#dateLine"),
    greeting: $("#greeting"),
    filters: $("#filters"),
    newTaskBtn: $("#newTaskBtn"),
    themeToggle: $("#themeToggle"),
  };

  // ---------- 持久化 ----------
  function loadTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      /* 隐私模式下静默失败 */
    }
  }

  // ---------- 工具 ----------
  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // 时间戳格式：MM/DD HH:mm
  function fmtStamp(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ---------- 顶部问候与日期 ----------
  function renderHeader() {
    const now = new Date();
    els.dateLine.textContent = new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(now);

    const h = now.getHours();
    const hi =
      h < 6 ? "夜深了" : h < 12 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
    els.greeting.textContent = `${hi}，今天要做点什么？`;
  }

  // ---------- 渲染 ----------
  function visibleTodos() {
    switch (filter) {
      case "active": return todos.filter((t) => !t.done);
      case "done":   return todos.filter((t) => t.done);
      default:       return todos;
    }
  }

  const FILTER_TITLES = { all: "全部任务", active: "进行中", done: "已完成" };

  function render() {
    // 徽标计数
    const done = todos.filter((t) => t.done).length;
    els.countAll.textContent = todos.length;
    els.countActive.textContent = todos.length - done;
    els.countDone.textContent = done;

    // 进度
    els.progressText.textContent = `${done} / ${todos.length}`;
    const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;
    els.progressFill.style.width = `${pct}%`;

    // 列表
    const items = visibleTodos();
    els.list.textContent = "";
    for (const t of items) els.list.appendChild(taskEl(t));

    // 空状态 / 列表头
    const showList = items.length > 0;
    els.listHead.hidden = !showList;
    els.empty.hidden = showList;
    els.listTitle.textContent = `${FILTER_TITLES[filter]} · ${items.length}`;
    els.clearDone.style.visibility = done > 0 ? "visible" : "hidden";

    if (!showList) {
      if (todos.length === 0) {
        els.emptyTitle.textContent = "还没有任务";
        els.emptySub.textContent = "在上方输入框添加你的第一个任务吧";
      } else {
        els.emptyTitle.textContent = "这里空空如也";
        els.emptySub.textContent =
          filter === "active" ? "所有任务都完成了，休息一下 ☕" : "还没有已完成的任务";
      }
    }

    els.sendBtn.disabled = els.input.value.trim().length === 0;
  }

  function taskEl(t) {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "");
    li.dataset.id = t.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = t.done;
    check.setAttribute("aria-label", t.done ? "标记为未完成" : "标记为已完成");
    check.addEventListener("change", () => toggle(t.id));

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = t.text; // textContent 防注入

    const time = document.createElement("time");
    time.className = "task-time";
    time.dateTime = new Date(t.createdAt).toISOString();
    time.textContent = fmtStamp(t.createdAt);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task-delete";
    del.setAttribute("aria-label", "删除任务");
    del.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/></svg>';
    del.addEventListener("click", () => remove(t.id, li));

    li.append(check, text, time, del);
    return li;
  }

  // ---------- 操作 ----------
  function addTodo(text) {
    todos.unshift({ id: uid(), text, done: false, createdAt: Date.now() });
    saveTodos();
    render();
  }

  function toggle(id) {
    const t = todos.find((t) => t.id === id);
    if (t) {
      t.done = !t.done;
      saveTodos();
      render();
    }
  }

  function remove(id, li) {
    li.classList.add("removing");
    setTimeout(() => {
      todos = todos.filter((t) => t.id !== id);
      saveTodos();
      render();
    }, 150);
  }

  // ---------- 主题 ----------
  function applyTheme(theme) {
    // theme: null 表示跟随系统
    if (theme) {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
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

  // ---------- 事件 ----------
  els.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;
    addTodo(text);
    els.input.value = "";
    els.input.focus();
    render();
  });

  els.input.addEventListener("input", () => {
    els.sendBtn.disabled = els.input.value.trim().length === 0;
  });

  els.filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    filter = btn.dataset.filter;
    for (const b of els.filters.querySelectorAll(".nav-item")) {
      b.classList.toggle("active", b === btn);
    }
    render();
  });

  els.clearDone.addEventListener("click", () => {
    todos = todos.filter((t) => !t.done);
    saveTodos();
    render();
  });

  els.newTaskBtn.addEventListener("click", () => {
    els.input.focus();
    els.input.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ---------- 启动 ----------
  renderHeader();
  initTheme();
  render();
})();

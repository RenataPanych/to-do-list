const LS_KEY = "todo_glass_v3";

const el = (id) => document.getElementById(id);

const $lists = el("lists");
const $tasks = el("tasks");
const $listNameInput = el("listNameInput");
const $createListBtn = el("createListBtn");

const $activeTitle = el("activeTitle");
const $activeMeta = el("activeMeta");

const $deleteListBtn = el("deleteListBtn");
const $clearDoneBtn = el("clearDoneBtn");

const $sortGroup = el("sortGroup");

const $addForm = el("addForm");
const $taskInput = el("taskInput");
const $prioSelect = el("prioSelect");
const $dateInput = el("dateInput");
const $tagsInput = el("tagsInput");

const $stats = el("stats");
const $pillLists = el("pillLists");
const $dragHint = el("dragHint");

const $modalOverlay = el("modalOverlay");
const $modalClose = el("modalClose");
const $modalTitle = el("modalTitle");
const $modalBody = el("modalBody");
const $modalActions = el("modalActions");

const $toast = el("toast");

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const nowTimeHM = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const normalizeTags = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s.split(",").map(t => t.trim()).filter(Boolean);
  const set = new Set();
  const out = [];
  for (const t of parts) {
    const k = t.toLowerCase();
    if (!set.has(k)) {
      set.add(k);
      out.push(t);
    }
  }
  return out.slice(0, 10);
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.lists) || !s.activeListId) return null;

    if (!s.sortMode) s.sortMode = "manual";
    return s;
  } catch {
    return null;
  }
};

const saveState = () => {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
};

const defaultState = () => {
  const id = uid();
  return {
    activeListId: id,
    sortMode: "manual",
    lists: [{ id, name: "Мій день", tasks: [] }]
  };
};

let state = loadState() || defaultState();

state.lists.forEach(l => {
  l.tasks.forEach(t => {
    if (typeof t.time !== "string") t.time = "";
    if ("due" in t) delete t.due;
  });
});
saveState();

const toast = (text) => {
  $toast.textContent = text;
  $toast.classList.add("toast--show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => $toast.classList.remove("toast--show"), 1400);
};

const openModal = ({ title, bodyNode, actions }) => {
  $modalTitle.textContent = title || "Повідомлення";
  $modalBody.innerHTML = "";
  $modalActions.innerHTML = "";

  if (bodyNode) $modalBody.appendChild(bodyNode);

  (actions || []).forEach(a => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = a.className || "btn btn--ghost";
    b.textContent = a.text;
    b.addEventListener("click", a.onClick);
    $modalActions.appendChild(b);
  });

  $modalOverlay.classList.add("modalOverlay--open");
  $modalOverlay.setAttribute("aria-hidden", "false");
};

const closeModal = () => {
  $modalOverlay.classList.remove("modalOverlay--open");
  $modalOverlay.setAttribute("aria-hidden", "true");
};

$modalClose.addEventListener("click", closeModal);
$modalOverlay.addEventListener("click", (e) => {
  if (e.target === $modalOverlay) closeModal();
});

const confirmModal = ({ title, text, okText, cancelText, onOk }) => {
  const wrap = document.createElement("div");
  wrap.textContent = text;

  openModal({
    title,
    bodyNode: wrap,
    actions: [
      { text: cancelText || "Скасувати", className: "btn btn--ghost", onClick: () => closeModal() },
      {
        text: okText || "Підтвердити",
        className: "btn btn--primary",
        onClick: () => {
          closeModal();
          onOk();
        }
      }
    ]
  });
};

const alertModal = ({ title, text }) => {
  const wrap = document.createElement("div");
  wrap.textContent = text;

  openModal({
    title: title || "Увага",
    bodyNode: wrap,
    actions: [{ text: "Ок", className: "btn btn--primary", onClick: () => closeModal() }]
  });
};

const getActiveList = () => state.lists.find(l => l.id === state.activeListId) || state.lists[0];

const setActiveList = (id) => {
  state.activeListId = id;
  saveState();
  render();
};

const setSortMode = (mode) => {
  state.sortMode = mode;
  saveState();
  render();
};

const addList = (name) => {
  const n = String(name || "").trim();
  if (!n) {
    alertModal({ title: "Не вийшло", text: "Введи назву списку." });
    return;
  }
  const id = uid();
  state.lists.unshift({ id, name: n, tasks: [] });
  state.activeListId = id;
  saveState();
  render();
  toast("Список створено");
};

const renameList = (id) => {
  const list = state.lists.find(l => l.id === id);
  if (!list) return;

  const body = document.createElement("div");
  body.className = "stack";
  const input = document.createElement("input");
  input.className = "input";
  input.value = list.name;
  input.placeholder = "Нова назва…";
  body.appendChild(input);

  openModal({
    title: "Перейменувати список",
    bodyNode: body,
    actions: [
      { text: "Скасувати", className: "btn btn--ghost", onClick: () => closeModal() },
      {
        text: "Зберегти",
        className: "btn btn--primary",
        onClick: () => {
          const v = String(input.value || "").trim();
          if (!v) {
            alertModal({ title: "Не вийшло", text: "Назва не може бути порожньою." });
            return;
          }
          list.name = v;
          saveState();
          render();
          closeModal();
          toast("Збережено");
        }
      }
    ]
  });

  setTimeout(() => input.focus(), 0);
};

const deleteList = (id) => {
  if (state.lists.length === 1) {
    alertModal({ title: "Не можна", text: "Потрібен хоча б один список." });
    return;
  }
  const list = state.lists.find(l => l.id === id);
  if (!list) return;

  confirmModal({
    title: "Видалення списку",
    text: `Видалити список "${list.name}"?`,
    okText: "Видалити",
    cancelText: "Скасувати",
    onOk: () => {
      state.lists = state.lists.filter(l => l.id !== id);
      if (state.activeListId === id) state.activeListId = state.lists[0].id;
      saveState();
      render();
      toast("Список видалено");
    }
  });
};

const addTask = ({ text, prio, time, tags }) => {
  const t = String(text || "").trim();
  if (!t) {
    alertModal({ title: "Не вийшло", text: "Введи назву справи." });
    return;
  }

  const list = getActiveList();
  if (!list) return;

  const task = {
    id: uid(),
    text: t,
    done: false,
    createdAt: Date.now(),
    prio: Number(prio) || 2,
    time: String(time || "").trim(),
    tags: Array.isArray(tags) ? tags : []
  };

  list.tasks.unshift(task);
  saveState();
  render();
  toast("Справу додано");
};

const updateTask = (taskId, patch) => {
  const list = getActiveList();
  if (!list) return;
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;
  Object.assign(task, patch);
  saveState();
  render();
  toast("Справу оновлено");
};

const toggleTask = (taskId) => {
  const list = getActiveList();
  if (!list) return;
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.done = !task.done;
  saveState();
  render();
};

const deleteTask = (taskId) => {
  const list = getActiveList();
  if (!list) return;
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;

  confirmModal({
    title: "Видалення справи",
    text: `Видалити справу "${task.text}"?`,
    okText: "Видалити",
    cancelText: "Скасувати",
    onOk: () => {
      list.tasks = list.tasks.filter(t => t.id !== taskId);
      saveState();
      render();
      toast("Справу видалено");
    }
  });
};

const clearDone = () => {
  const list = getActiveList();
  if (!list) return;
  const hasDone = list.tasks.some(t => t.done);
  if (!hasDone) {
    toast("Немає виконаних справ");
    return;
  }
  confirmModal({
    title: "Очищення",
    text: "Прибрати всі виконані справи?",
    okText: "Прибрати",
    cancelText: "Скасувати",
    onOk: () => {
      list.tasks = list.tasks.filter(t => !t.done);
      saveState();
      render();
      toast("Очищено");
    }
  });
};

const getRenderTasks = (list) => {
  const tasks = [...list.tasks];

  if (state.sortMode === "prio") {

    tasks.sort((a, b) => {
      if (a.prio !== b.prio) return b.prio - a.prio;
      return b.createdAt - a.createdAt;
    });
  }

  return tasks;
};

const prioChip = (p) => (p === 3 ? ["Високий", "chip--high"] : p === 1 ? ["Низький", "chip--low"] : ["Середній", "chip--mid"]);

const renderLists = () => {
  $lists.innerHTML = "";
  $pillLists.textContent = `Списків: ${state.lists.length}`;

  state.lists.forEach(list => {
    const total = list.tasks.length;
    const done = list.tasks.filter(t => t.done).length;

    const item = document.createElement("div");
    item.className = "listItem" + (list.id === state.activeListId ? " listItem--active" : "");
    item.dataset.id = list.id;

    const left = document.createElement("div");
    left.className = "listName";

    const name = document.createElement("strong");
    name.textContent = list.name;

    const meta = document.createElement("span");
    meta.textContent = `${done}/${total} виконано`;

    left.appendChild(name);
    left.appendChild(meta);

    const btns = document.createElement("div");
    btns.className = "listBtns";

    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "iconBtn";
    rename.dataset.action = "renameList";
    rename.dataset.id = list.id;
    rename.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-3L16.5 4a2 2 0 0 0-3 0L3 14.5V20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 5.5l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "iconBtn";
    del.dataset.action = "deleteList";
    del.dataset.id = list.id;
    del.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M10 7V5h4v2m-7 0l1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    btns.appendChild(rename);
    btns.appendChild(del);

    item.appendChild(left);
    item.appendChild(btns);

    $lists.appendChild(item);
  });
};

const renderSort = () => {
  const btn = $sortGroup ? $sortGroup.querySelector("[data-sort='prio']") : null;
  if (!btn) return;
  btn.classList.toggle("sort--active", state.sortMode === "prio");
  btn.textContent = state.sortMode === "prio" ? "За пріоритетом (ON)" : "За пріоритетом";
};

const renderTasks = () => {
  const list = getActiveList();
  if (!list) return;

  const total = list.tasks.length;
  const done = list.tasks.filter(t => t.done).length;

  $activeTitle.textContent = list.name;
  $activeMeta.textContent = `${done}/${total} виконано`;

  const tasks = getRenderTasks(list);

  $dragHint.textContent = "Перетягуй справи за кнопкою справа.";

  $tasks.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Тут порожньо.";
    $tasks.appendChild(empty);
  } else {
    tasks.forEach(task => {
      const row = document.createElement("div");
      row.className = "task" + (task.done ? " task--done" : "");
      row.dataset.id = task.id;

      const left = document.createElement("div");
      left.className = "task__left";

      const cb = document.createElement("input");
      cb.className = "check";
      cb.type = "checkbox";
      cb.checked = !!task.done;
      cb.dataset.action = "toggleTask";
      cb.dataset.id = task.id;

      const main = document.createElement("div");
      main.className = "task__main";

      const text = document.createElement("div");
      text.className = "task__text";
      text.textContent = task.text;

      const meta = document.createElement("div");
      meta.className = "task__meta";

      const [pLabel, pClass] = prioChip(task.prio);
      const pr = document.createElement("span");
      pr.className = `chip ${pClass}`;
      pr.textContent = pLabel;
      meta.appendChild(pr);

      if (task.time) {
        const due = document.createElement("span");
        due.className = "chip chip--date";
        due.textContent = task.time;
        meta.appendChild(due);
      }

      (task.tags || []).forEach(t => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = `#${t}`;
        meta.appendChild(chip);
      });

      main.appendChild(text);
      main.appendChild(meta);

      left.appendChild(cb);
      left.appendChild(main);

      const right = document.createElement("div");
      right.className = "task__right";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "iconBtn";
      editBtn.dataset.action = "editTask";
      editBtn.dataset.id = task.id;
      editBtn.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-3L16.5 4a2 2 0 0 0-3 0L3 14.5V20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 5.5l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "iconBtn";
      delBtn.dataset.action = "deleteTask";
      delBtn.dataset.id = task.id;
      delBtn.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M10 7V5h4v2m-7 0l1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "handle";
      handle.dataset.action = "dragHandle";
      handle.dataset.id = task.id;
      handle.innerHTML = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8M8 12h8M8 17h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

      right.appendChild(editBtn);
      right.appendChild(delBtn);
      right.appendChild(handle);

      row.appendChild(left);
      row.appendChild(right);

      $tasks.appendChild(row);
    });
  }

  $stats.textContent = `Списків: ${state.lists.length} · Показано: ${tasks.length} · Режим: ${state.sortMode === "prio" ? "Пріоритет" : "Ручний порядок"}`;
};

const render = () => {
  const active = getActiveList();
  if (!active && state.lists.length) state.activeListId = state.lists[0].id;
  renderLists();
  renderSort();
  renderTasks();
};

const openEditTaskModal = (taskId) => {
  const list = getActiveList();
  if (!list) return;
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;

  const body = document.createElement("div");
  body.className = "stack";

  const tInput = document.createElement("input");
  tInput.className = "input";
  tInput.value = task.text;
  tInput.placeholder = "Назва справи…";

  const pSelect = document.createElement("select");
  pSelect.className = "select";
  pSelect.innerHTML = `
    <option value="1">Низький</option>
    <option value="2">Середній</option>
    <option value="3">Високий</option>
  `;
  pSelect.value = String(task.prio);

  const dInput = document.createElement("input");
  dInput.className = "input";
  dInput.type = "time";
  dInput.value = task.time || "";

  const tgInput = document.createElement("input");
  tgInput.className = "input";
  tgInput.placeholder = "Теги через кому…";
  tgInput.value = (task.tags || []).join(", ");

  body.appendChild(tInput);
  body.appendChild(pSelect);
  body.appendChild(dInput);
  body.appendChild(tgInput);

  openModal({
    title: "Редагування справи",
    bodyNode: body,
    actions: [
      { text: "Скасувати", className: "btn btn--ghost", onClick: () => closeModal() },
      {
        text: "Зберегти",
        className: "btn btn--primary",
        onClick: () => {
          const nextText = String(tInput.value || "").trim();
          if (!nextText) {
            alertModal({ title: "Не вийшло", text: "Назва справи не може бути порожньою." });
            return;
          }
          updateTask(taskId, {
            text: nextText,
            prio: Number(pSelect.value) || 2,
            time: String(dInput.value || "").trim(),
            tags: normalizeTags(tgInput.value)
          });
          closeModal();
        }
      }
    ]
  });

  setTimeout(() => tInput.focus(), 0);
};

let drag = null;

const onDragStart = (e, taskId, handleEl) => {
  const taskEl = $tasks.querySelector(`.task[data-id="${taskId}"]`);
  if (!taskEl) return;

  const rect = taskEl.getBoundingClientRect();

  const placeholder = document.createElement("div");
  placeholder.className = "placeholder";
  placeholder.style.height = rect.height + "px";

  taskEl.parentElement.insertBefore(placeholder, taskEl);

  drag = {
    taskId,
    taskEl,
    placeholder,
    handleEl,
    pointerId: e.pointerId,
    offX: e.clientX - rect.left,
    offY: e.clientY - rect.top
  };

  taskEl.classList.add("task--dragging");
  taskEl.style.width = rect.width + "px";
  taskEl.style.height = rect.height + "px";
  taskEl.style.left = rect.left + "px";
  taskEl.style.top = rect.top + "px";

  document.body.appendChild(taskEl);

  handleEl.setPointerCapture(e.pointerId);
  handleEl.addEventListener("pointermove", onDragMove);
  handleEl.addEventListener("pointerup", onDragEnd);
  handleEl.addEventListener("pointercancel", onDragEnd);
};

const onDragMove = (e) => {
  if (!drag) return;

  const x = e.clientX - drag.offX;
  const y = e.clientY - drag.offY;

  drag.taskEl.style.left = x + "px";
  drag.taskEl.style.top = y + "px";

  const under = document.elementFromPoint(e.clientX, e.clientY);
  const overTask = under ? under.closest(".task") : null;

  if (!overTask) return;
  if (overTask === drag.taskEl) return;

  const overRect = overTask.getBoundingClientRect();
  const before = e.clientY < overRect.top + overRect.height / 2;

  const parent = drag.placeholder.parentElement;
  if (!parent) return;

  if (before) parent.insertBefore(drag.placeholder, overTask);
  else parent.insertBefore(drag.placeholder, overTask.nextElementSibling);
};

const applyOrderFromDOM = () => {
  const list = getActiveList();
  if (!list) return;

  const ids = Array.from($tasks.querySelectorAll(".task"))
    .map(n => n.dataset.id)
    .filter(Boolean);

  const map = new Map(list.tasks.map(t => [t.id, t]));
  const ordered = [];

  ids.forEach(id => {
    if (map.has(id)) {
      ordered.push(map.get(id));
      map.delete(id);
    }
  });

  list.tasks = [...ordered, ...Array.from(map.values())];
  saveState();
};

const onDragEnd = () => {
  if (!drag) return;

  drag.handleEl.removeEventListener("pointermove", onDragMove);
  drag.handleEl.removeEventListener("pointerup", onDragEnd);
  drag.handleEl.removeEventListener("pointercancel", onDragEnd);

  drag.taskEl.classList.remove("task--dragging");
  drag.taskEl.style.width = "";
  drag.taskEl.style.height = "";
  drag.taskEl.style.left = "";
  drag.taskEl.style.top = "";

  drag.placeholder.parentElement.insertBefore(drag.taskEl, drag.placeholder);
  drag.placeholder.remove();

  applyOrderFromDOM();

  drag = null;

  if (state.sortMode !== "manual") {
    state.sortMode = "manual";
    saveState();
  }

  toast("Порядок змінено");
  render();
};

$createListBtn.addEventListener("click", () => {
  addList($listNameInput.value);
  $listNameInput.value = "";
  $listNameInput.focus();
});

$listNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $createListBtn.click();
});

$addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTask({
    text: $taskInput.value,
    prio: Number($prioSelect.value),
    time: $dateInput.value || "",
    tags: normalizeTags($tagsInput.value)
  });
  $taskInput.value = "";
  $tagsInput.value = "";
  $taskInput.focus();
});

$deleteListBtn.addEventListener("click", () => deleteList(state.activeListId));
$clearDoneBtn.addEventListener("click", () => clearDone());

$sortGroup.addEventListener("click", (e) => {
  const b = e.target.closest("[data-sort='prio']");
  if (!b) return;
  setSortMode(state.sortMode === "prio" ? "manual" : "prio");
});

$lists.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (btn) {
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === "renameList") renameList(id);
    if (action === "deleteList") deleteList(id);
    return;
  }
  const item = e.target.closest(".listItem");
  if (!item) return;
  setActiveList(item.dataset.id);
});

$tasks.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "toggleTask") toggleTask(id);
  if (action === "deleteTask") deleteTask(id);
  if (action === "editTask") openEditTaskModal(id);
});

$tasks.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest("[data-action='dragHandle']");
  if (!handle) return;

  const id = handle.dataset.id;
  if (!id) return;

  e.preventDefault();
  onDragStart(e, id, handle);
});

if (!$dateInput.value) $dateInput.value = nowTimeHM();

render();

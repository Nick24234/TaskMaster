import type { ITask, Priority } from "../types.js";
import { Priority as PriorityEnum } from "../types.js";
import { TaskManager } from "../TaskManager.js";

type Route = "#/all" | "#/active" | "#/completed";

function getRouteFromHash(hash: string): Route {
  const normalized: string = hash || "#/all";
  if (normalized === "#/active") return "#/active";
  if (normalized === "#/completed") return "#/completed";
  return "#/all";
}

function priorityFromString(raw: string): Priority {
  const values: string[] = Object.values(PriorityEnum);
  if (values.includes(raw)) {
    return raw as Priority;
  }
  return PriorityEnum.Medium;
}

const el = {
  form: document.getElementById("taskForm") as HTMLFormElement | null,
  titleInput: document.getElementById("titleInput") as HTMLInputElement | null,
  prioritySelect: document.getElementById("prioritySelect") as HTMLSelectElement | null,
  deadlineInput: document.getElementById("deadlineInput") as HTMLInputElement | null,
  tasksList: document.getElementById("tasksList") as HTMLUListElement | null,
  emptyState: document.getElementById("emptyState") as HTMLDivElement | null,
  tasksCount: document.getElementById("tasksCount") as HTMLSpanElement | null,
  activeFilterLabel: document.getElementById("activeFilterLabel") as HTMLDivElement | null,
  filterLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>(".filter-link")),
  statsDashboard: document.getElementById("statsDashboard") as HTMLElement | null,
  statsProgressRing: document.getElementById("statsProgressRing") as HTMLElement | null,
  statsPercent: document.getElementById("statsPercent") as HTMLSpanElement | null,
  statTotal: document.getElementById("statTotal") as HTMLSpanElement | null,
  statCompleted: document.getElementById("statCompleted") as HTMLSpanElement | null,
  statActive: document.getElementById("statActive") as HTMLSpanElement | null,
  statOverdue: document.getElementById("statOverdue") as HTMLSpanElement | null,
  editModal: document.getElementById("editModal") as HTMLDialogElement | null,
  editForm: document.getElementById("editForm") as HTMLFormElement | null,
  editTaskId: document.getElementById("editTaskId") as HTMLInputElement | null,
  editTitleInput: document.getElementById("editTitleInput") as HTMLInputElement | null,
  editPrioritySelect: document.getElementById("editPrioritySelect") as HTMLSelectElement | null,
  editDeadlineInput: document.getElementById("editDeadlineInput") as HTMLInputElement | null,
  closeEditModalBtn: document.getElementById("closeEditModalBtn") as HTMLButtonElement | null
};

let taskManager: TaskManager = new TaskManager([]);
let currentRoute: Route = getRouteFromHash(location.hash);

function applyActiveLink(route: Route): void {
  for (const link of el.filterLinks) {
    const linkRoute: string = link.getAttribute("data-route") ?? "#/all";
    link.classList.toggle("active", linkRoute === route);
  }
}

function filterTasks(route: Route, tasks: ITask[]): ITask[] {
  if (route === "#/active") return tasks.filter((t: ITask) => !t.isCompleted);
  if (route === "#/completed") return tasks.filter((t: ITask) => t.isCompleted);
  return tasks;
}

function renderStats(tasks: ITask[]): void {
  if (
    !el.statsProgressRing || !el.statsPercent ||
    !el.statTotal || !el.statCompleted ||
    !el.statActive || !el.statOverdue
  ) return;

  const total = tasks.length;
  let completed = 0;
  let active = 0;
  let overdue = 0;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const t of tasks) {
    if (t.isCompleted) {
      completed++;
    } else {
      active++;
      if (t.deadline && t.deadline < todayStr) {
        overdue++;
      }
    }
  }

  el.statTotal.textContent = String(total);
  el.statCompleted.textContent = String(completed);
  el.statActive.textContent = String(active);
  el.statOverdue.textContent = String(overdue);

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  el.statsPercent.textContent = `${percent}%`;
  el.statsProgressRing.style.background = `conic-gradient(var(--ok) ${percent}%, rgba(255, 255, 255, 0.05) ${percent}%)`;
}

function render(): void {
  if (!el.tasksList || !el.emptyState || !el.tasksCount || !el.activeFilterLabel) {
    return;
  }

  const all: ITask[] = taskManager.getAllTasks();
  const visible: ITask[] = filterTasks(currentRoute, all);

  renderStats(all);

  el.tasksCount.textContent = String(visible.length);
  const label: string =
    currentRoute === "#/active" ? "Активні" : currentRoute === "#/completed" ? "Виконані" : "Усі";
  el.activeFilterLabel.textContent = `Фільтр: ${label}`;

  el.tasksList.innerHTML = "";

  if (visible.length === 0) {
    el.emptyState.hidden = false;
    return;
  }

  el.emptyState.hidden = true;

  for (const task of visible) {
    const li: HTMLLIElement = document.createElement("li");
    li.className = "task-item";

    const checkbox: HTMLInputElement = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.isCompleted;
    checkbox.setAttribute("aria-label", "Статус виконання");

    checkbox.addEventListener("change", async () => {
      if (!task.isCompleted && task.subtasks && task.subtasks.some(st => !st.isCompleted)) {
        alert("Неможливо виконати задачу: є невиконані підзадачі!");
        checkbox.checked = false;
        return;
      }

      try {
        await taskManager.toggleTaskCompletion(task.id);
        render();
      } catch (e) {
        console.error(e);
      }
    });

    const titleWrap: HTMLDivElement = document.createElement("div");
    const title: HTMLDivElement = document.createElement("div");
    title.className = `task-title${task.isCompleted ? " completed" : ""}`;
    title.textContent = task.title;
    titleWrap.appendChild(title);

    const badge: HTMLSpanElement = document.createElement("span");
    badge.className = `priority-badge priority-${task.priority}`;
    badge.textContent = task.priority;

    const metaWrap: HTMLDivElement = document.createElement("div");
    metaWrap.className = "task-meta";
    metaWrap.appendChild(badge);

    if (task.deadline) {
      const deadlineEl: HTMLSpanElement = document.createElement("span");
      deadlineEl.className = "task-deadline";
      const parts: string[] = task.deadline.split("-");
      deadlineEl.textContent = parts.length === 3 ? `До ${parts[2]}.${parts[1]}.${parts[0]}` : `До ${task.deadline}`;
      metaWrap.appendChild(deadlineEl);
    }

    const actionsWrap = document.createElement("div");
    actionsWrap.style.display = "flex";
    actionsWrap.style.gap = "8px";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "task-edit";
    editBtn.textContent = "✎";
    editBtn.setAttribute("aria-label", "Редагувати задачу");
    editBtn.addEventListener("click", () => openEditModal(task));

    const delBtn: HTMLButtonElement = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "task-delete";
    delBtn.textContent = "×";
    delBtn.setAttribute("aria-label", "Видалити задачу");

    delBtn.addEventListener("click", async () => {
      try {
        await taskManager.deleteTask(task.id);
        render();
      } catch (e) {
        console.error(e);
      }
    });

    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(delBtn);

    li.appendChild(checkbox);
    li.appendChild(titleWrap);
    li.appendChild(metaWrap);
    li.appendChild(actionsWrap);

    const subtasksContainer: HTMLDivElement = document.createElement("div");
    subtasksContainer.className = "subtasks-container";
    
    const subtasks = task.subtasks || [];
    if (subtasks.length > 0) {
      const completedCount = subtasks.filter(s => s.isCompleted).length;
      const progressEl = document.createElement("div");
      progressEl.className = "subtasks-progress";
      progressEl.textContent = `Підзадачі: ${completedCount} / ${subtasks.length} виконано`;
      subtasksContainer.appendChild(progressEl);
    }

    for (const subtask of subtasks) {
      const stItem = document.createElement("div");
      stItem.className = "subtask-item";

      const stCheckbox = document.createElement("input");
      stCheckbox.type = "checkbox";
      stCheckbox.checked = subtask.isCompleted;
      stCheckbox.addEventListener("change", async () => {
        try {
          const newSubtasks = subtasks.map(s => 
            s.id === subtask.id ? { ...s, isCompleted: stCheckbox.checked } : s
          );
          await taskManager.updateSubtasks(task.id, newSubtasks);
          render();
        } catch(e) { console.error(e); }
      });

      const stTitle = document.createElement("div");
      stTitle.className = `subtask-title${subtask.isCompleted ? " completed" : ""}`;
      stTitle.textContent = subtask.title;

      const stDelBtn = document.createElement("button");
      stDelBtn.type = "button";
      stDelBtn.className = "task-delete";
      stDelBtn.style.width = "24px";
      stDelBtn.style.height = "24px";
      stDelBtn.style.fontSize = "14px";
      stDelBtn.textContent = "×";
      stDelBtn.addEventListener("click", async () => {
        try {
          const newSubtasks = subtasks.filter(s => s.id !== subtask.id);
          await taskManager.updateSubtasks(task.id, newSubtasks);
          render();
        } catch(e) { console.error(e); }
      });

      stItem.appendChild(stCheckbox);
      stItem.appendChild(stTitle);
      stItem.appendChild(stDelBtn);
      subtasksContainer.appendChild(stItem);
    }

    const addForm = document.createElement("form");
    addForm.className = "subtask-add-form";
    const addInput = document.createElement("input");
    addInput.type = "text";
    addInput.placeholder = "Додати підзадачу...";
    addInput.required = true;
    const addBtn = document.createElement("button");
    addBtn.type = "submit";
    addBtn.className = "btn btn-outline";
    addBtn.textContent = "Додати";

    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = addInput.value.trim();
      if (!title) return;
      try {
        const newSubtask = { id: crypto.randomUUID(), title, isCompleted: false };
        const newSubtasks = [...subtasks, newSubtask];
        await taskManager.updateSubtasks(task.id, newSubtasks);
        render();
      } catch(e) { console.error(e); }
    });

    addForm.appendChild(addInput);
    addForm.appendChild(addBtn);
    subtasksContainer.appendChild(addForm);

    li.appendChild(subtasksContainer);

    el.tasksList.appendChild(li);
  }
}

async function loadInitial(): Promise<void> {
  await taskManager.fetchTasks();
}

function syncRouteFromHash(): void {
  currentRoute = getRouteFromHash(location.hash);
  applyActiveLink(currentRoute);
  render();
}

function initRouting(): void {
  window.addEventListener("hashchange", () => {
    syncRouteFromHash();
  });
}

function initForm(): void {
  if (!el.form || !el.titleInput || !el.prioritySelect) {
    return;
  }

  const formEl: HTMLFormElement = el.form!;
  const titleInputEl: HTMLInputElement = el.titleInput!;
  const prioritySelectEl: HTMLSelectElement = el.prioritySelect!;
  const deadlineInputEl: HTMLInputElement | null = el.deadlineInput;

  formEl.addEventListener("submit", async (ev: SubmitEvent) => {
    ev.preventDefault();

    const title: string = titleInputEl.value.trim();
    const priority: Priority = priorityFromString(prioritySelectEl.value);
    const deadline: string | undefined = deadlineInputEl?.value ? deadlineInputEl.value : undefined;

    if (!title) {
      return;
    }

    try {
      await taskManager.addTask(title, priority, deadline);

      formEl.reset();
      render();

      location.hash = currentRoute;
    } catch (e) {
      console.error(e);
    }
  });
}

function openEditModal(task: ITask): void {
  if (!el.editModal || !el.editTaskId || !el.editTitleInput || !el.editPrioritySelect || !el.editDeadlineInput) return;
  
  el.editTaskId.value = String(task.id);
  el.editTitleInput.value = task.title;
  el.editPrioritySelect.value = task.priority;
  el.editDeadlineInput.value = task.deadline || "";
  
  el.editModal.showModal();
}

function initEditModal(): void {
  if (!el.editModal || !el.editForm || !el.closeEditModalBtn) return;

  el.closeEditModalBtn.addEventListener("click", () => {
    el.editModal?.close();
  });

  el.editForm.addEventListener("submit", async (ev: SubmitEvent) => {
    ev.preventDefault();
    if (!el.editTaskId || !el.editTitleInput || !el.editPrioritySelect || !el.editDeadlineInput) return;

    const id = Number(el.editTaskId.value);
    const title = el.editTitleInput.value.trim();
    const priority = priorityFromString(el.editPrioritySelect.value);
    const deadline = el.editDeadlineInput.value || undefined;

    if (!title || isNaN(id)) return;

    try {
      await taskManager.editTask(id, { title, priority, deadline });
      el.editModal?.close();
      render();
    } catch (e) {
      console.error(e);
    }
  });
}

function updateAuthStateUI(): void {
  const isLoggedIn = taskManager.isLoggedIn();
  const authCard = document.getElementById("authCard");
  const taskContent = document.getElementById("taskContent");
  const userHeader = document.getElementById("userHeader");
  const usernameDisplay = document.getElementById("usernameDisplay");

  if (isLoggedIn) {
    if (authCard) authCard.hidden = true;
    if (taskContent) taskContent.hidden = false;
    if (el.statsDashboard) el.statsDashboard.hidden = false;
    if (userHeader) userHeader.hidden = false;
    if (usernameDisplay) usernameDisplay.textContent = taskManager.getUsername() || "";
  } else {
    if (authCard) authCard.hidden = false;
    if (taskContent) taskContent.hidden = true;
    if (el.statsDashboard) el.statsDashboard.hidden = true;
    if (userHeader) userHeader.hidden = true;
  }
}

function initAuthTabs(): void {
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const authSlider = document.getElementById("authSlider");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (tabLogin && tabRegister && authSlider && loginForm && registerForm) {
    tabLogin.addEventListener("click", () => {
      tabLogin.classList.add("active");
      tabRegister.classList.remove("active");
      authSlider.style.transform = "translateX(0)";
      loginForm.classList.add("active-form");
      registerForm.classList.remove("active-form");
    });

    tabRegister.addEventListener("click", () => {
      tabRegister.classList.add("active");
      tabLogin.classList.remove("active");
      authSlider.style.transform = "translateX(-50%)";
      registerForm.classList.add("active-form");
      loginForm.classList.remove("active-form");
    });

    loginForm.classList.add("active-form");
  }
}

function initLoginForm(): void {
  const loginForm = document.getElementById("loginForm") as HTMLFormElement | null;
  const loginUsername = document.getElementById("loginUsername") as HTMLInputElement | null;
  const loginPassword = document.getElementById("loginPassword") as HTMLInputElement | null;
  const loginError = document.getElementById("loginError") as HTMLDivElement | null;

  if (loginForm && loginUsername && loginPassword && loginError) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginError.hidden = true;
      loginError.textContent = "";

      const username = loginUsername.value.trim();
      const password = loginPassword.value;

      const res = await taskManager.login(username, password);
      if (res.success) {
        loginForm.reset();
        updateAuthStateUI();
        await loadInitial();
        render();
      } else {
        loginError.textContent = res.error || "Помилка авторизації";
        loginError.hidden = false;
      }
    });
  }
}

function initRegisterForm(): void {
  const registerForm = document.getElementById("registerForm") as HTMLFormElement | null;
  const registerUsername = document.getElementById("registerUsername") as HTMLInputElement | null;
  const registerPassword = document.getElementById("registerPassword") as HTMLInputElement | null;
  const registerError = document.getElementById("registerError") as HTMLDivElement | null;
  const registerSuccess = document.getElementById("registerSuccess") as HTMLDivElement | null;

  if (registerForm && registerUsername && registerPassword && registerError && registerSuccess) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      registerError.hidden = true;
      registerError.textContent = "";
      registerSuccess.hidden = true;

      const username = registerUsername.value.trim();
      const password = registerPassword.value;

      const res = await taskManager.register(username, password);
      if (res.success) {
        registerForm.reset();
        registerSuccess.hidden = false;
        setTimeout(() => {
          const tabLogin = document.getElementById("tabLogin");
          if (tabLogin) {
            (tabLogin as HTMLButtonElement).click();
          }
        }, 1500);
      } else {
        registerError.textContent = res.error || "Помилка реєстрації";
        registerError.hidden = false;
      }
    });
  }
}

function initLogoutBtn(): void {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await taskManager.logout();
      updateAuthStateUI();
      render();
    });
  }
}

(async () => {
  initRouting();
  applyActiveLink(currentRoute);
  initForm();
  initEditModal();
  initAuthTabs();
  initLoginForm();
  initRegisterForm();
  initLogoutBtn();
  updateAuthStateUI();

  if (taskManager.isLoggedIn()) {
    await loadInitial();
    render();
  }
})();


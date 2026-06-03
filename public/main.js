import { Priority as PriorityEnum } from "../types.js";
import { TaskManager } from "../TaskManager.js";

function getRouteFromHash(hash) {
  const normalized = hash || "#/all";
  if (normalized === "#/active") return "#/active";
  if (normalized === "#/completed") return "#/completed";
  return "#/all";
}

function priorityFromString(raw) {
  const values = Object.values(PriorityEnum);
  if (values.includes(raw)) {
    return raw;
  }
  return PriorityEnum.Medium;
}

const el = {
  form: document.getElementById("taskForm"),
  titleInput: document.getElementById("titleInput"),
  prioritySelect: document.getElementById("prioritySelect"),
  deadlineInput: document.getElementById("deadlineInput"),
  tasksList: document.getElementById("tasksList"),
  emptyState: document.getElementById("emptyState"),
  tasksCount: document.getElementById("tasksCount"),
  activeFilterLabel: document.getElementById("activeFilterLabel"),
  filterLinks: Array.from(document.querySelectorAll(".filter-link")),
  statsDashboard: document.getElementById("statsDashboard"),
  statsProgressRing: document.getElementById("statsProgressRing"),
  statsPercent: document.getElementById("statsPercent"),
  statTotal: document.getElementById("statTotal"),
  statCompleted: document.getElementById("statCompleted"),
  statActive: document.getElementById("statActive"),
  statOverdue: document.getElementById("statOverdue"),
  editModal: document.getElementById("editModal"),
  editForm: document.getElementById("editForm"),
  editTaskId: document.getElementById("editTaskId"),
  editTitleInput: document.getElementById("editTitleInput"),
  editPrioritySelect: document.getElementById("editPrioritySelect"),
  editDeadlineInput: document.getElementById("editDeadlineInput"),
  closeEditModalBtn: document.getElementById("closeEditModalBtn"),
  authSection: document.getElementById("authSection"),
  appSection: document.getElementById("appSection"),
  loginTab: document.getElementById("loginTab"),
  registerTab: document.getElementById("registerTab"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  logoutBtn: document.getElementById("logoutBtn"),
  userNameDisplay: document.getElementById("userNameDisplay")
};

let taskManager = new TaskManager([]);
let currentRoute = getRouteFromHash(location.hash);

function applyActiveLink(route) {
  for (const link of el.filterLinks) {
    const linkRoute = link.getAttribute("data-route") ?? "#/all";
    link.classList.toggle("active", linkRoute === route);
  }
}

function filterTasks(route, tasks) {
  if (route === "#/active") return tasks.filter(t => !t.isCompleted);
  if (route === "#/completed") return tasks.filter(t => t.isCompleted);
  return tasks;
}

function renderStats(tasks) {
  if (!el.statsProgressRing || !el.statsPercent ||
      !el.statTotal || !el.statCompleted ||
      !el.statActive || !el.statOverdue) return;

  const total = tasks.length;
  let completed = 0, active = 0, overdue = 0;

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
  el.statsProgressRing.style.background =
    `conic-gradient(var(--ok) ${percent}%, rgba(255,255,255,0.05) ${percent}%)`;
}

function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item" + (task.isCompleted ? " completed" : "");
  li.dataset.id = task.id;

  const priorityClass = "priority-" + String(task.priority).toLowerCase();

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.isCompleted;
  checkbox.addEventListener("change", async () => {
    await taskManager.toggleComplete(task.id);
    render();
  });

  const info = document.createElement("div");
  info.className = "task-info";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("span");
  meta.className = "task-meta";
  const parts = [];
  if (task.priority) parts.push(task.priority);
  if (task.deadline) parts.push("Deadline: " + task.deadline);
  meta.textContent = parts.join(" | ");

  info.appendChild(title);
  info.appendChild(meta);

  const badge = document.createElement("span");
  badge.className = "priority-badge " + priorityClass;
  badge.textContent = task.priority || PriorityEnum.Medium;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn-icon";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => openEditModal(task));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-icon danger";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", async () => {
    if (confirm("Delete this task?")) {
      await taskManager.delete(task.id);
      render();
    }
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(checkbox);
  li.appendChild(info);
  li.appendChild(badge);
  li.appendChild(actions);

  return li;
}

function render() {
  const allTasks = taskManager.getAll();
  const tasks = filterTasks(currentRoute, allTasks);

  if (el.tasksList) {
    el.tasksList.innerHTML = "";
    if (tasks.length === 0) {
      if (el.emptyState) el.emptyState.style.display = "block";
    } else {
      if (el.emptyState) el.emptyState.style.display = "none";
      for (const task of tasks) {
        el.tasksList.appendChild(createTaskElement(task));
      }
    }
  }

  if (el.tasksCount) {
    el.tasksCount.textContent = String(tasks.length);
  }

  if (el.activeFilterLabel) {
    const map = { "#/all": "All", "#/active": "Active", "#/completed": "Completed" };
    el.activeFilterLabel.textContent = map[currentRoute] || "All";
  }

  renderStats(allTasks);
}

async function loadInitial() {
  try {
    await taskManager.loadFromServer();
  } catch (err) {
    console.error("Failed to load tasks:", err);
  }
}

function initRouting() {
  window.addEventListener("hashchange", () => {
    currentRoute = getRouteFromHash(location.hash);
    applyActiveLink(currentRoute);
    render();
  });

  for (const link of el.filterLinks) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const route = link.getAttribute("data-route") || "#/all";
      location.hash = route;
    });
  }
}

function initForm() {
  if (!el.form) return;
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = el.titleInput?.value.trim();
    if (!title) return;

    const priority = priorityFromString(el.prioritySelect?.value);
    const deadline = el.deadlineInput?.value || null;

    await taskManager.add({ title, priority, deadline, isCompleted: false });
    el.form.reset();
    render();
  });
}

function openEditModal(task) {
  if (!el.editModal || !el.editTaskId) return;
  el.editTaskId.value = task.id;
  if (el.editTitleInput) el.editTitleInput.value = task.title;
  if (el.editPrioritySelect) el.editPrioritySelect.value = task.priority || PriorityEnum.Medium;
  if (el.editDeadlineInput) el.editDeadlineInput.value = task.deadline || "";
  el.editModal.classList.add("open");
}

function closeEditModal() {
  if (!el.editModal) return;
  el.editModal.classList.remove("open");
  if (el.editForm) el.editForm.reset();
}

function initEditModal() {
  if (!el.editForm) return;
  el.editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = el.editTaskId?.value;
    if (!id) return;

    const title = el.editTitleInput?.value.trim();
    if (!title) return;

    const priority = priorityFromString(el.editPrioritySelect?.value);
    const deadline = el.editDeadlineInput?.value || null;

    await taskManager.update(id, { title, priority, deadline });
    closeEditModal();
    render();
  });

  if (el.closeEditModalBtn) {
    el.closeEditModalBtn.addEventListener("click", closeEditModal);
  }

  if (el.editModal) {
    el.editModal.addEventListener("click", (e) => {
      if (e.target === el.editModal) closeEditModal();
    });
  }
}

function updateAuthStateUI() {
  const isLoggedIn = taskManager.isLoggedIn();
  if (el.authSection) el.authSection.style.display = isLoggedIn ? "none" : "block";
  if (el.appSection) el.appSection.style.display = isLoggedIn ? "block" : "none";
  if (el.logoutBtn) el.logoutBtn.style.display = isLoggedIn ? "inline-block" : "none";

  if (isLoggedIn && el.userNameDisplay) {
    const user = taskManager.getCurrentUser?.();
    el.userNameDisplay.textContent = user?.name || user?.email || "User";
  }
}

function initAuthTabs() {
  if (!el.loginTab || !el.registerTab) return;

  el.loginTab.addEventListener("click", () => {
    el.loginTab.classList.add("active");
    el.registerTab.classList.remove("active");
    if (el.loginForm) el.loginForm.style.display = "block";
    if (el.registerForm) el.registerForm.style.display = "none";
  });

  el.registerTab.addEventListener("click", () => {
    el.registerTab.classList.add("active");
    el.loginTab.classList.remove("active");
    if (el.registerForm) el.registerForm.style.display = "block";
    if (el.loginForm) el.loginForm.style.display = "none";
  });
}

function initLoginForm() {
  if (!el.loginForm) return;
  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = el.loginForm.querySelector('[name="email"]')?.value.trim();
    const password = el.loginForm.querySelector('[name="password"]')?.value;
    if (!email || !password) return;

    try {
      await taskManager.login(email, password);
      updateAuthStateUI();
      await loadInitial();
      render();
    } catch (err) {
      alert(err.message || "Login failed");
    }
  });
}

function initRegisterForm() {
  if (!el.registerForm) return;
  el.registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = el.registerForm.querySelector('[name="email"]')?.value.trim();
    const password = el.registerForm.querySelector('[name="password"]')?.value;
    const name = el.registerForm.querySelector('[name="name"]')?.value.trim();
    if (!email || !password) return;

    try {
      await taskManager.register({ email, password, name });
      updateAuthStateUI();
      await loadInitial();
      render();
    } catch (err) {
      alert(err.message || "Registration failed");
    }
  });
}

function initLogoutBtn() {
  if (!el.logoutBtn) return;
  el.logoutBtn.addEventListener("click", async () => {
    await taskManager.logout();
    updateAuthStateUI();
    if (el.tasksList) el.tasksList.innerHTML = "";
  });
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


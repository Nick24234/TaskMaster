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
  tasksList: document.getElementById("tasksList") as HTMLUListElement | null,
  emptyState: document.getElementById("emptyState") as HTMLDivElement | null,
  tasksCount: document.getElementById("tasksCount") as HTMLSpanElement | null,
  activeFilterLabel: document.getElementById("activeFilterLabel") as HTMLDivElement | null,
  filterLinks: Array.from(document.querySelectorAll<HTMLAnchorElement>(".filter-link"))
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

function render(): void {
  if (!el.tasksList || !el.emptyState || !el.tasksCount || !el.activeFilterLabel) {
    return;
  }

  const all: ITask[] = taskManager.getAllTasks();
  const visible: ITask[] = filterTasks(currentRoute, all);

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

    li.appendChild(checkbox);
    li.appendChild(titleWrap);
    li.appendChild(badge);
    li.appendChild(delBtn);

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

  formEl.addEventListener("submit", async (ev: SubmitEvent) => {
    ev.preventDefault();

    const title: string = titleInputEl.value.trim();
    const priority: Priority = priorityFromString(prioritySelectEl.value);

    if (!title) {
      return;
    }

    try {
      await taskManager.addTask(title, priority);

      formEl.reset();
      render();

      location.hash = currentRoute;
    } catch (e) {
      console.error(e);
    }
  });
}

(async () => {
  initRouting();
  applyActiveLink(currentRoute);
  initForm();
  await loadInitial();
  render();
})();


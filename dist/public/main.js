import { Priority as PriorityEnum } from "../types.js";
import { TaskManager } from "../TaskManager.js";
function getRouteFromHash(hash) {
    const normalized = hash || "#/all";
    if (normalized === "#/active")
        return "#/active";
    if (normalized === "#/completed")
        return "#/completed";
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
    tasksList: document.getElementById("tasksList"),
    emptyState: document.getElementById("emptyState"),
    tasksCount: document.getElementById("tasksCount"),
    activeFilterLabel: document.getElementById("activeFilterLabel"),
    filterLinks: Array.from(document.querySelectorAll(".filter-link"))
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
    if (route === "#/active")
        return tasks.filter((t) => !t.isCompleted);
    if (route === "#/completed")
        return tasks.filter((t) => t.isCompleted);
    return tasks;
}
function render() {
    if (!el.tasksList || !el.emptyState || !el.tasksCount || !el.activeFilterLabel) {
        return;
    }
    const all = taskManager.getAllTasks();
    const visible = filterTasks(currentRoute, all);
    el.tasksCount.textContent = String(visible.length);
    const label = currentRoute === "#/active" ? "Активні" : currentRoute === "#/completed" ? "Виконані" : "Усі";
    el.activeFilterLabel.textContent = `Фільтр: ${label}`;
    el.tasksList.innerHTML = "";
    if (visible.length === 0) {
        el.emptyState.hidden = false;
        return;
    }
    el.emptyState.hidden = true;
    for (const task of visible) {
        const li = document.createElement("li");
        li.className = "task-item";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.isCompleted;
        checkbox.setAttribute("aria-label", "Статус виконання");
        checkbox.addEventListener("change", async () => {
            try {
                await taskManager.toggleTaskCompletion(task.id);
                render();
            }
            catch (e) {
                console.error(e);
            }
        });
        const titleWrap = document.createElement("div");
        const title = document.createElement("div");
        title.className = `task-title${task.isCompleted ? " completed" : ""}`;
        title.textContent = task.title;
        titleWrap.appendChild(title);
        const badge = document.createElement("span");
        badge.className = `priority-badge priority-${task.priority}`;
        badge.textContent = task.priority;
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "task-delete";
        delBtn.textContent = "×";
        delBtn.setAttribute("aria-label", "Видалити задачу");
        delBtn.addEventListener("click", async () => {
            try {
                await taskManager.deleteTask(task.id);
                render();
            }
            catch (e) {
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
async function loadInitial() {
    await taskManager.fetchTasks();
}
function syncRouteFromHash() {
    currentRoute = getRouteFromHash(location.hash);
    applyActiveLink(currentRoute);
    render();
}
function initRouting() {
    window.addEventListener("hashchange", () => {
        syncRouteFromHash();
    });
}
function initForm() {
    if (!el.form || !el.titleInput || !el.prioritySelect) {
        return;
    }
    const formEl = el.form;
    const titleInputEl = el.titleInput;
    const prioritySelectEl = el.prioritySelect;
    formEl.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const title = titleInputEl.value.trim();
        const priority = priorityFromString(prioritySelectEl.value);
        if (!title) {
            return;
        }
        try {
            await taskManager.addTask(title, priority);
            formEl.reset();
            render();
            location.hash = currentRoute;
        }
        catch (e) {
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

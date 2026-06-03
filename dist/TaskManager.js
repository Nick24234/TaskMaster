export class TaskManager {
    tasks;
    token = null;
    username = null;
    constructor(initialTasks = []) {
        this.tasks = [...initialTasks];
        try {
            this.token = localStorage.getItem("auth_token");
            this.username = localStorage.getItem("auth_username");
        }
        catch (e) {
        }
    }
    getUsername() {
        return this.username;
    }
    isLoggedIn() {
        return this.token !== null;
    }
    async register(username, password) {
        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, error: data.error || "Реєстрація не вдалася" };
            }
            return { success: true };
        }
        catch (e) {
            return { success: false, error: "Помилка мережі" };
        }
    }
    async login(username, password) {
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                return { success: false, error: data.error || "Вхід не вдалося виконати" };
            }
            this.token = data.token;
            this.username = data.username;
            localStorage.setItem("auth_token", this.token);
            localStorage.setItem("auth_username", this.username);
            return { success: true };
        }
        catch (e) {
            return { success: false, error: "Помилка мережі" };
        }
    }
    async logout() {
        try {
            if (this.token) {
                await fetch("/api/logout", {
                    method: "POST",
                    headers: this.getAuthHeaders()
                });
            }
        }
        catch (e) {
            console.error("Logout error:", e);
        }
        finally {
            this.token = null;
            this.username = null;
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_username");
            this.tasks = [];
        }
    }
    getAuthHeaders() {
        return this.token ? { "Authorization": `Bearer ${this.token}` } : {};
    }
    setTasks(tasks) {
        this.tasks = [...tasks];
    }
    async fetchTasks() {
        try {
            const res = await fetch("/api/tasks", {
                headers: this.getAuthHeaders()
            });
            if (!res.ok)
                throw new Error("Failed to fetch tasks");
            const data = await res.json();
            this.tasks = data.tasks.map((t) => ({
                ...t,
                dueDate: new Date(t.dueDate),
                reminder: { ...t.reminder, remindAt: new Date(t.reminder.remindAt) }
            }));
        }
        catch (error) {
            console.error("Fetch error:", error);
        }
    }
    async addTask(title, priority, deadline) {
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({ title, priority, deadline })
            });
            if (res.ok) {
                const data = await res.json();
                const newTask = {
                    ...data.task,
                    dueDate: new Date(data.task.dueDate),
                    reminder: {
                        ...data.task.reminder,
                        remindAt: new Date(data.task.reminder.remindAt)
                    }
                };
                this.tasks.push(newTask);
            }
        }
        catch (error) {
            console.error("Add task error:", error);
        }
    }
    async toggleTaskCompletion(id) {
        const task = this.tasks.find((t) => t.id === id);
        if (!task)
            return;
        const newStatus = !task.isCompleted;
        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({ isCompleted: newStatus })
            });
            if (res.ok) {
                task.isCompleted = newStatus;
            }
            else {
                const data = await res.json();
                alert(data.error || "Помилка оновлення задачі");
            }
        }
        catch (error) {
            console.error("Toggle task error:", error);
        }
    }
    async editTask(id, updates) {
        const task = this.tasks.find((t) => t.id === id);
        if (!task)
            return;
        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const data = await res.json();
                const updatedTask = data.task;
                Object.assign(task, {
                    ...updatedTask,
                    dueDate: new Date(updatedTask.dueDate),
                    reminder: {
                        ...updatedTask.reminder,
                        remindAt: new Date(updatedTask.reminder.remindAt)
                    }
                });
            }
            else {
                const data = await res.json();
                alert(data.error || "Помилка редагування задачі");
            }
        }
        catch (error) {
            console.error("Edit task error:", error);
        }
    }
    async updateSubtasks(taskId, subtasks) {
        const task = this.tasks.find((t) => t.id === taskId);
        if (!task)
            return;
        try {
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...this.getAuthHeaders()
                },
                body: JSON.stringify({ subtasks })
            });
            if (res.ok) {
                task.subtasks = [...subtasks];
            }
        }
        catch (error) {
            console.error("Update subtasks error:", error);
        }
    }
    async deleteTask(id) {
        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: "DELETE",
                headers: this.getAuthHeaders()
            });
            if (res.ok || res.status === 204) {
                this.tasks = this.tasks.filter((t) => t.id !== id);
            }
        }
        catch (error) {
            console.error("Delete task error:", error);
        }
    }
    getTasksByPriority(priority) {
        return this.tasks.filter((t) => t.priority === priority);
    }
    getAllTasks() {
        return [...this.tasks];
    }
}

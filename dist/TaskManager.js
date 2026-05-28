export class TaskManager {
    tasks;
    constructor(initialTasks = []) {
        this.tasks = [...initialTasks];
    }
    setTasks(tasks) {
        this.tasks = [...tasks];
    }
    async fetchTasks() {
        try {
            const res = await fetch("/api/tasks");
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
    async addTask(title, priority) {
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, priority })
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isCompleted: newStatus })
            });
            if (res.ok) {
                task.isCompleted = newStatus;
            }
        }
        catch (error) {
            console.error("Toggle task error:", error);
        }
    }
    async deleteTask(id) {
        try {
            const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
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

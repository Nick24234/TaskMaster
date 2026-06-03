import type { ITask, ISubtask, Priority } from "./types.js";

export class TaskManager {
  private tasks: ITask[];
  private token: string | null = null;
  private username: string | null = null;

  public constructor(initialTasks: ITask[] = []) {
    this.tasks = [...initialTasks];
    try {
      this.token = localStorage.getItem("auth_token");
      this.username = localStorage.getItem("auth_username");
    } catch (e) {
    }
  }

  public getUsername(): string | null {
    return this.username;
  }

  public isLoggedIn(): boolean {
    return this.token !== null;
  }

  public async register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
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
    } catch (e) {
      return { success: false, error: "Помилка мережі" };
    }
  }

  public async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
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
      localStorage.setItem("auth_token", this.token!);
      localStorage.setItem("auth_username", this.username!);
      return { success: true };
    } catch (e) {
      return { success: false, error: "Помилка мережі" };
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.token) {
        await fetch("/api/logout", {
          method: "POST",
          headers: this.getAuthHeaders()
        });
      }
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      this.token = null;
      this.username = null;
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_username");
      this.tasks = [];
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return this.token ? { "Authorization": `Bearer ${this.token}` } : {};
  }

  public setTasks(tasks: ITask[]): void {
    this.tasks = [...tasks];
  }

  public async fetchTasks(): Promise<void> {
    try {
      const res = await fetch("/api/tasks", {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      
      const data = await res.json();
      this.tasks = data.tasks.map((t: any) => ({
        ...t,
        dueDate: new Date(t.dueDate),
        reminder: { ...t.reminder, remindAt: new Date(t.reminder.remindAt) }
      }));
    } catch (error) {
      console.error("Fetch error:", error);
    }
  }

  public async addTask(title: string, priority: Priority, deadline?: string): Promise<void> {
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
        const newTask: ITask = {
          ...data.task,
          dueDate: new Date(data.task.dueDate),
          reminder: {
            ...data.task.reminder,
            remindAt: new Date(data.task.reminder.remindAt)
          }
        };
        this.tasks.push(newTask);
      }
    } catch (error) {
      console.error("Add task error:", error);
    }
  }

  public async toggleTaskCompletion(id: number): Promise<void> {
    const task: ITask | undefined = this.tasks.find((t: ITask) => t.id === id);
    if (!task) return;

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
      } else {
        const data = await res.json();
        alert(data.error || "Помилка оновлення задачі");
      }
    } catch (error) {
      console.error("Toggle task error:", error);
    }
  }

  public async editTask(id: number, updates: Partial<ITask>): Promise<void> {
    const task: ITask | undefined = this.tasks.find((t: ITask) => t.id === id);
    if (!task) return;

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
      } else {
        const data = await res.json();
        alert(data.error || "Помилка редагування задачі");
      }
    } catch (error) {
      console.error("Edit task error:", error);
    }
  }

  public async updateSubtasks(taskId: number, subtasks: ISubtask[]): Promise<void> {
    const task: ITask | undefined = this.tasks.find((t: ITask) => t.id === taskId);
    if (!task) return;

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
    } catch (error) {
      console.error("Update subtasks error:", error);
    }
  }

  public async deleteTask(id: number): Promise<void> {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
        headers: this.getAuthHeaders()
      });

      if (res.ok || res.status === 204) {
        this.tasks = this.tasks.filter((t: ITask) => t.id !== id);
      }
    } catch (error) {
      console.error("Delete task error:", error);
    }
  }

  public getTasksByPriority(priority: Priority): ITask[] {
    return this.tasks.filter((t: ITask) => t.priority === priority);
  }

  public getAllTasks(): ITask[] {
    return [...this.tasks];
  }
}
import type { ITask, Priority } from "./types.js";

export class TaskManager {
  private tasks: ITask[];

  public constructor(initialTasks: ITask[] = []) {
    this.tasks = [...initialTasks];
  }

  public setTasks(tasks: ITask[]): void {
    this.tasks = [...tasks];
  }

  public async fetchTasks(): Promise<void> {

    try {
      const res = await fetch("/api/tasks");
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

  public async addTask(title: string, priority: Priority): Promise<void> {

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority })
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: newStatus })
      });

      if (res.ok) {
        task.isCompleted = newStatus;
      }
    } catch (error) {
      console.error("Toggle task error:", error);
    }
  }

  public async deleteTask(id: number): Promise<void> {

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });

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
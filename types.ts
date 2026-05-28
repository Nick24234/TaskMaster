export enum Priority {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical"
}

export interface IReminder {
  id: string;
  remindAt: Date;
  message: string;
}

export interface ITask {
  id: number;
  title: string;
  description: string;
  isCompleted: boolean;
  priority: Priority;
  dueDate: Date;
  reminder: IReminder;
}


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

export interface ISubtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface ITask {
  id: number;
  title: string;
  description: string;
  isCompleted: boolean;
  priority: Priority;
  dueDate: Date;
  reminder: IReminder;
  subtasks?: ISubtask[];
  username?: string;
  deadline?: string;
}

export interface IUser {
  username: string;
  passwordHash: string;
  salt: string;
}


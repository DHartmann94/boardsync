export interface SubtaskInterface {
  id?: string;
  title: string;
  completed: boolean;
}

export interface TaskInterface {
  id: string;
  projectId: string;
  title: string;
  description: string;
  step: string;
  prio: string;
  categoryId: string;
  assignedToUser: string;
  subtasks: SubtaskInterface[];
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
}

export type CreateTaskPayload = Omit<TaskInterface, 'id' | 'createdAt' | 'updatedAt'>;
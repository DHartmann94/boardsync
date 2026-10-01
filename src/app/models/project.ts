export interface ProjectInterface {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
  completed: boolean;
}

export type CreateProjectPayload = Omit<ProjectInterface, 'id' | 'createdAt' | 'updatedAt'>;
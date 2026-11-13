/**
 * Beschreibt einen einzelnen Unterpunkt einer Aufgabe.
 * @interface
 */
export interface SubtaskInterface {
  id?: string;
  title: string;
  completed: boolean;
}

/**
 * Beschreibt eine Aufgabe und ihre Projekt-, Zuweisungs- und Zeitdaten.
 * @interface
 */
export interface TaskInterface {
  id: string;
  projectId: string;
  title: string;
  description: string;
  step: string;
  prio: string;
  categoryId: string;
  assignedToUser: string[];
  subtasks: SubtaskInterface[];
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
}

/**
 * Aufgabendaten, die beim Erstellen gespeichert werden.
 * @typedef {Object} CreateTaskPayload
 */
export type CreateTaskPayload = Omit<TaskInterface, 'id' | 'createdAt' | 'updatedAt'>;
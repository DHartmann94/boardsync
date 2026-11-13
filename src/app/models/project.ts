/**
 * Beschreibt ein Projekt mit Mitgliedern und Metadaten.
 * @interface
 */
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

/**
 * Projektdaten, die beim Erstellen gespeichert werden.
 * @typedef {Object} CreateProjectPayload
 */
export type CreateProjectPayload = Omit<ProjectInterface, 'id' | 'createdAt' | 'updatedAt'>;
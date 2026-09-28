export interface ProjectInterface {
  id: string;
  title: string;
  description: string;
  ownerId: string;        // User, der das Projekt erstellt hat
  memberIds: string[];    // Alle User, die Zugriff auf dieses Projekt haben
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
  completed: boolean; // Abfrage wenn noch nicht alle Task beendet sind
}

export type CreateProjectPayload = Omit<ProjectInterface, 'id' | 'createdAt' | 'updatedAt'>;
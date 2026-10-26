import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, Timestamp, collection, collectionData, deleteDoc, docData, query, where, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { TaskInterface } from '../models/task';

const PRIO_ICONS: Record<string, string> = {
  low: 'assets/img/icons/add-task-low.svg',
  medium: 'assets/img/icons/add-task-medium.svg',
  urgent: 'assets/img/icons/add-task-urgent.svg',
};

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  /*------ Firestore ------*/
  getTasksForProject(projectId: string): Observable<TaskInterface[]> {
    return runInInjectionContext(this.injector, () => {
      const tasksRef = collection(this.firestore, 'tasks');
      const q = query(tasksRef, where('projectId', '==', projectId));

      return collectionData(q, { idField: 'id' }).pipe(
        map((res) => res as TaskInterface[]),
        catchError((error) => {
          console.error('ERROR loading tasks in TaskService:', error);
          return of([] as TaskInterface[]);
        })
      );
    });
  }

  // Ein einzelner Task als Live-Stream, null wenn nicht gefunden oder Fehler
  getTaskById(taskId: string): Observable<TaskInterface | null> {
    return runInInjectionContext(this.injector, () => {
      const taskRef = doc(this.firestore, 'tasks', taskId);

      return docData(taskRef, { idField: 'id' }).pipe(
        map((res) => (res ? (res as TaskInterface) : null)),
        catchError((error) => {
          console.error('ERROR loading task in TaskService:', error);
          return of(null);
        })
      );
    });
  }

  async updateTaskStep(taskId: string, newStep: string): Promise<void> {
    await runInInjectionContext(this.injector, () => {
      const taskRef = doc(this.firestore, 'tasks', taskId);
      return updateDoc(taskRef, {
        step: newStep,
        updatedAt: serverTimestamp(),
      });
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await runInInjectionContext(this.injector, () => {
      const taskRef = doc(this.firestore, 'tasks', taskId);
      return deleteDoc(taskRef);
    });
  }

  /*------ Helper ------*/
  getPrioIcon(prio: string): string {
    return PRIO_ICONS[prio] ?? PRIO_ICONS['medium'];
  }

  // Firestore liefert Timestamps, das Interface behauptet Date
  toMillis(value: unknown): number {
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return 0;
  }

  // Überfällig erst nach Ablauf des Fälligkeitstages, erledigte Tasks zählen nicht
  isTaskOverdue(task: TaskInterface): boolean {
    if (task.step === 'done') {
      return false;
    }

    const due = this.toMillis(task.dueDate);
    if (!due) {
      return false;
    }

    const endOfDueDay = new Date(due);
    endOfDueDay.setHours(23, 59, 59, 999);
    return endOfDueDay.getTime() < Date.now();
  }
}
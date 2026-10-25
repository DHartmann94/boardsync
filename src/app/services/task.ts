import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, query, where, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { TaskInterface } from '../models/task';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

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

  async updateTaskStep(taskId: string, newStep: string): Promise<void> {
    await runInInjectionContext(this.injector, () => {
      const taskRef = doc(this.firestore, 'tasks', taskId);
      return updateDoc(taskRef, {
        step: newStep,
        updatedAt: serverTimestamp(),
      });
    });
  }
}
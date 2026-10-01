import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, query, where, doc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { TaskInterface } from '../models/task';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly firestore = inject(Firestore);

  getTasksForProject(projectId: string): Observable<TaskInterface[]> {
    const tasksRef = collection(this.firestore, 'tasks');
    const q = query(tasksRef, where('projectId', '==', projectId));

    return collectionData(q, { idField: 'id' }).pipe(
      map((res) => res as TaskInterface[]),
      catchError((error) => {
        console.error('ERROR loading tasks in TaskService:', error);
        // Wir geben ein leeres Array zurück, damit das Observable nicht abbricht ("stirbt")
        return of([]);
      })
    );
  }

  async updateTaskStep(taskId: string, newStep: string): Promise<void> {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    await updateDoc(taskRef, {
      step: newStep,
      updatedAt: serverTimestamp(),
    });
  }
}
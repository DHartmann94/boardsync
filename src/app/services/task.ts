import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  deleteDoc,
  docData,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Observable, catchError, from, map, of } from 'rxjs';
import { SubtaskInterface, TaskInterface } from '../models/task';

export interface TaskFormValue {
  projectId: string;
  title: string;
  description: string;
  prio: string;
  categoryId: string;
  assignedToUser: string[];
  subtasks: SubtaskInterface[];
  dueDate: Date | null;
}

export type TaskForm = FormGroup<{
  projectId: FormControl<string>;
  title: FormControl<string>;
  description: FormControl<string>;
  prio: FormControl<string>;
  categoryId: FormControl<string>;
  assignedToUser: FormControl<string[]>;
  subtasks: FormControl<SubtaskInterface[]>;
  dueDate: FormControl<Date | null>;
}>;

export class TaskProjectDueDateError extends Error {
  constructor(readonly code: 'afterProjectEnd' | 'projectDueDateLoadFailed') {
    super(code);
  }
}

const dateNotInPastValidator: ValidatorFn = (
  control: AbstractControl<Date | null>,
): ValidationErrors | null => {
  const date = control.value;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate < today ? { pastDate: true } : null;
};

const nonWhitespaceValidator: ValidatorFn = (control): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

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

  createTaskForm(value: Partial<TaskFormValue> = {}): TaskForm {
    const form = new FormGroup({
      projectId: new FormControl(value.projectId ?? '', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      title: new FormControl(value.title ?? '', {
        nonNullable: true,
        validators: [nonWhitespaceValidator, Validators.maxLength(50)],
      }),
      description: new FormControl(value.description ?? '', { nonNullable: true }),
      prio: new FormControl(value.prio ?? 'medium', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      categoryId: new FormControl(value.categoryId ?? '', { nonNullable: true }),
      assignedToUser: new FormControl(value.assignedToUser ?? [], { nonNullable: true }),
      subtasks: new FormControl(value.subtasks ?? [], { nonNullable: true }),
      dueDate: new FormControl<Date | null>(value.dueDate ?? null, {
        validators: [Validators.required, dateNotInPastValidator],
        asyncValidators: [(control) => this.validateProjectDueDate(control)],
      }),
    });
    form.controls.projectId.valueChanges.subscribe(() => {
      form.controls.dueDate.updateValueAndValidity();
    });
    form.controls.dueDate.updateValueAndValidity({ emitEvent: false });
    return form;
  }

  async createTask(value: TaskFormValue): Promise<void> {
    const payload = this.toPayload(value);
    await this.assertTaskDueDateWithinProject(value);

    await runInInjectionContext(this.injector, () => {
      const taskRef = doc(collection(this.firestore, 'tasks'));
      return setDoc(taskRef, {
        id: taskRef.id,
        ...payload,
        step: 'todo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  async updateTask(taskId: string, value: TaskFormValue): Promise<void> {
    const payload = this.toPayload(value);
    await this.assertTaskDueDateWithinProject(value);

    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'tasks', taskId), {
        ...payload,
        updatedAt: serverTimestamp(),
      }),
    );
  }

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

  async getUnfinishedTaskAssignees(projectId: string, userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }

    return runInInjectionContext(this.injector, async () => {
      const tasksRef = collection(this.firestore, 'tasks');
      const tasksQuery = query(tasksRef, where('projectId', '==', projectId));
      const snapshot = await getDocs(tasksQuery);
      const userIdSet = new Set(userIds);

      return new Set(
        snapshot.docs
          .map((task) => task.data() as TaskInterface)
          .filter((task) => task.step !== 'done')
          .flatMap((task) => task.assignedToUser)
          .filter((userId) => userIdSet.has(userId)),
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

  private toPayload(
    value: TaskFormValue,
  ): Omit<TaskInterface, 'id' | 'createdAt' | 'updatedAt' | 'step'> {
    if (!value.projectId.trim()) {
      throw new Error('A task project is required.');
    }
    if (!value.title.trim()) {
      throw new Error('A task title is required.');
    }
    if (value.title.length > 50) {
      throw new Error('A task title must not exceed 50 characters.');
    }
    if (!value.dueDate || Number.isNaN(value.dueDate.getTime())) {
      throw new Error('A valid task due date is required.');
    }

    return {
      projectId: value.projectId,
      title: value.title.trim(),
      description: value.description.trim(),
      prio: value.prio,
      categoryId: value.categoryId,
      assignedToUser: [...new Set(value.assignedToUser)],
      subtasks: value.subtasks.map((subtask) => ({ ...subtask, title: subtask.title.trim() })),
      dueDate: value.dueDate,
    };
  }

  private validateProjectDueDate(
    control: AbstractControl<Date | null>,
  ): Observable<ValidationErrors | null> {
    const projectId = control.parent?.get('projectId')?.value;
    const dueDate = control.value;
    if (typeof projectId !== 'string' || !projectId || !dueDate || Number.isNaN(dueDate.getTime())) {
      return of(null);
    }

    return from(this.getProjectDueDate(projectId)).pipe(
      map((projectDueDate) =>
        this.isAfterCalendarDay(dueDate, projectDueDate) ? { afterProjectEnd: true } : null,
      ),
      catchError((error: unknown) => {
        console.error('Failed to validate task due date against project end date', error);
        return of({ projectDueDateLoadFailed: true });
      }),
    );
  }

  private async assertTaskDueDateWithinProject(value: TaskFormValue): Promise<void> {
    let projectDueDate: Date;
    try {
      projectDueDate = await this.getProjectDueDate(value.projectId);
    } catch (error) {
      console.error('Failed to load project end date before writing task', error);
      throw new TaskProjectDueDateError('projectDueDateLoadFailed');
    }

    if (value.dueDate && this.isAfterCalendarDay(value.dueDate, projectDueDate)) {
      throw new TaskProjectDueDateError('afterProjectEnd');
    }
  }

  private async getProjectDueDate(projectId: string): Promise<Date> {
    const projectSnapshot = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'projects', projectId)),
    );
    if (!projectSnapshot.exists()) {
      throw new Error(`Project ${projectId} does not exist.`);
    }

    const value: unknown = projectSnapshot.data()['dueDate'];
    const date =
      value instanceof Timestamp
        ? value.toDate()
        : value instanceof Date
          ? value
          : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new Error(`Project ${projectId} has no valid due date.`);
    }
    return date;
  }

  private isAfterCalendarDay(date: Date, projectDueDate: Date): boolean {
    const taskDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const projectDay = new Date(
      projectDueDate.getFullYear(),
      projectDueDate.getMonth(),
      projectDueDate.getDate(),
    ).getTime();
    return taskDay > projectDay;
  }
}
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { CategoryService } from '../../services/category';
import { NotificationService } from '../../services/notification';
import { TaskProjectDueDateError, TaskService } from '../../services/task';
import { UserService } from '../../services/user';

export interface TaskDetailsData {
  taskId: string;
}

@Component({
  selector: 'app-task-details',
  imports: [
    DatePipe,
    TranslatePipe,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './task-details.html',
  styleUrl: './task-details.scss',
})
export class TaskDetails {
  private readonly data = inject<TaskDetailsData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TaskDetails>);
  private readonly taskService = inject(TaskService);
  private readonly userService = inject(UserService);
  private readonly categoryService = inject(CategoryService);
  private readonly notificationService = inject(NotificationService);

  readonly task = toSignal(this.taskService.getTaskById(this.data.taskId), {
    initialValue: undefined,
  });
  readonly categories = this.categoryService.categories;
  readonly projectUsers = this.userService.projectUsers;
  readonly taskForm = this.taskService.createTaskForm();
  readonly today = new Date(new Date().setHours(0, 0, 0, 0));
  readonly isDeleting = signal(false);
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);
  readonly newSubtaskTitle = signal('');

  readonly category = computed(() => {
    const task = this.task();
    const categories = this.categoryService.categoryMap();
    if (!task || categories.size === 0) {
      return null;
    }
    return categories.get(task.categoryId) ?? { type: 'Unknown', color: 'var(--light-blue)' };
  });

  readonly dueDate = computed(() => {
    const millis = this.taskService.toMillis(this.task()?.dueDate);
    return millis ? new Date(millis) : null;
  });

  readonly isOverdue = computed(() => {
    const task = this.task();
    return task ? this.taskService.isTaskOverdue(task) : false;
  });

  readonly prioIcon = computed(() => this.taskService.getPrioIcon(this.task()?.prio ?? 'medium'));

  readonly assignedUsers = computed(() => {
    const assignedIds = this.task()?.assignedToUser ?? [];
    const state = this.userService.state();
    const currentId = state.status === 'ready' ? state.user.id : null;

    return this.userService
      .projectUsers()
      .filter((user) => assignedIds.includes(user.id))
      .map((user) => ({
        id: user.id,
        avatar: user.avatar || '?',
        fullName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        isOwn: user.id === currentId,
      }))
      .sort((a, b) => Number(b.isOwn) - Number(a.isOwn));
  });

  close(): void {
    if (this.isSaving()) {
      return;
    }
    this.dialogRef.close();
  }

  startEditing(): void {
    const task = this.task();
    if (!task || this.isSaving()) {
      return;
    }

    const dueDateMillis = this.taskService.toMillis(task.dueDate);
    this.taskForm.reset({
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      prio: task.prio,
      categoryId: task.categoryId,
      assignedToUser: [...task.assignedToUser],
      subtasks: task.subtasks.map((subtask) => ({ ...subtask })),
      dueDate: dueDateMillis ? new Date(dueDateMillis) : null,
    });
    this.newSubtaskTitle.set('');
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    if (this.isSaving()) {
      return;
    }
    this.isEditing.set(false);
    this.newSubtaskTitle.set('');
    this.taskForm.reset();
  }

  async saveChanges(): Promise<void> {
    const task = this.task();
    if (!task || this.isSaving()) {
      return;
    }
    if (this.taskForm.invalid || this.taskForm.pending) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    try {
      await this.taskService.updateTask(task.id, this.taskForm.getRawValue());
      this.isEditing.set(false);
      this.notificationService.showSuccess('taskDetail.updated');
    } catch (error) {
      console.error('Failed to update task', error);
      this.notificationService.showError(
        error instanceof TaskProjectDueDateError
          ? `addTaskForm.${error.code === 'afterProjectEnd' ? 'dueDateAfterProjectEnd' : 'projectDueDateLoadError'}`
          : 'taskDetail.errors.updateFailed',
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  updateSubtaskTitle(index: number, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const subtasks = this.taskForm.controls.subtasks.value.map((subtask, subtaskIndex) =>
      subtaskIndex === index ? { ...subtask, title: input.value } : subtask,
    );
    this.taskForm.controls.subtasks.setValue(subtasks);
  }

  setNewSubtaskTitle(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.newSubtaskTitle.set(input.value);
    }
  }

  updateSubtaskCompleted(index: number, completed: boolean): void {
    const subtasks = this.taskForm.controls.subtasks.value.map((subtask, subtaskIndex) =>
      subtaskIndex === index ? { ...subtask, completed } : subtask,
    );
    this.taskForm.controls.subtasks.setValue(subtasks);
  }

  addSubtask(): void {
    const title = this.newSubtaskTitle().trim();
    if (!title) {
      return;
    }

    const subtasks = this.taskForm.controls.subtasks.value;
    this.taskForm.controls.subtasks.setValue([
      ...subtasks,
      { id: String(subtasks.length + 1), title, completed: false },
    ]);
    this.newSubtaskTitle.set('');
  }

  removeSubtask(index: number): void {
    this.taskForm.controls.subtasks.setValue(
      this.taskForm.controls.subtasks.value.filter((_, subtaskIndex) => subtaskIndex !== index),
    );
  }

  confirmDelete(): void {
    const task = this.task();
    if (!task || this.isDeleting() || this.isSaving()) {
      return;
    }

    this.notificationService
      .openConfirmDialog(
        'taskDetail.deleteDialog.title',
        'taskDetail.deleteDialog.message',
        'taskDetail.delete',
        'general.cancel',
        { title: task.title },
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          void this.deleteTask(task.id);
        }
      });
  }

  private async deleteTask(taskId: string): Promise<void> {
    this.isDeleting.set(true);
    try {
      await this.taskService.deleteTask(taskId);
      this.notificationService.showSuccess('taskDetail.deleted');
      this.dialogRef.close();
    } catch (error) {
      console.error('Failed to delete task', error);
      this.notificationService.showError('taskDetail.errors.deleteFailed');
      this.isDeleting.set(false);
    }
  }
}

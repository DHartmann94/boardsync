import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';

import { CategoryService } from '../../services/category';
import { NotificationService } from '../../services/notification';
import { TaskService } from '../../services/task';
import { UserService } from '../../services/user';

export interface TaskDetailsData {
  taskId: string;
}

@Component({
  selector: 'app-task-details',
  imports: [
    DatePipe,
    TranslatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
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

  // undefined = lädt noch, null = nicht gefunden oder Fehler
  readonly task = toSignal(this.taskService.getTaskById(this.data.taskId), {
    initialValue: undefined,
  });

  readonly isDeleting = signal(false);

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

  // Zugeordnete User des Projekts, der eigene User steht zuerst
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
    this.dialogRef.close();
  }

  confirmDelete(): void {
    const task = this.task();
    if (!task || this.isDeleting()) {
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
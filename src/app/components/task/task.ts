import { Component, Input, inject } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { TaskInterface, SubtaskInterface } from '../../models/task';
import { UserService } from '../../services/user';
import { CategoryService } from '../../services/category';
import { TaskService } from '../../services/task';

const MAX_VISIBLE_AVATARS = 4;

@Component({
  selector: 'app-task',
  imports: [
    MatCardModule,
    MatProgressBarModule,
  ],
  templateUrl: './task.html',
  styleUrl: './task.scss',
})
export class Task {
  private readonly userService = inject(UserService);
  private readonly categoryService = inject(CategoryService);
  private readonly taskService = inject(TaskService);

  @Input({ required: true })
  task!: TaskInterface;

  // Fälligkeitsdatum überschritten (erledigte Tasks zählen nicht)
  get isOverdue(): boolean {
    return this.taskService.isTaskOverdue(this.task);
  }

  // Alle zugeordneten User des Projekts, der eigene User steht zuerst
  get assignedUsers() {
    const assignedIds = this.task.assignedToUser ?? [];
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
  }

  get visibleUsers() {
    return this.assignedUsers.slice(0, MAX_VISIBLE_AVATARS);
  }

  get hiddenUsers() {
    return this.assignedUsers.slice(MAX_VISIBLE_AVATARS);
  }

  get hiddenNames(): string {
    return this.hiddenUsers.map((user) => user.fullName).join(', ');
  }

  get completedSubtasks(): number {
    return this.task.subtasks
      ?.filter((subtask: SubtaskInterface) => subtask.completed)
      .length ?? 0;
  }

  get totalSubtasks(): number {
    return this.task.subtasks?.length ?? 0;
  }

  get progress(): number {
    if (this.totalSubtasks === 0) {
      return 0;
    }

    return (this.completedSubtasks / this.totalSubtasks) * 100;
  }

  get category() {
    const categories = this.categoryService.categoryMap();
    if (categories.size === 0) {
      return null;
    }
    return categories.get(this.task.categoryId) ?? { type: 'Unknown', color: 'var(--light-blue)' };
  }

  get prioIcon(): string {
    return this.taskService.getPrioIcon(this.task.prio);
  }
}
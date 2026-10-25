import { Component, Input, inject } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { TaskInterface, SubtaskInterface } from '../../models/task';
import { UserService } from '../../services/user';
import { CategoryService } from '../../services/category';

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

  @Input({ required: true })
  task!: TaskInterface;

  private readonly prioIcons: Record<string, string> = {
    low: 'assets/img/icons/add-task-low.svg',
    medium: 'assets/img/icons/add-task-medium.svg',
    urgent: 'assets/img/icons/add-task-urgent.svg',
  };

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
    return this.categoryService.categoryMap().get(this.task.categoryId);
  }

  get prioIcon(): string {
    return this.prioIcons[this.task.prio] ?? this.prioIcons['medium'];
  }
}
import { Component, Input, computed, inject } from '@angular/core';

import { NgClass } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { TaskInterface, SubtaskInterface } from '../../models/task';
import { UserService } from '../../services/user';

@Component({
  selector: 'app-task',
  imports: [
    NgClass,
    MatCardModule,
    MatProgressBarModule,
  ],
  templateUrl: './task.html',
  styleUrl: './task.scss',
})
export class Task {
  private readonly userService = inject(UserService);

  @Input({ required: true })
  task!: TaskInterface;

  // Filtert die User des Projekts für die Avatare auf der Task-Karte
  readonly assignedUsers = computed(() => {
    const projectMembers = this.userService.projectUsers();
    const assignedIds = this.task.assignedToUser ?? [];
    return projectMembers.filter((user) => assignedIds.includes(user.id));
  });

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

    return (
      this.completedSubtasks /
      this.totalSubtasks
    ) * 100;
  }

  // Todo Noch Platzhalter
  get categoryClass(): string {
    return this.task.categoryId === 'technical-task'
      ? 'task-card__badge--technical'
      : 'task-card__badge--story';
  }

  get categoryLabel(): string {
    return this.task.categoryId === 'technical-task'
      ? 'Technical Task'
      : 'User Story';
  }

}

import { DatePipe } from '@angular/common';
import { Component, Injector, computed, inject, runInInjectionContext, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { deleteDoc, doc, Firestore } from '@angular/fire/firestore';
import { TranslatePipe } from '@ngx-translate/core';

import { NotificationService } from '../../services/notification';
import { UserService } from '../../services/user';
import { ProjectInterface } from '../../models/project';

export interface ProjectDetailsData {
  project: ProjectInterface;
}

/** Firestore liefert Timestamps, das Modell sagt Date: beides sicher in Date umwandeln. */
function toDate(value: Date | { toDate(): Date } | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value : value.toDate();
}

@Component({
  selector: 'app-project-details',
  imports: [
    DatePipe,
    TranslatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './project-details.html',
  styleUrl: './project-details.scss',
})
export class ProjectDetails {
  private readonly data = inject<ProjectDetailsData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProjectDetails>);
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);

  readonly project = signal<ProjectInterface | null>(this.data.project);

  readonly isDeleting = signal(false);

  readonly dueDate = computed(() => toDate(this.project()?.dueDate));
  readonly createdAt = computed(() => toDate(this.project()?.createdAt));

  readonly isOverdue = computed(() => {
    const project = this.project();
    const due = this.dueDate();
    if (!project || project.completed || !due) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  });

  // Nur der Owner darf löschen
  readonly canDelete = computed(() => {
    const project = this.project();
    const state = this.userService.state();
    return !!project && state.status === 'ready' && state.user.id === project.ownerId;
  });

  // Mitglieder des Projekts, der eigene User steht zuerst
  readonly members = computed(() => {
    const memberIds = this.project()?.memberIds ?? [];
    const state = this.userService.state();
    const currentId = state.status === 'ready' ? state.user.id : null;

    return this.userService
      .projectUsers()
      .filter((user) => memberIds.includes(user.id))
      .map((user) => ({
        id: user.id,
        avatar: user.avatar || '?',
        fullName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        isOwn: user.id === currentId,
      }))
      .sort((a, b) => Number(b.isOwn) - Number(a.isOwn));
  });

  readonly owner = computed(() => {
    const ownerId = this.project()?.ownerId;
    return this.members().find((user) => user.id === ownerId) ?? null;
  });

  close(): void {
    this.dialogRef.close();
  }

  confirmDelete(): void {
    const project = this.project();
    if (!project || !this.canDelete() || this.isDeleting()) {
      return;
    }

    this.notificationService
      .openConfirmDialog(
        'projectDetail.deleteDialog.title',
        'projectDetail.deleteDialog.message',
        'projectDetail.delete',
        'general.cancel',
        { title: project.title },
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          void this.deleteProject(project.id);
        }
      });
  }

  private async deleteProject(projectId: string): Promise<void> {
    this.isDeleting.set(true);
    try {
      await runInInjectionContext(this.injector, () =>
        deleteDoc(doc(this.firestore, 'projects', projectId)),
      );
      this.notificationService.showSuccess('projectDetail.deleted');
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to delete project', error);
      this.notificationService.showError('projectDetail.errors.deleteFailed');
      this.isDeleting.set(false);
    }
  }
}
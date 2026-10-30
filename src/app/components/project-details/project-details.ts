import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { NotificationService } from '../../services/notification';
import { ProjectService } from '../../services/project';
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
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './project-details.html',
  styleUrl: './project-details.scss',
})
export class ProjectDetails {
  private readonly data = inject<ProjectDetailsData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProjectDetails>);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private readonly projectServices = inject(ProjectService);

  readonly project = signal<ProjectInterface | null>(this.data.project);
  readonly isDeleting = signal(false);
  readonly isEditing = signal(false);
  readonly isSaving = signal(false);
  readonly today = new Date(new Date().setHours(0, 0, 0, 0));
  readonly projectForm = this.projectServices.createProjectForm();

  users: { id: string; displayName: string }[] = [];

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
  readonly canEdit = this.canDelete;

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

  async ngOnInit(): Promise<void> {
    const allUsers = await this.userService.getallUsers();
    this.users = allUsers.map((user) => ({
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    }));
    this.projectForm.markAllAsTouched();
  }

  close(): void {
    this.dialogRef.close();
  }

  startEditing(): void {
    const project = this.project();
    if (!project || !this.canEdit() || this.isSaving()) {
      return;
    }

    this.projectForm.reset({
      title: project.title,
      description: project.description,
      memberIds: [...project.memberIds],
      dueDate: toDate(project.dueDate),
    });
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    if (this.isSaving()) {
      return;
    }
    this.isEditing.set(false);
    this.projectForm.reset();
  }

  async saveChanges(): Promise<void> {
    const project = this.project();
    if (!project || !this.canEdit() || this.isSaving()) {
      return;
    }
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const formValue = this.projectForm.getRawValue();
    if (!formValue.dueDate) {
      this.projectForm.controls.dueDate.markAsTouched();
      return;
    }

    this.isSaving.set(true);
    try {
      await this.projectServices.updateProject(project, formValue);
      const updatedProject = {
        ...project,
        title: formValue.title.trim(),
        description: formValue.description.trim(),
        memberIds: [...new Set([...formValue.memberIds, project.ownerId])],
        dueDate: formValue.dueDate,
        updatedAt: new Date(),
      };
      this.project.set(updatedProject);
      await this.userService.loadUsersForProject(updatedProject.memberIds);
      this.isEditing.set(false);
      this.notificationService.showSuccess('projectDetail.updated');
    } catch (error) {
      console.error('Failed to update project', error);
      this.notificationService.showError('projectDetail.errors.updateFailed');
    } finally {
      this.isSaving.set(false);
    }
  }

  getUserDisplayName(userId: string): string {
    return this.users.find((user) => user.id === userId)?.displayName ?? userId;
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
      await this.projectServices.deleteProject(projectId);
      this.notificationService.showSuccess('projectDetail.deleted');
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to delete project', error);
      this.notificationService.showError('projectDetail.errors.deleteFailed');
      this.isDeleting.set(false);
    }
  }
}

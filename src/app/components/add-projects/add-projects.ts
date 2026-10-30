import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { NotificationService } from '../../services/notification';
import { ProjectService } from '../../services/project';
import { UserService } from '../../services/user';

@Component({
  selector: 'app-add-projects',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './add-projects.html',
  styleUrl: './add-projects.scss',
})
export class AddProjects {
  readonly today = new Date(new Date().setHours(0, 0, 0, 0));
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private readonly projectServices = inject(ProjectService);

  users: { id: string; displayName: string }[] = [];
  isSubmitting = false;

  readonly projectForm = this.projectServices.createProjectForm();

  async ngOnInit(): Promise<void> {
    const allUsers = await this.userService.getallUsers();
    this.users = allUsers.map((user) => ({
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
    }));

    const currentUser = this.userService.currentUser();
    if (currentUser) {
      this.projectForm.controls.memberIds.setValue([currentUser.id]);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.projectForm.invalid || this.isSubmitting) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const currentUser = this.userService.currentUser();
    if (!currentUser) {
      this.notificationService.showError('addProjectForm.projectCreateError');
      return;
    }

    const formValue = this.projectForm.getRawValue();
    if (!formValue.dueDate) {
      this.projectForm.controls.dueDate.markAsTouched();
      return;
    }

    this.isSubmitting = true;
    try {
      await this.projectServices.createProject(formValue, currentUser.id);
      this.notificationService.showSuccess('addProjectForm.projectCreated');
      this.onClear();
    } catch (error) {
      console.error('Error adding project: ', error);
      this.notificationService.showError('addProjectForm.projectCreateError', 3000);
    } finally {
      this.isSubmitting = false;
    }
  }

  getUserDisplayName(userId: string): string {
    return this.users.find((user) => user.id === userId)?.displayName ?? userId;
  }

  onClear(): void {
    this.projectForm.reset({
      title: '',
      description: '',
      memberIds: [],
      dueDate: null,
    });
  }
}

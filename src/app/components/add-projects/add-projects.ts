import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Firestore, collection, doc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import type { CreateProjectPayload, ProjectInterface } from '../../models/project';
import { NotificationService } from '../../services/notification';
import { UserService } from '../../services/user';

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
  private readonly firestore = inject(Firestore);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);

  users: { id: string; displayName: string }[] = [];
  isSubmitting = false;

  readonly projectForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [nonWhitespaceValidator] }),
    description: new FormControl('', { nonNullable: true }),
    memberIds: new FormControl<string[]>([], { nonNullable: true }),
    dueDate: new FormControl<Date | null>(null, {
      validators: [Validators.required, dateNotInPastValidator],
    }),
  });

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

    const { title, description, memberIds, dueDate } = this.projectForm.getRawValue();
    if (!dueDate) {
      this.projectForm.controls.dueDate.markAsTouched();
      return;
    }

    const projectRef = doc(collection(this.firestore, 'projects'));
    const payload: CreateProjectPayload = {
      title: title.trim(),
      description: description.trim(),
      ownerId: currentUser.id,
      memberIds: [...new Set([...memberIds, currentUser.id])],
      dueDate,
      completed: false,
    };
    const project: ProjectInterface = {
      id: projectRef.id,
      ...payload,
      createdAt: serverTimestamp() as unknown as Date,
      updatedAt: serverTimestamp() as unknown as Date,
    };

    this.isSubmitting = true;
    try {
      await setDoc(projectRef, project);
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
    const currentUser = this.userService.currentUser();
    this.projectForm.reset({
      title: '',
      description: '',
      memberIds:  [],
      dueDate: null,
    });
  }
}

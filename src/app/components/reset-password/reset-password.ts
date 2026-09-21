import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TranslatePipe } from '@ngx-translate/core';

import { HeaderPublic } from '../../components/header-public/header-public';
import { FooterPublic } from '../../components/footer-public/footer-public';
import { AuthenticationService } from '../../services/authentication';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    HeaderPublic,
    FooterPublic
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {

  private readonly authenticationService = inject(AuthenticationService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly isReset = signal(false);

  protected readonly resetPasswordForm = this.fb.group({
    email: this.fb.control('', [
      Validators.required,
      Validators.pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/),
    ]),
  });

  async resetPassword(): Promise<void> {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }
    this.isReset.set(true);

    const emailLowerCase = this.resetPasswordForm.value.email?.toLowerCase() ?? '';
    await this.sendPasswordResetEmail(emailLowerCase);
  }

  async sendPasswordResetEmail(emailLowerCase: string): Promise<void> {
    try {
      await this.authenticationService.sendPasswordReset(emailLowerCase);

      this.notificationService.showSuccess('resetPassword.success', 0);
      this.resetForm();
      this.router.navigateByUrl('/sign-in');

    } catch (error: any) {
      console.error('Error during password reset process:', error);

      if (error.code === 'auth/too-many-requests') {
        this.notificationService.showError('general.errors.tooManyRequests');
        this.isReset.set(false);
      } else {
        this.handleResetFailure();
      }
    }
  }

  private handleResetFailure(): void {
    this.notificationService.showError('general.errors.failure');
    this.isReset.set(false);
  }

  /*------ Help functions ------*/
  resetForm() {
    this.resetPasswordForm.reset();
    this.isReset.set(false);
  }

  navigateBack(): void {
    this.location.back();
  }
}
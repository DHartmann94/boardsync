import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRipple } from '@angular/material/core';

import { TranslatePipe } from '@ngx-translate/core';

import { Authentication } from '../../services/authentication';
import { Notification } from '../../services/notification';
import { HeaderPublic } from '../../components/header-public/header-public';
import { FooterPublic } from '../../components/footer-public/footer-public';

@Component({
  selector: 'app-sign-in',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRipple,
    TranslatePipe,
    HeaderPublic,
    FooterPublic
  ],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignIn {

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authenticationService = inject(Authentication);
  private readonly notificationService = inject(Notification);
  private readonly router = inject(Router);

  protected readonly isSignIn = signal(false);

  protected readonly signInForm = this.fb.group({
    email: this.fb.control('', [
      Validators.required,
      Validators.pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/),
    ]),
    password: this.fb.control('', Validators.required),
  });

  async signIn(): Promise<void> {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.isSignIn.set(true);

    try {
      const { email, password } = this.signInForm.getRawValue();
      await this.authenticationService.signAsUser(email, password);

      this.router.navigateByUrl('/main');

    } catch (error: any) {
      switch (error.code) {
        case 'auth/email-not-verified': {
          const currentUser = error.user;

          this.signInForm.controls.email.setErrors({ emailNotVerify: true });
          this.signInForm.controls.email.markAsTouched();

          this.notificationService.openConfirmDialog(
            'signIn.emailNotVerifiedTitle',
            'signIn.emailNotVerifiedMessage',
            'signIn.resendEmail',
            'general.close',
            undefined,
            currentUser ? () => this.authenticationService.sendVerificationMail(currentUser) : undefined
          ).subscribe((success) => {
            if (success) {
              this.notificationService.showSuccess('signIn.verificationSent');
            } else if (success === false && currentUser) {
              // false kann jetzt zwei Dinge bedeuten: Abbruch ODER Mail-Versand fehlgeschlagen
              this.notificationService.showError('general.errors.failure');
            }
            // success === undefined/null → User hat abgebrochen, keine Meldung nötig
          });
          break;
        }

        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          this.notificationService.showError("signIn.errors.userNotFound");
          break;

        case 'auth/too-many-requests':
          this.notificationService.showError("general.errors.tooManyRequests");
          break;

        default:
          this.notificationService.showError('general.errors.failure');
      }
    } finally {
      this.isSignIn.set(false);
    }
  }

  async signInGuest() {
    //   this.isSignIn.set(true);
    //   try {
    //     await this.authenticationService.signInAsGuest();
    //     // User wird um user.service effect geladen
    //     //await this.userService.getCurrentUser(); Wird im effect getriggert
    //   } catch (error: any) {
    //     this.notification.showError('auth.guestLoginFailed');
    //     // oder: this.userNotFound.set(true); je nach Fehlerfall differenzieren
    //   } finally {
    //     this.isSignIn.set(false);
    //   }
  }

}
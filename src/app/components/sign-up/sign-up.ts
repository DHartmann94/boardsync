import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { TranslatePipe } from '@ngx-translate/core';

import { HeaderPublic } from '../../components/header-public/header-public';
import { FooterPublic } from '../../components/footer-public/footer-public';
import { Validation } from '../../services/validation';
import { Authentication } from '../../services/authentication';
import { Notification } from '../../services/notification';
import { User } from '../../services/user';


@Component({
  selector: 'app-sign-up',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    HeaderPublic,
    FooterPublic
  ],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp {

  private readonly validationService = inject(Validation);
  private readonly authenticationService = inject(Authentication);
  private readonly notificationService = inject(Notification);
  private readonly userService = inject(User);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly location = inject(Location);
  private readonly router = inject(Router);


  protected readonly isSignUp = signal(false);

  protected readonly signUpForm = this.fb.group(
    {
      firstName: this.fb.control('', [Validators.required]),
      lastName: this.fb.control('', [Validators.required]),
      email: this.fb.control('', [
        Validators.required,
        Validators.pattern(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/),
      ]),
      phone: ['', [Validators.pattern(/^\+?\(?\d{1,4}\)?[\s./\d-]*$/)]],
      // Groß-/Kleinbuchstabe, Zahl, Sonderzeichen
      password: this.fb.control('', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/)
      ]),
      confirmPassword: this.fb.control('', [Validators.required]),
      privacyPolicy: this.fb.control(false, [Validators.requiredTrue]),
    },
    {
      validators: [this.validationService.passwordMatchValidator]
    }
  );

  async signUp(): Promise<void> {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      return;
    }
    this.isSignUp.set(true);

    await this.createUser(this.signUpForm.value.email?.toLowerCase() ?? '');
  }

  async createUser(emailLowerCase: string): Promise<void> {
    let createdUser: any = null;

    try {
      const firstName = this.signUpForm.value.firstName ?? '';
      const lastName = this.signUpForm.value.lastName ?? '';
      const password = this.signUpForm.value.password ?? '';
      const phone = this.signUpForm.value.phone ?? '';
      const avatar = this.userService.generateInitialsAvatar(firstName, lastName);

      const authResult = await this.authenticationService.sendUserToAuthenticator(emailLowerCase, password);
      // Geht automatisch in den Catch wenn kein User erstellt werden kann (z.B. gleiche Mail)
      createdUser = authResult.user;
      const authUID = authResult.uid;

      const userFirestore = await this.userService.createUserDocument(authUID, {
        firstName, lastName, email: emailLowerCase, phone, avatar
      });

      if (userFirestore) {
        this.notificationService.showSuccess('signUp.success');
        this.resetForm();
        this.router.navigateByUrl('/sign-in');
      } else {
        await this.authenticationService.deleteUserInstance(createdUser);
        this.handleSignUpFailure();
      }

    } catch (error: any) {
      console.error('Error during creation process:', error);
      if (createdUser) {
        await this.authenticationService.deleteUserInstance(createdUser);
      }

      switch (error.code) {
        case 'auth/email-already-in-use':
          this.signUpForm.controls.email.setErrors({ emailExists: true });
          this.signUpForm.controls.email.markAsTouched();
          this.isSignUp.set(false);
          break;

        case 'auth/too-many-requests':
          this.notificationService.showError('signUp.errors.tooManyRequests');
          this.isSignUp.set(false);
          break;

        default:
          this.handleSignUpFailure();
      }
    }
  }

  private handleSignUpFailure(): void {
    this.notificationService.showError('signUp.errors.failure');
    this.isSignUp.set(false);
  }


  /*------ Help functions ------*/
  resetForm() {
    setTimeout(() => {
      this.signUpForm.reset();
      this.isSignUp.set(false);
    }, 1000);
  }

  navigateBack(): void {
    this.location.back();
  }
}
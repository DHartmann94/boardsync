import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRipple } from '@angular/material/core';

import { TranslatePipe } from '@ngx-translate/core';

import { Authentication } from '../../services/authentication';
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
  protected readonly authentication = inject(Authentication);

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

    // this.disableForm();

    // try {
    //   const { email, password } = this.signInForm.getRawValue();
    //   await this.authentication.login(email, password);
    //   // Erfolgreicher Login -> Weiterleitung
    // } catch (error: any) {
    //   if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
    //     this.signInForm.controls.password.setErrors({ userNotFound: true });
    //   } else if (error.code === 'auth/email-not-verified') {
    //     this.signInForm.controls.email.setErrors({ emailNotVerify: true });
    //   }
    // } finally {
    //   this.enableForm();
    // }
  }


  async signInGuest() {
    //   this.disableForm();
    //   try {
    //     await this.authentication.signInAsGuest();
    //     // User wird um user.service effect geladen
    //     //await this.userService.getCurrentUser(); Wird im effect getriggert
    //   } catch (error: any) {
    //     this.notification.showError('auth.guestLoginFailed');
    //     // oder: this.userNotFound.set(true); je nach Fehlerfall differenzieren
    //   } finally {
    //     this.enableForm();
    //   }
  }



  /*------ Help functions ------*/
  disableForm(): void {
    this.signInForm.disable();
    this.isSignIn.set(true);
  }

  enableForm(): void {
    setTimeout(() => {
      this.signInForm.enable();
      this.isSignIn.set(false);
    }, 3500);
  }

}
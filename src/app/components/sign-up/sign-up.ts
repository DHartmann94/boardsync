import { Component, inject, signal, OnInit } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
export class SignUp implements OnInit {

  private readonly validation = inject(Validation);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly location = inject(Location);

  protected readonly isSignUp = signal(false);
  protected readonly emailExistsError = signal(false);

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
      validators: [this.validation.passwordMatchValidator]
    }
  );


  ngOnInit(): void {
    // Sobald sich der Wert im E-Mail-Feld ändert, den Fehler zurücksetzen
    this.signUpForm.get('email')?.valueChanges.subscribe(() => {
      if (this.emailExistsError()) {
        this.emailExistsError.set(false);
      }
    });
  }

  async signUp(): Promise<void> {
    if (this.signUpForm.invalid) {
      return;
    }
    this.disableForm();

    await this.checkSignUp();
  }


  async checkSignUp(): Promise<void> {
    const emailLowerCase: string = this.signUpForm.value.email?.toLowerCase() || '';

    if (await this.validation.emailExistsValidator(emailLowerCase)) {
      this.emailExistsError.set(true);
      this.signUpForm.enable();
      this.isSignUp.set(false);
      return;
    }

    // await this.createUser(emailLowerCase);
  }


  /*------ Help functions ------*/
  disableForm(): void {
    this.signUpForm.disable();
    this.isSignUp.set(true);
  }


  enableForm(): void {
    setTimeout(() => {
      this.signUpForm.enable();
      this.isSignUp.set(false);
    }, 3500);
  }

  navigateBack(): void {
    this.location.back();
  }
}
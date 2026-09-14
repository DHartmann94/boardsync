import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { getAuth, fetchSignInMethodsForEmail } from 'firebase/auth';


@Injectable({
  providedIn: 'root',
})
export class Validation {

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    const mismatch = password.value !== confirmPassword.value;

    confirmPassword.setErrors(mismatch ? { passwordMismatch: true } : null);

    return mismatch ? { passwordMismatch: true } : null;
  }

  async emailExistsValidator(emailLowerCase: string): Promise<boolean> {
    const auth = getAuth();

    try {
      const emailResult = await fetchSignInMethodsForEmail(auth, emailLowerCase);
      return emailResult.length > 0;
    } catch (error) {
      console.log('Error check e-Mail exists: ', error);
      return true;
    }
  }

}

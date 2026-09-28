import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';

@Injectable({
  providedIn: 'root',
})
export class ValidationService {

  /**
   * Validiert, ob das Passwort und das Bestätigungspasswort übereinstimmen.
   * 
   * @param control Das zu validierende Formulargruppen-Control.
   * @returns Ein Validierungsfehler-Objekt bei Nicht-Übereinstimmung, andernfalls `null`.
   */
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

}

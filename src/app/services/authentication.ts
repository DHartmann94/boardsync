import { Injectable, inject, Injector, Signal, runInInjectionContext } from '@angular/core';
import { Auth, user, User, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendEmailVerification, deleteUser, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {

  private readonly auth = inject(Auth);
  private readonly injector = inject(Injector);

  readonly authUser: Signal<User | null | undefined>;

  constructor() {
    /**
     * Signal für den aktuellen Firebase-Auth-Status:
     * - undefined : Anfangszustand (Firebase löst den Login nach einem Seiten-Reload/F5 noch auf)
     * - null      : User ist ausgeloggt
     * - User      : Authentifizierter Firebase-User
     */
    this.authUser = toSignal<User | null | undefined>(user(this.auth), {
      initialValue: undefined
    });
  }

  /**
   * Meldet einen Benutzer mit E-Mail und Passwort an.
   * 
   * Überprüft nach dem Login, ob die E-Mail-Adresse verifiziert wurde. 
   * Ist dies nicht der Fall, wird der Benutzer abgemeldet und ein Fehler ausgelöst.
   * 
   * @param email Die E-Mail-Adresse des Benutzers.
   * @param password Das Passwort des Benutzers.
   * @returns Ein Promise, das das angemeldete User-Objekt zurückgibt.
   */
  async signInAsUser(email: string, password: string): Promise<User> {
    try {
      const userCredential = await runInInjectionContext(this.injector, () =>
        signInWithEmailAndPassword(this.auth, email, password)
      );
      const user = userCredential.user;

      if (!user.emailVerified) {
        const error: any = new Error('Email is not verified.');
        error.code = 'auth/email-not-verified';
        error.user = user;
        await this.signOutUser();
        throw error;
      }

      return user;
    } catch (error: any) {
      console.error('ERROR during login:', error.code, error.message);
      throw error;
    }
  }

  /**
   * Meldet einen Benutzer über ein Google-Popup an.
   * 
   * @returns Ein Promise, das das angemeldete User-Objekt zurückgibt.
   */
  async signInWithGoogle(): Promise<User> {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await runInInjectionContext(this.injector, () =>
        signInWithPopup(this.auth, provider)
      );

      return userCredential.user;
    } catch (error: any) {
      console.error('ERROR during Google login:', error.code, error.message);
      throw error;
    }
  }

  // async signInAsGuest() {
  //   try {
  //     await signOut(this.auth);
  //     const userCredential = await signInAnonymously(this.auth);
  //     return userCredential.user;
  //   } catch (error: any) {
  //     console.error('ERROR signInAsGuest:', error);
  //     throw error;
  //   }
  // }

  async signOutUser(): Promise<void> {
    try {
      await runInInjectionContext(this.injector, () => signOut(this.auth));
    } catch (error: any) {
      console.error('ERROR during sign out:', error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Firebase-Auth-Benutzer mit E-Mail und Passwort
   * und sendet eine E-Mail zur Verifizierung.
   * 
   * @param emailLowerCase Die E-Mail-Adresse des Benutzers in Kleinbuchstaben.
   * @param password Das Passwort für den neuen Account.
   * @returns Ein Promise, das die UID und das User-Objekt zurückgibt.
   */
  async sendUserToAuthenticator(emailLowerCase: string, password: string): Promise<{ uid: string; user: User }> {
    const userCredential = await runInInjectionContext(this.injector, () =>
      createUserWithEmailAndPassword(this.auth, emailLowerCase, password)
    );
    const user = userCredential.user;

    await this.sendVerificationMail(user);

    return { uid: user.uid, user };
  }

  /**
   * Sendet eine E-Mail zur Verifizierung an den angegebenen Benutzer.
   * 
   * @param user Der Benutzer, an den die Verifizierungs-E-Mail gesendet werden soll.
   * @returns Ein Promise, das `true` bei Erfolg oder `false` im Fehlerfall zurückgibt.
   */
  async sendVerificationMail(user: User): Promise<boolean> {
    try {
      await runInInjectionContext(this.injector, () => sendEmailVerification(user));
      return true;
    } catch (error: any) {
      console.error('ERROR email verification:', error);
      return false;
    }
  }

  /**
   * Löscht die angegebene Instanz des authentifizierten Benutzers (Rollback).
   * 
   * @param user Der zu löschende Firebase-User.
   */
  async deleteUserInstance(user: User): Promise<void> {
    try {
      await runInInjectionContext(this.injector, () => deleteUser(user));
    } catch (error: any) {
      console.error('ERROR deleting auth user during rollback:', error);
    }
  }

  /**
   * Sendet eine E-Mail zum Zurücksetzen des Passworts an die angegebene Adresse.
   * 
   * @param email Die E-Mail-Adresse des Benutzers.
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await runInInjectionContext(this.injector, () => sendPasswordResetEmail(this.auth, email));
    } catch (error: any) {
      console.error('ERROR password reset:', error);
      throw error;
    }
  }

}
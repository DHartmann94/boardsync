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

  async sendUserToAuthenticator(emailLowerCase: string, password: string): Promise<{ uid: string; user: User }> {
    const userCredential = await runInInjectionContext(this.injector, () =>
      createUserWithEmailAndPassword(this.auth, emailLowerCase, password)
    );
    const user = userCredential.user;

    await this.sendVerificationMail(user);

    return { uid: user.uid, user };
  }

  async sendVerificationMail(user: User): Promise<boolean> {
    try {
      await runInInjectionContext(this.injector, () => sendEmailVerification(user));
      return true;
    } catch (error: any) {
      console.error('ERROR email verification:', error);
      return false;
    }
  }

  // Sauberes Löschen über die direkte Instanz
  async deleteUserInstance(user: User): Promise<void> {
    try {
      await runInInjectionContext(this.injector, () => deleteUser(user));
    } catch (error: any) {
      console.error('ERROR deleting auth user during rollback:', error);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await runInInjectionContext(this.injector, () => sendPasswordResetEmail(this.auth, email));
    } catch (error: any) {
      console.error('ERROR password reset:', error);
      throw error;
    }
  }

}
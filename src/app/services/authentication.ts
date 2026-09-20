import { Injectable, inject, Signal } from '@angular/core';
import { Auth, user, User, signInWithEmailAndPassword, signInAnonymously, signOut, createUserWithEmailAndPassword, sendEmailVerification, deleteUser, sendPasswordResetEmail } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {

  private readonly auth = inject(Auth);

  readonly authUser: Signal<User | null | undefined>;

  constructor() {
    /**
     * Signal for the current Firebase Auth status:
     * - undefined : Initial state (Firebase is still resolving the login after a page reload/F5)
     * - null      : User is logged out
     * - User      : Authenticated Firebase user
     */
    this.authUser = toSignal<User | null | undefined>(user(this.auth), {
      initialValue: undefined
    });
  }

  async signInAsUser(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        const error: any = new Error('Email is not verified.');
        error.code = 'auth/email-not-verified';
        error.user = user;
        await signOut(this.auth);
        throw error;
      }

      return user;
    } catch (error: any) {
      console.error('ERROR during login:', error.code, error.message);
      throw error;
    }
  }

  async signInAsGuest() {
    try {
      const userCredential = await signInAnonymously(this.auth);
      return userCredential.user;
    } catch (error: any) {
      console.error('ERROR signInAsGuest:', error);
      throw error; // Präsentation entscheidet die Component
    }
  }

  async signInWithGoogle() {
    // TODO
  }

  async sendUserToAuthenticator(emailLowerCase: string, password: string): Promise<{ uid: string; user: User }> {
    const userCredential = await createUserWithEmailAndPassword(this.auth, emailLowerCase, password);
    const user = userCredential.user;

    await this.sendVerificationMail(user);

    return { uid: user.uid, user };
  }

  async sendVerificationMail(user: User): Promise<boolean> {
    try {
      await sendEmailVerification(user);
      return true;
    } catch (error: any) {
      console.error('ERROR email verification:', error);
      return false;
    }
  }

  // Sauberes Löschen über die direkte Instanz
  async deleteUserInstance(user: User): Promise<void> {
    try {
      await deleteUser(user);
    } catch (error: any) {
      console.error('ERROR deleting auth user during rollback:', error);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      console.error('ERROR password reset:', error);
      throw error;
    }
  }

}

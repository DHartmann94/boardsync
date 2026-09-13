import { Injectable, inject, Signal } from '@angular/core';
import { Auth, user, User, signInAnonymously } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class Authentication {
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

}

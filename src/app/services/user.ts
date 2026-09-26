import { Injectable, inject, signal, effect, computed, untracked, Injector, runInInjectionContext } from '@angular/core';
import { User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp, getDoc, DocumentData } from '@angular/fire/firestore';

import { UserInterface } from '../models/user';
import { AuthenticationService } from '../services/authentication';
import { DateService } from '../services/date';

/**
 * Ladezustand des Users in der App.
 * Discriminated Union: `user` existiert nur, wenn status === 'ready'.
 */
export type UserState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'ready'; user: UserInterface }
  | { status: 'error' };

const DEFAULT_AVATAR = '/assets/profile-pictures/unknown-user.png';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  private readonly firestore = inject(Firestore);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly dateService = inject(DateService);
  private readonly injector = inject(Injector);

  /**
   * Ergebnis des letzten Firestore-Loads, gehört immer zu genau einer uid.
   * Basis für `state`/`currentUser` – nie direkt außerhalb dieses Service lesen.
   */
  private readonly profileLoad = signal<{ uid: string; user: UserInterface | null } | null>(null);

  /** Pausiert das automatische Nachladen (siehe `withoutAutoLoad`). */
  private readonly suppressAutoLoad = signal(false);

  /**
   * Abgeleiteter Zustand (lazy + memoized, ohne Seiteneffekte).
   * Wird nur berechnet, wenn jemand liest (Guard, Template, isReady) und sich ein
   * zuletzt gelesenes Signal geändert hat.
   *
   * - authUser === undefined       -> erster Auth-Check läuft noch -> loading
   * - authUser === null            -> ausgeloggt -> signedOut
   * - profile gehört zu anderer uid -> Firestore-Load läuft noch -> loading
   * - profile.user vorhanden       -> ready
   * - profile.user === null        -> Auth ok, Firestore fehlgeschlagen -> error
   *
   * Der uid-Vergleich sorgt dafür, dass nach einem Login nie kurz ein alter State steht,
   * auch wenn der Effect noch nicht gelaufen ist.
   */
  readonly state = computed<UserState>(() => {
    const authUser = this.authenticationService.authUser();
    if (authUser === undefined) return { status: 'loading' };
    if (authUser === null) return { status: 'signedOut' };

    const profileLoad = this.profileLoad();
    if (profileLoad?.uid !== authUser.uid) return { status: 'loading' };

    return profileLoad.user
      ? { status: 'ready', user: profileLoad.user }
      : { status: 'error' };
  });

  // Ableitungen für Templates/Komponenten
  readonly currentUser = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.user : null;
  });
  readonly isLoading = computed(() => this.state().status === 'loading');
  readonly loadError = computed(() => this.state().status === 'error');

  constructor() {
    effect(() => console.log('[currentUser]', this.currentUser()));
    /**
     * Der Effect hat nur eine Aufgabe: Firestore-Daten laden, sobald sich der Auth-User ändert.
     * Der Zustand selbst kommt aus dem computed `state`.
     */
    effect(() => {
      const authUser = this.authenticationService.authUser();
      if (authUser === undefined) return;

      if (authUser === null) {
        untracked(() => this.profileLoad.set(null));
        return;
      }

      untracked(() => {
        if (this.suppressAutoLoad()) return; // Registrierung läuft, Dokument existiert bewusst noch nicht
        void this.load(authUser);
      });
    });
  }

  /**
   * Für den Guard: wartet, bis der Zustand nicht mehr 'loading' ist.
   * Timeout gegen hängende Firebase-Initialisierung -> dann 'error'.
   */
  isReady(timeoutMs = 10_000): Promise<UserState> {
    const current = this.state();
    if (current.status !== 'loading') return Promise.resolve(current);

    return new Promise<UserState>((resolve) => {
      const timer = setTimeout(() => {
        ref.destroy();
        resolve({ status: 'error' });
      }, timeoutMs);

      const ref = effect(() => {
        const s = this.state();
        if (s.status !== 'loading') {
          clearTimeout(timer);
          ref.destroy();
          resolve(s);
        }
      }, { injector: this.injector });
    });
  }

  /**
   * Lädt das User-Dokument neu (z. B. nach Profiländerung).
   * Der bisherige User bleibt bis zum neuen Ergebnis stehen.
   */
  async refresh(): Promise<void> {
    const authUser = this.authenticationService.authUser();
    if (authUser) await this.load(authUser);
  }

  /*------ Laden ------*/

  private async load(authUser: User): Promise<void> {
    let user: UserInterface | null = null;

    try {
      user = await this.getUserById(authUser.uid);

      if (!user) {
        if (this.isGoogleProvider(authUser)) {
          // Google Erst-Login: Dokument automatisch anlegen
          user = await this.createGoogleUser(authUser);
        } else {
          user = null;
        }
      }
    } catch (error) {
      console.error('ERROR loading current user:', error);
    }

    // Race-Guard: authUser kann sich während des awaits geändert haben
    if (this.authenticationService.authUser()?.uid === authUser.uid) {
      this.profileLoad.set({ uid: authUser.uid, user });
      console.log('[load] profileLoad gesetzt:', user);
    }
  }

  /**
   * Firestore-Aufrufe laufen im Injection Context, dadurch von überall aufrufbar.
   */
  async getUserById(uid: string): Promise<UserInterface | null> {
    const snapshot = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'users', uid))
    );
    return snapshot.exists() ? this.mapToUser(uid, snapshot.data()) : null;
  }

  private isGoogleProvider(authUser: User): boolean {
    return authUser.providerData.some((p) => p.providerId === 'google.com');
  }

  private async createGoogleUser(authUser: User): Promise<UserInterface> {
    const fullName = authUser.displayName ?? '';
    const spaceIndex = fullName.lastIndexOf(' ');
    let firstName = fullName;
    let lastName = '';

    if (spaceIndex !== -1) {
      firstName = fullName.substring(0, spaceIndex);
      lastName = fullName.substring(spaceIndex + 1);
    }

    const newUserData: Partial<UserInterface> = {
      firstName,
      lastName,
      email: authUser.email ?? '',
      avatar: this.generateInitialsAvatar(firstName, lastName) || DEFAULT_AVATAR,
      role: 'user',
    };

    const created = await this.createUserDocument(authUser.uid, newUserData);
    if (!created) throw new Error('Could not create user document');

    return {
      id: authUser.uid,
      firstName: newUserData.firstName!,
      lastName: newUserData.lastName!,
      email: newUserData.email!,
      phone: '',
      avatar: newUserData.avatar!,
      role: 'user',
      status: '',
      createdAt: new Date(),
    };
  }

  async createUserDocument(authUID: string, userDataDto: Partial<UserInterface>): Promise<boolean> {
    try {
      const userPayload = {
        firstName: userDataDto.firstName ?? '',
        lastName: userDataDto.lastName ?? '',
        email: userDataDto.email ?? '',
        phone: userDataDto.phone ?? '',
        avatar: userDataDto.avatar ?? '',
        role: userDataDto.role ?? 'user',
        status: userDataDto.status ?? '',
        createdAt: serverTimestamp(),
      };

      // Nach einem await läuft der Code ggf. außerhalb des Injection Contexts,
      // deshalb Firestore-Aufrufe explizit im Context ausführen
      const userDocRef = runInInjectionContext(this.injector, () => doc(this.firestore, 'users', authUID));
      await runInInjectionContext(this.injector, () => setDoc(userDocRef, userPayload));

      return true;
    } catch (error) {
      console.error('ERROR user send to Firebase / Firestore:', error);
      return false;
    }
  }

  /*------ Help functions ------*/
  private mapToUser(id: string, data: DocumentData): UserInterface {
    return {
      id,
      firstName: data['firstName'] ?? '',
      lastName: data['lastName'] ?? '',
      email: data['email'] ?? '',
      phone: data['phone'] ?? '',
      avatar: data['avatar'] ?? DEFAULT_AVATAR,
      role: data['role'] ?? '',
      status: data['status'] ?? '',
      createdAt: this.dateService.parseDate(data['createdAt']),
    };
  }

  generateInitialsAvatar(firstName: string, lastName: string): string {
    const firstInitial = firstName.trim().charAt(0).toUpperCase();
    const lastInitial = lastName.trim().charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }

  /**
   * Führt `action` aus, während das automatische Nachladen des Firestore-Profils
   * unterdrückt wird (siehe `suppressAutoLoad`).
   *
   * Nötig bei der Registrierung: Firebase Auth meldet den neuen User sofort an,
   * bevor das zugehörige Firestore-Dokument existiert. Ohne diese Sperre würde
   * der Lade-Effect in diesem kurzen Zeitfenster fälschlich eine Fehlermeldung auslösen.
   *
   * `finally` stellt sicher, dass die Sperre auch bei einem Fehler in `action`
   * garantiert wieder aufgehoben wird.
   *
   * @param action - Asynchrone Aktion, während der das Nachladen pausiert werden soll.
   * @returns - Das Ergebnis von `action`.
   */
  async withoutAutoLoad<T>(action: () => Promise<T>): Promise<T> {
    this.suppressAutoLoad.set(true);
    try {
      return await action();
    } finally {
      this.suppressAutoLoad.set(false);
    }
  }
}

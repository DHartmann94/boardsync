import { Injectable, inject, signal, effect, computed, untracked, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp, getDoc, DocumentData } from '@angular/fire/firestore';

import { UserInterface } from '../models/user';
import { AuthenticationService } from '../services/authentication';
import { DateService } from '../services/date';

@Injectable({
  providedIn: 'root',
})
export class UserService {

  private readonly firestore = inject(Firestore);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly dateService = inject(DateService);
  private readonly injector = inject(Injector);

  currentUser = signal<UserInterface | null>(null);

  // true, wenn der User laut Firebase Auth eingeloggt ist, aber die Firestore-Daten (noch) nicht geladen werden konnten (z.B. Netzwerkfehler).
  // Wichtig, später für den Guard
  loadError = signal<boolean>(false);

  /**
 * Prüft, ob currentUser aktuell zum aktuellen authUser passt.
 * Wird automatisch ausgeführt sobald sich eines der Signals ändert: authUser, currentUser, loadError
 * - authUser === undefined -> erster Auth-Check läuft noch -> false
 * - authUser === null -> ausgeloggt -> true sobald currentUser auch null ist
 * - authUser vorhanden -> true sobald currentUser.id === authUser.uid (Firestore-Sync fertig)
 */
  readonly synced = computed(() => {
    console.log("Test um zu sehen wie oft synced/computed aufgerufen wird...");
    const authUser = this.authenticationService.authUser();
    if (authUser === undefined) return false;
    if (authUser === null) return this.currentUser() === null;
    if (this.loadError()) return true; // Wichtig falls Auth klappt aber Firestore abfrage nicht
    return this.currentUser()?.id === authUser.uid;
  });

  constructor() {
    /**
     * Reaktiver Effekt, der den globalen `currentUser` Zustand der Anwendung synchronisiert, sobald sich der Firebase-Authentifizierungsstatus (`authUser`) ändert.
     */
    effect(() => {
      const authUser = this.authenticationService.authUser();
      if (authUser === undefined) return;

      if (!authUser) {
        this.currentUser.set(null);
        this.loadError.set(false);
        return;
      }

      const currentUser = untracked(() => this.currentUser()); // liest, ohne Dependency zu erzeugen (CurrenUser ändert sich)
      if (currentUser?.id !== authUser.uid) {
        // runInInjectionContext nötig, da effect() ohne DI-Context läuft 
        // und getCurrentUserDocument() intern Firestore-APIs (doc/getDoc) aufruft
        void runInInjectionContext(this.injector, () => this.getCurrentUserDocument());
      }
    });
  }

  async getCurrentUserDocument(): Promise<void> {
    this.loadError.set(false);

    const authUser = this.authenticationService.authUser();
    if (!authUser) {
      this.currentUser.set(null);
      return;
    }

    const userID = authUser.uid;

    try {
      const userDocRef = doc(this.firestore, 'users', userID);
      const docSnapshot = await getDoc(userDocRef);

      // Race-Guard: authUser kann sich während des awaits geändert haben
      if (this.authenticationService.authUser()?.uid !== userID) return;

      if (docSnapshot.exists()) {
        // Normaler Firestore User
        const mappedUser = this.mapToUser(userID, docSnapshot.data());
        this.currentUser.set(mappedUser);
        console.log('User geladen:', mappedUser);
      } else if (authUser.isAnonymous) {
        // GAST ohne Firestore-Eintrag: liegt nur lokal ab
        this.currentUser.set({
          id: userID,
          firstName: 'Guest',
          lastName: '',
          email: '',
          phone: '',
          avatar: '/assets/profile-pictures/unknown-user.png',
          role: 'user',
          status: '',
          createdAt: this.dateService.parseDate(authUser.metadata.creationTime) ?? new Date()
        });
      } else {
        this.currentUser.set(null);
      }
    } catch (error: any) {
      console.error('ERROR loading current user:', error);
      this.loadError.set(true);
    }
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
        createdAt: serverTimestamp()
      };

      const userDocRef = doc(this.firestore, 'users', authUID);
      await setDoc(userDocRef, userPayload);

      console.log('User erfolgreich in Firestore angelegt mit ID:', authUID);
      return true;
    } catch (error) {
      console.error('ERROR user send to Firebase / Firestore:', error);
      return false;
    }
  }

  generateInitialsAvatar(firstName: string, lastName: string): string {
    const firstInitial = firstName.trim().charAt(0).toUpperCase();
    const lastInitial = lastName.trim().charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }


  /*------ Help functions ------*/
  private mapToUser(id: string, data: DocumentData): UserInterface {
    return {
      id,
      firstName: data['firstName'] ?? '',
      lastName: data['lastName'] ?? '',
      email: data['email'] ?? '',
      phone: data['phone'] ?? '',
      avatar: data['avatar'] ?? '/assets/profile-pictures/unknown-user.png',
      role: data['role'] ?? '',
      status: data['status'] ?? '',
      createdAt: this.dateService.parseDate(data['createdAt'])
    };
  }
}

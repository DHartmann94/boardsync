/**
 * Beschreibt ein Benutzerprofil in der Anwendung.
 * @interface
 */
export interface UserInterface {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    role: string;
    status?: string;
    createdAt: Date;
}

// Beim Anlegen: id/createdAt entstehen erst durch Firebase Auth + Firestore,
// role wird beim Erstellen immer fix auf 'user' gesetzt (siehe Security Rule)
// Wichtig wenn der User nachdem er im Auth erstellt wurde an den Firestore geschickt wird
/**
 * Benutzerdaten, die beim Anlegen eines Profils benötigt werden.
 * @typedef {Object} CreateUserPayload
 */
export type CreateUserPayload = Omit<UserInterface, 'id' | 'createdAt' | 'role'>;

// Beim Bearbeiten des eigenen Profils: id/createdAt/role dürfen NICHT verändert werden
/**
 * Zulässige Änderungen an einem bestehenden Benutzerprofil.
 * @typedef {Object} UpdateUserPayload
 */
export type UpdateUserPayload = Partial<Omit<UserInterface, 'id' | 'createdAt' | 'role'>>;
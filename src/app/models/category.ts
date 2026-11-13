/**
 * Beschreibt eine Aufgaben-Kategorie.
 * @interface
 */
export interface CategoryInterface {
    id: string;
    type: string;
    color: string;
}

/**
 * Daten, die zum Anlegen einer Kategorie benötigt werden.
 * @typedef {Object} CreateategoryPayload
 */
export type CreateategoryPayload = Omit<CategoryInterface, 'id'>;
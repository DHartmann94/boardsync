import { Injectable, computed, Injector, inject, runInInjectionContext } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { collection, collectionData, deleteDoc, doc, Firestore, getDocs, query, setDoc, where } from '@angular/fire/firestore';
import { catchError, map, of } from 'rxjs';

import type { CategoryInterface, CreateategoryPayload } from '../models/category';

/**
 * Verwaltet Kategorien und deren Speicherung in Firestore.
 * @class
 */
@Injectable({ providedIn: 'root' })

export class CategoryService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  /**
    * Ein Signal, das alle Kategorien in Echtzeit aus Firestore lädt, 
    * in das entsprechende Interface konvertiert und Fehler abfängt, 
    * indem es standardmäßig ein leeres Array zurückgibt.
    */
  readonly categories = toSignal(
    collectionData(collection(this.firestore, 'categories'), { idField: 'id' }).pipe(
      map((res) => res as CategoryInterface[]),
      catchError((error) => {
        console.error('Error loading categories:', error);
        return of([] as CategoryInterface[]);
      }),
    ),
    { initialValue: [] as CategoryInterface[] },
  );

  // Lookup per ID, damit nicht jede Karte das Array durchsucht
  readonly categoryMap = computed(
    () => new Map(this.categories().map((category) => [category.id, category])),
  );

  /**
   * Prüft, ob eine Kategorie bereits existiert.
   * @param type Der Typ der Kategorie
   * @returns Promise<boolean> - true wenn die Kategorie bereits existiert
   */
  async categoryExists(type: string): Promise<boolean> {
    try {
      const categoriesQuery = query(
        collection(this.firestore, 'categories'),
        where('type', '==', type),
      );
      const categoriesSnapshot = await runInInjectionContext(this.injector, () =>
        getDocs(categoriesQuery),
      );
      return !categoriesSnapshot.empty;
    } catch (error) {
      console.error('Error checking if category exists:', error);
      return false;
    }
  }

  /**
   * Prüft, ob eine Kategorie in Aufgaben verwendet wird.
   * @param categoryId Die ID der Kategorie
   * @returns Promise<boolean> - true wenn die Kategorie verwendet wird
   */
  async isCategoryInUse(categoryId: string): Promise<boolean> {
    try {
      const tasksQuery = query(
        collection(this.firestore, 'tasks'),
        where('categoryId', '==', categoryId),
      );
      const tasksSnapshot = await runInInjectionContext(this.injector, () => getDocs(tasksQuery));
      return !tasksSnapshot.empty;
    } catch (error) {
      console.error('Error checking if category is in use:', error);
      return true;
    }
  }

  /**
   * Fügt eine neue Kategorie zu Firestore hinzu.
   * @param payload Die Kategoriedaten (type und color)
   * @returns Promise<CategoryInterface | null> - Die neue Kategorie oder null wenn sie bereits existiert
   */
  async addCategory(payload: CreateategoryPayload): Promise<CategoryInterface | null> {
    const trimmedType = payload.type.trim();
    if (!trimmedType) return null;

    const exists = await this.categoryExists(trimmedType);
    if (exists) {
      return null;
    }

    try {
      const categoryRef = doc(collection(this.firestore, 'categories'));
      const newCategory: CreateategoryPayload = {
        type: trimmedType,
        color: payload.color,
      };

      await runInInjectionContext(this.injector, () => setDoc(categoryRef, newCategory));

      return {
        id: categoryRef.id,
        ...newCategory,
      };
    } catch (error) {
      console.error('Error adding category:', error);
      return null;
    }
  }

  /**
   * Löscht eine Kategorie aus Firestore, falls sie nicht verwendet wird.
   * @param categoryId Die ID der zu löschenden Kategorie
   * @returns Promise<boolean> - true bei Erfolg, false wenn die Kategorie verwendet wird
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    const inUse = await this.isCategoryInUse(categoryId);
    if (inUse) {
      return false;
    }

    try {
      await runInInjectionContext(this.injector, () =>
        deleteDoc(doc(this.firestore, 'categories', categoryId)),
      );
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      return false;
    }
  }

  /**
   * Gibt den Typ einer Kategorie anhand ihrer ID zurück.
   * @param categoryId Die ID der Kategorie
   * @returns string - Der Typ der Kategorie oder leerer String
   */
  getCategoryType(categoryId: string): string {
    return this.categoryMap().get(categoryId)?.type ?? '';
  }
}
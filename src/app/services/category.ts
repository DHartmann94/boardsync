import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { collection, collectionData, Firestore } from '@angular/fire/firestore';
import { catchError, map, of } from 'rxjs';

import { CategoryInterface } from '../models/category';

@Injectable({ providedIn: 'root' })

export class CategoryService {
  private readonly firestore = inject(Firestore);

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
}
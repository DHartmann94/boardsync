import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import type { CreateProjectPayload, ProjectInterface } from '../models/project';

export interface ProjectFormValue {
  title: string;
  description: string;
  memberIds: string[];
  dueDate: Date | null;
}

export type ProjectForm = FormGroup<{
  title: FormControl<string>;
  description: FormControl<string>;
  memberIds: FormControl<string[]>;
  dueDate: FormControl<Date | null>;
}>;

const dateNotInPastValidator: ValidatorFn = (
  control: AbstractControl<Date | null>,
): ValidationErrors | null => {
  const date = control.value;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate < today ? { pastDate: true } : null;
};

const nonWhitespaceValidator: ValidatorFn = (control): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);

  /**
   * Erstellt und initialisiert ein neues reaktives Formular für Projekte 
   * inklusive Validierungen für Titel, Mitglieder und Fälligkeitsdatum.
   * @param value Optionale Startwerte zur Vorbefüllung des Formulars.
   * @returns Das konfigurierte ProjectForm-Objekt.
   */
  createProjectForm(value: Partial<ProjectFormValue> = {}): ProjectForm {
    return new FormGroup({
      title: new FormControl(value.title ?? '', {
        nonNullable: true,
        validators: [nonWhitespaceValidator, Validators.maxLength(50)],
      }),
      description: new FormControl(value.description ?? '', { nonNullable: true }),
      memberIds: new FormControl(value.memberIds ?? [], { nonNullable: true }),
      dueDate: new FormControl<Date | null>(value.dueDate ?? null, {
        validators: [Validators.required, dateNotInPastValidator],
      }),
    });
  }

  /**
   * Speichert ein neues Projekt asynchron in der Firestore-Datenbank 
   * und fügt Server-Timestamps für Erstellung und Aktualisierung hinzu.
   * @param value Die Formulardaten des Projekts.
   * @param ownerId Die ID des Benutzers, der das Projekt erstellt.
   * @returns Ein Promise, das bei Abschluss aufgelöst wird.
   */
  async createProject(value: ProjectFormValue, ownerId: string): Promise<void> {
    const payload = this.toPayload(value, ownerId);

    await runInInjectionContext(this.injector, () => {
      const projectRef = doc(collection(this.firestore, 'projects'));
      return setDoc(projectRef, {
        id: projectRef.id,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  /**
   * Aktualisiert ein bestehendes Projekt in der Firestore-Datenbank 
   * und setzt einen neuen Aktualisierungs-Timestamp.
   * @param project Das zu aktualisierende Projekt-Interface.
   * @param value Die neuen Formulardaten.
   * @returns Ein Promise, das bei Abschluss aufgelöst wird.
   */
  async updateProject(project: ProjectInterface, value: ProjectFormValue): Promise<void> {
    const payload = this.toPayload(value, project.ownerId, project.completed);

    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'projects', project.id), {
        ...payload,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  /**
   * Löscht zuerst alle Aufgaben des Projekts und anschließend das Projekt aus Firestore.
   * @param projectId Die eindeutige ID des zu löschenden Projekts.
   * @returns Ein Promise, das bei Abschluss aufgelöst wird.
   */
  async deleteProject(projectId: string): Promise<void> {
    const tasksSnapshot = await runInInjectionContext(this.injector, () => {
      const tasksQuery = query(
        collection(this.firestore, 'tasks'),
        where('projectId', '==', projectId),
      );
      return getDocs(tasksQuery);
    });

    await Promise.all(
      tasksSnapshot.docs.map((task) =>
        runInInjectionContext(this.injector, () => deleteDoc(task.ref)),
      ),
    );
    await runInInjectionContext(this.injector, () =>
      deleteDoc(doc(this.firestore, 'projects', projectId)),
    );
  }

  /**
   * Konvertiert die Rohdaten des Formulars in ein valides Payload-Objekt 
   * für die Datenbankoperationen, inklusive Bereinigung von Leerzeichen und Mitgliedern.
   * @param value Die Formulardaten des Projekts.
   * @param ownerId Die ID des Projektbesitzers.
   * @param completed Der Abschlussstatus des Projekts.
   * @returns Das aufbereitete CreateProjectPayload-Objekt.
   */
  private toPayload(
    value: ProjectFormValue,
    ownerId: string,
    completed = false,
  ): CreateProjectPayload {
    if (!value.dueDate) {
      throw new Error('A project due date is required.');
    }

    return {
      title: value.title.trim(),
      description: value.description.trim(),
      ownerId,
      memberIds: [...new Set([...value.memberIds, ownerId])],
      dueDate: value.dueDate,
      completed,
    };
  }
}
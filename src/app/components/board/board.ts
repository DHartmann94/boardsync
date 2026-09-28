import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { collection, collectionData, doc, Firestore, query, serverTimestamp, Timestamp, updateDoc, where } from '@angular/fire/firestore';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { UserService } from '../../services/user';
import { NotificationService } from '../../services/notification';
import { ProjectInterface } from '../../models/project';
import { TaskInterface } from '../../models/task';

interface BoardColumn {
  id: string;
  title: string;
  tasks: TaskInterface[];
}

const LAST_PROJECT_STORAGE_KEY = 'board.lastProjectId';

@Component({
  selector: 'app-board',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    TranslatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatAutocompleteModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
  ],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  // Services
  private readonly firestore = inject(Firestore);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly notificationService = inject(NotificationService);

  // Form Controls
  readonly projectSearchControl = new FormControl<ProjectInterface | string | null>('');
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  // State
  readonly selectedProject = signal<ProjectInterface | null>(null);

  // Spalten-Definition
  readonly columns = signal<BoardColumn[]>([
    { id: 'todo', title: 'To do', tasks: [] },
    { id: 'inProgress', title: 'In progress', tasks: [] },
    { id: 'awaitFeedback', title: 'Await feedback', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] },
  ]);

  // Projekte laden basierend auf User-ID
  private readonly projects$ = toObservable(this.userService.state).pipe(
    map((state) => (state.status === 'ready' ? state.user.id : null)),
    switchMap((uid) => (uid ? this.loadProjects(uid) : of([])))
  );

  // Für das Autocomplete im Template (Observable)
  readonly filteredProjects = this.projectSearchControl.valueChanges.pipe(
    startWith(''),
    switchMap((value) =>
      this.projects$.pipe(
        map((projects) => {
          const term = typeof value === 'string' ? value.trim().toLowerCase() : '';
          return term ? projects.filter((p) => p.title.toLowerCase().includes(term)) : projects;
        })
      )
    )
  );

  constructor() {
    this.initProjectsAndAutoSelect();
    this.initTaskSync();
  }

  // --- Projekt-Logik ---
  private loadProjects(uid: string) {
    const projectsRef = collection(this.firestore, 'projects');
    const q = query(projectsRef, where('memberIds', 'array-contains', uid));
    return collectionData(q, { idField: 'id' }).pipe(
      map((res) => res as ProjectInterface[]),
      catchError(() => {
        this.notificationService.showError('board.errors.loadProjectsFailed');
        return of([]);
      })
    );
  }

  private initProjectsAndAutoSelect(): void {
    this.projects$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((projects) => {
      if (projects.length === 0) return;

      // Wenn noch kein Projekt ausgewählt ist, nimm das letzte gespeicherte oder das erste
      if (!this.selectedProject()) {
        const lastProjectId = localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
        const project = projects.find((p) => p.id === lastProjectId) ?? projects[0];

        this.selectedProject.set(project);
        this.projectSearchControl.setValue(project);
      }
    });
  }

  displayProject(project: ProjectInterface | string | null): string {
    return typeof project === 'string' ? project : (project?.title ?? '');
  }

  onProjectSelected(project: ProjectInterface): void {
    this.selectedProject.set(project);
    try {
      localStorage.setItem(LAST_PROJECT_STORAGE_KEY, project.id);
    } catch { }
  }

  // --- Task-Logik & Echtzeit-Synchronisation ---
  private initTaskSync(): void {
    // Sob sich das Projekt ändert, laden wir die Tasks neu
    toObservable(this.selectedProject).pipe(
      switchMap((project) => {
        if (!project) return of([]);
        const tasksRef = collection(this.firestore, 'tasks');
        const q = query(tasksRef, where('projectId', '==', project.id));
        return collectionData(q, { idField: 'id' }).pipe(
          map((res) => res as TaskInterface[]),
          catchError(() => {
            this.notificationService.showError('board.errors.loadTasksFailed');
            return of([]);
          })
        );
      }),
      // Kombiniere Tasks mit dem aktuellen Suchfeld-Wert
      switchMap((tasks) =>
        this.searchControl.valueChanges.pipe(
          debounceTime(200),
          startWith(this.searchControl.value),
          map((term) => ({ tasks, term: term.trim().toLowerCase() }))
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).forEach(({ tasks, term }) => {
      this.updateColumnsWithTasks(tasks, term);
    });
  }

  private updateColumnsWithTasks(tasks: TaskInterface[], term: string): void {
    // 1. Filtern nach Suchbegriff und Sortieren nach Erstellungsdatum
    const filtered = tasks.filter((task) => {
      if (!term) return true;
      return (
        task.title.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term)
      );
    }).sort((a, b) => this.toMillis(a.createdAt) - this.toMillis(b.createdAt));

    // 2. Spalten zurücksetzen und Tasks zuordnen
    const currentColumns = [
      { id: 'todo', title: 'To do', tasks: [] as TaskInterface[] },
      { id: 'inProgress', title: 'In progress', tasks: [] as TaskInterface[] },
      { id: 'awaitFeedback', title: 'Await feedback', tasks: [] as TaskInterface[] },
      { id: 'done', title: 'Done', tasks: [] as TaskInterface[] },
    ];

    for (const task of filtered) {
      const col = currentColumns.find((c) => c.id === task.step) ?? currentColumns[0];
      col.tasks.push(task);
    }

    this.columns.set(currentColumns);
    this.cdr.markForCheck();
  }

  // Drag & Drop
  async onTaskDropped(event: CdkDragDrop<TaskInterface[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      return;
    }

    const task = event.previousContainer.data[event.previousIndex];
    const previousStep = task.step;
    const newStep = event.container.id;

    // Optimistisches UI-Update über CDK
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    task.step = newStep;

    // In Firestore speichern
    try {
      const taskRef = doc(this.firestore, 'tasks', task.id);
      await updateDoc(taskRef, {
        step: newStep,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Rollback bei Fehler
      task.step = previousStep;
      // UI einmal neu aufbauen lassen durch erneutes Zuweisen
      this.columns.update((cols) => [...cols]);
      this.notificationService.showError('board.errors.moveFailed');
    }
  }

  /*------ Help functions ------*/
  private toMillis(value: unknown): number {
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return 0;
  }
}
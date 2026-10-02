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
import { collection, collectionData, Firestore, query, Timestamp, where } from '@angular/fire/firestore';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, shareReplay, startWith, switchMap } from 'rxjs';

import { UserService } from '../../services/user';
import { TaskService } from '../../services/task';
import { NotificationService } from '../../services/notification';
import { ProjectInterface } from '../../models/project';
import { TaskInterface } from '../../models/task';
import { Task } from '../task/task';

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
    Task // Nur wichtig für die Component im HTML
  ],
  templateUrl: './board.html',
  styleUrl: './board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Board {
  // Services
  private readonly firestore = inject(Firestore);
  private readonly userService = inject(UserService);
  private readonly taskService = inject(TaskService);
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
    distinctUntilChanged(),
    switchMap((uid) => (uid ? this.loadProjects(uid) : of([]))),
    shareReplay({ bufferSize: 1, refCount: true }),
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
    // Sobald sich das Projekt ändert, laden wir die Tasks neu
    toObservable(this.selectedProject).pipe(
      switchMap((project) => {
        if (!project) {
          this.userService.loadUsersForProject([]).catch((err) => {
            console.error('Failed to clear users', err);
          });
          return of([]);
        }

        // Projekt-User für die Avatare laden
        this.userService.loadUsersForProject(project.memberIds).catch((err) => {
          console.error('Failed to load users for project', err);
        });

        // Tasks über den TaskService laden und Fehler hier in der Component abfangen
        return this.taskService.getTasksForProject(project.id).pipe(
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
    ).subscribe(({ tasks, term }) => {
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

    // 1. Optimistisches UI-Update über CDK
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    task.step = newStep;

    // 2. Über den Service in Firestore speichern
    try {
      await this.taskService.updateTaskStep(task.id, newStep);
    } catch {
      // Rollback bei Fehler
      transferArrayItem(
        event.container.data,
        event.previousContainer.data,
        event.currentIndex,
        event.previousIndex,
      );
      task.step = previousStep;
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
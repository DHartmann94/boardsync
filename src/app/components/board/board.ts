import { AsyncPipe } from '@angular/common';
import { OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Injector, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { addDoc, collection, collectionData, Firestore, query, Timestamp, where } from '@angular/fire/firestore';
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
export class Board implements OnInit {
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

ngOnInit() {
  this.userService.isReady()
    .then((state) => {
      console.log("START");
      if (state.status === 'ready') { // Nur bei bereitem User laden
        this.initProjectsAndAutoSelect();
        this.initTaskSync();
        console.log("Finish");
      }
    })
    .catch((error) => {

    });
}

  //constructor() {
  //  this.initProjectsAndAutoSelect();
  //  this.initTaskSync();
  //}

  // --- Projekt-Logik ---
private loadProjects(uid: string) {
  const projectsRef = collection(this.firestore, 'projects');
  const q = query(projectsRef, where('memberIds', 'array-contains', uid));

  return collectionData(q, { idField: 'id' }).pipe(
    map((res) => {
      console.log('[DEBUG] Projects loaded:', res.length);
      return res as ProjectInterface[];
    }),
    catchError((error) => {
      console.error('[DEBUG] Firestore ERROR:', error);
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

  async createDemoData(): Promise<void> {
  try {
    const now = new Date();
    // =========================
    // Kategorien anlegen
    // =========================
    const frontendCategory = await addDoc(
      collection(this.firestore, 'categories'),
      {
        type: 'Frontend',
        color: '#29ABE2'
      }
    );
    const backendCategory = await addDoc(
      collection(this.firestore, 'categories'),
      {
        type: 'Backend',
        color: '#8B5CF6'
      }
    );
    const testingCategory = await addDoc(
      collection(this.firestore, 'categories'),
      {
        type: 'Testing',
        color: '#22C55E'
      }
    );
    // =========================
    // Projekt 1
    // =========================
    const projectOne = await addDoc(
      collection(this.firestore, 'projects'),
      {
        title: 'Dashboard Development',
        description: 'Entwicklung des Angular Dashboards',
        ownerId: '2FXlnXfgZTT6C9KlFW11f0lqew63',
        memberIds: [
          '2FXlnXfgZTT6C9KlFW11f0lqew63',
          'user-1',
          'user-2'
        ],
        createdAt: now,
        updatedAt: now,
        dueDate: new Date(
          now.getTime() + 1000 * 60 * 60 * 24 * 30
        ),
        completed: false
      }
    );
    // =========================
    // Projekt 2
    // =========================
    const projectTwo = await addDoc(
      collection(this.firestore, 'projects'),
      {
        title: 'Mobile App',
        description: 'Entwicklung der mobilen Anwendung',
        ownerId: '2FXlnXfgZTT6C9KlFW11f0lqew633',
        memberIds: [
          '2FXlnXfgZTT6C9KlFW11f0lqew633',
          'user-3'
        ],
        createdAt: now,
        updatedAt: now,
        dueDate: new Date(
          now.getTime() + 1000 * 60 * 60 * 24 * 45
        ),
        completed: false
      }
    );
    // =========================
    // Tasks Projekt 1
    // =========================
    await addDoc(collection(this.firestore, 'tasks'), {
      projectId: projectOne.id,
      title: 'Login Seite erstellen',
      description: 'Login UI entwickeln',
      step: 'todo',
      prio: 'high',
      categoryId: frontendCategory.id,
      assignedToUser: ['2FXlnXfgZTT6C9KlFW11f0lqew63'],
      subtasks: [
        {
          title: 'Mockup erstellen',
          completed: true
        },
        {
          title: 'UI implementieren',
          completed: false
        }
      ],
      createdAt: now,
      updatedAt: now,
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7)
    });
    await addDoc(collection(this.firestore, 'tasks'), {
      projectId: projectOne.id,
      title: 'Firestore anbinden',
      description: 'Services und Datenzugriff erstellen',
      step: 'inprogress',
      prio: 'high',
      categoryId: backendCategory.id,
      assignedToUser: ['2FXlnXfgZTT6C9KlFW11f0lqew63'],
      subtasks: [
        {
          title: 'Collection erstellen',
          completed: true
        },
        {
          title: 'CRUD implementieren',
          completed: false
        }
      ],
      createdAt: now,
      updatedAt: now,
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 10)
    });
    await addDoc(collection(this.firestore, 'tasks'), {
      projectId: projectOne.id,
      title: 'Board testen',
      description: 'Alle Board Funktionen prüfen',
      step: 'done',
      prio: 'medium',
      categoryId: testingCategory.id,
      assignedToUser: ['2FXlnXfgZTT6C9KlFW11f0lqew63'],
      subtasks: [
        {
          title: 'Drag & Drop',
          completed: true
        },
        {
          title: 'Filter testen',
          completed: true
        }
      ],
      createdAt: now,
      updatedAt: now,
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14)
    });
    // =========================
    // Tasks Projekt 2
    // =========================
    await addDoc(collection(this.firestore, 'tasks'), {
      projectId: projectTwo.id,
      title: 'Mobile Layout',
      description: 'Responsive Mobile Ansicht erstellen',
      step: 'todo',
      prio: 'medium',
      categoryId: frontendCategory.id,
      assignedToUser: ['2FXlnXfgZTT6C9KlFW11f0lqew633'],
      subtasks: [
        {
          title: 'Breakpoints definieren',
          completed: false
        }
      ],
      createdAt: now,
      updatedAt: now,
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5)
    });
    await addDoc(collection(this.firestore, 'tasks'), {
      projectId: projectTwo.id,
      title: 'API Integration',
      description: 'Backend anbinden',
      step: 'await-feedback',
      prio: 'high',
      categoryId: backendCategory.id,
      assignedToUser: ['2FXlnXfgZTT6C9KlFW11f0lqew633'],
      subtasks: [
        {
          title: 'API testen',
          completed: true
        },
        {
          title: 'Review abwarten',
          completed: false
        }
      ],
      createdAt: now,
      updatedAt: now,
      dueDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 12)
    });
    console.log('Demo-Daten erfolgreich erstellt.');
  } catch (error) {
    console.error('Fehler beim Erstellen der Demo-Daten:', error);
  }
}
}
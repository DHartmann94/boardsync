import { AsyncPipe } from '@angular/common';
import { runInInjectionContext, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Injector, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup, transferArrayItem } from '@angular/cdk/drag-drop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { collection, collectionData, Firestore, query, where } from '@angular/fire/firestore';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, map, of, shareReplay, startWith, switchMap, filter, take, tap } from 'rxjs';

import { UserService } from '../../services/user';
import { TaskService } from '../../services/task';
import { NotificationService } from '../../services/notification';
import { ProjectInterface } from '../../models/project';
import { TaskInterface } from '../../models/task';
import { Task } from '../task/task';
import { TaskDetails } from '../task-details/task-details';

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
    MatProgressSpinnerModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    Task
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
  private readonly injector = inject(Injector);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  // Form Controls
  readonly projectSearchControl = new FormControl<ProjectInterface | string | null>('');
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  // State
  readonly selectedProject = signal<ProjectInterface | null>(null);
  // Startet mit true, damit der Spinner sofort sichtbar ist
  readonly isLoadingTasks = signal(true);

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
    switchMap((uid) => (uid ? this.loadProjects(uid) : of([] as ProjectInterface[]))),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Für das Autocomplete im Template
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
        if (state.status === 'ready') {
          this.initProjectsAndAutoSelect();
          this.initTaskSync();
        } else {
          this.isLoadingTasks.set(false);
        }
      })
      .catch((error) => {
        console.error('Error checking user readiness:', error);
        this.isLoadingTasks.set(false);
      });
  }

  // --- Projekt-Logik ---
  private loadProjects(uid: string) {
    return runInInjectionContext(this.injector, () => {
      const projectsRef = collection(this.firestore, 'projects');
      const q = query(projectsRef, where('memberIds', 'array-contains', uid));

      return collectionData(q, { idField: 'id' }).pipe(
        map((res) => res as ProjectInterface[]),
        // User hat keine Projekte: Es wird kein Projekt gewählt, daher kommt keine
        // Task-Antwort mehr, die den Spinner beenden könnte
        tap((projects) => {
          if (projects.length === 0) {
            this.isLoadingTasks.set(false);
          }
        }),
        catchError((error) => {
          console.error('Firestore error while loading projects:', error);
          this.notificationService.showError('board.errors.loadProjectsFailed');
          this.isLoadingTasks.set(false);
          return of([] as ProjectInterface[]);
        })
      );
    });
  }

  private initProjectsAndAutoSelect(): void {
    this.projects$.pipe(
      filter((projects) => projects.length > 0), // leere Zwischenwerte überspringen
      take(1),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((projects) => {
      if (this.selectedProject()) return;

      let lastProjectId: string | null = null;
      try {
        lastProjectId = localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
      } catch { }

      const project = projects.find((p) => p.id === lastProjectId) ?? projects[0];
      this.onProjectSelected(project);
      this.projectSearchControl.setValue(project);
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
    runInInjectionContext(this.injector, () => {
      toObservable(this.selectedProject).pipe(
        filter((project): project is ProjectInterface => project !== null),
        tap(() => this.isLoadingTasks.set(true)),
        switchMap((project) => {
          this.userService.loadUsersForProject(project.memberIds).catch((err) => {
            console.error('Failed to load users for project', err);
          });

          return this.taskService.getTasksForProject(project.id).pipe(
            catchError(() => {
              this.notificationService.showError('board.errors.loadTasksFailed');
              return of([] as TaskInterface[]);
            })
          );
        }),
        tap(() => this.isLoadingTasks.set(false)),
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
    });
  }

  private updateColumnsWithTasks(tasks: TaskInterface[], term: string): void {
    const filtered = tasks.filter((task) => {
      if (!term) return true;
      return (
        task.title.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term)
      );
    }).sort((a, b) => this.taskService.toMillis(a.createdAt) - this.taskService.toMillis(b.createdAt));

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

  // --- Task-Details ---
  openTask(task: TaskInterface): void {
    this.dialog.open(TaskDetails, {
      data: { taskId: task.id },
      panelClass: 'task-detail-dialog',
      width: '525px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  // --- Drag & Drop ---
  async onTaskDropped(event: CdkDragDrop<TaskInterface[]>): Promise<void> {
    if (event.previousContainer === event.container) {
      return;
    }

    const task = event.previousContainer.data[event.previousIndex];
    const newStep = event.container.id;

    if (newStep === 'done' && this.hasOpenSubtasks(task)) {
      this.notificationService.showError('board.errors.subtasksNotCompleted');
      return;
    }

    const previousStep = task.step;

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    task.step = newStep;

    try {
      await this.taskService.updateTaskStep(task.id, newStep);
    } catch {
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

  private hasOpenSubtasks(task: TaskInterface): boolean {
    return task.subtasks?.some((subtask) => !subtask.completed) ?? false;
  }
}
import { afterNextRender, ChangeDetectorRef, Component, Injector, inject, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserService } from '../../services/user';
import { NotificationService } from '../../services/notification';
import { TaskProjectDueDateError, TaskService } from '../../services/task';
import { CategoryService } from '../../services/category';
import type { CategoryInterface } from '../../models/category';
import { SubtaskInterface } from '../../models/task';

interface ProjectOption {
  id: string;
  title: string;
}

export interface AddTasksDialogData {
  projectId: string;
}

@Component({
  selector: 'app-add-tasks',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatButtonModule,
    MatIconModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './add-tasks.html',
  styleUrl: './add-tasks.scss',
})

export class AddTasks {
  private readonly dialogData = inject<AddTasksDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject<MatDialogRef<AddTasks> | null>(MatDialogRef, { optional: true });
  readonly today = new Date(new Date().setHours(0, 0, 0, 0));
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(Injector);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private readonly taskService = inject(TaskService);
  private readonly categoryService = inject(CategoryService);

  newSubtask: {
    Subtask: SubtaskInterface;
    valid: boolean;
  } = {
    Subtask: { title: '', completed: false },
    valid: true
  };

  potentialCategory = { type: '', color: '' };
  users: { id: string; displayName: string }[] = [];
  categories: CategoryInterface[] = [];
  colors: string[] = [
  '#F44336', // Rot
  '#FF9800', // Orange
  '#FFEB3B', // Gelb
  '#4CAF50', // Grün
  '#2196F3'  // Blau
  ];
  projectOptions: ProjectOption[] = [];

  constructor() {
    /**
     * Konstruktor der Komponente. Verwendet `afterNextRender`,
     * um initiale Optionen nach dem Rendern zu laden.
     */
    afterNextRender(() => {
      void this.loadInitialOptions().catch((error: unknown) => {
        console.error('Failed to load add-task form options:', error);
      });
    });
  }

  /**
   * Lädt initiale Optionen wie Benutzer, Kategorien und Projekte asynchron aus Firestore 
   * und filtert die Projekte basierend auf den Mitgliedschaften des aktuellen Benutzers.
   */
  private async loadInitialOptions(): Promise<void> {
    const [allUsers, projectsSnapshot] = await Promise.all([
      this.userService.getallUsers(),
      runInInjectionContext(this.injector, () => getDocs(collection(this.firestore, 'projects'))),
    ]);

    this.users = allUsers.map((user) => ({
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`,
    }));
    
    // Kategorien werden jetzt über den CategoryService geladen (Signal)
    // Warte kurz, damit das Signal initialisiert wird
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.categories = this.categoryService.categories();
    
    const projectOptions = projectsSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data()['title'],
      memberIds: doc.data()['memberIds'] as string[],
    }));
    const currentUser = this.userService.currentUser();
    this.projectOptions = currentUser
      ? projectOptions.filter((project) => project.memberIds.includes(currentUser.id))
      : [];
    this.cdr.detectChanges();
  }

  readonly taskForm = this.taskService.createTaskForm({ projectId: this.dialogData?.projectId ?? '' });

  closeDialog(): void {
    this.dialogRef?.close();
  }

  /**
   * Verarbeitet das Absenden des Task-Formulars, validiert die Eingaben
   * und speichert die neue Aufgabe in Firestore.
   * @returns Ein Promise, das bei Abschluss aufgelöst wird.
   */
  async onSubmit(): Promise<void> {
    if (this.taskForm.invalid || this.taskForm.pending) {
      this.taskForm.controls.projectId.markAsTouched();
      this.taskForm.controls.title.markAsTouched();
      this.taskForm.controls.dueDate.markAsTouched();
      return;
    }

    try {
      await this.taskService.createTask(this.taskForm.getRawValue());
      this.notificationService.showSuccess('task.taskCreated');
      if (this.dialogRef) {
        this.dialogRef.close(true);
      } else {
        this.onClear();
      }
    } catch (error) {
      console.error('Error adding task: ', error);
      let errorMessage = 'task.taskCreateError';
      if (error instanceof TaskProjectDueDateError) {
        if (error.code === 'afterProjectEnd') {
          errorMessage = 'addTaskForm.dueDateAfterProjectEnd';
        } else {
          errorMessage = 'addTaskForm.projectDueDateLoadError';
        }
      }
      this.notificationService.showError(errorMessage, 3000);
    }

  }

  /**
   * Setzt das Aufgabenformular auf seine Standardwerte zurück 
   * und verwirft eventuelle Benachrichtigungen.
   */
  onClear(): void {
    this.notificationService.dismiss();
    this.taskForm.reset({
      projectId: '',
      title: '',
      description: '',
      prio: 'medium',
      categoryId: '',
      assignedToUser: [],
      subtasks: [],
      dueDate: null,
    });
  }

  /**
   * Löscht eine spezifische Kategorie aus Firestore, sofern sie 
   * nicht mehr von aktiven Aufgaben verwendet wird.
   * @param categoryId Die eindeutige ID der zu löschenden Kategorie.
   * @param event Das Mausereignis, um die Event-Propagation zu stoppen.
   * @returns Ein Promise, das bei Abschluss aufgelöst wird.
   */
  async deleteCategory(categoryId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    try {
      const success = await this.categoryService.deleteCategory(categoryId);
      if (!success) {
        this.notificationService.showError('addTaskForm.categoryInUse', 3000);
        return;
      }
      this.categories = this.categories.filter((category) => category.id !== categoryId);
      if (this.taskForm.controls.categoryId.value === categoryId) {
        this.taskForm.controls.categoryId.setValue('');
      }
      this.cdr.markForCheck();
      this.notificationService.showSuccess('addTaskForm.categoryDeleted');
    } catch (error) {
      console.error('Error deleting category: ', error);
      this.notificationService.showError('addTaskForm.categoryDeleteError', 3000);
    }
  }

  /**
   * Fügt eine neue Kategorie zu Firestore hinzu, falls diese 
   * noch nicht existiert.
   * @param event Das Mausereignis, um die Event-Propagation zu stoppen.
   * @returns Ein Promise, das bei Abschluss aufgelöst wird.
   */
  async addCategory(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const color = this.potentialCategory.color;
    const type = this.potentialCategory.type.trim();

    try {
      const newCategory = await this.categoryService.addCategory({ type, color });
      if (!newCategory) {
        this.notificationService.showError('addTaskForm.categoryAlreadyExists', 3000);
        return;
      }
      this.categories = [
        ...this.categories,
        newCategory,
      ];
      this.taskForm.controls.categoryId.setValue(newCategory.id);
      this.potentialCategory = { type: '', color: '' };
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error adding category: ', error);
      this.notificationService.showError('addTaskForm.categoryCreateError', 3000);
    }
  }

  /**
   * Fügt eine neue Unteraufgabe zur Liste der Unteraufgaben im Task-Formular hinzu.
   */
  addSubtask(): void {
    const title = this.newSubtask.Subtask.title.trim();
    if (!title) 
    {
      this.newSubtask.valid = false;
      return;
    }
    this.newSubtask.valid = true;

    const subtasks = this.taskForm.controls.subtasks.value;
    let id = this.taskForm.controls.subtasks.value.length + 1;
    this.taskForm.controls.subtasks.setValue([
      ...subtasks,
      { id: id.toString(), title, completed: false },
    ]);

    this.clearInput();
  }
  
  clearInput(): void {
    this.newSubtask.Subtask.title = '';
  }

  getUserDisplayName(userId: string): string {
    return UserService.getUserDisplayName(userId, this.users);
  }

  getCategoryType(categoryId: string): string {
    return this.categoryService.getCategoryType(categoryId);
  }
}
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../../services/user';
import { NotificationService } from '../../services/notification';
import { TaskProjectDueDateError, TaskService } from '../../services/task';
import type { CategoryInterface, CreateategoryPayload } from '../../models/category';
import { SubtaskInterface } from '../../models/task';

interface ProjectOption {
  id: string;
  title: string;
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
    MatNativeDateModule,
    MatSelectModule,
    MatRadioModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './add-tasks.html',
  styleUrl: './add-tasks.scss',
})

export class AddTasks {
  readonly today = new Date(new Date().setHours(0, 0, 0, 0));
  private readonly firestore = inject(Firestore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private readonly taskService = inject(TaskService);
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

  async ngOnInit(): Promise<void> {
    const allUsers = await this.userService.getallUsers();
    const potentialUsers = allUsers.map((user) => ({
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`,
    }));
    this.users = potentialUsers;
    this.loadCategories();
    this.loadProjects();
  }

  async loadCategories(): Promise<void> {
    const Categories = getDocs(collection(this.firestore, 'categories'));
    const categoriesSnapshot = await Categories;
    this.categories = categoriesSnapshot.docs.map((doc) => ({
      id: doc.id,
      type: doc.data()['type'] as string,
      color: doc.data()['color'] as string,
    }));
    this.cdr.markForCheck();
  }
  async loadProjects(): Promise<void> {
    const Projects = getDocs(collection(this.firestore, 'projects'));
    const projectsSnapshot = await Projects;
    const projectOptions = projectsSnapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data()['title'],
      memberIds: doc.data()['memberIds'] as string[],
    }));
    const currentUser = this.userService.currentUser();
    if (currentUser) {
      this.projectOptions = projectOptions.filter((project) => {
        console.log('Projekt:', project);
        console.log('Member IDs:', project.memberIds);
        console.log('Current User ID:', currentUser.id);

        const includesUser = project.memberIds.includes(currentUser.id);
        console.log('Enthält User:', includesUser);

        return includesUser;
      });
    }
  }

  readonly taskForm = this.taskService.createTaskForm();

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
      this.onClear();
    } catch (error) {
      console.error('Error adding task: ', error);
      this.notificationService.showError(
        error instanceof TaskProjectDueDateError
          ? `addTaskForm.${error.code === 'afterProjectEnd' ? 'dueDateAfterProjectEnd' : 'projectDueDateLoadError'}`
          : 'task.taskCreateError',
        3000,
      );
    }

  }
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

  async deleteCategory(categoryId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    try {
      const tasksQuery = query(
        collection(this.firestore, 'tasks'),
        where('categoryId', '==', categoryId),
      );
      const tasksSnapshot = await getDocs(tasksQuery);

      if (!tasksSnapshot.empty) {
        this.notificationService.showError('addTaskForm.categoryInUse', 3000);
        return;
      }

      await deleteDoc(doc(this.firestore, 'categories', categoryId));
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

  async addCategory(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const color = this.potentialCategory.color;
    const type = this.potentialCategory.type.trim();
    const categoryRef = doc(collection(this.firestore, 'categories'));
    const newCategory: CreateategoryPayload = {
      type,
      color,
    };

    try {
      const categoriesQuery = query(
        collection(this.firestore, 'categories'),
        where('type', '==', type),
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);

      if (!categoriesSnapshot.empty) {
        this.notificationService.showError('addTaskForm.categoryAlreadyExists', 3000);
        return;
      }

      await setDoc(categoryRef, newCategory);
      this.categories = [
        ...this.categories,
        {
          id: categoryRef.id,
          ...newCategory,
        },
      ];
      this.taskForm.controls.categoryId.setValue(categoryRef.id);
      this.potentialCategory = { type: '', color: '' };
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error adding category: ', error);
      this.notificationService.showError('addTaskForm.categoryCreateError', 3000);
    }
  }
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
    return this.users.find((user) => user.id === userId)?.displayName ?? userId;
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddTasks } from './add-tasks';

describe('AddTasks', () => {
  let component: AddTasks;
  let fixture: ComponentFixture<AddTasks>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTasks],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTasks);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not impose a hard character limit on the title input', () => {
    const titleInput = fixture.nativeElement.querySelector('#task-title') as HTMLInputElement;

    expect(titleInput.maxLength).toBe(-1);
  });

  it('shows the title length error while typing values longer than 50 characters', () => {
    const titleControl = component.taskForm.controls.title;
    titleControl.setValue('a'.repeat(51));
    titleControl.markAsDirty();
    fixture.detectChanges();

    expect(titleControl.hasError('maxlength')).toBe(true);
    expect(fixture.nativeElement.querySelector('#task-title-error')).not.toBeNull();
    const titleInput = fixture.nativeElement.querySelector('#task-title') as HTMLInputElement;
    expect(titleInput.getAttribute('aria-invalid')).toBe('true');
  });
});

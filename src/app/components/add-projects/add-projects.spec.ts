import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddProjects } from './add-projects';

describe('AddProjects', () => {
  let component: AddProjects;
  let fixture: ComponentFixture<AddProjects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddProjects],
    }).compileComponents();

    fixture = TestBed.createComponent(AddProjects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('disables the submit button while the project form is invalid', () => {
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('.primary-btn') as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);
  });

  it('enables the submit button when the project form is valid', () => {
    component.projectForm.controls.title.setValue('Valid project');
    component.projectForm.controls.dueDate.setValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('.primary-btn') as HTMLButtonElement;

    expect(submitButton.disabled).toBe(false);
  });

  it('does not impose a hard character limit on the project title input', () => {
    const titleInput = fixture.nativeElement.querySelector('#project-title') as HTMLInputElement;

    expect(titleInput.maxLength).toBe(-1);
  });

  it('shows the title length error while typing values longer than 50 characters', () => {
    const titleControl = component.projectForm.controls.title;
    titleControl.setValue('a'.repeat(51));
    titleControl.markAsDirty();
    fixture.detectChanges();

    expect(titleControl.hasError('maxlength')).toBe(true);
    expect(fixture.nativeElement.querySelector('#project-title-error')).not.toBeNull();
    const titleInput = fixture.nativeElement.querySelector('#project-title') as HTMLInputElement;
    expect(titleInput.getAttribute('aria-invalid')).toBe('true');
  });
});

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
});

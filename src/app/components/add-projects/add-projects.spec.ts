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
});

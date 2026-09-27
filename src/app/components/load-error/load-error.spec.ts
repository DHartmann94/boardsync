import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadError } from './load-error';

describe('LoadError', () => {
  let component: LoadError;
  let fixture: ComponentFixture<LoadError>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadError],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadError);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

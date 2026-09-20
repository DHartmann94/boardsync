import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Startscreen } from './startscreen';

describe('Startscreen', () => {
  let component: Startscreen;
  let fixture: ComponentFixture<Startscreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Startscreen],
    }).compileComponents();

    fixture = TestBed.createComponent(Startscreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderMain } from './header-main';

describe('HeaderMain', () => {
  let component: HeaderMain;
  let fixture: ComponentFixture<HeaderMain>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderMain],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderMain);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

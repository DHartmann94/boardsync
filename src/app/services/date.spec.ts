import { TestBed } from '@angular/core/testing';

import { Date } from './date';

describe('Date', () => {
  let service: Date;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Date);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

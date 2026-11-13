import { TestBed } from '@angular/core/testing';

import { DateService } from './date';

describe('Date', () => {
  let service: DateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null for missing optional dates', () => {
    expect(service.parseOptionalDate(null)).toBeNull();
    expect(service.parseOptionalDate(undefined)).toBeNull();
  });

  it('should parse a provided optional date', () => {
    const date = new Date('2026-01-15T12:00:00.000Z');

    expect(service.parseOptionalDate(date)).toBe(date);
    expect(service.parseOptionalDate(date.toISOString())).toEqual(date);
  });
});

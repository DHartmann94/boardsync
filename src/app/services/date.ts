import { Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class DateService {

  // Browser time zone
  userLocale = navigator.language;

  parseDate(value: any): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    if (value instanceof Date) return value;
    return new Date();
  }
}

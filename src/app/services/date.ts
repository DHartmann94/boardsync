import { Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class DateService {

  // Browser time zone
  userLocale = navigator.language;

  /**
   * Konvertiert verschiedene Datumsformate in ein JavaScript-Date-Objekt.
   * 
   * Unterstützt Firestore-Timestamps, Strings, Zahlen und bereits bestehende Date-Objekte.
   * 
   * @param value Der zu konvertierende Wert (Timestamp, String, Number oder Date).
   * @returns Das konvertierte Date-Objekt oder das aktuelle Datum als Fallback.
   */
  parseDate(value: any): Date {
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    if (value instanceof Date) return value;
    return new Date();
  }
}

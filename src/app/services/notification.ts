import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ConfirmDialog } from '../components/confirm-dialog/confirm-dialog';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {

  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  private readonly horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  private readonly verticalPosition: MatSnackBarVerticalPosition = 'bottom';


  // Snackbar
  /**
   * Zeigt eine Snackbar-Benachrichtigung mit übersetztem Text und optionalen Parametern an.
   * 
   * @param key Der Übersetzungsschlüssel für die Nachricht.
   * @param duration Die Anzeigedauer in Millisekunden (bei Werten <= 0 unendlich).
   * @param panelClass Die CSS-Klasse für das Styling des Panels.
   * @param params Optional: Parameter zum Ersetzen von Platzhaltern in der Übersetzung.
   */
  private show(key: string, duration: number, panelClass: string, params?: object): void {
    const message = this.translate.instant(key, params);
    const action = this.translate.instant('general.close');

    this.snackBar.open(message, action, {
      duration: duration > 0 ? duration : undefined,
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      panelClass: [panelClass],
    });
  }

  showError(key: string, duration: number = 0, params?: object): void {
    this.show(key, duration, 'notification-error', params);
  }

  showSuccess(key: string, duration: number = 3000, params?: object): void {
    this.show(key, duration, 'notification-success', params);
  }

  dismiss(): void {
    this.snackBar.dismiss();
  }

  // Dialog
  /**
   * Öffnet einen Bestätigungsdialog mit übersetzten Texten und optionalen Aktionen.
   * 
   * @param titleKey Der Übersetzungsschlüssel für den Titel des Dialogs.
   * @param messageKey Der Übersetzungsschlüssel für die Nachricht.
   * @param confirmTextKey Der Übersetzungsschlüssel für den Bestätigungsbutton.
   * @param cancelTextKey Der Übersetzungsschlüssel für den Abbrechenbutton.
   * @param messageParams Optional: Parameter für Platzhalter in der Nachricht.
   * @param onConfirmAction Optional: Eine asynchrone Funktion, die bei Bestätigung ausgeführt wird.
   * @returns Ein Observable, das nach dem Schließen des Dialogs das Ergebnis (boolean) zurückgibt.
   */
  openConfirmDialog(
    titleKey: string,
    messageKey: string,
    confirmTextKey: string = 'general.confirm',
    cancelTextKey: string = 'general.cancel',
    messageParams?: object,
    onConfirmAction?: () => Promise<boolean>
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: {
        title: this.translate.instant(titleKey),
        message: this.translate.instant(messageKey, messageParams),
        confirmText: this.translate.instant(confirmTextKey),
        cancelText: this.translate.instant(cancelTextKey),
        onConfirmAction
      }
    });

    return dialogRef.afterClosed();
  }
}
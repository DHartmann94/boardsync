import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirmAction?: () => Promise<boolean>;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [
    MatDialogModule,
    MatCardModule,
    MatButtonModule,
    MatProgressBarModule,
    TranslatePipe
  ],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<ConfirmDialog>);

  isLoading = signal(false);

  async onConfirm() {
    if (!this.data.onConfirmAction) {
      this.dialogRef.close(true);
      return;
    }

    this.isLoading.set(true);
    try {
      const success = await this.data.onConfirmAction();
      this.dialogRef.close(success);
    } catch {
      this.isLoading.set(false);
    }
  }
}
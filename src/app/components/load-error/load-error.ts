import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TranslatePipe } from '@ngx-translate/core';

import { HeaderPublic } from '../../components/header-public/header-public';
import { FooterPublic } from '../../components/footer-public/footer-public';
import { UserService } from '../../services/user';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-load-error',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    HeaderPublic,
    FooterPublic
  ],
  templateUrl: './load-error.html',
  styleUrl: './load-error.scss',
})
export class LoadError {

  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly isRetrying = signal(false);

  /**
   * Stößt einen neuen Firestore-Load an (siehe `UserService.refresh()`).
   * Bei Erfolg leitet die App über den `state`-Effect ohnehin weiter, sobald
   * der Guard erneut greift – hier navigieren wir bewusst manuell zu `/main`,
   * damit der User nicht auf der Fehlerseite hängen bleibt, falls der Load
   * zwar erfolgreich war, aber kein automatischer Re-Guard-Check stattfindet.
   */
  async retry(): Promise<void> {
    this.isRetrying.set(true);

    try {
      await this.userService.refresh();

      if (this.userService.state().status === 'ready') {
        this.router.navigateByUrl('/main');
      } else {
        this.notificationService.showError('loadError.stillFailing');
      }
    } finally {
      this.isRetrying.set(false);
    }
  }
}

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { TranslatePipe } from '@ngx-translate/core';

import { UserService } from '../../services/user';
import { AuthenticationService } from '../../services/authentication';

@Component({
  selector: 'app-header-main',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatToolbarModule,
    MatMenuModule,
    MatDividerModule,
    TranslatePipe
  ],
  templateUrl: './header-main.html',
  styleUrl: './header-main.scss',
})
export class HeaderMain {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthenticationService);
  private readonly router = inject(Router);

  readonly currentUser = this.userService.currentUser;

  async logout(): Promise<void> {
    try {
      await this.authService.signOutUser();
      await this.router.navigate(['/sign-in']);
    } catch (error) {
      console.error('Fehler beim Abmelden:', error);
    }
  }
}
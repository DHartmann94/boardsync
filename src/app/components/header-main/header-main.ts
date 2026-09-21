import { Component, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-header-main',
  imports: [MatButtonModule, MatIconModule, MatListModule, MatToolbarModule],
  templateUrl: './header-main.html',
  styleUrl: './header-main.scss',
})
export class HeaderMain {
  readonly toggleSidebar = output<void>();

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }
}

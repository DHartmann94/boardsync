import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-sidebar-main',
  imports: [RouterLink, RouterLinkActive, MatButtonModule, MatListModule, MatIconModule, MatDividerModule],
  templateUrl: './sidebar-main.html',
  styleUrl: './sidebar-main.scss',
})
export class SidebarMain {
  readonly collapsed = input(false);
  
  readonly toggleSidebar = output<void>();

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }
}

import { Component, signal } from '@angular/core';
import { SidebarMain } from '../sidebar-main/sidebar-main';
import { HeaderMain } from '../header-main/header-main';
import {  RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-main',
  imports: [RouterOutlet, SidebarMain, HeaderMain, MatSidenavModule, MatToolbarModule, MatButtonModule, MatIconModule, MatListModule],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {
  readonly sidebarCollapsed = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }
}

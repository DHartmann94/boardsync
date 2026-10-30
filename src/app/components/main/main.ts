import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, signal } from '@angular/core';
import { SidebarMain } from '../sidebar-main/sidebar-main';
import { HeaderMain } from '../header-main/header-main';
import { RouterOutlet } from '@angular/router';
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
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly isMobile = signal(this.breakpointObserver.isMatched('(max-width: 768px)'));
  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpened = signal(false);

  constructor() {
    this.breakpointObserver.observe('(max-width: 768px)').subscribe(({ matches }) => {
      this.isMobile.set(matches);
      if (!matches) {
        this.mobileSidebarOpened.set(false);
      }
    });
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.mobileSidebarOpened.update((opened) => !opened);
      return;
    }

    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  onSidebarOpenedChange(opened: boolean): void {
    if (this.isMobile()) {
      this.mobileSidebarOpened.set(opened);
    }
  }
}

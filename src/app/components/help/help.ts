import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    TranslatePipe
  ],
  templateUrl: './help.html',
  styleUrl: './help.scss',
})
export class Help {
  private readonly location = inject(Location);

  readonly steps = [
    { key: 'projects', icon: 'folder_open' },
    { key: 'tasks', icon: 'task' },
    { key: 'board', icon: 'view_kanban' },
    { key: 'drag', icon: 'drag_indicator' }
  ];

  readonly tips = [
    { key: 'tip1', icon: 'lightbulb' },
    { key: 'tip2', icon: 'group' },
    { key: 'tip3', icon: 'sync' }
  ];

  goBack(): void {
    this.location.back();
  }
}
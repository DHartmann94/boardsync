import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { HeaderPublic } from '../../components/header-public/header-public';
import { FooterPublic } from '../../components/footer-public/footer-public';

@Component({
  selector: 'app-imprint',
  standalone: true,
  imports: [
    MatCardModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule,
    HeaderPublic,
    FooterPublic
  ],
  templateUrl: './imprint.html',
  styleUrl: './imprint.scss',
})
export class Imprint {

  private readonly location = inject(Location);


  navigateBack(): void {
    this.location.back();
  }
}
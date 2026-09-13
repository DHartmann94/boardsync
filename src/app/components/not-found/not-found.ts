import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { TranslatePipe } from '@ngx-translate/core';

import { HeaderPublic } from '../../components/header-public/header-public';
import { FooterPublic } from '../../components/footer-public/footer-public';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    TranslatePipe,
    HeaderPublic,
    FooterPublic
  ],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {


  private readonly location = inject(Location);

  navigateBack(): void {
    this.location.back();
  }
}
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-footer-public',
  imports: [
    RouterLink,
    TranslatePipe
  ],
  templateUrl: './footer-public.html',
  styleUrl: './footer-public.scss',
})
export class FooterPublic { }

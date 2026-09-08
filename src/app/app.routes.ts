import { Routes } from '@angular/router';
import { SignIn } from './components/sign-in/sign-in';

export const routes: Routes = [
  { path: '', redirectTo: 'sign-in', pathMatch: 'full' }, // Startscreen
  { path: 'sign-in', component: SignIn },

  { path: '**', redirectTo: 'sign-in' } // 404 noch erstellen
];
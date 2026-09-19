import { Routes } from '@angular/router';
import { SignIn } from './components/sign-in/sign-in';
import { SignUp } from './components/sign-up/sign-up';
import { ResetPassword } from './components/reset-password/reset-password';
import { Imprint } from './components/imprint/imprint';
import { Privacy } from './components/privacy/privacy';
import { NotFound } from './components/not-found/not-found';

export const routes: Routes = [
  { path: '', redirectTo: 'sign-in', pathMatch: 'full' },
  { path: 'sign-in', component: SignIn },
  { path: 'sign-up', component: SignUp },
  { path: 'reset-password', component: ResetPassword },
  { path: 'imprint', component: Imprint },
  { path: 'privacy', component: Privacy },

  // 404-Fallback
  { path: '**', component: NotFound }
];
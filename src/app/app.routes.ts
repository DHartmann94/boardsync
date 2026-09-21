import { Routes } from '@angular/router';
import { SignIn } from './components/sign-in/sign-in';
import { SignUp } from './components/sign-up/sign-up';
import { ResetPassword } from './components/reset-password/reset-password';
import { Imprint } from './components/imprint/imprint';
import { Privacy } from './components/privacy/privacy';
import { NotFound } from './components/not-found/not-found';
import { Main } from './components/main/main';
import { AddTasks } from './components/add-tasks/add-tasks';

export const routes: Routes = [
  { path: '', redirectTo: 'sign-in', pathMatch: 'full' },
  { path: 'sign-in', component: SignIn },
  { path: 'sign-up', component: SignUp },
  { path: 'reset-password', component: ResetPassword },
  { path: 'imprint', component: Imprint },
  { path: 'privacy', component: Privacy },
  {
    path: 'main',
    component: Main,
    children: [
      { path: 'add-tasks', component: AddTasks },
      //{ path: '', redirectTo: 'add-tasks', pathMatch: 'full' },
    ],
  },
  
 // 404-Fallback
  { path: '**', component: NotFound }
];
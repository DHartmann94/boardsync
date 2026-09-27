import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { NotificationService } from '../services/notification';
import { UserService } from '../services/user';

/**
 * Rollen-Rangfolge: höhere Rolle darf alles, was niedrigere darf.
 * Neue Rollen hier eintragen. Unbekannte/leere Rollen bekommen Rang 0 (fail closed).
 */
const ROLE_RANK: Record<string, number> = {
  user: 1,
  admin: 2,
};

/**
 * Prüft, ob `userRole` mindestens den Rang von `requiredRole` hat (siehe `ROLE_RANK`).
 *
 * Unbekannte Rollen werden "fail closed" behandelt:
 * - Eine unbekannte `userRole` bekommt Rang 0 -> erfüllt keine Anforderung.
 * - Eine unbekannte `requiredRole` bekommt Rang Infinity -> kann von niemandem erfüllt werden.
 *   Das verhindert, dass ein Tippfehler bei `data: { role: '...' }` versehentlich jeden durchlässt.
 *
 * @param userRole - Rolle des aktuellen Users (aus `UserInterface.role`).
 * @param requiredRole - Für die Route geforderte Mindestrolle.
 * @returns `true`, wenn `userRole` ausreicht, um `requiredRole` zu erfüllen.
 */
const hasRequiredRole = (userRole: string, requiredRole: string): boolean =>
  (ROLE_RANK[userRole] ?? 0) >= (ROLE_RANK[requiredRole] ?? Number.POSITIVE_INFINITY);


export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const userService = inject(UserService);
  const notificationService = inject(NotificationService);

  // Optional pro Route: data: { role: 'admin' }
  const requiredRole = route.data['role'] as string | undefined;

  // Wartet, bis Auth-Check + Firestore-Load durch sind (oder Timeout -> 'error')
  const state = await userService.isReady();

  switch (state.status) {
    case 'signedOut':
      return router.createUrlTree(['/sign-in']);

    case 'error':
      // Eingeloggt, aber User-Daten nicht ladbar (Netzwerk, Timeout, ...).
      // Fehlerseite mit Retry-Button (-> userService.refresh()) statt leerer Seite.
      notificationService.showError('guard.loadUserDataError');
      return router.createUrlTree(['/load-error']);

    case 'ready':
      if (requiredRole && !hasRequiredRole(state.user.role, requiredRole)) {
        notificationService.showError('guard.noPermission');
        return false;
      }
      return true;

    default:
      // 'loading' kann nach isReady() nicht mehr vorkommen
      return false;
  }
}

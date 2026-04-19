import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] as string[] | undefined) ?? [];
  const currentRole = authService.getCurrentUser()?.role;

  if (!authService.isAuthenticated() || !currentRole) {
    return router.createUrlTree(['/']);
  }

  if (allowedRoles.length === 0 || allowedRoles.includes(currentRole)) {
    return true;
  }

  return router.createUrlTree([authService.getRouteForRole(currentRole)]);
};
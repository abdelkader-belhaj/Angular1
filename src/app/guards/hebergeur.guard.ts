import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const hebergeurGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.getCurrentUser()?.role === 'HEBERGEUR') {
    return true;
  }

  return router.createUrlTree(['/']);
};

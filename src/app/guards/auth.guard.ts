import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
    console.log('=== AUTH GUARD RUNNING ===');
  console.log('auth_token:', localStorage.getItem('auth_token'));
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('token key:', localStorage.getItem('token'));
  console.log('auth_token key:', localStorage.getItem('auth_token'));
  console.log('isAuthenticated:', authService.isAuthenticated());

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};

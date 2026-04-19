// src/app/features/transport/core/guards/est-client.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

export const estClientGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  const role = (user?.role ?? '').toUpperCase().replace(/^ROLE_/, '');

  if (role === 'CLIENT_TOURISTE' || role === 'CLIENT') {
    return true;
  }

  return router.createUrlTree(['/transport']);
};

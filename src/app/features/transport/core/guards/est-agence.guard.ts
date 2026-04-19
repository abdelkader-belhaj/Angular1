// src/app/features/transport/core/guards/est-agence.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

export const estAgenceGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  const role = (user?.role ?? '').toUpperCase().replace(/^ROLE_/, '');

  if (role === 'TRANSPORTEUR') {
    return true;
  }

  return router.createUrlTree(['/transport']);
};

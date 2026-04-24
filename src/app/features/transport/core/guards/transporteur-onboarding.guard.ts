import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { forkJoin, map, of, catchError } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';
import { ChauffeurService } from '../services/chauffeur.service';
import { AgenceService } from '../services/agence.service';

export const transporteurOnboardingGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const chauffeurService = inject(ChauffeurService);
  const agenceService = inject(AgenceService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  const normalizedRole = (user?.role ?? '').toUpperCase().replace(/^ROLE_/, '');

  if (normalizedRole !== 'TRANSPORTEUR') {
    return true;
  }

  const userId = Number(user?.id ?? 0);
  if (!Number.isFinite(userId) || userId <= 0) {
    return router.createUrlTree(['/']);
  }

  return forkJoin({
    chauffeurId: chauffeurService.resolveChauffeurIdByUserId(userId),
    agenceId: agenceService.resolveAgenceIdByUserId(userId),
  }).pipe(
    map(({ chauffeurId, agenceId }) => {
      const currentUrl = state.url || '';
      const isTransportRoot =
        currentUrl === '/transport' ||
        currentUrl === '/transport/' ||
        currentUrl === '/transporteur' ||
        currentUrl === '/transporteur/';

      if (isTransportRoot && agenceId) {
        return router.createUrlTree(['/transport/location/agence/dashboard']);
      }

      if (isTransportRoot && chauffeurId) {
        return router.createUrlTree(['/transport/chauffeur-dashboard']);
      }

      if (chauffeurId || agenceId) {
        return true;
      }

      return router.createUrlTree(['/transport/onboarding-transporteur']);
    }),
    catchError(() =>
      of(router.createUrlTree(['/transport/onboarding-transporteur'])),
    ),
  );
};

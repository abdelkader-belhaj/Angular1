import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

export const estChauffeurGuard: CanActivateFn = () => {
  return true; // ← Tout le monde peut passer pendant le test
};

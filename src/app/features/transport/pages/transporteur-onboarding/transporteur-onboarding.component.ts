import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';
import { ChauffeurService } from '../../core/services/chauffeur.service';
import { AgenceService } from '../../core/services/agence.service';

@Component({
  selector: 'app-transporteur-onboarding',
  templateUrl: './transporteur-onboarding.component.html',
  styleUrl: './transporteur-onboarding.component.css',
})
export class TransporteurOnboardingComponent implements OnInit {
  mode: 'choix' | 'chauffeur' | 'agence' = 'choix';
  submitting = false;
  errorMessage = '';

  chauffeurForm = {
    telephone: '',
    numeroLicence: '',
  };

  agenceForm = {
    nomAgence: '',
    telephone: '',
    adresse: '',
  };

  constructor(
    private readonly authService: AuthService,
    private readonly chauffeurService: ChauffeurService,
    private readonly agenceService: AgenceService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    const userId = Number(currentUser?.id ?? 0);
    const role = (currentUser?.role ?? '').toUpperCase().replace(/^ROLE_/, '');

    if (role !== 'TRANSPORTEUR' || !Number.isFinite(userId) || userId <= 0) {
      void this.router.navigate(['/transport']);
      return;
    }

    forkJoin({
      chauffeurId: this.chauffeurService.resolveChauffeurIdByUserId(userId),
      agenceId: this.agenceService.resolveAgenceIdByUserId(userId),
    }).subscribe({
      next: ({ chauffeurId, agenceId }) => {
        if (agenceId) {
          void this.router.navigate(['/transport/location/agence/dashboard']);
          return;
        }

        if (chauffeurId) {
          void this.router.navigate(['/transport/chauffeur-dashboard']);
        }
      },
      error: () => {
        // No profile yet or transient API issue: stay on onboarding page.
      },
    });
  }

  choisirChauffeur(): void {
    this.mode = 'chauffeur';
    this.errorMessage = '';
  }

  choisirAgence(): void {
    this.mode = 'agence';
    this.errorMessage = '';
  }

  retourChoix(): void {
    this.mode = 'choix';
    this.errorMessage = '';
  }

  submitChauffeur(): void {
    const currentUser = this.authService.getCurrentUser();
    const userId = Number(currentUser?.id ?? 0);

    if (
      !this.chauffeurForm.telephone.trim() ||
      !this.chauffeurForm.numeroLicence.trim()
    ) {
      this.errorMessage = 'Veuillez remplir telephone et numero de licence.';
      return;
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      this.errorMessage = 'Utilisateur introuvable. Reconnectez-vous.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.chauffeurService
      .createChauffeur({
        utilisateurId: userId,
        telephone: this.chauffeurForm.telephone.trim(),
        numeroLicence: this.chauffeurForm.numeroLicence.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          void this.router.navigate(['/transport/chauffeur-dashboard']);
        },
        error: (error) => {
          this.submitting = false;
          this.errorMessage =
            error?.error?.message ??
            error?.message ??
            'Creation du profil chauffeur impossible.';
        },
      });
  }

  submitAgence(): void {
    const currentUser = this.authService.getCurrentUser();
    const userId = Number(currentUser?.id ?? 0);

    if (!this.agenceForm.nomAgence.trim()) {
      this.errorMessage = "Le nom de l'agence est obligatoire.";
      return;
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      this.errorMessage = 'Utilisateur introuvable. Reconnectez-vous.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.agenceService
      .createAgence({
        nomAgence: this.agenceForm.nomAgence.trim(),
        telephone: this.agenceForm.telephone.trim() || undefined,
        adresse: this.agenceForm.adresse.trim() || undefined,
        utilisateur: { id: userId },
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          void this.router.navigate(['/transport/location/agence/dashboard']);
        },
        error: (error) => {
          this.submitting = false;
          this.errorMessage =
            error?.error?.message ??
            error?.message ??
            'Creation du profil agence impossible.';
        },
      });
  }
}

// src/app/features/transport/layouts/layout-chauffeur/layout-chauffeur.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChauffeurService } from '../../core/services/chauffeur.service';
import { NotificationService } from '../../core/services/notification.service';
import { DisponibiliteStatut } from '../../core/models';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-layout-chauffeur',
  templateUrl: './layout-chauffeur.component.html',
  styleUrls: ['./layout-chauffeur.component.css'],
})
export class LayoutChauffeurComponent implements OnInit {
  chauffeurId: number | null = null;
  isOnline = false;

  constructor(
    private chauffeurService: ChauffeurService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initializeLayoutContext();
  }

  private initializeLayoutContext(): void {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      this.isOnline = false;
      return;
    }

    this.chauffeurService.resolveChauffeurIdByUserId(currentUser.id).subscribe({
      next: (id) => {
        this.chauffeurId = id;
        if (!this.chauffeurId) {
          this.isOnline = false;
          return;
        }

        this.loadCurrentStatus();
      },
      error: () => (this.isOnline = false),
    });
  }

  private loadCurrentStatus(): void {
    if (!this.chauffeurId) {
      this.isOnline = false;
      return;
    }

    this.chauffeurService.getProfil(this.chauffeurId).subscribe({
      next: (chauffeur) => {
        this.isOnline =
          chauffeur.disponibilite === DisponibiliteStatut.AVAILABLE;
      },
      error: () => (this.isOnline = false),
    });
  }

  /** Changement du toggle (switch) */
  onDisponibiliteChange(event: any): void {
    if (!this.chauffeurId) {
      this.isOnline = false;
      return;
    }

    const isNowOnline = event.checked;

    const action$ = isNowOnline
      ? this.chauffeurService.goOnline(this.chauffeurId)
      : this.chauffeurService.goOffline(this.chauffeurId);

    action$.subscribe({
      next: (chauffeur) => {
        this.isOnline =
          chauffeur.disponibilite === DisponibiliteStatut.AVAILABLE;

        this.notificationService.success(
          'Statut mis à jour',
          this.isOnline
            ? '✅ Vous êtes maintenant en ligne'
            : '⛔ Vous êtes hors ligne',
        );
      },
      error: () => {
        this.notificationService.error(
          'Erreur',
          'Impossible de changer le statut',
        );
        // Revenir à l'état visuel précédent
        this.isOnline = !isNowOnline;
      },
    });
  }

  logout(): void {
    // TODO: implémenter logout réel
    this.router.navigate(['/login']);
  }
}

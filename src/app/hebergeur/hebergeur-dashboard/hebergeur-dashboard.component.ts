import { Component, OnInit, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-hebergeur-dashboard',
  templateUrl: './hebergeur-dashboard.component.html',
  styleUrls: ['./hebergeur-dashboard.component.css']
})
export class HebergeurDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  pageTitle = 'TunisiaTour';
  pageSubtitle = 'Pilotez vos logements comme un administration pro.';

  ngOnInit(): void {
    this.updateTitle(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.updateTitle(e.urlAfterRedirects);
    });
  }

  updateTitle(url: string): void {
    if (url.includes('/reclamations')) {
      this.pageTitle = 'Reclamations';
      this.pageSubtitle = 'Suivez et traitez les réclamations de vos clients.';
    } else if (url.includes('/reservations')) {
      this.pageTitle = 'Reservations';
      this.pageSubtitle = 'Consultez et gérez vos réservations en cours.';
    } else if (url.includes('/logements/ajout')) {
      this.pageTitle = 'Nouveau logement';
      this.pageSubtitle = 'Publiez une annonce complète.';
    } else if (url.includes('/categories')) {
      this.pageTitle = 'Catégories';
      this.pageSubtitle = '';
    } else if (url.includes('/logements')) {
      this.pageTitle = 'Mes logements';
      this.pageSubtitle = 'Liste, recherche, filtres et actions sur chaque bien.';
    } else if (url.includes('/parametres')) {
      this.pageTitle = 'Paramètres';
      this.pageSubtitle = 'Profil, notifications et sécurité.';
    } else if (url.includes('/notifications')) {
      this.pageTitle = 'Notifications';
      this.pageSubtitle = 'Suivez les actions sur vos logements.';
    } else {
      this.pageTitle = 'Tableau de bord';
      this.pageSubtitle = 'Indicateurs clés, tendances et activité récente.';
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/'])
    });
  }
}

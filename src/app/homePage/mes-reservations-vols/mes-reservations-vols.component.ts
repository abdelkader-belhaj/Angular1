import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ReservationVolService } from '../../services/transport/reservation-vol.service';

@Component({
  selector: 'app-mes-reservations-vols',
  templateUrl: './mes-reservations-vols.component.html',
  styleUrl: './mes-reservations-vols.component.css'
})
export class MesReservationsVolsComponent implements OnInit {
  reservations: any[] = [];
  confirmedCount: number = 0;
  loading: boolean = true;
  error: string = '';
  isDarkMode = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private reservationVolService: ReservationVolService
  ) {}

  ngOnInit(): void {
    // Vérifier que l'utilisateur est bien un client touriste
    const user = this.authService.getCurrentUser();
    if (!this.authService.isAuthenticated() || !user || user.role !== 'CLIENT_TOURISTE') {
      this.router.navigate(['/']);
      return;
    }

    this.loadThemeMode();
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;
    this.error = '';
    
    // Récupérer l'ID de l'utilisateur connecté
    const userId = this.authService.getCurrentUser()?.id;
    
    if (!userId) {
      this.error = 'Utilisateur non connecté';
      this.loading = false;
      return;
    }

    // Charger les réservations de vol pour ce client
    this.reservationVolService.getReservationsByClient(userId).subscribe({
      next: (reservations) => {
        this.reservations = reservations;
        this.confirmedCount = (this.reservations || []).filter(r => r.statut === 'confirmee').length;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement réservations vols', err);
        this.error = 'Impossible de charger vos réservations de vol. Veuillez réessayer plus tard.';
        this.reservations = [];
        this.loading = false;
      }
    });
  }

  private loadThemeMode(): void {
    try {
      const raw = localStorage.getItem('mes_reservations_vols_dark_mode');
      this.isDarkMode = raw === '1';
    } catch {
      this.isDarkMode = false;
    }
  }

  toggleThemeMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('mes_reservations_vols_dark_mode', this.isDarkMode ? '1' : '0');
  }

  // Méthodes pour gérer les réservations de vol
  annulerReservation(reservationId: number): void {
    if (confirm('Êtes-vous sûr de vouloir annuler cette réservation de vol ?')) {
      this.reservationVolService.annulerReservation(reservationId).subscribe({
        next: () => {
          this.loadReservations(); // Recharger la liste
        },
        error: (err) => {
          console.error('Erreur annulation réservation', err);
          alert('Erreur lors de l\'annulation. Veuillez réessayer.');
        }
      });
    }
  }

  voirDetails(reservationId: number): void {
    this.router.navigate(['/billet', reservationId]);
  }

  retourAccueil(): void {
    this.router.navigate(['/homePage']);
  }

  // Formater les dates
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Obtenir le statut formaté
  getStatutLibelle(statut: string): string {
    switch (statut?.toLowerCase()) {
      case 'confirmee':
        return '✅ Confirmée';
      case 'en_attente':
        return '⏳ En attente';
      case 'annulee':
        return '❌ Annulée';
      case 'en_cours':
        return '🛫 En cours';
      case 'terminee':
        return '✈️ Terminée';
      default:
        return statut || 'Inconnu';
    }
  }

  // Obtenir la couleur du statut
  getStatutColor(statut: string): string {
    switch (statut?.toLowerCase()) {
      case 'confirmee':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'en_attente':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'annulee':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'en_cours':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'terminee':
        return 'text-slate-700 bg-slate-50 border-slate-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { ReservationResponse, ReservationService } from '../../services/accommodation/reservation.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-hebergeur-reservations',
  templateUrl: './hebergeur-reservations.component.html',
  styleUrls: ['./hebergeur-reservations.component.css']
})
export class HebergeurReservationsComponent implements OnInit {
  reservations: ReservationResponse[] = [];
  loading = true;
  error = '';
  viewMode: 'all' | 'active' | 'archived' = 'active';
  actionLoadingId: number | null = null;

  private readonly reservationService = inject(ReservationService);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.error = 'Utilisateur non connecté.';
      this.loading = false;
      return;
    }

    this.loading = true;
    // Le backend getAll() filtre automatiquement selon le rôle :
    // HEBERGEUR → seulement les réservations de ses logements
    this.reservationService.getAllReservations().subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.reservations = data.sort((a, b) =>
            new Date(b.dateReservation).getTime() - new Date(a.dateReservation).getTime()
          );
        } else {
          const anyData = data as any;
          const list = anyData?.data ?? anyData?.content ?? [];
          this.reservations = list.sort((a: ReservationResponse, b: ReservationResponse) =>
            new Date(b.dateReservation).getTime() - new Date(a.dateReservation).getTime()
          );
        }
        this.actionLoadingId = null;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Erreur lors du chargement des réservations.';
        this.actionLoadingId = null;
        this.loading = false;
      }
    });
  }

  get visibleReservations(): ReservationResponse[] {
    if (this.viewMode === 'archived') {
      return this.reservations.filter(res => !!res.archived);
    }

    if (this.viewMode === 'active') {
      return this.reservations.filter(res => !res.archived);
    }

    return this.reservations;
  }

  setViewMode(mode: 'all' | 'active' | 'archived'): void {
    this.viewMode = mode;
  }

  archiveReservation(reservation: ReservationResponse): void {
    this.actionLoadingId = reservation.idReservation;
    this.reservationService.archiveReservation(reservation.idReservation).subscribe({
      next: () => this.loadReservations(),
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible d’archiver la réservation.';
        this.actionLoadingId = null;
      }
    });
  }

  unarchiveReservation(reservation: ReservationResponse): void {
    this.actionLoadingId = reservation.idReservation;
    this.reservationService.unarchiveReservation(reservation.idReservation).subscribe({
      next: () => this.loadReservations(),
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de restaurer la réservation.';
        this.actionLoadingId = null;
      }
    });
  }

  getRowClass(reservation: ReservationResponse): string {
    return reservation.archived ? 'bg-slate-50/70 opacity-80' : '';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  getStatusClass(status: string): string {
    if (!status) return 'bg-slate-100 text-slate-800';
    const s = status.toLowerCase();
    if (s === 'confirmee') return 'bg-emerald-50 text-emerald-700';
    if (s === 'annulee') return 'bg-rose-50 text-rose-700';
    if (s === 'en_attente') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-800';
  }

  getArchiveLabel(reservation: ReservationResponse): string {
    return reservation.archived ? 'Archivée' : 'Active';
  }

  getStatusLabel(status: string): string {
    if (!status) return 'Inconnu';
    const s = status.toLowerCase();
    if (s === 'confirmee') return 'Confirmée';
    if (s === 'annulee') return 'Annulée';
    if (s === 'en_attente') return 'En attente';
    return status;
  }
}

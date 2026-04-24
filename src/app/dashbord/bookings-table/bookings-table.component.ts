 
import { Component, OnInit, inject } from '@angular/core';
import { ReservationResponse, ReservationService } from '../../services/accommodation/reservation.service';
import {
  ReservationLocation,
  ReservationStatus,
} from '../../features/transport/core/models';
import { LocationService } from '../../features/transport/core/services/location.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-bookings-table',
  templateUrl: './bookings-table.component.html',
  styleUrl: './bookings-table.component.css',
})
export class BookingsTableComponent implements OnInit {
  reservations: ReservationResponse[] = [];
  loading = true;
  error = '';
  viewMode: 'all' | 'active' | 'archived' = 'active';
  actionLoadingId: number | null = null;
  activeReservations: ReservationLocation[] = [];
  isLoading = false;

  private readonly reservationService = inject(ReservationService);

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadReservations();
    this.loadActiveReservations();
  }

  loadReservations(): void {
    this.loading = true;
    // Le backend getAll() filtre automatiquement selon le rôle :
    // ADMIN → toutes les réservations
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

  deleteReservation(reservation: ReservationResponse): void {
    if (!confirm(`Delete reservation #${reservation.idReservation} ?`)) return;
    this.actionLoadingId = reservation.idReservation;
    this.reservationService.deleteReservation(reservation.idReservation).subscribe({
      next: () => this.loadReservations(),
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de supprimer la réservation.';
        this.actionLoadingId = null;
      }
    });
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

  getRowClass(reservation: ReservationResponse): string {
    return reservation.archived ? 'bg-slate-50/70 opacity-80' : '';
  }

  getStatusLabel(status: string): string {
    if (!status) return 'Inconnu';
    const s = status.toLowerCase();
    if (s === 'confirmee') return 'Confirmée';
    if (s === 'annulee') return 'Annulée';
    if (s === 'en_attente') return 'En attente';
    return status;
  }

  getArchiveLabel(reservation: ReservationResponse): string {
    return reservation.archived ? 'Archivée' : 'Active';
  }

  private loadActiveReservations(): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) {
      return;
    }

    this.isLoading = true;
    this.locationService.resolveAgencyByUserId(userId).subscribe({
      next: (agency) => {
        if (!agency?.idAgence) {
          this.isLoading = false;
          return;
        }

        this.locationService
          .getReservationsByAgence(agency.idAgence)
          .subscribe({
            next: (reservations) => {
              this.activeReservations = reservations
                .filter((reservation) =>
                  [
                    ReservationStatus.IN_PROGRESS,
                    ReservationStatus.ACTIVE,
                  ].includes(reservation.statut),
                )
                .sort(
                  (a, b) =>
                    new Date(a.dateFin).getTime() -
                    new Date(b.dateFin).getTime(),
                );
              this.isLoading = false;
            },
            error: () => {
              this.isLoading = false;
            },
          });
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  getClientName(reservation: ReservationLocation): string {
    return reservation.client?.username || 'Client';
  }

  getVehicleName(reservation: ReservationLocation): string {
    const brand = reservation.vehiculeAgence?.marque || '';
    const model = reservation.vehiculeAgence?.modele || '';
    const label = `${brand} ${model}`.trim();
    return label || `Véhicule #${reservation.vehiculeAgenceId || '-'}`;
  }
}

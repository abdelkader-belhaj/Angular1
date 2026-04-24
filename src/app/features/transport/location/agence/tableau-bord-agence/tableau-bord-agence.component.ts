import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  AgenceLocation,
  ReservationLocation,
  ReservationStatus,
  VehiculeAgence,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-tableau-bord-agence',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tableau-bord-agence.component.html',
  styleUrl: './tableau-bord-agence.component.css',
})
export class TableauBordAgenceComponent implements OnInit, OnDestroy {
  agency: AgenceLocation | null = null;
  vehicles: VehiculeAgence[] = [];
  reservations: ReservationLocation[] = [];
  isLoading = false;
  error = '';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.loadDashboard();
    }, 15000);
  }

  get currentUserId(): number | null {
    return this.authService.getCurrentUser()?.id ?? null;
  }

  get activeVehicles(): VehiculeAgence[] {
    return this.vehicles.filter((vehicle) => vehicle.statut === 'ACTIVE');
  }

  get pendingReservations(): ReservationLocation[] {
    return this.reservations.filter((reservation) =>
      [
        ReservationStatus.PENDING,
        ReservationStatus.DRAFT,
        ReservationStatus.KYC_PENDING,
      ].includes(reservation.statut),
    );
  }

  get confirmedReservations(): ReservationLocation[] {
    return this.reservations.filter((reservation) =>
      [
        ReservationStatus.CONFIRMED,
        ReservationStatus.DEPOSIT_HELD,
        ReservationStatus.CONTRACT_SIGNED,
        ReservationStatus.CHECKOUT_PENDING,
        ReservationStatus.IN_PROGRESS,
      ].includes(reservation.statut),
    );
  }

  get advancePendingReservations(): ReservationLocation[] {
    return this.reservations.filter(
      (reservation) =>
        reservation.statut === ReservationStatus.DRAFT ||
        reservation.advanceStatus === 'PENDING' ||
        reservation.paymentPhase === 'ADVANCE_PENDING',
    );
  }

  get advancePaidReservations(): ReservationLocation[] {
    return this.reservations.filter(
      (reservation) =>
        reservation.advanceStatus === 'PAID' ||
        reservation.paymentPhase === 'ADVANCE_PAID',
    );
  }

  get totalAdvanceCollected(): number {
    return this.advancePaidReservations.reduce(
      (total, reservation) => total + (reservation.advanceAmount ?? 0),
      0,
    );
  }

  get totalDepositExpected(): number {
    return this.reservations.reduce(
      (total, reservation) => total + (reservation.depositAmount ?? 0),
      0,
    );
  }

  get revenueEstimate(): number {
    return this.reservations
      .filter((reservation) =>
        [
          ReservationStatus.CONFIRMED,
          ReservationStatus.CHECKOUT_PENDING,
          ReservationStatus.IN_PROGRESS,
          ReservationStatus.COMPLETED,
        ].includes(reservation.statut),
      )
      .reduce((total, reservation) => total + (reservation.prixTotal ?? 0), 0);
  }

  get recentReservations(): ReservationLocation[] {
    return [...this.reservations].sort((left, right) => {
      const leftDate = new Date(
        left.dateCreation ?? left.dateDebut ?? '',
      ).getTime();
      const rightDate = new Date(
        right.dateCreation ?? right.dateDebut ?? '',
      ).getTime();
      return rightDate - leftDate;
    });
  }

  loadDashboard(): void {
    const userId = this.currentUserId;

    if (!userId) {
      this.error = "Aucun utilisateur connecté n'a été trouvé.";
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.locationService
      .resolveAgencyByUserId(userId)
      .pipe(
        switchMap((agency: AgenceLocation | null) => {
          this.agency = agency;

          if (!agency) {
            return of<{
              vehicles: VehiculeAgence[];
              reservations: ReservationLocation[];
            }>({ vehicles: [], reservations: [] });
          }

          return forkJoin({
            vehicles: this.locationService
              .getVehiculesByAgence(agency.idAgence)
              .pipe(
                catchError((error) => {
                  this.error =
                    error?.message ||
                    "Impossible de charger les véhicules de l'agence.";
                  return of([] as VehiculeAgence[]);
                }),
              ),
            reservations: this.locationService
              .getReservationsByAgence(agency.idAgence)
              .pipe(
                catchError((error) => {
                  this.error =
                    error?.message ||
                    "Impossible de charger les réservations de l'agence.";
                  return of([] as ReservationLocation[]);
                }),
              ),
          });
        }),
        catchError((error) => {
          this.error =
            error?.message ||
            "Impossible de charger le tableau de bord de l'agence.";
          return of<{
            vehicles: VehiculeAgence[];
            reservations: ReservationLocation[];
          }>({ vehicles: [], reservations: [] });
        }),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe(
        (result: {
          vehicles: VehiculeAgence[];
          reservations: ReservationLocation[];
        }) => {
          this.vehicles = result.vehicles;
          this.reservations = result.reservations;
        },
      );
  }

  getStatusLabel(status: ReservationStatus): string {
    switch (status) {
      case ReservationStatus.PENDING:
        return 'En attente';
      case ReservationStatus.DRAFT:
        return 'Brouillon';
      case ReservationStatus.KYC_PENDING:
        return 'KYC en attente';
      case ReservationStatus.DEPOSIT_HELD:
        return 'Caution bloquée';
      case ReservationStatus.CONTRACT_SIGNED:
        return 'Contrat signé';
      case ReservationStatus.CONFIRMED:
        return 'Confirmée';
      case ReservationStatus.IN_PROGRESS:
        return 'En cours';
      case ReservationStatus.CHECKOUT_PENDING:
        return 'Active';
      case ReservationStatus.COMPLETED:
        return 'Terminée';
      case ReservationStatus.CANCELLED_BY_AGENCY:
        return 'Annulée';
      default:
        return status;
    }
  }

  getReservationSummary(reservation: ReservationLocation): string {
    const clientName = reservation.client
      ? reservation.client.username
      : 'Client';
    const vehicleName = this.getVehicleLabel(reservation);
    return `${clientName} - ${vehicleName}`;
  }

  getPaymentSummary(reservation: ReservationLocation): string {
    if (reservation.advanceStatus === 'PAID') {
      return 'Avance payée';
    }

    if (reservation.advanceStatus === 'FAILED') {
      return 'Avance refusée';
    }

    if (reservation.advanceStatus === 'HELD') {
      return 'Carte préautorisée';
    }

    if (reservation.statut === ReservationStatus.DRAFT) {
      return 'En attente de paiement';
    }

    return 'Paiement à traiter';
  }

  getVehicleLabel(reservation: ReservationLocation): string {
    const vehicle =
      reservation.vehiculeAgence ??
      this.vehicles.find(
        (item) => item.idVehiculeAgence === reservation.vehiculeAgenceId,
      );

    if (!vehicle) {
      return reservation.vehiculeAgenceId
        ? `Véhicule #${reservation.vehiculeAgenceId}`
        : 'Véhicule';
    }

    const brand = vehicle.marque || '';
    const model = vehicle.modele || '';
    return `${brand} ${model}`.trim();
  }
}

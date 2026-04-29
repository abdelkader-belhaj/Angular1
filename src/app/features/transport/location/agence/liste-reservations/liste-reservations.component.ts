import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  AgenceLocation,
  ReservationLocation,
  ReservationStatus,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-liste-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './liste-reservations.component.html',
  styleUrl: './liste-reservations.component.css',
})
export class ListeReservationsComponent implements OnInit, OnDestroy {
  agency: AgenceLocation | null = null;
  reservations: ReservationLocation[] = [];
  isLoading = false;
  error = '';
  selectedStatus = 'ALL';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly statusOptions = ['ALL', ...Object.values(ReservationStatus)];

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error = 'Aucune session détectée.';
      return;
    }

    this.isLoading = true;
    this.locationService
      .resolveAgencyByUserId(userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (agency) => {
          this.agency = agency;

          if (!this.agency) {
            this.error = 'Agence de location introuvable pour ce compte.';
            return;
          }

          this.loadReservations();
          this.startAutoRefresh();
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de charger votre agence.';
        },
      });
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
      this.loadReservations();
    }, 15000);
  }

  private loadReservations(): void {
    if (!this.agency) {
      return;
    }

    this.locationService
      .getReservationsByAgence(this.agency.idAgence)
      .subscribe({
        next: (reservations) => {
          this.reservations = [...reservations].sort((left, right) => {
            if (left.idReservation && right.idReservation) {
                return right.idReservation - left.idReservation;
            }

            const leftDate = new Date(
              left.dateCreation ?? left.dateDebut ?? '',
            ).getTime();
            const rightDate = new Date(
              right.dateCreation ?? right.dateDebut ?? '',
            ).getTime();
            
            if (isNaN(leftDate) && isNaN(rightDate)) return 0;
            if (isNaN(leftDate)) return 1;
            if (isNaN(rightDate)) return -1;
            
            return rightDate - leftDate;
          });
        },
        error: (error) => {
          this.error =
            error?.message ||
            'Impossible de charger les réservations. La liste est temporairement indisponible.';
          this.reservations = [];
        },
      });
  }

  get filteredReservations(): ReservationLocation[] {
    if (this.selectedStatus === 'ALL') {
      return this.reservations;
    }

    return this.reservations.filter(
      (reservation) => reservation.statut === this.selectedStatus,
    );
  }

  getStatusLabel(status: ReservationStatus): string {
    switch (status) {
      case ReservationStatus.PENDING:
        return 'En attente';
      case ReservationStatus.DRAFT:
        return 'Brouillon';
      case ReservationStatus.KYC_PENDING:
        return 'KYC';
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

  getVehicleLabel(reservation: ReservationLocation): string {
    const vehicle = reservation.vehiculeAgence;
    if (!vehicle) {
      return reservation.vehiculeAgenceId
        ? `Véhicule #${reservation.vehiculeAgenceId}`
        : 'Véhicule';
    }

    const brand = vehicle ? vehicle.marque || '' : '';
    const model = vehicle ? vehicle.modele || '' : '';
    return `${brand} ${model}`.trim();
  }

  getClientLabel(reservation: ReservationLocation): string {
    if (reservation.client) {
      return reservation.client.username;
    }

    return 'Client';
  }

  getClientNote(reservation: ReservationLocation): string {
    const raw = reservation as ReservationLocation & Record<string, any>;

    const directCandidates = [
      raw.note,
      raw['notes'],
      raw['noteClient'],
      raw['clientNote'],
      raw['reservationNote'],
      raw['commentaire'],
      raw['comment'],
      raw['messageClient'],
      raw['message'],
      raw['observation'],
      raw['remarque'],
      raw['note_client'],
      raw['client_note'],
    ];

    const nestedContainers = [
      raw['reservation'],
      raw['reservationLocation'],
      raw['dto'],
      raw['data'],
    ].filter((item) => item && typeof item === 'object') as Array<
      Record<string, any>
    >;

    for (const container of nestedContainers) {
      directCandidates.push(
        container['note'],
        container['notes'],
        container['noteClient'],
        container['clientNote'],
        container['reservationNote'],
        container['commentaire'],
        container['comment'],
        container['messageClient'],
        container['message'],
        container['observation'],
        container['remarque'],
      );
    }

    const normalizedCandidate = directCandidates
      .map((candidate) => String(candidate ?? '').trim())
      .find(
        (candidate) =>
          candidate.length > 0 &&
          candidate.toLowerCase() !== 'null' &&
          candidate.toLowerCase() !== 'undefined',
      );

    if (normalizedCandidate) {
      return normalizedCandidate;
    }

    const dynamicKey = Object.keys(raw).find((key) =>
      /note|comment|message/i.test(key),
    );
    if (!dynamicKey) {
      return '';
    }

    const dynamicValue = String(raw[dynamicKey] ?? '').trim();
    return dynamicValue.toLowerCase() === 'null' ||
      dynamicValue.toLowerCase() === 'undefined'
      ? ''
      : dynamicValue;
  }
}

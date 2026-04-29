import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import { ReservationLocation, ReservationStatus } from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-mes-locations',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mes-locations.component.html',
  styleUrl: './mes-locations.component.css',
})
export class MesLocationsComponent implements OnInit {
  reservations: ReservationLocation[] = [];
  isLoading = false;
  error = '';

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error = 'Veuillez vous connecter pour voir vos locations.';
      return;
    }

    this.isLoading = true;
    this.locationService
      .getReservationsByClient(userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (reservations) => {
          this.reservations = [...reservations].sort((left, right) => {
            const getSafeTime = (dateStr?: string) => {
               if (!dateStr) return 0;
               const time = new Date(dateStr).getTime();
               return isNaN(time) ? 0 : time;
            };
            
            // Priority 1: Strictly use the reservation date (dateCreation) as requested.
            const leftTime = getSafeTime(left.dateCreation);
            const rightTime = getSafeTime(right.dateCreation);

            // Descending: newest reservation date first
            if (rightTime !== leftTime) {
                return rightTime - leftTime; 
            }
            
            // Priority 2: Fallback to reservation ID only if times are exactly identical
            return (right.idReservation || 0) - (left.idReservation || 0);
          });
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de charger vos locations.';
        },
      });
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
      case ReservationStatus.ACTIVE:
        return 'Active';
      case ReservationStatus.COMPLETED:
        return 'Terminée';
      case ReservationStatus.CANCELLED:
        return 'Annulée';
      default:
        return status;
    }
  }

  getVehicleLabel(reservation: ReservationLocation): string {
    const vehicle = reservation.vehiculeAgence;
    if (!vehicle) {
      return 'Véhicule de Location';
    }

    const brand = vehicle ? vehicle.marque || '' : '';
    const model = vehicle ? vehicle.modele || '' : '';
    return `${brand} ${model}`.trim();
  }

  getAgencyLabel(reservation: ReservationLocation): string {
    if (reservation.agenceLocation) {
      return reservation.agenceLocation.nomAgence;
    }

    return 'Agence de location';
  }

  getVehiclePhoto(reservation: ReservationLocation): string | null {
    const urls = reservation.vehiculeAgence?.photoUrls;
    if (urls && urls.length > 0) {
      const url = urls[0];
      return (this.locationService as any).getPublicUploadUrl ? (this.locationService as any).getPublicUploadUrl(url) : ((this.locationService as any).resolveMediaUrl ? (this.locationService as any).resolveMediaUrl(url) : url);
    }
    return null;
  }
}

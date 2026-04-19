import { Component, OnInit } from '@angular/core';
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
  activeReservations: ReservationLocation[] = [];
  isLoading = false;

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
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

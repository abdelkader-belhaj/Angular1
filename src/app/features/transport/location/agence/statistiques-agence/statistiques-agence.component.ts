import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  AgenceLocation,
  ReservationLocation,
  ReservationStatus,
  TypeVehicule,
  VehiculeAgence,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

type VehicleStatusSlice = {
  label: string;
  value: number;
  colorClass: string;
};

type CategoryRevenue = {
  label: string;
  amount: number;
  width: number;
  colorClass: string;
};

@Component({
  selector: 'app-statistiques-agence',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistiques-agence.component.html',
  styleUrl: './statistiques-agence.component.css',
})
export class StatistiquesAgenceComponent implements OnInit {
  agency: AgenceLocation | null = null;
  vehicles: VehiculeAgence[] = [];
  reservations: ReservationLocation[] = [];
  isLoading = false;
  error = '';

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  get occupationRate(): number {
    if (!this.vehicles.length) {
      return 0;
    }

    const rented = this.vehicleStatusSlices.find(
      (slice) => slice.label === 'Loués',
    )?.value;
    return Math.round(((rented || 0) / this.vehicles.length) * 100);
  }

  get monthlyRevenue(): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return this.reservations
      .filter((reservation) => {
        const rawDate = reservation.dateCreation || reservation.dateDebut;
        const date = new Date(rawDate || '');
        if (Number.isNaN(date.getTime())) {
          return false;
        }

        return (
          date.getMonth() === currentMonth && date.getFullYear() === currentYear
        );
      })
      .reduce(
        (total, reservation) => total + Number(reservation.prixTotal || 0),
        0,
      );
  }

  get maintenanceCount(): number {
    return this.vehicles.filter(
      (vehicle) => String(vehicle.statut || '').toUpperCase() !== 'ACTIVE',
    ).length;
  }

  get topVehicleLabel(): string {
    if (!this.reservations.length) {
      return 'Aucun historique';
    }

    const ranking = new Map<string, number>();

    for (const reservation of this.reservations) {
      const vehicle = reservation.vehiculeAgence;
      const key = vehicle
        ? `${vehicle.marque || ''} ${vehicle.modele || ''}`.trim() ||
          `Véhicule #${vehicle.idVehiculeAgence}`
        : reservation.vehiculeAgenceId
          ? `Véhicule #${reservation.vehiculeAgenceId}`
          : 'Véhicule';

      ranking.set(key, (ranking.get(key) || 0) + 1);
    }

    const top = Array.from(ranking.entries()).sort((a, b) => b[1] - a[1])[0];
    return top?.[0] || 'Aucun historique';
  }

  get topVehicleUsage(): string {
    if (!this.reservations.length) {
      return '0 location';
    }

    const ranking = new Map<string, number>();

    for (const reservation of this.reservations) {
      const key = reservation.vehiculeAgence
        ? String(reservation.vehiculeAgence.idVehiculeAgence)
        : String(reservation.vehiculeAgenceId || '0');
      ranking.set(key, (ranking.get(key) || 0) + 1);
    }

    const topCount = Array.from(ranking.values()).sort((a, b) => b - a)[0] || 0;
    return `${topCount} location${topCount > 1 ? 's' : ''}`;
  }

  get vehicleStatusSlices(): VehicleStatusSlice[] {
    const rentedStatuses: ReservationStatus[] = [
      ReservationStatus.CONFIRMED,
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.CHECKOUT_PENDING,
      ReservationStatus.ACTIVE,
    ];

    const rentedVehicleIds = new Set<number>();
    for (const reservation of this.reservations) {
      if (!rentedStatuses.includes(reservation.statut)) {
        continue;
      }

      const vehicleId =
        reservation.vehiculeAgence?.idVehiculeAgence ||
        reservation.vehiculeAgenceId;
      if (vehicleId) {
        rentedVehicleIds.add(vehicleId);
      }
    }

    let rented = 0;
    let available = 0;
    let maintenance = 0;

    for (const vehicle of this.vehicles) {
      const status = String(vehicle.statut || '').toUpperCase();
      if (status !== 'ACTIVE') {
        maintenance += 1;
        continue;
      }

      if (rentedVehicleIds.has(vehicle.idVehiculeAgence)) {
        rented += 1;
      } else {
        available += 1;
      }
    }

    return [
      { label: 'Loués', value: rented, colorClass: 'slice-rented' },
      { label: 'Disponibles', value: available, colorClass: 'slice-available' },
      {
        label: 'Maintenance',
        value: maintenance,
        colorClass: 'slice-maintenance',
      },
    ];
  }

  get categoryRevenue(): CategoryRevenue[] {
    const byType: Record<string, number> = {
      [TypeVehicule.PREMIUM]: 0,
      [TypeVehicule.ECONOMY]: 0,
      [TypeVehicule.VAN]: 0,
    };

    for (const reservation of this.reservations) {
      const type =
        reservation.vehiculeAgence?.typeVehicule ||
        reservation.typeVehiculeDemande ||
        TypeVehicule.ECONOMY;
      byType[type] = (byType[type] || 0) + Number(reservation.prixTotal || 0);
    }

    const rows: CategoryRevenue[] = [
      {
        label: 'Premium',
        amount: byType[TypeVehicule.PREMIUM] || 0,
        width: 0,
        colorClass: 'bar-premium',
      },
      {
        label: 'Économie',
        amount: byType[TypeVehicule.ECONOMY] || 0,
        width: 0,
        colorClass: 'bar-economy',
      },
      {
        label: 'Van',
        amount: byType[TypeVehicule.VAN] || 0,
        width: 0,
        colorClass: 'bar-van',
      },
    ];

    const max = Math.max(...rows.map((row) => row.amount), 1);
    return rows.map((row) => ({
      ...row,
      width: Math.max(8, Math.round((row.amount / max) * 100)),
    }));
  }

  get upcomingAlerts(): Array<{
    title: string;
    note: string;
    tone: 'danger' | 'neutral';
  }> {
    const alerts: Array<{
      title: string;
      note: string;
      tone: 'danger' | 'neutral';
    }> = [];

    const endingSoon = [...this.reservations]
      .filter((reservation) => {
        const endDate = new Date(reservation.dateFin || '');
        if (Number.isNaN(endDate.getTime())) {
          return false;
        }

        const diffDays = Math.ceil(
          (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return diffDays >= 0 && diffDays <= 3;
      })
      .slice(0, 2);

    for (const reservation of endingSoon) {
      const vehicleLabel = reservation.vehiculeAgence
        ? `${reservation.vehiculeAgence.marque || ''} ${reservation.vehiculeAgence.modele || ''}`.trim()
        : reservation.vehiculeAgenceId
          ? `Véhicule #${reservation.vehiculeAgenceId}`
          : 'Véhicule';

      alerts.push({
        title: vehicleLabel || 'Véhicule',
        note: `Retour prévu le ${this.formatDate(reservation.dateFin)}.`,
        tone: 'neutral',
      });
    }

    const maintenanceVehicles = this.vehicles
      .filter(
        (vehicle) => String(vehicle.statut || '').toUpperCase() !== 'ACTIVE',
      )
      .slice(0, 2);

    for (const vehicle of maintenanceVehicles) {
      alerts.push({
        title:
          `${vehicle.marque || ''} ${vehicle.modele || ''}`.trim() ||
          `Véhicule #${vehicle.idVehiculeAgence}`,
        note: 'Véhicule marqué indisponible, contrôle recommandé.',
        tone: 'danger',
      });
    }

    if (!alerts.length) {
      alerts.push({
        title: 'Aucune alerte',
        note: 'Tout le parc est stable pour le moment.',
        tone: 'neutral',
      });
    }

    return alerts;
  }

  private loadStats(): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) {
      this.error = 'Aucune session détectée.';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.locationService
      .resolveAgencyByUserId(userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (agency) => {
          this.agency = agency;

          if (!agency) {
            this.error = 'Agence introuvable pour ce compte.';
            this.vehicles = [];
            this.reservations = [];
            return;
          }

          this.locationService.getVehiculesByAgence(agency.idAgence).subscribe({
            next: (vehicles) => {
              this.vehicles = vehicles || [];
            },
            error: (error) => {
              this.error = error?.message || 'Impossible de charger la flotte.';
              this.vehicles = [];
            },
          });

          this.locationService
            .getReservationsByAgence(agency.idAgence)
            .subscribe({
              next: (reservations) => {
                this.reservations = reservations || [];
              },
              error: (error) => {
                this.error =
                  error?.message || 'Impossible de charger les réservations.';
                this.reservations = [];
              },
            });
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de charger les statistiques.';
        },
      });
  }

  private formatDate(value?: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}

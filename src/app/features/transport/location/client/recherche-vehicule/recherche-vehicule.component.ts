import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { TypeVehicule, VehiculeAgence } from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-recherche-vehicule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recherche-vehicule.component.html',
  styleUrl: './recherche-vehicule.component.css',
})
export class RechercheVehiculeComponent implements OnInit {
  query = '';
  selectedType = '';
  isLoading = false;
  error = '';
  vehicles: Array<VehiculeAgence & { agenceLabel: string }> = [];

  isGalleryOpen = false;
  galleryPhotos: string[] = [];
  galleryIndex = 0;
  galleryTitle = '';

  readonly typeOptions = [
    '',
    TypeVehicule.ECONOMY,
    TypeVehicule.PREMIUM,
    TypeVehicule.VAN,
  ] as const;

  constructor(private readonly locationService: LocationService) {}

  ngOnInit(): void {
    this.loadVehicles();
  }

  loadVehicles(): void {
    this.isLoading = true;
    this.error = '';

    this.locationService
      .getActiveAgences()
      .pipe(map((agences) => agences.filter(Boolean)))
      .subscribe({
        next: (agences) => {
          if (!agences.length) {
            this.vehicles = [];
            this.isLoading = false;
            return;
          }

          forkJoin(
            agences.map((agence) =>
              this.locationService.getVehiculesByAgence(agence.idAgence).pipe(
                map((vehicles) =>
                  vehicles
                    .filter((vehicle) => this.isVehicleActive(vehicle))
                    .map((vehicle) => ({
                      ...vehicle,
                      agenceLabel: agence.nomAgence,
                    })),
                ),
              ),
            ),
          ).subscribe({
            next: (groups) => {
              this.vehicles = groups.flat();
              this.isLoading = false;
            },
            error: (error) => {
              this.error =
                error?.message ||
                'Impossible de charger les véhicules disponibles.';
              this.isLoading = false;
            },
          });
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de charger les agences actives.';
          this.isLoading = false;
        },
      });
  }

  get filteredVehicles(): Array<VehiculeAgence & { agenceLabel: string }> {
    const query = this.query.trim().toLowerCase();

    return this.vehicles.filter((vehicle) => {
      if (!this.isVehicleActive(vehicle)) {
        return false;
      }

      const matchesQuery =
        !query ||
        [
          vehicle.marque,
          vehicle.modele,
          vehicle.numeroPlaque,
          vehicle.agenceLabel,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));

      const matchesType =
        !this.selectedType || vehicle.typeVehicule === this.selectedType;

      return matchesQuery && matchesType;
    });
  }

  private isVehicleActive(vehicle: VehiculeAgence): boolean {
    return String(vehicle.statut || '')
      .trim()
      .toUpperCase()
      .startsWith('ACTIVE');
  }

  getVehiclePhotos(vehicle: VehiculeAgence): string[] {
    return vehicle.photoUrls || [];
  }

  resolvePhotoUrl(path?: string): string {
    if (!path) {
      return '';
    }
    return this.locationService.getPublicUploadUrl(path);
  }

  openGallery(vehicle: VehiculeAgence, index = 0): void {
    const photos = this.getVehiclePhotos(vehicle);
    if (!photos.length) {
      return;
    }

    this.galleryPhotos = photos;
    this.galleryIndex = Math.max(0, Math.min(index, photos.length - 1));
    this.galleryTitle = `${vehicle.marque || ''} ${vehicle.modele || ''}`;
    this.isGalleryOpen = true;
  }

  closeGallery(): void {
    this.isGalleryOpen = false;
    this.galleryPhotos = [];
    this.galleryIndex = 0;
    this.galleryTitle = '';
  }

  prevGalleryPhoto(): void {
    if (!this.galleryPhotos.length) {
      return;
    }
    this.galleryIndex =
      (this.galleryIndex - 1 + this.galleryPhotos.length) %
      this.galleryPhotos.length;
  }

  nextGalleryPhoto(): void {
    if (!this.galleryPhotos.length) {
      return;
    }
    this.galleryIndex = (this.galleryIndex + 1) % this.galleryPhotos.length;
  }

  getCurrentGalleryPhotoUrl(): string {
    if (!this.galleryPhotos.length) {
      return '';
    }

    return this.resolvePhotoUrl(this.galleryPhotos[this.galleryIndex]);
  }
}

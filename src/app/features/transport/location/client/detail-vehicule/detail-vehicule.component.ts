import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VehiculeAgence } from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-detail-vehicule',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './detail-vehicule.component.html',
  styleUrl: './detail-vehicule.component.css',
})
export class DetailVehiculeComponent implements OnInit {
  vehicle: VehiculeAgence | null = null;
  isLoading = false;
  error = '';

  isGalleryOpen = false;
  galleryPhotos: string[] = [];
  galleryIndex = 0;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly locationService: LocationService,
  ) {}

  ngOnInit(): void {
    const vehicleId = Number(this.route.snapshot.paramMap.get('id'));

    if (!vehicleId) {
      this.error = 'Véhicule introuvable.';
      return;
    }

    this.isLoading = true;
    this.locationService.getVehiculeAgenceById(vehicleId).subscribe({
      next: (vehicle) => {
        this.vehicle = vehicle;
        this.isLoading = false;
      },
      error: (error) => {
        this.error = error?.message || 'Impossible de charger le véhicule.';
        this.isLoading = false;
      },
    });
  }

  getVehiclePhotos(vehicle: VehiculeAgence | null): string[] {
    if (!vehicle) {
      return [];
    }

    const photoUrls = Array.isArray(vehicle.photoUrls)
      ? vehicle.photoUrls
          .map((path) => String(path || '').trim())
          .filter((path) => !!path)
      : [];

    if (photoUrls.length) {
      return photoUrls;
    }

    const serialized = String(
      (vehicle as any).photoUrlsSerialized || '',
    ).trim();
    if (!serialized) {
      return [];
    }

    let parsedPhotos: string[] = [];

    // Format JSON array: ["uploads/a.jpg","uploads/b.jpg"]
    if (serialized.startsWith('[') && serialized.endsWith(']')) {
      try {
        const parsed = JSON.parse(serialized);
        if (Array.isArray(parsed)) {
          parsedPhotos = parsed
            .map((path) => String(path || '').trim())
            .filter((path) => !!path);
        }
      } catch {
        // Fall back to delimiter-based parsing.
      }
    }

    // Legacy delimiter format: uploads/a.jpg||uploads/b.jpg
    if (!parsedPhotos.length && serialized.includes('||')) {
      parsedPhotos = serialized
        .split('||')
        .map((path) => path.trim())
        .filter((path) => !!path);
    }

    // CSV fallback: uploads/a.jpg,uploads/b.jpg
    if (!parsedPhotos.length && serialized.includes(',')) {
      parsedPhotos = serialized
        .split(',')
        .map((path) => path.trim())
        .filter((path) => !!path);
    }

    // Single value fallback.
    if (!parsedPhotos.length) {
      parsedPhotos = [serialized];
    }

    return Array.from(new Set(parsedPhotos));
  }

  resolvePhotoUrl(path?: string): string {
    const rawPath = String(path || '').trim();
    if (!rawPath) {
      return '';
    }

    if (
      rawPath.startsWith('data:') ||
      rawPath.startsWith('blob:') ||
      /^https?:\/\//i.test(rawPath)
    ) {
      return rawPath;
    }

    if (
      rawPath.startsWith('/hypercloud/') ||
      rawPath.startsWith('hypercloud/') ||
      rawPath.startsWith('/uploads/') ||
      rawPath.startsWith('uploads/')
    ) {
      return this.locationService.resolveMediaUrl(rawPath) || '';
    }

    const uploadsMarker = '/uploads/';
    const uploadsIndex = rawPath.toLowerCase().indexOf(uploadsMarker);
    if (uploadsIndex >= 0) {
      const relativeUploadsPath = rawPath.slice(
        uploadsIndex + uploadsMarker.length,
      );
      return this.locationService.getPublicUploadUrl(relativeUploadsPath);
    }

    return this.locationService.getPublicUploadUrl(rawPath);
  }

  openGallery(index = 0): void {
    const photos = this.getVehiclePhotos(this.vehicle);
    if (!photos.length) {
      return;
    }

    this.galleryPhotos = photos;
    this.galleryIndex = Math.max(0, Math.min(index, photos.length - 1));
    this.isGalleryOpen = true;
  }

  closeGallery(): void {
    this.isGalleryOpen = false;
    this.galleryPhotos = [];
    this.galleryIndex = 0;
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

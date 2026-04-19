import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  AgenceLocation,
  TypeVehicule,
  VehiculeAgence,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

@Component({
  selector: 'app-gestion-flotte',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-flotte.component.html',
  styleUrl: './gestion-flotte.component.css',
})
export class GestionFlotteComponent implements OnInit, OnDestroy {
  agency: AgenceLocation | null = null;
  vehicles: VehiculeAgence[] = [];
  vehicleSearch = '';
  selectedTypeFilter = 'ALL';
  selectedStatusFilter = 'ALL';
  isLoading = false;
  isSaving = false;
  isFormModalOpen = false;
  error = '';
  success = '';
  editingVehicleId: number | null = null;
  selectedPhotoFiles: File[] = [];
  photoPreviews: string[] = [];

  isGalleryOpen = false;
  galleryPhotos: string[] = [];
  galleryIndex = 0;
  galleryTitle = '';

  readonly typeOptions = Object.values(TypeVehicule) as TypeVehicule[];
  readonly statusOptions = ['ACTIVE', 'INACTIVE'];

  form: Partial<VehiculeAgence> = {
    marque: '',
    modele: '',
    numeroPlaque: '',
    typeVehicule: TypeVehicule.ECONOMY,
    capacitePassagers: 4,
    prixJour: 0,
    statut: 'ACTIVE',
  };

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadAgencyAndVehicles();
  }

  ngOnDestroy(): void {
    this.clearSelectedPhotos();
  }

  get activeVehiclesCount(): number {
    return this.vehicles.filter((vehicle) => this.isVehicleActive(vehicle))
      .length;
  }

  get inactiveVehiclesCount(): number {
    return this.vehicles.length - this.activeVehiclesCount;
  }

  get typeFilterOptions(): string[] {
    return ['ALL', ...this.typeOptions];
  }

  get statusFilterOptions(): string[] {
    return ['ALL', ...this.statusOptions];
  }

  get filteredVehicles(): VehiculeAgence[] {
    const query = this.vehicleSearch.trim().toLowerCase();

    return this.vehicles.filter((vehicle) => {
      const type = String(vehicle.typeVehicule || '');
      const status = String(vehicle.statut || '').toUpperCase();
      const searchable = [
        vehicle.marque || '',
        vehicle.modele || '',
        vehicle.numeroPlaque || '',
        type,
      ]
        .join(' ')
        .toLowerCase();

      const matchesQuery = !query || searchable.includes(query);
      const matchesType =
        this.selectedTypeFilter === 'ALL' || type === this.selectedTypeFilter;
      const matchesStatus =
        this.selectedStatusFilter === 'ALL' ||
        status === this.selectedStatusFilter;

      return matchesQuery && matchesType && matchesStatus;
    });
  }

  openCreateModal(): void {
    this.startCreate();
    this.isFormModalOpen = true;
  }

  openEditModal(vehicle: VehiculeAgence): void {
    this.editVehicle(vehicle);
    this.isFormModalOpen = true;
  }

  closeFormModal(): void {
    this.isFormModalOpen = false;
    this.startCreate();
  }

  loadAgencyAndVehicles(): void {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error = 'Aucun compte connecté.';
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
            this.error = 'Aucune agence de location rattachée à ce compte.';
            this.vehicles = [];
            return;
          }

          this.locationService
            .getVehiculesByAgence(this.agency.idAgence)
            .subscribe({
              next: (vehicles) => {
                this.vehicles = vehicles;
              },
              error: (error) => {
                this.error =
                  error?.message || 'Impossible de charger les véhicules.';
              },
            });
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de charger votre agence.';
        },
      });
  }

  startCreate(): void {
    this.editingVehicleId = null;
    this.clearSelectedPhotos();
    this.form = {
      marque: '',
      modele: '',
      numeroPlaque: '',
      typeVehicule: TypeVehicule.ECONOMY,
      capacitePassagers: 4,
      prixJour: 0,
      prixVehicule: 0,
      statut: 'ACTIVE',
    };
    this.success = '';
  }

  editVehicle(vehicle: VehiculeAgence): void {
    this.editingVehicleId = vehicle.idVehiculeAgence;
    this.clearSelectedPhotos();
    this.form = {
      ...vehicle,
      photoUrls: this.normalizePhotoUrls(
        vehicle?.photoUrls,
        vehicle?.photoUrlsSerialized,
      ),
    };
  }

  saveVehicle(): void {
    if (!this.agency) {
      this.error = 'Agence introuvable.';
      return;
    }

    this.isSaving = true;
    this.error = '';
    this.success = '';

    const payload: Partial<VehiculeAgence> = {
      ...this.form,
      agenceId: this.agency.idAgence,
      numeroPlaque: (this.form.numeroPlaque || '').trim(),
      capacitePassagers:
        this.form.capacitePassagers != null
          ? Number(this.form.capacitePassagers)
          : undefined,
      prixJour:
        this.form.prixJour != null ? Number(this.form.prixJour) : undefined,
      prixVehicule:
        this.form.prixVehicule != null
          ? Number(this.form.prixVehicule)
          : undefined,
      agence: undefined,
    };

    const request$ = this.editingVehicleId
      ? this.locationService.updateVehiculeAgence(
          this.editingVehicleId,
          payload,
        )
      : this.locationService.addVehiculeAgence(payload);

    request$.pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: (savedVehicle) => {
        const successLabel = this.editingVehicleId
          ? 'Véhicule mis à jour.'
          : 'Véhicule ajouté au parc.';

        if (
          savedVehicle?.idVehiculeAgence &&
          this.selectedPhotoFiles.length > 0
        ) {
          this.locationService
            .uploadVehiculeAgencePhotos(
              savedVehicle.idVehiculeAgence,
              this.selectedPhotoFiles,
            )
            .subscribe({
              next: () => {
                this.success = `${successLabel} Photos uploadées.`;
                this.startCreate();
                this.isFormModalOpen = false;
                this.loadAgencyAndVehicles();
              },
              error: (error) => {
                this.error =
                  error?.message ||
                  `${successLabel} Mais l'upload des photos a échoué.`;
                this.startCreate();
                this.isFormModalOpen = false;
                this.loadAgencyAndVehicles();
              },
            });
          return;
        }

        this.success = successLabel;
        this.startCreate();
        this.isFormModalOpen = false;
        this.loadAgencyAndVehicles();
      },
      error: (error) => {
        this.error = error?.message || "Impossible d'enregistrer le véhicule.";
      },
    });
  }

  deactivateVehicle(vehicle: VehiculeAgence): void {
    if (!confirm(`Désactiver ${vehicle.numeroPlaque} ?`)) {
      return;
    }

    this.locationService
      .updateVehiculeAgence(vehicle.idVehiculeAgence, {
        ...vehicle,
        statut: 'INACTIVE',
      })
      .subscribe({
        next: () => this.loadAgencyAndVehicles(),
        error: (error) => {
          this.error =
            error?.message || 'Impossible de désactiver ce véhicule.';
        },
      });
  }

  activateVehicle(vehicle: VehiculeAgence): void {
    if (!confirm(`Activer ${vehicle.numeroPlaque} ?`)) {
      return;
    }

    this.locationService
      .updateVehiculeAgence(vehicle.idVehiculeAgence, {
        ...vehicle,
        statut: 'ACTIVE',
      })
      .subscribe({
        next: () => this.loadAgencyAndVehicles(),
        error: (error) => {
          this.error = error?.message || 'Impossible de réactiver ce véhicule.';
        },
      });
  }

  isVehicleActive(vehicle: VehiculeAgence): boolean {
    return String(vehicle.statut || '')
      .trim()
      .toUpperCase()
      .startsWith('ACTIVE');
  }

  deleteVehicle(vehicle: VehiculeAgence): void {
    if (!confirm(`Supprimer ${vehicle.numeroPlaque} ?`)) {
      return;
    }

    this.locationService
      .deleteVehiculeAgence(vehicle.idVehiculeAgence)
      .subscribe({
        next: () => this.loadAgencyAndVehicles(),
        error: (error) => {
          this.error =
            this.extractApiMessage(error) ||
            'Impossible de supprimer ce véhicule.';
        },
      });
  }

  private extractApiMessage(error: any): string {
    return error?.error?.message || error?.error?.error || error?.message || '';
  }

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    this.clearSelectedPhotos();

    if (!files || files.length === 0) {
      return;
    }

    this.selectedPhotoFiles = Array.from(files);
    this.photoPreviews = this.selectedPhotoFiles.map((file) =>
      URL.createObjectURL(file),
    );
  }

  removeSelectedPhoto(index: number): void {
    if (index < 0 || index >= this.selectedPhotoFiles.length) {
      return;
    }

    const [removedPreview] = this.photoPreviews.splice(index, 1);
    if (removedPreview) {
      URL.revokeObjectURL(removedPreview);
    }
    this.selectedPhotoFiles.splice(index, 1);
  }

  deleteExistingPhoto(vehicle: VehiculeAgence, photoUrl: string): void {
    if (!vehicle?.idVehiculeAgence || !photoUrl) {
      return;
    }

    this.locationService
      .removeVehiculeAgencePhoto(vehicle.idVehiculeAgence, photoUrl)
      .subscribe({
        next: () => {
          this.success = 'Photo supprimée.';
          this.loadAgencyAndVehicles();
          if (this.editingVehicleId === vehicle.idVehiculeAgence) {
            this.locationService
              .getVehiculeAgenceById(vehicle.idVehiculeAgence)
              .subscribe((updated) => {
                this.form = {
                  ...updated,
                  photoUrls: this.normalizePhotoUrls(
                    updated?.photoUrls,
                    updated?.photoUrlsSerialized,
                  ),
                };
              });
          }
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de supprimer cette photo.';
        },
      });
  }

  deleteEditingPhoto(photoUrl: string): void {
    if (!this.editingVehicleId || !photoUrl) {
      return;
    }

    this.deleteExistingPhoto(
      {
        idVehiculeAgence: this.editingVehicleId,
      } as VehiculeAgence,
      photoUrl,
    );
  }

  getVehiclePhotos(vehicle: VehiculeAgence): string[] {
    return this.normalizePhotoUrls(
      vehicle?.photoUrls,
      vehicle?.photoUrlsSerialized,
    );
  }

  getEditingPhotos(): string[] {
    return this.normalizePhotoUrls(
      (this.form as VehiculeAgence | null)?.photoUrls,
      (this.form as VehiculeAgence | null)?.photoUrlsSerialized,
    );
  }

  private normalizePhotoUrls(
    photoUrls?: string[] | string,
    serialized?: string,
  ): string[] {
    if (Array.isArray(photoUrls)) {
      return photoUrls
        .filter((p) => typeof p === 'string')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    const source =
      typeof photoUrls === 'string' && photoUrls.trim().length > 0
        ? photoUrls
        : typeof serialized === 'string'
          ? serialized
          : '';

    if (!source) {
      return [];
    }

    return source
      .split('||')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
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
    this.galleryTitle = `${vehicle.marque || ''} ${vehicle.modele || ''} - ${vehicle.numeroPlaque}`;
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

  private clearSelectedPhotos(): void {
    for (const preview of this.photoPreviews) {
      URL.revokeObjectURL(preview);
    }
    this.photoPreviews = [];
    this.selectedPhotoFiles = [];
  }
}

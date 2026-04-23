import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  AgenceLocation,
  ReservationLocation,
  ReservationStatus,
  TypeVehicule,
  VehiculeAgence,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';

/** Plaque style tunisien courant : chiffres + code wilaya (lettres) + chiffres, espaces optionnels. */
export const PLAQUE_TUNISIENNE_REGEX =
  /^\d{2,4}\s*[A-Za-z]{1,3}\s*\d{2,5}$/;

function texteMarqueModele(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = String(control.value ?? '');
    const t = raw.trim();
    if (!t) {
      return { required: true };
    }
    if (t.length < 2) {
      return { minlength: { requiredLength: 2, actualLength: t.length } };
    }
    if (t.length > 30) {
      return { maxlength: { requiredLength: 30, actualLength: t.length } };
    }
    return null;
  };
}

function placesPassagers(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const n = Number(control.value);
    if (!Number.isInteger(n) || n < 1 || n > 9) {
      return { places: { min: 1, max: 9 } };
    }
    return null;
  };
}

/**
 * Prix / jour : 0 accepté (brouillon) ; sinon plage 80–1000 TND et cohérence avec le type.
 */
function prixJourEtTypeValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const type = String(group.get('typeVehicule')?.value ?? '').toUpperCase();
    const raw = group.get('prixJour')?.value;
    const prix =
      raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
    if (!Number.isFinite(prix)) {
      return { prixJourInvalide: true };
    }
    if (prix < 0) {
      return { prixJourNegatif: true };
    }
    if (prix === 0) {
      return null;
    }
    if (prix < 80) {
      return { prixJourSousSeuil: { min: 80 } };
    }
    if (prix > 1000) {
      return { prixJourAuDessus: { max: 1000 } };
    }
    if (type === TypeVehicule.ECONOMY && prix > 400) {
      return { economyPrixEleve: { maxConseille: 400 } };
    }
    if (type === TypeVehicule.PREMIUM && prix < 280) {
      return { premiumPrixBas: { minConseille: 280 } };
    }
    if (type === TypeVehicule.VAN && (prix < 180 || prix > 850)) {
      return { vanPrixFourchette: { min: 180, max: 850 } };
    }
    return null;
  };
}

@Component({
  selector: 'app-gestion-flotte',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gestion-flotte.component.html',
  styleUrl: './gestion-flotte.component.css',
})
export class GestionFlotteComponent implements OnInit, OnDestroy {
  private readonly fleetFormSubs = new Subscription();

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
  /** Photos déjà enregistrées (URLs) pendant l’édition. */
  editingExistingPhotos: string[] = [];
  /** Véhicules ayant au moins une réservation « engagée » (non terminée / non annulée). */
  vehiculeIdsLouesActifs = new Set<number>();

  selectedPhotoFiles: File[] = [];
  photoPreviews: string[] = [];

  isGalleryOpen = false;
  galleryPhotos: string[] = [];
  galleryIndex = 0;
  galleryTitle = '';

  fleetForm: FormGroup;
  /** Après clic sur Enregistrer, afficher aussi les erreurs « groupe » (prix / type). */
  submitAttempted = false;

  readonly typeOptions = Object.values(TypeVehicule) as TypeVehicule[];
  readonly statusOptions = ['ACTIVE', 'INACTIVE', 'EN_MAINTENANCE'];

  constructor(
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
    private readonly fb: FormBuilder,
  ) {
    this.fleetForm = this.createFleetForm();
  }

  ngOnInit(): void {
    this.fleetFormSubs.add(
      this.fleetForm.get('typeVehicule')!.valueChanges.subscribe(() => {
        this.fleetForm.updateValueAndValidity({ emitEvent: false });
      }),
    );
    this.fleetFormSubs.add(
      this.fleetForm.get('prixJour')!.valueChanges.subscribe(() => {
        this.fleetForm.updateValueAndValidity({ emitEvent: false });
      }),
    );
    this.loadAgencyAndVehicles();
  }

  ngOnDestroy(): void {
    this.fleetFormSubs.unsubscribe();
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
        status === this.selectedStatusFilter ||
        (this.selectedStatusFilter === 'EN_MAINTENANCE' &&
          (status === 'EN_MAINTENANCE' || status === 'IN_MAINTENANCE'));

      return matchesQuery && matchesType && matchesStatus;
    });
  }

  /** Réservation en cours sur ce véhicule : ne pas exposer en ACTIVE pour la location. */
  isVehiculeActuellementLoue(vehiculeId: number): boolean {
    return this.vehiculeIdsLouesActifs.has(Number(vehiculeId));
  }

  statutLabel(statut: string): string {
    const u = String(statut || '').toUpperCase();
    if (u === 'ACTIVE') {
      return 'Actif';
    }
    if (u === 'INACTIVE') {
      return 'Inactif';
    }
    if (u === 'EN_MAINTENANCE' || u === 'IN_MAINTENANCE') {
      return 'En maintenance';
    }
    return statut || '—';
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
            this.vehiculeIdsLouesActifs = new Set();
            return;
          }

          forkJoin({
            vehicles: this.locationService
              .getVehiculesByAgence(this.agency.idAgence)
              .pipe(catchError(() => of([] as VehiculeAgence[]))),
            reservations: this.locationService
              .getReservationsByAgence(this.agency.idAgence)
              .pipe(catchError(() => of([] as ReservationLocation[]))),
          }).subscribe({
            next: ({ vehicles, reservations }) => {
              this.vehicles = vehicles ?? [];
              this.rebuildLouesActifs(reservations ?? []);
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

  private rebuildLouesActifs(reservations: ReservationLocation[]): void {
    const loues: ReservationStatus[] = [
      ReservationStatus.CONFIRMED,
      ReservationStatus.DEPOSIT_HELD,
      ReservationStatus.CONTRACT_SIGNED,
      ReservationStatus.CHECKOUT_PENDING,
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.ACTIVE,
    ];
    const next = new Set<number>();
    for (const r of reservations) {
      if (!loues.includes(r.statut)) {
        continue;
      }
      const vid =
        r.vehiculeAgenceId ?? r.vehiculeAgence?.idVehiculeAgence ?? null;
      if (vid != null && Number.isFinite(Number(vid))) {
        next.add(Number(vid));
      }
    }
    this.vehiculeIdsLouesActifs = next;
  }

  private createFleetForm(): FormGroup {
    return this.fb.group(
      {
        marque: ['', [texteMarqueModele()]],
        modele: ['', [texteMarqueModele()]],
        numeroPlaque: [
          '',
          [Validators.required, Validators.pattern(PLAQUE_TUNISIENNE_REGEX)],
        ],
        typeVehicule: [TypeVehicule.ECONOMY, Validators.required],
        capacitePassagers: [4, [Validators.required, placesPassagers()]],
        statut: ['ACTIVE', Validators.required],
        prixJour: [0, [Validators.required, Validators.min(0)]],
        prixVehicule: [0, [Validators.min(0)]],
      },
      { validators: [prixJourEtTypeValidator()] },
    );
  }

  startCreate(): void {
    this.submitAttempted = false;
    this.editingVehicleId = null;
    this.editingExistingPhotos = [];
    this.clearSelectedPhotos();
    this.fleetForm.reset({
      marque: '',
      modele: '',
      numeroPlaque: '',
      typeVehicule: TypeVehicule.ECONOMY,
      capacitePassagers: 4,
      prixJour: 0,
      prixVehicule: 0,
      statut: 'ACTIVE',
    });
    this.success = '';
    this.error = '';
  }

  editVehicle(vehicle: VehiculeAgence): void {
    this.submitAttempted = false;
    this.editingVehicleId = vehicle.idVehiculeAgence;
    this.clearSelectedPhotos();
    this.editingExistingPhotos = [...this.getVehiclePhotos(vehicle)];
    this.fleetForm.patchValue({
      marque: vehicle.marque ?? '',
      modele: vehicle.modele ?? '',
      numeroPlaque: (vehicle.numeroPlaque ?? '').trim(),
      typeVehicule: vehicle.typeVehicule ?? TypeVehicule.ECONOMY,
      capacitePassagers: vehicle.capacitePassagers ?? 4,
      prixJour: vehicle.prixJour ?? 0,
      prixVehicule: vehicle.prixVehicule ?? 0,
      statut: this.normalizeStatutForForm(vehicle.statut),
    });
    this.fleetForm.markAsUntouched();
    this.success = '';
    this.error = '';
  }

  private normalizeStatutForForm(statut?: string): string {
    const u = String(statut || '')
      .trim()
      .toUpperCase();
    if (u === 'EN_MAINTENANCE' || u === 'IN_MAINTENANCE') {
      return 'EN_MAINTENANCE';
    }
    if (u === 'INACTIVE') {
      return 'INACTIVE';
    }
    return 'ACTIVE';
  }

  saveVehicle(): void {
    if (!this.agency) {
      this.error = 'Agence introuvable.';
      return;
    }

    this.submitAttempted = true;
    this.fleetForm.updateValueAndValidity({ emitEvent: false });
    this.fleetForm.markAllAsTouched();
    if (this.fleetForm.invalid) {
      this.error =
        'Veuillez corriger les champs du formulaire (voir les messages sous chaque champ).';
      return;
    }

    const raw = this.fleetForm.getRawValue();
    const statut = String(raw.statut || '').toUpperCase();
    const vid = this.editingVehicleId;

    if (
      statut === 'ACTIVE' &&
      vid != null &&
      this.vehiculeIdsLouesActifs.has(vid)
    ) {
      this.error =
        'Ce véhicule a une réservation en cours : choisissez « Inactif » ou « En maintenance » jusqu’à la fin de la location, ou finalisez la réservation.';
      return;
    }

    this.isSaving = true;
    this.error = '';
    this.success = '';

    const payload: Partial<VehiculeAgence> = {
      agenceId: this.agency.idAgence,
      marque: String(raw.marque ?? '').trim(),
      modele: String(raw.modele ?? '').trim(),
      numeroPlaque: String(raw.numeroPlaque ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase(),
      typeVehicule: raw.typeVehicule as TypeVehicule,
      capacitePassagers: Number(raw.capacitePassagers),
      prixJour: Number(raw.prixJour),
      prixVehicule:
        raw.prixVehicule != null && raw.prixVehicule !== ''
          ? Number(raw.prixVehicule)
          : 0,
      statut,
      photoUrls: this.editingVehicleId ? [...this.editingExistingPhotos] : undefined,
      agence: undefined,
    };

    const request$ = this.editingVehicleId
      ? this.locationService.updateVehiculeAgence(this.editingVehicleId, payload)
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

        this.submitAttempted = false;
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
    if (this.vehiculeIdsLouesActifs.has(vehicle.idVehiculeAgence)) {
      this.error =
        'Impossible d’activer ce véhicule : une réservation est encore en cours.';
      return;
    }
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
    return (
      String(vehicle.statut || '')
        .trim()
        .toUpperCase() === 'ACTIVE'
    );
  }

  isVehicleReservable(vehicle: VehiculeAgence): boolean {
    const s = String(vehicle.statut || '')
      .trim()
      .toUpperCase();
    if (s === 'INACTIVE' || s === 'EN_MAINTENANCE' || s === 'IN_MAINTENANCE') {
      return false;
    }
    return this.isVehicleActive(vehicle);
  }

  isEnMaintenance(vehicle: VehiculeAgence): boolean {
    const s = String(vehicle.statut || '')
      .trim()
      .toUpperCase();
    return s === 'EN_MAINTENANCE' || s === 'IN_MAINTENANCE';
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

  private extractApiMessage(error: unknown): string {
    const err = error as {
      error?: { message?: string; error?: string };
      message?: string;
    };
    return err?.error?.message || err?.error?.error || err?.message || '';
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
                this.editingExistingPhotos = this.getVehiclePhotos(updated);
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

  erreurChamp(nom: string): string | null {
    const c = this.fleetForm.get(nom);
    if (!c?.errors || (!c.touched && !this.submitAttempted)) {
      return null;
    }
    if (c.errors['required']) {
      return 'Champ obligatoire.';
    }
    if (c.errors['minlength']) {
      const req = c.errors['minlength'].requiredLength;
      return `Minimum ${req} caractères.`;
    }
    if (c.errors['maxlength']) {
      const req = c.errors['maxlength'].requiredLength;
      return `Maximum ${req} caractères.`;
    }
    if (c.errors['pattern']) {
      if (nom === 'numeroPlaque') {
        return 'Format plaque tunisien attendu (ex. 123 TU 4567).';
      }
      return 'Format invalide.';
    }
    if (c.errors['places']) {
      return 'Nombre de places : entier entre 1 et 9.';
    }
    return null;
  }

  erreurGroupePrix(): string | null {
    const g = this.fleetForm;
    if (!g.errors) {
      return null;
    }
    const interaction =
      this.submitAttempted ||
      g.touched ||
      !!g.get('prixJour')?.touched ||
      !!g.get('typeVehicule')?.touched;
    if (!interaction) {
      return null;
    }
    const e = g.errors;
    if (e['prixJourInvalide']) {
      return 'Indiquez un prix / jour numérique valide.';
    }
    if (e['prixJourNegatif']) {
      return 'Le prix / jour ne peut pas être négatif.';
    }
    if (e['prixJourSousSeuil']) {
      return 'Hors période de brouillon (0), le prix / jour doit être au moins 80 TND.';
    }
    if (e['prixJourAuDessus']) {
      return 'Le prix / jour ne peut pas dépasser 1000 TND.';
    }
    if (e['economyPrixEleve']) {
      return 'Type Économique : privilégiez un prix / jour plus bas (≤ 400 TND).';
    }
    if (e['premiumPrixBas']) {
      return 'Type Premium : le prix / jour doit refléter le segment haut (≥ 280 TND).';
    }
    if (e['vanPrixFourchette']) {
      return 'Type Van : fourchette conseillée 180 – 850 TND / jour.';
    }
    return null;
  }

  private clearSelectedPhotos(): void {
    for (const preview of this.photoPreviews) {
      URL.revokeObjectURL(preview);
    }
    this.photoPreviews = [];
    this.selectedPhotoFiles = [];
  }
}

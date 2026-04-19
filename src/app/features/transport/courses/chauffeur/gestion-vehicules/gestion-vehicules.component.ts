// src/app/features/transport/courses/chauffeur/gestion-vehicules/gestion-vehicules.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Vehicule, TypeVehicule, VehiculeStatut } from '../../../core/models';
import { AuthService } from '../../../../../services/auth.service';

@Component({
  selector: 'app-gestion-vehicules',
  templateUrl: './gestion-vehicules.component.html',
  styleUrls: ['./gestion-vehicules.component.css'],
})
export class GestionVehiculesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  chauffeurId: number | null = null;
  vehicules: Vehicule[] = [];

  isLoading = true;
  isSubmitting = false;
  showAddForm = false;
  editingVehicule: Vehicule | null = null;

  vehiculeForm!: FormGroup;
  selectedPhotoFiles: File[] = [];
  photoPreviews: string[] = [];

  isGalleryOpen = false;
  galleryPhotos: string[] = [];
  galleryIndex = 0;
  galleryVehiculeTitle = '';
  searchTerm = '';

  // Enums pour le template
  readonly TypeVehicule = TypeVehicule;
  readonly VehiculeStatut = VehiculeStatut;

  constructor(
    private chauffeurService: ChauffeurService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.initializeVehiculesContext();
  }

  private initializeVehiculesContext(): void {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      this.notificationService.warning(
        'Authentification',
        'Veuillez vous connecter pour acceder a vos vehicules.',
      );
      this.isLoading = false;
      return;
    }

    this.chauffeurService.resolveChauffeurIdByUserId(currentUser.id).subscribe({
      next: (id) => {
        this.chauffeurId = id;
        if (!this.chauffeurId) {
          this.notificationService.warning(
            'Profil chauffeur',
            'Aucun profil chauffeur lie a cet utilisateur.',
          );
          this.isLoading = false;
          return;
        }

        this.loadVehicules();
      },
      error: () => {
        this.notificationService.error(
          'Erreur',
          'Impossible de resoudre le chauffeur courant.',
        );
        this.isLoading = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.vehiculeForm = this.fb.group({
      marque: ['', Validators.required],
      modele: ['', Validators.required],
      numeroPlaque: [
        '',
        [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{5,10}$/)],
      ],
      typeVehicule: [TypeVehicule.ECONOMY, Validators.required],
      capacitePassagers: [4, [Validators.required, Validators.min(1)]],
      prixKm: [0.8, [Validators.required, Validators.min(0)]],
      prixMinute: [0.2, [Validators.required, Validators.min(0)]],
      statut: [VehiculeStatut.INACTIVE],
    });
  }

  private loadVehicules(): void {
    if (!this.chauffeurId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.chauffeurService
      .getVehicules(this.chauffeurId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.vehicules = (data || []).map((v) =>
            this.normalizeVehiculePhotos(v),
          );
          console.log(
            '[Vehicules][Load] vehicules with photos',
            this.vehicules.map((v) => ({
              idVehicule: v.idVehicule,
              numeroPlaque: v.numeroPlaque,
              photoUrls: v.photoUrls,
            })),
          );
          this.isLoading = false;
        },
        error: () => {
          this.notificationService.error(
            'Erreur',
            'Impossible de charger vos véhicules',
          );
          this.isLoading = false;
        },
      });
  }

  openAddForm(): void {
    console.log('[Vehicules][UI] openAddForm clicked');
    this.editingVehicule = null;
    this.clearSelectedPhotos();
    this.vehiculeForm.reset({
      typeVehicule: TypeVehicule.ECONOMY,
      capacitePassagers: 4,
      prixKm: 0.8,
      prixMinute: 0.2,
      statut: VehiculeStatut.INACTIVE,
    });
    this.showAddForm = true;
    console.log('[Vehicules][UI] modal opened', {
      showAddForm: this.showAddForm,
      formValid: this.vehiculeForm.valid,
      formValue: this.vehiculeForm.value,
    });
  }

  editVehicule(v: Vehicule): void {
    this.editingVehicule = v;
    this.clearSelectedPhotos();
    this.vehiculeForm.patchValue({
      marque: v.marque,
      modele: v.modele,
      numeroPlaque: v.numeroPlaque,
      typeVehicule: v.typeVehicule,
      capacitePassagers: v.capacitePassagers,
      prixKm: v.prixKm,
      prixMinute: v.prixMinute,
      statut: v.statut,
    });
    this.showAddForm = true;
  }

  saveVehicule(): void {
    if (this.isSubmitting) {
      console.warn(
        '[Vehicules][Submit] blocked duplicate click while submitting',
      );
      return;
    }

    console.log('[Vehicules][Submit] saveVehicule called', {
      showAddForm: this.showAddForm,
      chauffeurId: this.chauffeurId,
      formValid: this.vehiculeForm.valid,
      selectedPhotoCount: this.selectedPhotoFiles.length,
      formValue: this.vehiculeForm.value,
    });

    if (this.vehiculeForm.invalid || !this.chauffeurId) {
      console.warn('[Vehicules][Submit] blocked by validation/context', {
        chauffeurId: this.chauffeurId,
        controlStates: this.getFormValidationSnapshot(),
      });
      this.notificationService.warning(
        'Formulaire invalide',
        'Veuillez vérifier les champs',
      );
      return;
    }

    const formValue = this.vehiculeForm.value;
    const normalizedNumeroPlaque = String(formValue.numeroPlaque || '')
      .trim()
      .toUpperCase();
    const isEditing = !!this.editingVehicule;

    // Creation: always start INACTIVE. Activation must go through dedicated action.
    const enforcedStatut = isEditing
      ? (this.editingVehicule?.statut ?? formValue.statut)
      : VehiculeStatut.INACTIVE;

    // ✅ SOLUTION : On envoie un objet "chauffeur" comme le backend l'attend
    const payload = {
      ...formValue,
      statut: enforcedStatut,
      numeroPlaque: normalizedNumeroPlaque,
      chauffeur: {
        idChauffeur: this.chauffeurId,
      },
    };

    console.log('[Vehicules][Submit] payload ready', payload);

    const saveRequest$ = isEditing
      ? this.chauffeurService.updateVehicule(
          this.editingVehicule!.idVehicule!,
          payload,
        )
      : this.chauffeurService.addVehicule(payload);

    this.isSubmitting = true;

    saveRequest$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (savedVehicule) => {
        console.log('[Vehicules][Submit] save success', savedVehicule);
        const vehiculeId =
          savedVehicule?.idVehicule ?? this.editingVehicule?.idVehicule ?? null;

        const successMessage = isEditing
          ? 'Véhicule mis à jour'
          : 'Véhicule ajouté avec succès';

        if (vehiculeId && this.selectedPhotoFiles.length > 0) {
          console.log('[Vehicules][Submit] photo upload start', {
            vehiculeId,
            count: this.selectedPhotoFiles.length,
          });
          this.chauffeurService
            .uploadVehiculePhotos(vehiculeId, this.selectedPhotoFiles)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                console.log('[Vehicules][Submit] photo upload success', {
                  vehiculeId,
                });
                this.notificationService.success(
                  'Succès',
                  `${successMessage} + photos uploadées`,
                );
                this.loadVehicules();
                this.cancelForm();
                this.isSubmitting = false;
              },
              error: () => {
                console.error('[Vehicules][Submit] photo upload failed', {
                  vehiculeId,
                });
                this.notificationService.warning(
                  'Photos',
                  `${successMessage}, mais l'upload des photos a échoué.`,
                );
                this.loadVehicules();
                this.cancelForm();
                this.isSubmitting = false;
              },
            });
          return;
        }

        if (!vehiculeId && this.selectedPhotoFiles.length > 0) {
          console.warn(
            '[Vehicules][Submit] vehiculeId missing after save, resolving by plate',
            {
              normalizedNumeroPlaque,
              chauffeurId: this.chauffeurId,
              selectedPhotoCount: this.selectedPhotoFiles.length,
            },
          );

          this.uploadPhotosByResolvedVehiculeId(
            normalizedNumeroPlaque,
            successMessage,
          );
          return;
        }

        this.notificationService.success('Succès', successMessage);
        this.loadVehicules();
        this.cancelForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('[Vehicules][Submit] save failed', err);
        this.notificationService.error(
          'Erreur',
          isEditing
            ? 'Impossible de modifier le véhicule'
            : 'Impossible d’ajouter le véhicule',
        );
        this.isSubmitting = false;
      },
    });
  }

  deleteVehicule(id: number): void {
    if (!confirm('Supprimer ce véhicule ?')) return;

    this.chauffeurService.deleteVehicule(id).subscribe({
      next: () => {
        this.notificationService.success('Succès', 'Véhicule supprimé');
        this.loadVehicules();
      },
      error: () =>
        this.notificationService.error(
          'Erreur',
          'Impossible de supprimer le véhicule',
        ),
    });
  }

  activateVehicule(v: Vehicule): void {
    if (!v?.idVehicule || v.statut === VehiculeStatut.ACTIVE) {
      return;
    }

    this.chauffeurService.activateVehicule(v.idVehicule).subscribe({
      next: () => {
        this.notificationService.success(
          'Succès',
          'Véhicule activé comme véhicule principal',
        );
        this.loadVehicules();
      },
      error: () =>
        this.notificationService.error(
          'Erreur',
          'Impossible d activer ce véhicule',
        ),
    });
  }

  deactivateVehicule(v: Vehicule): void {
    if (!v?.idVehicule || v.statut !== VehiculeStatut.ACTIVE) {
      return;
    }

    this.chauffeurService.deactivateVehicule(v.idVehicule).subscribe({
      next: () => {
        this.notificationService.success('Succès', 'Véhicule désactivé');
        this.loadVehicules();
      },
      error: () =>
        this.notificationService.error(
          'Erreur',
          'Impossible de désactiver ce véhicule',
        ),
    });
  }

  cancelForm(): void {
    this.showAddForm = false;
    this.editingVehicule = null;
    this.isSubmitting = false;
    this.clearSelectedPhotos();
  }

  goBack(): void {
    this.router.navigate(['/transport/chauffeur-dashboard']);
  }

  goToActiveCourseShortcut(): void {
    this.router.navigate(['/transport/chauffeur-course-active']);
  }

  // Helper pour afficher le type de véhicule
  getTypeLabel(type: TypeVehicule): string {
    switch (type) {
      case TypeVehicule.ECONOMY:
        return 'Économie';
      case TypeVehicule.PREMIUM:
        return 'Premium';
      case TypeVehicule.VAN:
        return 'Van';
      default:
        return type;
    }
  }

  getActivationLabel(v: Vehicule): string {
    return v.statut === VehiculeStatut.ACTIVE ? 'Déjà actif' : 'Activer';
  }

  isActivationDisabled(v: Vehicule): boolean {
    return v.statut === VehiculeStatut.ACTIVE;
  }

  get currentDriverName(): string {
    const user = this.authService.getCurrentUser();
    return user?.username || 'Chauffeur';
  }

  get totalVehicules(): number {
    return this.vehicules.length;
  }

  get activeVehiculesCount(): number {
    return this.vehicules.filter((v) => v.statut === VehiculeStatut.ACTIVE)
      .length;
  }

  get inactiveVehiculesCount(): number {
    return this.vehicules.filter((v) => v.statut !== VehiculeStatut.ACTIVE)
      .length;
  }

  get totalSeats(): number {
    return this.vehicules.reduce(
      (sum, v) => sum + Number(v.capacitePassagers || 0),
      0,
    );
  }

  get averagePrixKm(): number {
    if (!this.vehicules.length) {
      return 0;
    }

    const total = this.vehicules.reduce(
      (sum, v) => sum + Number(v.prixKm || 0),
      0,
    );

    return total / this.vehicules.length;
  }

  get filteredVehicules(): Vehicule[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.vehicules;
    }

    return this.vehicules.filter((v) => {
      const marque = String(v.marque || '').toLowerCase();
      const modele = String(v.modele || '').toLowerCase();
      const plaque = String(v.numeroPlaque || '').toLowerCase();
      const type = this.getTypeLabel(v.typeVehicule).toLowerCase();

      return (
        marque.includes(term) ||
        modele.includes(term) ||
        plaque.includes(term) ||
        type.includes(term)
      );
    });
  }

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    this.clearSelectedPhotos();

    if (!files || files.length === 0) {
      console.log('[Vehicules][Photos] no files selected');
      return;
    }

    this.selectedPhotoFiles = Array.from(files);
    console.log('[Vehicules][Photos] files selected', {
      count: this.selectedPhotoFiles.length,
      files: this.selectedPhotoFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    });
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

  deleteExistingPhoto(vehicule: Vehicule, photoUrl: string): void {
    if (!vehicule?.idVehicule || !photoUrl) {
      return;
    }

    this.chauffeurService
      .removeVehiculePhoto(vehicule.idVehicule, photoUrl)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedVehicule) => {
          this.vehicules = this.vehicules.map((item) =>
            item.idVehicule === updatedVehicule.idVehicule
              ? updatedVehicule
              : item,
          );

          if (
            this.editingVehicule &&
            this.editingVehicule.idVehicule === updatedVehicule.idVehicule
          ) {
            this.editingVehicule = updatedVehicule;
          }

          this.notificationService.success('Succès', 'Photo supprimée');
        },
        error: () => {
          this.notificationService.error(
            'Erreur',
            'Impossible de supprimer cette photo',
          );
        },
      });
  }

  resolveVehiculePhotoUrl(path?: string): string {
    if (!path) {
      return '';
    }

    return this.chauffeurService.getPublicUploadUrl(path);
  }

  getVehiculePhotos(v: Vehicule): string[] {
    return this.normalizeVehiculePhotos(v).photoUrls || [];
  }

  getVehiculeMainPhoto(v: Vehicule): string {
    const photos = this.getVehiculePhotos(v);
    return photos.length > 0 ? this.resolveVehiculePhotoUrl(photos[0]) : '';
  }

  onVehiculeImageError(v: Vehicule, event: Event): void {
    const target = event.target as HTMLImageElement;
    console.error('[Vehicules][Photos] image load failed', {
      idVehicule: v.idVehicule,
      numeroPlaque: v.numeroPlaque,
      attemptedSrc: target?.currentSrc || target?.src,
      rawPhotoUrls: (v as any)?.photoUrls,
      rawPhotoUrlsSerialized: (v as any)?.photoUrlsSerialized,
    });
  }

  openVehiculeGallery(v: Vehicule, index = 0): void {
    const photos = this.getVehiculePhotos(v);
    if (!photos.length) {
      return;
    }

    this.galleryPhotos = photos;
    this.galleryIndex = Math.max(0, Math.min(index, photos.length - 1));
    this.galleryVehiculeTitle = `${v.marque} ${v.modele} - ${v.numeroPlaque}`;
    this.isGalleryOpen = true;
  }

  closeVehiculeGallery(): void {
    this.isGalleryOpen = false;
    this.galleryPhotos = [];
    this.galleryIndex = 0;
    this.galleryVehiculeTitle = '';
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
    return this.resolveVehiculePhotoUrl(this.galleryPhotos[this.galleryIndex]);
  }

  private clearSelectedPhotos(): void {
    for (const preview of this.photoPreviews) {
      URL.revokeObjectURL(preview);
    }
    this.photoPreviews = [];
    this.selectedPhotoFiles = [];
  }

  private normalizeVehiculePhotos(v: Vehicule): Vehicule {
    const current = (v as any)?.photoUrls;
    const serialized = (v as any)?.photoUrlsSerialized;

    let normalized: string[] = [];

    if (Array.isArray(current)) {
      const currentStrings = current.filter(
        (p) => typeof p === 'string' && p.trim().length > 0,
      ) as string[];

      const looksLikeCharArray =
        currentStrings.length > 0 &&
        currentStrings.every((p) => p.length === 1);

      if (looksLikeCharArray) {
        // Some payloads accidentally expose photoUrls as a string split into characters.
        const rebuilt = currentStrings.join('');
        normalized = rebuilt
          .split('||')
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
      } else {
        normalized = currentStrings;
      }
    } else if (typeof current === 'string' && current.trim().length > 0) {
      normalized = current
        .split('||')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    if (
      normalized.length === 0 &&
      typeof serialized === 'string' &&
      serialized.trim().length > 0
    ) {
      normalized = serialized
        .split('||')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);
    }

    normalized = Array.from(new Set(normalized));

    return {
      ...v,
      photoUrls: normalized,
    };
  }

  private uploadPhotosByResolvedVehiculeId(
    numeroPlaque: string,
    successMessage: string,
  ): void {
    if (!this.chauffeurId) {
      this.notificationService.warning(
        'Photos',
        `${successMessage}, mais l'identifiant chauffeur est introuvable pour l'upload photos.`,
      );
      this.loadVehicules();
      this.cancelForm();
      this.isSubmitting = false;
      return;
    }

    this.chauffeurService
      .getVehicules(this.chauffeurId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vehicules) => {
          const matched = (vehicules || []).find(
            (v) =>
              String(v.numeroPlaque || '')
                .trim()
                .toUpperCase() === numeroPlaque,
          );

          if (!matched?.idVehicule) {
            console.error(
              '[Vehicules][Submit] unable to resolve vehiculeId for photo upload',
              {
                numeroPlaque,
                vehiculesCount: vehicules?.length ?? 0,
              },
            );
            this.notificationService.warning(
              'Photos',
              `${successMessage}, mais le véhicule créé est introuvable pour l'upload photos.`,
            );
            this.loadVehicules();
            this.cancelForm();
            this.isSubmitting = false;
            return;
          }

          console.log(
            '[Vehicules][Submit] resolved vehiculeId for photo upload',
            {
              vehiculeId: matched.idVehicule,
              numeroPlaque,
            },
          );

          this.chauffeurService
            .uploadVehiculePhotos(matched.idVehicule, this.selectedPhotoFiles)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.notificationService.success(
                  'Succès',
                  `${successMessage} + photos uploadées`,
                );
                this.loadVehicules();
                this.cancelForm();
                this.isSubmitting = false;
              },
              error: (err) => {
                console.error(
                  '[Vehicules][Submit] photo upload failed after id resolution',
                  err,
                );
                this.notificationService.warning(
                  'Photos',
                  `${successMessage}, mais l'upload des photos a échoué.`,
                );
                this.loadVehicules();
                this.cancelForm();
                this.isSubmitting = false;
              },
            });
        },
        error: (err) => {
          console.error(
            '[Vehicules][Submit] failed loading vehicles for id resolution',
            err,
          );
          this.notificationService.warning(
            'Photos',
            `${successMessage}, mais impossible de résoudre le véhicule pour l'upload photos.`,
          );
          this.loadVehicules();
          this.cancelForm();
          this.isSubmitting = false;
        },
      });
  }

  debugSubmitButtonClick(event: MouseEvent): void {
    console.log('[Vehicules][UI] submit button clicked', {
      defaultPrevented: event.defaultPrevented,
      button: event.button,
      targetTag: (event.target as HTMLElement)?.tagName,
      currentTargetTag: (event.currentTarget as HTMLElement)?.tagName,
      formValid: this.vehiculeForm.valid,
      showAddForm: this.showAddForm,
    });
  }

  private getFormValidationSnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    Object.keys(this.vehiculeForm.controls).forEach((key) => {
      const control = this.vehiculeForm.controls[key];
      snapshot[key] = {
        value: control.value,
        valid: control.valid,
        errors: control.errors,
        touched: control.touched,
        dirty: control.dirty,
      };
    });
    return snapshot;
  }
}

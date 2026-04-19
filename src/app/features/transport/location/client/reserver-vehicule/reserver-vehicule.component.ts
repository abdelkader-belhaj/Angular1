import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  VehiculeAgence,
  ReservationLocation,
  ReservationStatus,
} from '../../../core/models';
import { LocationService } from '../../../core/services/location.service';
import {
  AiExtractionService,
  LicenseVerificationResult,
} from '../../../core/services/ai-extraction.service';

@Component({
  selector: 'app-reserver-vehicule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reserver-vehicule.component.html',
  styleUrl: './reserver-vehicule.component.css',
})
export class ReserverVehiculeComponent implements OnInit {
  private static readonly MAX_LICENSE_UPLOAD_CHARS = 850_000;
  private static readonly LICENSE_MAX_DIMENSION = 1400;

  vehicle: VehiculeAgence | null = null;
  isLoading = false;
  isSaving = false;
  isVerifyingLicense = false;
  error = '';
  success = '';
  licenseVerification: LicenseVerificationResult | null = null;

  isGalleryOpen = false;
  galleryPhotos: string[] = [];
  galleryIndex = 0;

  form = {
    dateDebut: '',
    dateFin: '',
    prenom: '',
    nom: '',
    dateNaiss: '',
    numeroPermis: '',
    licenseExpiryDate: '',
    licenseImageBase64: '',
    acceptedTerms: false,
    note: '',
  };

  selectedLicenseFileName = '';
  private selectedLicenseFile: File | null = null;
  private licenseVerificationSignature = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
    private readonly aiExtractionService: AiExtractionService,
  ) {}

  ngOnInit(): void {
    const vehicleId = Number(this.route.snapshot.paramMap.get('id'));
    if (!vehicleId) {
      this.error = 'Véhicule introuvable.';
      return;
    }

    this.isLoading = true;
    this.locationService
      .getVehiculeAgenceById(vehicleId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (vehicle) => {
          this.vehicle = vehicle;
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de charger ce véhicule.';
        },
      });
  }

  get estimatedDays(): number {
    if (!this.form.dateDebut || !this.form.dateFin) {
      return 0;
    }

    const start = new Date(this.form.dateDebut).getTime();
    const end = new Date(this.form.dateFin).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return 0;
    }

    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }

  get reservationQuote() {
    if (!this.vehicle || !this.form.dateDebut || !this.form.dateFin) {
      return null;
    }

    const quote = this.locationService.buildReservationQuote(
      this.vehicle,
      this.form.dateDebut,
      this.form.dateFin,
    );

    return quote.days > 0 ? quote : null;
  }

  get estimatedTotalPrice(): number {
    return this.reservationQuote?.totalPrice ?? 0;
  }

  get advanceAmount(): number {
    return this.reservationQuote?.advanceAmount ?? 0;
  }

  get depositAmount(): number {
    return this.reservationQuote?.depositAmount ?? 0;
  }

  get upfrontPaymentAmount(): number {
    return this.advanceAmount + this.depositAmount;
  }

  get paymentSummaryLabel(): string {
    if (!this.reservationQuote) {
      return 'Estimez la réservation pour afficher le paiement initial.';
    }

    return 'Le paiement initial (avance + caution) sera demandé après validation du permis par l’agence.';
  }

  getVehicleAgencyLabel(vehicle: VehiculeAgence): string {
    if (vehicle.agence) {
      return vehicle.agence.nomAgence;
    }

    return 'Agence de location';
  }

  getVehiclePhotos(vehicle: VehiculeAgence | null): string[] {
    return vehicle?.photoUrls || [];
  }

  resolvePhotoUrl(path?: string): string {
    if (!path) {
      return '';
    }
    return this.locationService.getPublicUploadUrl(path);
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

  reserve(): void {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser || !this.vehicle) {
      this.error = 'Session utilisateur ou véhicule manquant.';
      return;
    }

    if (!this.form.dateDebut || !this.form.dateFin) {
      this.error = 'Veuillez renseigner les dates de début et de fin.';
      return;
    }

    if (!this.form.numeroPermis || !this.form.licenseExpiryDate) {
      this.error =
        'Veuillez renseigner le numéro et la date de validité du permis.';
      return;
    }

    if (!this.form.prenom || !this.form.nom || !this.form.dateNaiss) {
      this.error =
        'Veuillez renseigner le prénom, le nom et la date de naissance.';
      return;
    }

    if (!this.form.licenseImageBase64) {
      this.error = 'Veuillez uploader une photo/scan de votre permis.';
      return;
    }

    if (!this.licenseVerification) {
      this.error =
        'Veuillez lancer la vérification IA du permis avant de continuer.';
      return;
    }

    if (
      this.form.licenseImageBase64.length >
      ReserverVehiculeComponent.MAX_LICENSE_UPLOAD_CHARS
    ) {
      this.error =
        'Image du permis trop lourde. Réduisez la taille puis réessayez.';
      return;
    }

    if (!this.form.acceptedTerms) {
      this.error = 'Veuillez accepter les conditions générales.';
      return;
    }

    this.isSaving = true;
    this.error = '';
    this.success = '';

    const quote = this.reservationQuote;

    const payload: Partial<ReservationLocation> = {
      clientId: currentUser.id,
      vehiculeAgenceId: this.vehicle.idVehiculeAgence,
      agenceLocation: this.vehicle.agence,
      dateDebut: this.form.dateDebut,
      dateFin: this.form.dateFin,
      note: this.form.note?.trim() || undefined,
      prixTotal: quote?.totalPrice ?? 0,
      advanceAmount: quote?.advanceAmount ?? 0,
      depositAmount: quote?.depositAmount ?? 0,
      statut: ReservationStatus.DRAFT,
      typeVehiculeDemande: this.vehicle.typeVehicule,
    };

    this.createReservationWithVerifiedLicense(payload, currentUser.id);
  }

  verifyLicenseWithAi(): void {
    if (!this.form.licenseImageBase64) {
      this.error = 'Veuillez sélectionner une photo de permis.';
      return;
    }

    if (!this.form.numeroPermis || !this.form.licenseExpiryDate) {
      this.error =
        'Renseignez le numéro et la date d’expiration avant la vérification.';
      return;
    }

    if (!this.form.prenom || !this.form.nom || !this.form.dateNaiss) {
      this.error =
        'Renseignez le prénom, le nom et la date de naissance avant la vérification.';
      return;
    }

    this.isVerifyingLicense = true;
    this.error = '';
    this.success = '';

    from(
      this.buildVerificationFileFromUploadedImage(
        this.form.licenseImageBase64,
        this.selectedLicenseFileName,
      ),
    )
      .pipe(
        switchMap((file) =>
          this.aiExtractionService.verifyLicense(
            file,
            this.form.numeroPermis,
            this.form.licenseExpiryDate,
            this.form.nom,
            this.form.prenom,
            this.form.dateNaiss,
          ),
        ),
        finalize(() => {
          this.isVerifyingLicense = false;
        }),
      )
      .subscribe({
        next: (result) => {
          this.licenseVerification = result;
          this.licenseVerificationSignature =
            this.buildLicenseVerificationSignature();

          if (result.valid) {
            this.success =
              'Permis validé par l’IA. Vous pouvez confirmer la réservation.';
            return;
          }

          this.error =
            result.message || 'Les données du permis ne correspondent pas.';
        },
        error: (error) => {
          this.licenseVerification = null;
          this.error =
            error?.error?.message ||
            error?.message ||
            'Impossible de vérifier le permis.';
        },
      });
  }

  private recoverReservationAfterCreateError(
    error: unknown,
    clientId: number,
  ): Observable<ReservationLocation> {
    return this.locationService.getReservationsByClient(clientId).pipe(
      map(
        (reservations) =>
          reservations
            .filter(
              (reservation) =>
                reservation.vehiculeAgenceId ===
                  this.vehicle?.idVehiculeAgence &&
                reservation.dateDebut === this.form.dateDebut &&
                reservation.dateFin === this.form.dateFin,
            )
            .sort((a, b) => b.idReservation - a.idReservation)[0],
      ),
      switchMap((reservation) => {
        if (reservation) {
          this.error =
            "La réservation a été créée malgré l'erreur serveur. On continue l'étape permis.";
          return of(reservation);
        }

        return throwError(() => error);
      }),
    );
  }

  private recoverReservationAfterUploadError(
    error: unknown,
    reservationId: number,
  ): Observable<ReservationLocation> {
    return this.locationService.getReservationById(reservationId).pipe(
      switchMap((reservation) => {
        if (reservation.numeroPermis || reservation.licenseStatus) {
          this.error =
            'Permis probablement enregistré malgré la réponse 400. Vérifiez le détail de la réservation.';
          return of(reservation);
        }

        return throwError(() => error);
      }),
    );
  }

  onLicenseFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.error = 'Le fichier du permis doit être une image.';
      return;
    }

    this.error = '';
    this.selectedLicenseFileName = file.name;
    this.selectedLicenseFile = file;
    this.licenseVerification = null;
    this.licenseVerificationSignature = '';

    this.optimizeLicenseImage(file)
      .then((optimizedDataUrl) => {
        const normalized = this.normalizeDataUrl(optimizedDataUrl);
        if (!normalized) {
          this.form.licenseImageBase64 = '';
          this.error = 'Image du permis invalide.';
          return;
        }

        if (
          normalized.length > ReserverVehiculeComponent.MAX_LICENSE_UPLOAD_CHARS
        ) {
          this.form.licenseImageBase64 = '';
          this.error =
            'Image du permis trop lourde apres compression. Choisissez une image plus legere.';
          return;
        }

        this.form.licenseImageBase64 = normalized;
        if (this.canVerifySelectedLicense()) {
          this.verifyLicenseWithAi();
        }
      })
      .catch(() => {
        this.error = 'Impossible de lire le fichier du permis.';
        this.form.licenseImageBase64 = '';
      });
  }

  onLicenseInputsChanged(): void {
    if (this.canVerifySelectedLicense()) {
      const signature = this.buildLicenseVerificationSignature();
      if (signature !== this.licenseVerificationSignature) {
        this.licenseVerification = null;
        this.licenseVerificationSignature = '';
      }
    }
  }

  get canShowLicenseVerification(): boolean {
    return !!this.licenseVerification;
  }

  get hasSelectedLicenseFile(): boolean {
    return !!this.selectedLicenseFile;
  }

  get canSubmitReservation(): boolean {
    return (
      !!this.licenseVerification && !this.isVerifyingLicense && !this.isSaving
    );
  }

  private canVerifySelectedLicense(): boolean {
    return (
      !!this.selectedLicenseFile &&
      !!this.form.numeroPermis &&
      !!this.form.licenseExpiryDate
    );
  }

  private buildLicenseVerificationSignature(): string {
    const file = this.selectedLicenseFile;
    return [
      file ? `${file.name}:${file.size}:${file.lastModified}` : '',
      this.form.numeroPermis.trim().toUpperCase(),
      this.form.licenseExpiryDate,
      String(this.form.licenseImageBase64.length || 0),
    ].join('|');
  }

  private async buildVerificationFileFromUploadedImage(
    dataUrl: string,
    originalFileName: string,
  ): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const baseName = (originalFileName || 'license').replace(/\.[^/.]+$/, '');
    const extension = blob.type.includes('png') ? 'png' : 'jpg';
    const mimeType = blob.type || 'image/jpeg';

    return new File([blob], `${baseName}_uploaded.${extension}`, {
      type: mimeType,
    });
  }

  private createReservationWithVerifiedLicense(
    payload: Partial<ReservationLocation>,
    clientId: number,
  ): void {
    this.locationService
      .createReservation(payload)
      .pipe(
        catchError((error) =>
          this.recoverReservationAfterCreateError(error, clientId),
        ),
        switchMap((reservation) =>
          this.locationService
            .uploadLicense(
              reservation.idReservation,
              this.form.numeroPermis,
              this.form.licenseImageBase64,
              this.form.licenseExpiryDate,
              this.form.prenom,
              this.form.nom,
              this.form.dateNaiss,
            )
            .pipe(
              catchError((error) =>
                this.recoverReservationAfterUploadError(
                  error,
                  reservation.idReservation,
                ),
              ),
            ),
        ),
      )
      .pipe(
        finalize(() => {
          this.isSaving = false;
        }),
      )
      .subscribe({
        next: (reservation) => {
          this.success =
            'Réservation envoyée avec permis validé par l’IA. En attente de validation agence.';
          this.router.navigate([
            '/transport/location/client/detail',
            reservation.idReservation,
          ]);
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de créer la réservation.';
        },
      });
  }

  private async optimizeLicenseImage(file: File): Promise<string> {
    const originalDataUrl = await this.readFileAsDataUrl(file);
    const image = await this.loadImage(originalDataUrl);

    const maxDimension = ReserverVehiculeComponent.LICENSE_MAX_DIMENSION;
    const ratio = Math.min(
      maxDimension / image.width,
      maxDimension / image.height,
      1,
    );
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return originalDataUrl;
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    // JPEG lowers payload size significantly for backend form uploads.
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Invalid image'));
      image.src = dataUrl;
    });
  }

  private normalizeDataUrl(value: string): string {
    const raw = value.trim();
    if (!raw.startsWith('data:image/')) {
      return '';
    }

    const commaIndex = raw.indexOf(',');
    if (commaIndex < 0) {
      return '';
    }

    const header = raw.slice(0, commaIndex + 1);
    const payload = raw.slice(commaIndex + 1).replace(/\s+/g, '');
    return `${header}${payload}`;
  }
}

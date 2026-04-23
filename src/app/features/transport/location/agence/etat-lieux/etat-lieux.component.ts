import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  DepositStatus,
  ReservationLocation,
  ReservationStatus,
} from '../../../core/models';
import {
  CheckoutCautionPayload,
  LocationService,
} from '../../../core/services/location.service';

@Component({
  selector: 'app-etat-lieux',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './etat-lieux.component.html',
  styleUrl: './etat-lieux.component.css',
})
export class EtatLieuxComponent implements OnInit {
  private static readonly PHOTO_COLLECTION_KEYS = [
    'etatDesLieuxPhotos',
    'photosEtatDesLieux',
    'checkInPhotos',
    'checkOutPhotos',
    'etatDesLieuxPhotoDtos',
    'etatDesLieuxPhotoList',
  ];
  private static readonly PHOTO_PREFERRED_KEYS = [
    'etatDesLieuxPhotos',
    'etatDesLieuxPhotoDtos',
    'etatDesLieuxPhotoList',
  ];

  reservation: ReservationLocation | null = null;
  isLoading = false;
  isSubmitting = false;
  error = '';
  success = '';
  checkInPhotos: string[] = [];
  checkOutPhotos: string[] = [];
  checkInFileNames: string[] = [];
  checkOutFileNames: string[] = [];
  checkoutHasDamages = false;
  checkoutDamageDescription = '';
  checkoutDamageAmount: number | null = null;
  checkoutRetainedAmount: number | null = 0;
  uploadedCheckInPhotos: Array<{ url: string; label: string }> = [];
  uploadedCheckOutPhotos: Array<{ url: string; label: string }> = [];
  enlargedPhoto: { url: string; label: string } | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly locationService: LocationService,
  ) {}

  ngOnInit(): void {
    const reservationId = Number(this.route.snapshot.paramMap.get('id'));

    if (!reservationId) {
      this.error = 'Réservation introuvable.';
      return;
    }

    this.isLoading = true;
    this.locationService
      .getReservationById(reservationId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
        },
        error: (error) => {
          this.error =
            error?.message || "Impossible de charger l'état des lieux.";
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

  getVehicleLabel(): string {
    if (!this.reservation) {
      return '';
    }

    const vehicle = this.reservation.vehiculeAgence;
    if (!vehicle) {
      return this.reservation.vehiculeAgenceId
        ? `Véhicule #${this.reservation.vehiculeAgenceId}`
        : 'Véhicule';
    }

    const brand = vehicle ? vehicle.marque || '' : '';
    const model = vehicle ? vehicle.modele || '' : '';
    return `${brand} ${model}`.trim();
  }

  get canSubmitCheckIn(): boolean {
    return (
      this.reservation?.statut === ReservationStatus.CONFIRMED &&
      this.reservation?.depositStatus === DepositStatus.HELD
    );
  }

  get canSubmitCheckOut(): boolean {
    if (!this.reservation) {
      return false;
    }

    return [ReservationStatus.IN_PROGRESS, ReservationStatus.ACTIVE].includes(
      this.reservation.statut,
    );
  }

  get expectedReturnDateLabel(): string {
    return this.reservation?.dateFin || '';
  }

  get depositAmountValue(): number {
    return Number(this.reservation?.depositAmount || 0);
  }

  get checkoutRetainedMax(): number {
    return this.depositAmountValue;
  }

  get checkoutRetainedNormalized(): number {
    return this.clampMoney(
      this.checkoutRetainedAmount,
      0,
      this.checkoutRetainedMax,
    );
  }

  get checkoutDamageAmountNormalized(): number {
    return Math.max(0, this.roundMoney(Number(this.checkoutDamageAmount || 0)));
  }

  get checkoutRestitutedAmount(): number {
    return Math.max(
      0,
      this.roundMoney(
        this.depositAmountValue - this.checkoutRetainedNormalized,
      ),
    );
  }

  get checkInGallery(): Array<{ url: string; label: string }> {
    return this.collectPhotosByType('CHECK_IN');
  }

  get checkOutGallery(): Array<{ url: string; label: string }> {
    return this.collectPhotosByType('CHECK_OUT');
  }

  get hasCheckInPhotos(): boolean {
    return this.checkInGallery.length > 0;
  }

  get hasCheckOutPhotos(): boolean {
    return this.checkOutGallery.length > 0;
  }

  get hideCheckInForm(): boolean {
    return this.isCheckInFinalized && this.hasCheckInPhotos;
  }

  get hideCheckOutForm(): boolean {
    return this.isCheckOutFinalized && this.hasCheckOutPhotos;
  }

  get isCheckInFinalized(): boolean {
    if (!this.reservation) {
      return false;
    }

    return [
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.ACTIVE,
      ReservationStatus.COMPLETED,
    ].includes(this.reservation.statut);
  }

  get isCheckOutFinalized(): boolean {
    return this.reservation?.statut === ReservationStatus.COMPLETED;
  }

  openPhoto(photo: { url: string; label: string }): void {
    this.enlargedPhoto = photo;
  }

  closePhoto(): void {
    this.enlargedPhoto = null;
  }

  onPhotoOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePhoto();
    }
  }

  private collectPhotosByType(
    type: 'CHECK_IN' | 'CHECK_OUT',
  ): Array<{ url: string; label: string }> {
    const backendCollected: Array<{
      url: string;
      label: string;
      type: string;
    }> = [];
    if (this.reservation) {
      const rawReservation = this.reservation as ReservationLocation &
        Record<string, any>;

      const preferredHasData = EtatLieuxComponent.PHOTO_PREFERRED_KEYS.some(
        (key) =>
          Array.isArray(rawReservation[key]) && rawReservation[key].length,
      );
      const keysToRead = preferredHasData
        ? EtatLieuxComponent.PHOTO_PREFERRED_KEYS
        : EtatLieuxComponent.PHOTO_COLLECTION_KEYS;

      for (const key of keysToRead) {
        const source = rawReservation[key];
        if (!Array.isArray(source)) {
          continue;
        }

        for (const item of source) {
          const rawUrl =
            typeof item === 'string'
              ? item
              : (item?.photoUrl ??
                item?.url ??
                item?.chemin ??
                item?.path ??
                '');
          const resolvedUrl = this.locationService.resolveMediaUrl(rawUrl);

          if (!resolvedUrl) {
            continue;
          }

          const itemType = this.normalizePhotoType(
            typeof item === 'string'
              ? ''
              : (item?.typePhoto ?? item?.type ?? ''),
          );
          const typeLabel = this.getPhotoTypeLabel(itemType);
          const createdAt =
            typeof item === 'string'
              ? ''
              : (item?.dateCreation ??
                item?.createdAt ??
                item?.createdDate ??
                '');

          backendCollected.push({
            url: resolvedUrl,
            label: [typeLabel, createdAt ? this.formatPhotoDate(createdAt) : '']
              .filter(Boolean)
              .join(' · '),
            type: itemType,
          });
        }
      }
    }

    const dedupeByType = (
      source: Array<{ url: string; label: string; type: string }>,
    ): Array<{ url: string; label: string }> => {
      const filtered = source.filter((photo) => photo.type === type);
      const deduped = filtered.filter((photo, index, list) => {
        const key = `${this.normalizePhotoUrl(photo.url)}|${photo.type}`;
        return (
          list.findIndex(
            (candidate) =>
              `${this.normalizePhotoUrl(candidate.url)}|${candidate.type}` ===
              key,
          ) === index
        );
      });

      const hasPersistentUrl = deduped.some(
        (photo) => !photo.url.startsWith('data:image/'),
      );
      const withoutLocalPreviewDuplicates = hasPersistentUrl
        ? deduped.filter((photo) => !photo.url.startsWith('data:image/'))
        : deduped;

      return withoutLocalPreviewDuplicates.map((photo) => ({
        url: photo.url,
        label: photo.label || this.getPhotoTypeLabel(photo.type),
      }));
    };

    const backendResult = dedupeByType(backendCollected);
    if (backendResult.length > 0) {
      return backendResult;
    }

    const fallbackCollected: Array<{
      url: string;
      label: string;
      type: string;
    }> = [];
    const cached = this.locationService.getCachedEtatDesLieuxPhotos(
      this.reservation?.idReservation || 0,
    );

    for (const photo of cached) {
      fallbackCollected.push({
        ...photo,
        type: this.inferTypeFromLabel(photo.label),
      });
    }

    for (const photo of this.uploadedCheckInPhotos) {
      fallbackCollected.push({ ...photo, type: 'CHECK_IN' });
    }

    for (const photo of this.uploadedCheckOutPhotos) {
      fallbackCollected.push({ ...photo, type: 'CHECK_OUT' });
    }

    return dedupeByType(fallbackCollected);
  }

  submitCheckIn(): void {
    if (!this.reservation) {
      return;
    }
    const reservationId = this.reservation.idReservation;

    if (!this.canSubmitCheckIn) {
      this.error =
        'Le check-in est autorisé uniquement après confirmation de la réservation et caution HELD.';
      return;
    }

    if (!this.checkInPhotos.length) {
      this.error = 'Ajoutez au moins une photo de départ (CHECK_IN).';
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    this.success = '';
    this.locationService
      .checkIn(reservationId, this.checkInPhotos)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (message) => {
          this.success =
            message ||
            'Check-in validé. Remise des clés confirmée et location démarrée.';
          this.uploadedCheckInPhotos = this.buildLocalPhotoGallery(
            this.checkInPhotos,
            this.checkInFileNames,
            'Check-in',
          );
          this.locationService.cacheEtatDesLieuxPhotos(
            reservationId,
            this.uploadedCheckInPhotos,
          );
          this.checkInPhotos = [];
          this.checkInFileNames = [];
          this.refreshReservationState();
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de lancer le check-in.';
        },
      });
  }

  submitCheckOut(): void {
    if (!this.reservation) {
      return;
    }
    const reservationId = this.reservation.idReservation;

    if (!this.canSubmitCheckOut) {
      this.error =
        'Le check-out est autorisé uniquement lorsque la location est en cours.';
      return;
    }

    if (!this.checkOutPhotos.length) {
      this.error = 'Ajoutez au moins une photo de retour (CHECK_OUT).';
      return;
    }

    const checkoutPayload = this.prepareCheckoutCautionPayload();
    if (!checkoutPayload) {
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    this.success = '';
    this.locationService
      .checkOut(reservationId, this.checkOutPhotos, checkoutPayload)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (message) => {
          this.success =
            message || 'Check-out validé. Caution traitée selon les dommages.';
          this.uploadedCheckOutPhotos = this.buildLocalPhotoGallery(
            this.checkOutPhotos,
            this.checkOutFileNames,
            'Check-out',
          );
          this.locationService.cacheEtatDesLieuxPhotos(
            reservationId,
            this.uploadedCheckOutPhotos,
          );
          this.checkOutPhotos = [];
          this.checkOutFileNames = [];
          this.resetCheckoutDamageForm();
          this.refreshReservationState();
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de lancer le check-out.';
        },
      });
  }

  onCheckoutDamageToggle(): void {
    if (!this.checkoutHasDamages) {
      this.checkoutDamageDescription = '';
      this.checkoutDamageAmount = 0;
      this.checkoutRetainedAmount = 0;
      return;
    }

    if (!this.checkoutRetainedAmount || this.checkoutRetainedAmount < 0) {
      this.checkoutRetainedAmount = 0;
    }
  }

  onCheckoutRetainedAmountChange(): void {
    this.checkoutRetainedAmount = this.checkoutRetainedNormalized;
  }

  private prepareCheckoutCautionPayload(): CheckoutCautionPayload | null {
    const deposit = this.depositAmountValue;
    const retained = this.checkoutHasDamages
      ? this.checkoutRetainedNormalized
      : 0;
    const damages = this.checkoutHasDamages
      ? this.checkoutDamageAmountNormalized
      : 0;
    const description = String(this.checkoutDamageDescription || '').trim();

    if (this.checkoutHasDamages) {
      if (!description) {
        this.error =
          'Décrivez les dommages constatés avant de valider le check-out.';
        return null;
      }

      if (damages <= 0) {
        this.error =
          'Le montant estimé des réparations doit être supérieur à 0 en cas de dommages.';
        return null;
      }
    }

    if (retained < 0 || retained > deposit) {
      this.error =
        'Le montant retenu sur la caution doit être compris entre 0 et la caution totale.';
      return null;
    }

    return {
      constatDommages: this.checkoutHasDamages,
      descriptionDommages: description,
      montantDommages: damages,
      montantCautionRetenu: retained,
      montantCautionRestitue: Math.max(0, this.roundMoney(deposit - retained)),
    };
  }

  private resetCheckoutDamageForm(): void {
    this.checkoutHasDamages = false;
    this.checkoutDamageDescription = '';
    this.checkoutDamageAmount = 0;
    this.checkoutRetainedAmount = 0;
  }

  private clampMoney(
    value: number | null | undefined,
    min: number,
    max: number,
  ): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return min;
    }

    return Math.max(min, Math.min(max, this.roundMoney(numeric)));
  }

  private roundMoney(value: number): number {
    return Number(Number(value || 0).toFixed(2));
  }

  onCheckInFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.loadFilesAsDataUrl(input.files, 'CHECK_IN');
  }

  onCheckOutFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.loadFilesAsDataUrl(input.files, 'CHECK_OUT');
  }

  private loadFilesAsDataUrl(
    files: FileList | null,
    type: 'CHECK_IN' | 'CHECK_OUT',
  ): void {
    if (!files || files.length === 0) {
      return;
    }

    const fileList = Array.from(files).filter((file) =>
      file.type.startsWith('image/'),
    );

    if (!fileList.length) {
      this.error = 'Sélectionnez des images valides.';
      return;
    }

    Promise.all(fileList.map((file) => this.readFileAsDataUrl(file)))
      .then((payloads) => {
        const normalizedPayloads = payloads
          .map((payload) => payload.trim())
          .filter((payload) => payload.startsWith('data:image/'));

        if (type === 'CHECK_IN') {
          this.checkInPhotos = normalizedPayloads;
          this.checkInFileNames = fileList.map((file) => file.name);
        } else {
          this.checkOutPhotos = normalizedPayloads;
          this.checkOutFileNames = fileList.map((file) => file.name);
        }

        this.error = '';
      })
      .catch(() => {
        this.error = 'Impossible de lire les photos sélectionnées.';
      });
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private buildLocalPhotoGallery(
    photoUrls: string[],
    fileNames: string[],
    typeLabel: string,
  ): Array<{ url: string; label: string }> {
    return photoUrls
      .map((photoUrl, index) => ({
        url: this.locationService.resolveMediaUrl(photoUrl),
        label: [typeLabel, fileNames[index] || ''].filter(Boolean).join(' · '),
      }))
      .filter((item) => !!item.url) as Array<{ url: string; label: string }>;
  }

  private refreshReservationState(): void {
    if (!this.reservation) {
      return;
    }

    this.locationService
      .getReservationById(this.reservation.idReservation)
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
        },
        error: () => {
          // Keep previous state if refresh fails.
        },
      });
  }

  private getPhotoTypeLabel(type: string): string {
    const normalized = this.normalizePhotoType(type);

    if (normalized === 'CHECK_IN' || normalized === 'DEPART') {
      return 'Check-in';
    }

    if (normalized === 'CHECK_OUT' || normalized === 'RETURN') {
      return 'Check-out';
    }

    if (normalized) {
      return normalized;
    }

    return 'État des lieux';
  }

  private formatPhotoDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private normalizePhotoType(type: string): string {
    const normalized = String(type || '')
      .trim()
      .toUpperCase();

    if (normalized === 'DEPART') {
      return 'CHECK_IN';
    }

    if (normalized === 'RETURN') {
      return 'CHECK_OUT';
    }

    if (normalized.includes('OUT') || normalized.includes('RETOUR')) {
      return 'CHECK_OUT';
    }

    if (normalized.includes('IN') || normalized.includes('DEPART')) {
      return 'CHECK_IN';
    }

    return normalized;
  }

  private inferTypeFromLabel(label: string): string {
    const normalized = String(label || '')
      .trim()
      .toLowerCase();
    if (normalized.includes('check-out') || normalized.includes('retour')) {
      return 'CHECK_OUT';
    }
    if (normalized.includes('check-in') || normalized.includes('depart')) {
      return 'CHECK_IN';
    }
    return '';
  }

  private normalizePhotoUrl(url: string): string {
    const trimmed = String(url || '').trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }

    const withoutQuery = trimmed.replace(/[?#].*$/, '');
    const uploadsMarker = '/uploads/';

    try {
      const parsed = new URL(withoutQuery, window.location.origin);
      const normalizedPath = parsed.pathname.replace(/\\/g, '/');
      const uploadsIndex = normalizedPath.toLowerCase().indexOf(uploadsMarker);
      if (uploadsIndex >= 0) {
        return normalizedPath.slice(uploadsIndex).toLowerCase();
      }

      return normalizedPath.toLowerCase();
    } catch {
      const normalized = withoutQuery.replace(/\\/g, '/');
      const uploadsIndex = normalized.toLowerCase().indexOf(uploadsMarker);
      if (uploadsIndex >= 0) {
        return normalized.slice(uploadsIndex).toLowerCase();
      }

      return normalized.toLowerCase();
    }
  }
}

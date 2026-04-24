import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, from, of, throwError } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  DepositStatus,
  DriverNotificationDTO,
  PaiementMethode,
  ReservationLocation,
  ReservationStatus,
} from '../../../core/models';
import {
  PaymentIntentResponse,
  StripePaymentService,
} from '../../../core/services/stripe-payment.service';
import {
  AiExtractionService,
  LicenseVerificationResult,
} from '../../../core/services/ai-extraction.service';
import {
  EtatDesLieuxPhotoDto,
  CheckoutCautionPayload,
  LocationExtensionRequest,
  LocationService,
} from '../../../core/services/location.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WebsocketService } from '../../../core/services/websocket.service';

@Component({
  selector: 'app-detail-reservation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detail-reservation.component.html',
  styleUrl: './detail-reservation.component.css',
})
export class DetailReservationComponent implements OnInit, OnDestroy {
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
  isHoldingDeposit = false;
  isReviewingExtension = false;
  isVerifyingLicenseAi = false;
  isSubmittingEtatLieux = false;
  isRefundingDeposit = false;
  isPreparingRefundPayment = false;
  depositRefundModalOpen = false;
  refundPaymentDetails: PaymentIntentResponse | null = null;
  refundModalError = '';
  error = '';
  success = '';
  agencyAiVerification: LicenseVerificationResult | null = null;
  agencyAiVerificationAt = '';
  decisionReason = '';
  extensionDecisionReason = '';
  showRejectReasonInput = false;
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
  departureCountdown = '';
  returnCountdown = '';
  extensionRequest: LocationExtensionRequest | null = null;
  etatDesLieuxPhotosFromApi: EtatDesLieuxPhotoDto[] = [];
  enlargedPhoto: { url: string; label: string } | null = null;
  permitImagePreviewUrl: string | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private wsNotificationSub: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly locationService: LocationService,
    private readonly aiExtractionService: AiExtractionService,
    private readonly stripePaymentService: StripePaymentService,
    private readonly authService: AuthService,
    private readonly websocketService: WebsocketService,
    private readonly notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    const reservationId = Number(this.route.snapshot.paramMap.get('id'));

    if (!reservationId) {
      this.error = 'Réservation introuvable.';
      return;
    }

    this.isLoading = true;
    this.setupRealtimeDepositNotifications();

    this.locationService
      .getReservationById(reservationId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.hydrateAgencyDetails();
          this.hydrateClientNoteFromAgencyList();
          this.loadPermitPreview();
          this.syncRentalTracking();
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de charger la réservation.';
        },
      });
  }

  ngOnDestroy(): void {
    this.stopCountdown();
    this.wsNotificationSub?.unsubscribe();
    this.wsNotificationSub = null;
    this.stripePaymentService.cleanup();
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

  getDepositStatusLabel(status?: DepositStatus | string | null): string {
    if (this.reservation?.statut === ReservationStatus.CANCELLED) {
      return 'Réservation annulée';
    }

    if (status === DepositStatus.HELD && !this.isAdvancePaymentCompleted) {
      return 'Caution en attente';
    }

    switch (status) {
      case DepositStatus.HELD:
        return 'Caution bloquée';
      case DepositStatus.RELEASED:
        return 'Caution remboursée';
      case DepositStatus.PENDING:
        return 'Caution en attente';
      case DepositStatus.FORFEITED:
        return 'Caution retenue';
      default:
        return status || '-';
    }
  }

  getVehicleLabel(): string {
    if (!this.reservation) {
      return '';
    }

    const vehicle = this.reservation.vehiculeAgence;
    if (!vehicle) {
      return 'Véhicule de Location';
    }

    const brand = vehicle ? vehicle.marque || '' : '';
    const model = vehicle ? vehicle.modele || '' : '';
    return `${brand} ${model}`.trim();
  }

  getRentedVehiclePhotos(): string[] {
    const urls = this.reservation?.vehiculeAgence?.photoUrls;
    if (!Array.isArray(urls)) {
      return [];
    }
    return urls.map((u) => String(u || '').trim()).filter(Boolean);
  }

  resolveRentedVehiclePhotoUrl(path?: string | null): string {
    const raw = String(path || '').trim();
    if (!raw) {
      return '';
    }
    if (
      raw.startsWith('data:') ||
      raw.startsWith('http://') ||
      raw.startsWith('https://')
    ) {
      return raw;
    }
    return this.locationService.getPublicUploadUrl(raw);
  }

  getRentedVehiclePlate(): string {
    return this.reservation?.vehiculeAgence?.numeroPlaque?.trim() || '—';
  }

  getRentedVehicleType(): string {
    const t = this.reservation?.vehiculeAgence?.typeVehicule;
    return t != null && String(t).trim() !== '' ? String(t) : '';
  }

  getRentedVehiclePassengers(): number | null {
    const n = this.reservation?.vehiculeAgence?.capacitePassagers;
    return n == null ? null : Number(n);
  }

  getClientLabel(): string {
    if (this.reservation && this.reservation.client) {
      return this.reservation.client.username;
    }

    return 'Client';
  }

  getAgencyAddress(): string {
    return (
      this.reservation?.agenceLocation?.adresse || 'Adresse non renseignée'
    );
  }

  get permitImageUrl(): string | null {
    const raw = this.reservation?.licenseImageUrl?.trim();
    if (!raw) {
      return null;
    }

    if (this.permitImagePreviewUrl) {
      return this.permitImagePreviewUrl;
    }

    if (raw.startsWith('data:image/') || raw.startsWith('http')) {
      return raw;
    }

    return null;
  }

  get hasAiLicenseVerification(): boolean {
    return !!(
      this.reservation &&
      (this.reservation.licenseAiValid !== undefined ||
        this.reservation.licenseAiMessage ||
        this.reservation.licenseAiExtractedNumero ||
        this.reservation.licenseAiExtractedDate)
    );
  }

  get aiLicenseVerificationLabel(): string {
    if (!this.reservation) {
      return '';
    }

    if (this.reservation.licenseAiValid === true) {
      return 'Permis validé par IA';
    }

    if (this.reservation.licenseAiValid === false) {
      return 'Alerte fraude possible';
    }

    return 'Validation IA non disponible';
  }

  get clientEnteredLicenseNumber(): string {
    return this.reservation?.numeroPermis?.trim() || '-';
  }

  get clientEnteredFirstName(): string {
    return this.reservation?.prenom?.trim() || '-';
  }

  get clientEnteredLastName(): string {
    return this.reservation?.nom?.trim() || '-';
  }

  get clientEnteredBirthDate(): string {
    const raw = this.reservation?.dateNaiss;
    if (!raw) {
      return '-';
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
    }).format(parsed);
  }

  get clientEnteredLicenseExpiryDate(): string {
    const raw = this.reservation?.licenseExpiryDate;
    if (!raw) {
      return '-';
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
    }).format(parsed);
  }

  get showAgencyAiComparison(): boolean {
    return !!(this.agencyAiVerification && this.reservation);
  }

  get hasEtatDesLieuxPhotos(): boolean {
    return this.getEtatDesLieuxPhotos().length > 0;
  }

  get checkInGallery(): Array<{ url: string; label: string }> {
    return this.collectEtatDesLieuxPhotosByType('CHECK_IN');
  }

  get checkOutGallery(): Array<{ url: string; label: string }> {
    return this.collectEtatDesLieuxPhotosByType('CHECK_OUT');
  }

  get hasCheckInPhotos(): boolean {
    return this.checkInGallery.length > 0;
  }

  get hasCheckOutPhotos(): boolean {
    return this.checkOutGallery.length > 0;
  }

  get remainingAmountToPay(): number {
    const total = this.getDisplayedTotalAmount();
    const advance = this.getDisplayedAdvanceAmount();
    return Math.max(0, Number((total - advance).toFixed(2)));
  }

  get displayedTotalAmount(): number {
    return this.getDisplayedTotalAmount();
  }

  get displayedAdvanceAmount(): number {
    return this.getDisplayedAdvanceAmount();
  }

  get displayedDepositAmount(): number {
    return this.getDisplayedDepositAmount();
  }

  get upfrontPaymentAmount(): number {
    return this.displayedAdvanceAmount + this.displayedDepositAmount;
  }

  get financialSummaryLabel(): string {
    if (!this.reservation) {
      return '';
    }

    if (this.hasSuspiciousStoredFinancials()) {
      return 'Montants recalculés depuis le véhicule et les dates pour garder un affichage cohérent.';
    }

    return 'Montants enregistrés par la réservation.';
  }

  get isFinalPaymentCompleted(): boolean {
    const phase = String(this.reservation?.paymentPhase || '').toUpperCase();
    return phase === 'FINAL_PAID';
  }

  get isAdvancePaymentCompleted(): boolean {
    const phase = String(this.reservation?.paymentPhase || '').toUpperCase();
    const advanceStatus = String(
      this.reservation?.advanceStatus || '',
    ).toUpperCase();
    return (
      advanceStatus === 'PAID' ||
      phase === 'ADVANCE_PAID' ||
      phase === 'FINAL_PAID'
    );
  }

  get paymentPhaseLabel(): string {
    const phase = this.reservation?.paymentPhase;
    if (!phase) {
      return '-';
    }

    switch (phase) {
      case 'DRAFT':
        return 'Brouillon';
      case 'ADVANCE_PENDING':
        return 'Avance en attente';
      case 'ADVANCE_PAID':
        return 'Avance payée';
      case 'VERIFICATION_PENDING':
        return 'Vérification agence';
      case 'CONFIRMED_PENDING_FINAL_PAYMENT':
        return 'Paiement final en attente';
      case 'FINAL_PAID':
        return 'Paiement final validé';
      case 'ACTIVE':
        return 'Location active';
      case 'COMPLETED':
        return 'Location terminée';
      default:
        return phase;
    }
  }

  private getDisplayedTotalAmount(): number {
    if (!this.reservation) {
      return 0;
    }

    const storedTotal = Number(this.reservation.prixTotal || 0);
    if (!this.hasSuspiciousStoredFinancials()) {
      return Number.isFinite(storedTotal) ? storedTotal : 0;
    }

    return this.getComputedReservationTotal();
  }

  private getDisplayedAdvanceAmount(): number {
    if (!this.reservation) {
      return 0;
    }

    const storedAdvance = Number(this.reservation.advanceAmount || 0);
    if (!this.hasSuspiciousStoredFinancials()) {
      return Number.isFinite(storedAdvance) ? storedAdvance : 0;
    }

    return this.getComputedReservationAdvance();
  }

  private getDisplayedDepositAmount(): number {
    if (!this.reservation) {
      return 0;
    }

    const storedDeposit = Number(this.reservation.depositAmount || 0);
    if (!this.hasSuspiciousStoredFinancials()) {
      return Number.isFinite(storedDeposit) ? storedDeposit : 0;
    }

    return this.getComputedReservationDeposit();
  }

  private getComputedReservationQuote(): {
    totalPrice: number;
    advanceAmount: number;
    depositAmount: number;
  } | null {
    if (!this.reservation?.vehiculeAgence) {
      return null;
    }

    const dateDebut = this.toDateInputValue(this.reservation.dateDebut);
    const dateFin = this.toDateInputValue(this.reservation.dateFin);
    if (!dateDebut || !dateFin) {
      return null;
    }

    const quote = this.locationService.buildReservationQuote(
      this.reservation.vehiculeAgence,
      dateDebut,
      dateFin,
    );

    return quote.days > 0 ? quote : null;
  }

  private getComputedReservationTotal(): number {
    return this.getComputedReservationQuote()?.totalPrice ?? 0;
  }

  private getComputedReservationAdvance(): number {
    return this.getComputedReservationQuote()?.advanceAmount ?? 0;
  }

  private getComputedReservationDeposit(): number {
    return this.getComputedReservationQuote()?.depositAmount ?? 0;
  }

  private hasSuspiciousStoredFinancials(): boolean {
    if (!this.reservation) {
      return false;
    }

    const storedTotal = Number(this.reservation.prixTotal || 0);
    const storedAdvance = Number(this.reservation.advanceAmount || 0);
    const storedDeposit = Number(this.reservation.depositAmount || 0);

    return (
      !Number.isFinite(storedTotal) ||
      storedTotal <= 0 ||
      (storedAdvance > 0 && storedTotal < storedAdvance) ||
      storedDeposit < 0
    );
  }

  private toDateInputValue(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get refundDepositAmount(): number {
    if (!this.reservation) {
      return 0;
    }

    const explicitRefund = Number(
      this.reservation.montantCautionRestitue ?? NaN,
    );
    if (Number.isFinite(explicitRefund) && explicitRefund >= 0) {
      return explicitRefund;
    }

    const retained = Number(this.reservation.montantCautionRetenu ?? NaN);
    const deposit = this.depositAmountValue;
    if (Number.isFinite(retained) && retained >= 0) {
      return Math.max(0, this.roundMoney(deposit - retained));
    }

    return deposit;
  }

  get depositAmountValue(): number {
    return Number(this.reservation?.depositAmount || 0);
  }

  get checkoutRetainedMax(): number {
    if (!this.checkoutHasDamages) {
      return this.depositAmountValue;
    }

    if (this.checkoutDamageAmountNormalized <= 0) {
      return this.depositAmountValue;
    }

    return Math.min(
      this.depositAmountValue,
      this.checkoutDamageAmountNormalized,
    );
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

  get canSubmitCheckIn(): boolean {
    return (
      this.reservation?.statut === ReservationStatus.CONFIRMED &&
      this.reservation?.depositStatus === DepositStatus.HELD &&
      this.isFinalPaymentCompleted
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

  get canRefundDeposit(): boolean {
    if (!this.reservation) {
      return false;
    }

    const phase = String(this.reservation.paymentPhase || '').toUpperCase();
    const depositStatus = String(
      this.reservation.depositStatus || '',
    ).toUpperCase();

    return (
      this.reservation.statut === ReservationStatus.COMPLETED &&
      depositStatus === 'HELD' &&
      phase === 'FINAL_PAID'
    );
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
      ReservationStatus.CHECKOUT_PENDING,
    ].includes(this.reservation.statut);
  }

  get isCheckOutFinalized(): boolean {
    return this.reservation?.statut === ReservationStatus.COMPLETED;
  }

  get canDisplayEtatDesLieuxByType(): boolean {
    if (!this.reservation) {
      return false;
    }

    return [
      ReservationStatus.CONFIRMED,
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.ACTIVE,
      ReservationStatus.COMPLETED,
    ].includes(this.reservation.statut);
  }

  getEtatDesLieuxPhotos(): Array<{ url: string; label: string }> {
    if (!this.reservation) {
      return [];
    }

    const rawReservation = this.reservation as ReservationLocation &
      Record<string, any>;
    const backendCollected: Array<{ url: string; label: string }> = [];

    const preferredHasData =
      DetailReservationComponent.PHOTO_PREFERRED_KEYS.some(
        (key) =>
          Array.isArray(rawReservation[key]) && rawReservation[key].length,
      );
    const keysToRead = preferredHasData
      ? DetailReservationComponent.PHOTO_PREFERRED_KEYS
      : DetailReservationComponent.PHOTO_COLLECTION_KEYS;

    for (const key of keysToRead) {
      const source = rawReservation[key];
      if (!Array.isArray(source)) {
        continue;
      }

      for (const item of source) {
        const rawUrl =
          typeof item === 'string'
            ? item
            : (item?.photoUrl ?? item?.url ?? item?.chemin ?? item?.path ?? '');
        const resolvedUrl = this.locationService.resolveMediaUrl(rawUrl);

        if (!resolvedUrl) {
          continue;
        }

        const typeLabel = this.getPhotoTypeLabel(
          typeof item === 'string' ? '' : (item?.typePhoto ?? item?.type ?? ''),
        );
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
        });
      }
    }

    const apiCollected = this.etatDesLieuxPhotosFromApi.map((photo) => ({
      url: photo.url,
      label: [
        this.getPhotoTypeLabel(photo.type),
        photo.createdAt ? this.formatPhotoDate(photo.createdAt) : '',
      ]
        .filter(Boolean)
        .join(' · '),
    }));

    const dedupedBackend = this.dedupePhotoEntries(
      backendCollected.concat(apiCollected),
    );
    if (dedupedBackend.length > 0) {
      return dedupedBackend;
    }

    return this.dedupePhotoEntries(
      this.locationService.getCachedEtatDesLieuxPhotos(
        this.reservation.idReservation,
      ),
    );
  }

  private collectEtatDesLieuxPhotosByType(
    type: 'CHECK_IN' | 'CHECK_OUT',
  ): Array<{ url: string; label: string }> {
    if (!this.reservation) {
      return [];
    }

    const rawReservation = this.reservation as ReservationLocation &
      Record<string, any>;
    const backendCollected: Array<{
      url: string;
      label: string;
      type: string;
    }> = [];

    for (const photo of this.etatDesLieuxPhotosFromApi) {
      const normalizedType = this.normalizePhotoType(photo.type);
      backendCollected.push({
        url: photo.url,
        type: normalizedType,
        label: [
          this.getPhotoTypeLabel(normalizedType),
          photo.createdAt ? this.formatPhotoDate(photo.createdAt) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }

    const preferredHasData =
      DetailReservationComponent.PHOTO_PREFERRED_KEYS.some(
        (key) =>
          Array.isArray(rawReservation[key]) && rawReservation[key].length,
      );
    const keysToRead = preferredHasData
      ? DetailReservationComponent.PHOTO_PREFERRED_KEYS
      : DetailReservationComponent.PHOTO_COLLECTION_KEYS;

    for (const key of keysToRead) {
      const source = rawReservation[key];
      if (!Array.isArray(source)) {
        continue;
      }

      for (const item of source) {
        const rawUrl =
          typeof item === 'string'
            ? item
            : (item?.photoUrl ?? item?.url ?? item?.chemin ?? item?.path ?? '');
        const resolvedUrl = this.locationService.resolveMediaUrl(rawUrl);

        if (!resolvedUrl) {
          continue;
        }

        const itemType = this.normalizePhotoType(
          typeof item === 'string' ? '' : (item?.typePhoto ?? item?.type ?? ''),
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

    const backendResult = this.dedupeTypedPhotoEntriesByType(
      backendCollected,
      type,
    );
    if (backendResult.length > 0) {
      return backendResult;
    }

    const fallbackCollected: Array<{
      url: string;
      label: string;
      type: string;
    }> = [];
    const cached = this.locationService.getCachedEtatDesLieuxPhotos(
      this.reservation.idReservation,
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

    return this.dedupeTypedPhotoEntriesByType(fallbackCollected, type);
  }

  submitCheckIn(): void {
    if (!this.reservation) {
      return;
    }

    if (!this.canSubmitCheckIn) {
      this.error =
        'Le check-in est autorisé uniquement après confirmation, caution HELD et paiement final client validé.';
      return;
    }

    if (!this.checkInPhotos.length) {
      this.error = 'Ajoutez au moins une photo de départ (CHECK_IN).';
      return;
    }

    const reservationId = this.reservation.idReservation;
    this.isSubmittingEtatLieux = true;
    this.error = '';
    this.success = '';

    this.locationService
      .checkIn(reservationId, this.checkInPhotos)
      .pipe(finalize(() => (this.isSubmittingEtatLieux = false)))
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

    const reservationId = this.reservation.idReservation;
    this.isSubmittingEtatLieux = true;
    this.error = '';
    this.success = '';

    this.locationService
      .checkOut(reservationId, this.checkOutPhotos, checkoutPayload)
      .pipe(finalize(() => (this.isSubmittingEtatLieux = false)))
      .subscribe({
        next: (message) => {
          this.success =
            message ||
            'Check-out validé. Caution traitée selon le constat de retour.';
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

    if (!this.checkoutDamageAmount || this.checkoutDamageAmount < 0) {
      this.checkoutDamageAmount = 0;
    }

    if (!this.checkoutRetainedAmount || this.checkoutRetainedAmount < 0) {
      this.checkoutRetainedAmount = this.clampMoney(
        this.checkoutDamageAmount,
        0,
        this.checkoutRetainedMax,
      );
    } else {
      this.checkoutRetainedAmount = this.clampMoney(
        this.checkoutRetainedAmount,
        0,
        this.checkoutRetainedMax,
      );
    }
  }

  onCheckoutDamageAmountChange(): void {
    if (!this.checkoutHasDamages) {
      return;
    }

    this.checkoutDamageAmount = this.checkoutDamageAmountNormalized;

    if (!this.checkoutRetainedAmount || this.checkoutRetainedAmount <= 0) {
      this.checkoutRetainedAmount = this.clampMoney(
        this.checkoutDamageAmount,
        0,
        this.checkoutRetainedMax,
      );
      return;
    }

    this.checkoutRetainedAmount = this.clampMoney(
      this.checkoutRetainedAmount,
      0,
      this.checkoutRetainedMax,
    );
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

      if (retained > damages) {
        this.error =
          'Le montant retenu sur caution ne peut pas dépasser le montant estimé des réparations.';
        return null;
      }
    }

    if (retained < 0 || retained > deposit) {
      this.error =
        'Le montant retenu sur la caution doit être compris entre 0 et le montant total de la caution.';
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

  openDepositRefundModal(): void {
    if (!this.canRefundDeposit) {
      return;
    }

    this.error = '';
    this.success = '';
    this.refundModalError = '';
    this.refundPaymentDetails = null;
    this.depositRefundModalOpen = true;

    const refundAmount = this.refundDepositAmount;
    if (refundAmount <= 0) {
      this.refundModalError = 'Montant de caution invalide pour remboursement.';
      return;
    }

    this.isPreparingRefundPayment = true;
    this.stripePaymentService
      .createPaymentIntent(refundAmount, 'DEPOSIT_REFUND')
      .pipe(finalize(() => (this.isPreparingRefundPayment = false)))
      .subscribe({
        next: (paymentIntent) => {
          this.refundPaymentDetails = paymentIntent;
          setTimeout(() => {
            this.stripePaymentService
              .setupPaymentForm('card-element-refund')
              .catch(() => {
                this.refundModalError =
                  'Impossible de préparer le formulaire Stripe.';
              });
          }, 0);
        },
        error: (error) => {
          this.refundModalError =
            error?.error?.message ||
            error?.message ||
            'Impossible d’initialiser le remboursement Stripe.';
        },
      });
  }

  cancelDepositRefundModal(): void {
    this.depositRefundModalOpen = false;
    this.refundModalError = '';
    this.refundPaymentDetails = null;
    this.stripePaymentService.cleanup();
  }

  confirmDepositRefund(): void {
    if (!this.reservation) {
      return;
    }

    if (!this.refundPaymentDetails) {
      this.refundModalError = 'Détails Stripe indisponibles.';
      return;
    }

    this.isRefundingDeposit = true;
    this.refundModalError = '';
    this.error = '';
    this.success = '';

    this.stripePaymentService
      .confirmPaymentWithCard(this.refundPaymentDetails)
      .then((stripeResult) => {
        const paymentIntentId = stripeResult?.paymentIntentId;

        this.locationService
          .refundDeposit(
            this.reservation!.idReservation,
            PaiementMethode.CARD,
            paymentIntentId,
          )
          .pipe(finalize(() => (this.isRefundingDeposit = false)))
          .subscribe({
            next: (reservation) => {
              this.depositRefundModalOpen = false;
              this.refundPaymentDetails = null;
              this.stripePaymentService.cleanup();
              this.reservation = reservation;
              this.syncRentalTracking();
              this.success =
                'Remboursement caution confirmé par l’agence. Le client a été notifié.';
            },
            error: (error) => {
              this.error =
                error?.message ||
                'Impossible de confirmer le remboursement caution.';
            },
          });
      })
      .catch((error) => {
        this.isRefundingDeposit = false;
        this.refundModalError =
          error?.message ||
          'Échec de confirmation Stripe pour le remboursement.';
      });
  }

  onCheckInFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.loadFilesAsDataUrl(input.files, 'CHECK_IN');
  }

  onCheckOutFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.loadFilesAsDataUrl(input.files, 'CHECK_OUT');
  }

  confirmReservation(): void {
    if (!this.reservation) {
      return;
    }

    this.locationService
      .confirmReservation(this.reservation.idReservation)
      .pipe(catchError((error) => this.recoverIfStateChanged(error)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
          this.success = 'Réservation confirmée.';
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de confirmer la réservation.';
        },
      });
  }

  cancelReservation(): void {
    if (!this.reservation) {
      return;
    }

    const advance = Number(this.displayedAdvanceAmount || 0);
    const deposit = Number(this.displayedDepositAmount || 0);
    const totalRefund = Number((advance + deposit).toFixed(2));

    const status = this.reservation.statut;
    const isConfirmed = status === ReservationStatus.CONFIRMED;
    const isAdvancePaid = this.isAdvancePaymentCompleted;

    let confirmMessage =
      "Confirmer l'annulation de cette réservation par l'agence ?";
    if (!isAdvancePaid) {
      confirmMessage +=
        '\n\nAucun remboursement (paiement initial non encaissé).';
    } else if (isConfirmed) {
      confirmMessage += `\n\nRemboursement prévu: caution ${deposit.toFixed(2)} TND.\nAvance non remboursée: ${advance.toFixed(2)} TND.`;
    } else {
      confirmMessage += `\n\nRemboursement total prévu: ${totalRefund.toFixed(2)} TND (avance + caution).`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    this.locationService
      .cancelReservation(this.reservation.idReservation, 'AGENCE')
      .pipe(catchError((error) => this.recoverIfStateChanged(error)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.loadPermitPreview();
          this.syncRentalTracking();
          const phase = String(reservation.paymentPhase || '').toUpperCase();
          if (phase === 'CANCELLED_REFUNDED_TOTAL') {
            this.success = `Réservation annulée. Client remboursé automatiquement (${totalRefund.toFixed(2)} TND: avance + caution).`;
          } else if (phase === 'CANCELLED_DEPOSIT_REFUNDED_ADVANCE_LOST') {
            this.success = `Réservation annulée. Caution remboursée (${deposit.toFixed(2)} TND), avance perdue (${advance.toFixed(2)} TND).`;
          } else {
            this.success =
              'Réservation annulée. Annulation simple, aucun remboursement.';
          }
        },
        error: (error) => {
          this.error = error?.message || "Impossible d'annuler la réservation.";
        },
      });
  }

  approveLicense(): void {
    if (!this.reservation) {
      return;
    }

    this.locationService
      .approveLicense(this.reservation.idReservation, true)
      .pipe(catchError((error) => this.recoverIfStateChanged(error)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
          this.error = '';
          this.success = 'Permis validé. En attente de la signature client.';
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de valider le permis de conduire.';
        },
      });
  }

  rejectLicense(): void {
    if (!this.reservation) {
      return;
    }

    const reason = this.decisionReason.trim();
    if (!reason) {
      this.success = '';
      this.error =
        'Veuillez renseigner un motif de rejet pour notifier le client.';
      return;
    }

    this.locationService
      .approveLicense(this.reservation.idReservation, false, reason)
      .pipe(catchError((error) => this.recoverIfStateChanged(error)))
      .subscribe({
        next: (reservation) => {
          const normalizedReservation = {
            ...reservation,
            licenseRejectionReason: reason,
            rejectionReason: reason,
            note: reason,
          } as ReservationLocation;

          this.reservation = normalizedReservation;
          this.showRejectReasonInput = false;
          this.decisionReason = '';
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
          this.error = '';
          const phase = String(reservation.paymentPhase || '').toUpperCase();
          this.success =
            phase === 'CANCELLED_BY_AGENCY_REFUND_TOTAL'
              ? 'Permis rejeté. Client remboursé automatiquement (avance + caution).'
              : 'Permis rejeté. Réservation annulée, caution remboursée et avance perdue.';
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de rejeter le permis.';
        },
      });
  }

  verifyLicenseWithAi(): void {
    if (!this.reservation) {
      return;
    }

    const normalizedExpiryDate = this.normalizeExpiryDateForAi(
      this.reservation.licenseExpiryDate,
    );

    if (!this.reservation.numeroPermis || !normalizedExpiryDate) {
      this.error =
        'Le numéro de permis ou la date d’expiration est manquant dans la réservation.';
      return;
    }

    if (!this.reservation.licenseImageUrl) {
      this.error = 'Aucune image de permis disponible pour la vérification IA.';
      return;
    }

    this.isVerifyingLicenseAi = true;
    this.error = '';
    this.success = '';

    from(this.buildLicenseFileForVerification(this.reservation))
      .pipe(
        switchMap((file) =>
          this.aiExtractionService.verifyLicense(
            file,
            this.reservation!.numeroPermis!,
            normalizedExpiryDate,
            this.reservation!.nom,
            this.reservation!.prenom,
            this.reservation!.dateNaiss,
          ),
        ),
        finalize(() => {
          this.isVerifyingLicenseAi = false;
        }),
      )
      .subscribe({
        next: (result) => {
          this.agencyAiVerification = result;
          this.agencyAiVerificationAt = new Date().toISOString();

          if (result.valid) {
            this.success =
              'Contrôle IA: correspondance trouvée. Vous pouvez valider le permis.';
            return;
          }

          this.error =
            result.message ||
            'Contrôle IA: incohérence détectée. Vérifiez le document avant décision.';
        },
        error: (error) => {
          this.agencyAiVerification = null;
          this.error =
            error?.error?.message ||
            error?.message ||
            'Impossible de vérifier le permis via IA.';
        },
      });
  }

  get hasAgencyAiVerification(): boolean {
    return !!this.agencyAiVerification;
  }

  get agencyAiWeakSignalHint(): string {
    const result = this.agencyAiVerification;
    if (!result) {
      return '';
    }

    if (result.numeroExtrait && !result.dateExtraite) {
      return 'Date non détectée par OCR: photo possiblement floue ou zone date peu lisible. Refaire une photo plus nette avant décision finale.';
    }

    if (result.rawMessage) {
      return result.rawMessage;
    }

    return '';
  }

  private async buildLicenseFileForVerification(
    reservation: ReservationLocation,
  ): Promise<File> {
    const raw = String(reservation.licenseImageUrl || '').trim();
    let blob: Blob;

    if (raw.startsWith('data:image/')) {
      const response = await fetch(raw);
      blob = await response.blob();
    } else {
      blob = await new Promise<Blob>((resolve, reject) => {
        this.locationService
          .getLicenseImageBlob(reservation.idReservation)
          .subscribe({
            next: (imageBlob) => resolve(imageBlob),
            error: (error) => reject(error),
          });
      });
    }

    const extension = this.resolveImageExtension(blob.type, raw);
    return new File(
      [blob],
      `license_${reservation.idReservation}.${extension}`,
      {
        type: blob.type || 'image/jpeg',
      },
    );
  }

  private normalizeExpiryDateForAi(value: string | undefined): string {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    // Keep only the calendar part when backend stores LocalDateTime.
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      return raw.slice(0, 10);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resolveImageExtension(mimeType: string, raw: string): string {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('png')) {
      return 'png';
    }
    if (mime.includes('webp')) {
      return 'webp';
    }
    if (mime.includes('jpg') || mime.includes('jpeg')) {
      return 'jpg';
    }

    const normalizedRaw = String(raw || '').toLowerCase();
    if (normalizedRaw.includes('.png')) {
      return 'png';
    }
    if (normalizedRaw.includes('.webp')) {
      return 'webp';
    }

    return 'jpg';
  }

  startRejectLicense(): void {
    this.showRejectReasonInput = true;
    this.success = '';
    this.error = '';
  }

  cancelRejectLicense(): void {
    this.showRejectReasonInput = false;
    this.decisionReason = '';
    this.error = '';
  }

  get clientNote(): string {
    if (!this.reservation) {
      return '';
    }

    return this.extractNoteFromReservation(this.reservation);
  }

  get canReviewLicense(): boolean {
    if (!this.reservation) {
      return false;
    }

    if (this.reservation.statut === ReservationStatus.CANCELLED) {
      return false;
    }

    return (
      this.reservation.licenseStatus === 'PENDING' ||
      this.reservation.statut === ReservationStatus.KYC_PENDING
    );
  }

  get canConfirmReservation(): boolean {
    if (!this.reservation) {
      return false;
    }

    return (
      this.reservation.depositStatus === DepositStatus.HELD &&
      this.reservation.statut === ReservationStatus.CONTRACT_SIGNED
    );
  }

  get canHoldDeposit(): boolean {
    // Deposit is now paid upfront with advance in the same transaction.
    return false;
  }

  get canCancelReservation(): boolean {
    if (!this.reservation) {
      return false;
    }

    return ![ReservationStatus.CANCELLED, ReservationStatus.COMPLETED].includes(
      this.reservation.statut,
    );
  }

  get canDownloadContract(): boolean {
    if (!this.reservation) {
      return false;
    }

    return [
      ReservationStatus.CONTRACT_SIGNED,
      ReservationStatus.CONFIRMED,
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.ACTIVE,
      ReservationStatus.COMPLETED,
    ].includes(this.reservation.statut);
  }

  get showFinalInvoiceDetails(): boolean {
    if (!this.reservation) {
      return false;
    }

    const phase = String(this.reservation.paymentPhase || '').toUpperCase();

    return (
      this.isFinalPaymentCompleted ||
      this.reservation.depositStatus === DepositStatus.RELEASED ||
      this.reservation.depositStatus === DepositStatus.FORFEITED ||
      phase === 'CANCELLED_REFUNDED_TOTAL' ||
      phase === 'CANCELLED_BY_AGENCY_REFUND_TOTAL' ||
      phase === 'CANCELLED_DEPOSIT_REFUNDED_ADVANCE_LOST'
    );
  }

  get isDepositRefunded(): boolean {
    return this.reservation?.depositStatus === DepositStatus.RELEASED;
  }

  get isDepositSettlementCompleted(): boolean {
    if (!this.reservation) {
      return false;
    }

    return (
      this.reservation.statut === ReservationStatus.COMPLETED &&
      (this.reservation.depositStatus === DepositStatus.RELEASED ||
        this.reservation.depositStatus === DepositStatus.FORFEITED)
    );
  }

  get depositRefundDisplayLabel(): string {
    if (
      !this.reservation ||
      this.reservation.statut !== ReservationStatus.COMPLETED
    ) {
      return this.isDepositRefunded ? 'OUI' : 'NON';
    }

    const deposit = Number(this.reservation.depositAmount || 0);
    const retained = Number(this.reservation.montantCautionRetenu || 0);
    const restored = Number(this.reservation.montantCautionRestitue || 0);

    if (deposit > 0 && retained <= 0 && restored >= deposit) {
      return 'OUI (total)';
    }

    if (retained > 0 && restored > 0) {
      return 'OUI (partiel)';
    }

    if (deposit > 0 && retained >= deposit && restored <= 0) {
      return 'NON';
    }

    return this.isDepositRefunded ? 'OUI' : 'NON';
  }

  get totalInvoiceAmount(): number {
    return this.displayedTotalAmount + this.displayedDepositAmount;
  }

  get canTrackActiveRental(): boolean {
    if (!this.reservation) {
      return false;
    }

    return [ReservationStatus.IN_PROGRESS, ReservationStatus.ACTIVE].includes(
      this.reservation.statut,
    );
  }

  get hasPendingExtensionRequest(): boolean {
    return this.extensionRequest?.status === 'PENDING';
  }

  get extensionStatusLabel(): string {
    if (!this.extensionRequest) {
      return 'Aucune';
    }

    if (this.extensionRequest.status === 'APPROVED') {
      return 'Approuvée';
    }

    if (this.extensionRequest.status === 'REJECTED') {
      return 'Refusée';
    }

    return 'En attente';
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

  get agencyWorkflowHint(): string {
    if (!this.reservation) {
      return '';
    }

    if (this.canReviewLicense) {
      return 'Étape 1: valider le permis client.';
    }

    if (this.reservation.statut === ReservationStatus.DEPOSIT_HELD) {
      if (!this.isAdvancePaymentCompleted) {
        return 'Étape 2: attendre le paiement initial client (avance + caution).';
      }

      return 'Étape 3: paiement initial validé, attente de la signature client du contrat.';
    }

    if (this.reservation.statut === ReservationStatus.CONTRACT_SIGNED) {
      return 'Étape 4: contrat signé. Vous pouvez confirmer la réservation.';
    }

    if (this.reservation.statut === ReservationStatus.CONFIRMED) {
      if (!this.isFinalPaymentCompleted) {
        return 'Étape 5: attendre le paiement final client avant le check-in.';
      }

      return 'Étape 6: paiement final validé. Vous pouvez lancer le check-in.';
    }

    return '';
  }

  get showFinalPaymentRequiredBadge(): boolean {
    return (
      this.reservation?.statut === ReservationStatus.CONFIRMED &&
      !this.isFinalPaymentCompleted
    );
  }

  get processSteps(): Array<{ label: string; done: boolean; active: boolean }> {
    const status = this.reservation?.statut;
    const licenseApproved =
      this.reservation?.licenseStatus === 'APPROVED' ||
      this.reservation?.licenseAiValid === true;

    const isReached = (targets: ReservationStatus[]) =>
      !!status && targets.includes(status);

    return [
      {
        label: 'Permis reçu',
        done: !!this.reservation?.numeroPermis,
        active: status === ReservationStatus.KYC_PENDING,
      },
      {
        label: 'Permis validé',
        done:
          licenseApproved ||
          isReached([
            ReservationStatus.DEPOSIT_HELD,
            ReservationStatus.CONTRACT_SIGNED,
            ReservationStatus.CONFIRMED,
            ReservationStatus.IN_PROGRESS,
            ReservationStatus.ACTIVE,
            ReservationStatus.COMPLETED,
          ]),
        active: status === ReservationStatus.KYC_PENDING,
      },
      {
        label: 'Paiement initial client (avance + caution)',
        done: this.isAdvancePaymentCompleted,
        active:
          status === ReservationStatus.DEPOSIT_HELD &&
          !this.isAdvancePaymentCompleted,
      },
      {
        label: 'Contrat signé client',
        done:
          status === ReservationStatus.CONTRACT_SIGNED ||
          status === ReservationStatus.CONFIRMED ||
          status === ReservationStatus.IN_PROGRESS ||
          status === ReservationStatus.ACTIVE ||
          status === ReservationStatus.COMPLETED,
        active:
          status === ReservationStatus.DEPOSIT_HELD &&
          this.isAdvancePaymentCompleted,
      },
      {
        label: 'Réservation confirmée',
        done: isReached([
          ReservationStatus.CONFIRMED,
          ReservationStatus.IN_PROGRESS,
          ReservationStatus.ACTIVE,
          ReservationStatus.COMPLETED,
        ]),
        active: status === ReservationStatus.CONFIRMED,
      },
      {
        label: 'Paiement final client',
        done: this.isFinalPaymentCompleted,
        active:
          status === ReservationStatus.CONFIRMED &&
          !this.isFinalPaymentCompleted,
      },
      {
        label: 'Check-in effectué',
        done:
          this.isFinalPaymentCompleted &&
          isReached([
            ReservationStatus.IN_PROGRESS,
            ReservationStatus.ACTIVE,
            ReservationStatus.COMPLETED,
          ]),
        active:
          status === ReservationStatus.CONFIRMED &&
          this.isFinalPaymentCompleted,
      },
      {
        label: 'Check-out effectué',
        done: status === ReservationStatus.COMPLETED,
        active:
          status === ReservationStatus.IN_PROGRESS ||
          status === ReservationStatus.ACTIVE,
      },
      {
        label: 'Remboursement caution',
        done: this.isDepositSettlementCompleted,
        active:
          status === ReservationStatus.COMPLETED &&
          !this.isDepositSettlementCompleted,
      },
    ];
  }

  downloadContract(): void {
    if (this.reservation) {
      this.locationService.downloadContractPdf(this.reservation.idReservation);
    }
  }

  downloadFinalInvoicePdf(): void {
    if (!this.reservation) {
      return;
    }

    this.locationService.downloadFinalInvoicePdf(
      this.reservation.idReservation,
    );
  }

  confirmDepositHeld(mode: 'PHYSICAL' | 'ONLINE' = 'PHYSICAL'): void {
    if (!this.reservation) {
      return;
    }

    this.isHoldingDeposit = true;
    this.error = '';
    this.success = '';

    this.locationService
      .holdDeposit(this.reservation.idReservation, mode)
      .pipe(
        catchError(() =>
          this.locationService.updateReservation(
            this.reservation!.idReservation,
            {
              depositStatus: DepositStatus.HELD,
              statut: ReservationStatus.DEPOSIT_HELD,
            },
          ),
        ),
        catchError((error) => this.recoverIfStateChanged(error)),
        finalize(() => {
          this.isHoldingDeposit = false;
        }),
      )
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.syncRentalTracking();
          this.success =
            'Caution confirmée et bloquée (HELD). Vous pouvez maintenant confirmer la réservation.';
        },
        error: (error) => {
          this.error =
            error?.message ||
            'Impossible de confirmer la réception de la caution.';
        },
      });
  }

  approveExtensionRequest(): void {
    if (
      !this.reservation ||
      !this.extensionRequest ||
      !this.hasPendingExtensionRequest
    ) {
      return;
    }

    this.isReviewingExtension = true;
    this.error = '';

    this.locationService
      .updateReservation(this.reservation.idReservation, {
        dateFin: this.extensionRequest.proposedEndDate,
        prixTotal: this.extensionRequest.proposedTotalPrice,
        depositAmount: this.extensionRequest.proposedDepositAmount,
      })
      .pipe(finalize(() => (this.isReviewingExtension = false)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.extensionRequest =
            this.locationService.updateRentalExtensionStatus(
              reservation.idReservation,
              'APPROVED',
              'Agence location',
              this.extensionDecisionReason,
            );
          this.extensionDecisionReason = '';
          this.syncRentalTracking();
          this.success =
            'Prolongation approuvée. Retour, prix et caution ont été mis à jour.';
        },
        error: (error) => {
          this.error =
            error?.message ||
            "Impossible d'approuver la prolongation pour le moment.";
        },
      });
  }

  rejectExtensionRequest(): void {
    if (
      !this.reservation ||
      !this.extensionRequest ||
      !this.hasPendingExtensionRequest
    ) {
      return;
    }

    this.extensionRequest = this.locationService.updateRentalExtensionStatus(
      this.reservation.idReservation,
      'REJECTED',
      'Agence location',
      this.extensionDecisionReason,
    );
    this.extensionDecisionReason = '';
    this.success = 'Demande de prolongation refusée.';
  }

  private recoverIfStateChanged(
    error: unknown,
  ): import('rxjs').Observable<ReservationLocation> {
    if (!this.reservation) {
      return throwError(() => error);
    }

    return this.locationService
      .getReservationById(this.reservation.idReservation)
      .pipe(
        switchMap((freshReservation) => {
          const changed =
            this.reservation &&
            freshReservation.statut !== this.reservation.statut;
          const licenseChanged =
            (this.reservation?.licenseStatus || '') !==
            (freshReservation.licenseStatus || '');

          if (changed || licenseChanged) {
            this.success =
              'Action appliquée malgré une réponse backend 400. État resynchronisé.';
            return of(freshReservation);
          }

          return throwError(() => error);
        }),
      );
  }

  private hydrateAgencyDetails(): void {
    if (!this.reservation) {
      return;
    }

    this.ensureRentedVehicleLoaded();

    const knownAgency = this.reservation.agenceLocation;
    const rawAgenceId =
      knownAgency?.idAgence ||
      this.reservation.vehiculeAgence?.agence?.idAgence ||
      Number((this.reservation as any)?.agenceId || 0);

    if (!rawAgenceId || knownAgency?.adresse) {
      return;
    }

    this.locationService.getAgenceById(rawAgenceId).subscribe({
      next: (agence) => {
        if (!this.reservation) {
          return;
        }

        this.reservation = {
          ...this.reservation,
          agenceLocation: agence,
        };
      },
      error: () => {
        // Keep existing reservation data.
      },
    });
  }

  private loadPermitPreview(): void {
    if (!this.reservation) {
      return;
    }

    const raw = this.reservation.licenseImageUrl?.trim();
    if (!raw || raw.startsWith('data:image/') || raw.startsWith('http')) {
      this.permitImagePreviewUrl = null;
      return;
    }

    this.locationService
      .getLicenseImageBlob(this.reservation.idReservation)
      .subscribe({
        next: (blob: Blob) => {
          if (this.permitImagePreviewUrl) {
            URL.revokeObjectURL(this.permitImagePreviewUrl);
          }
          this.permitImagePreviewUrl = URL.createObjectURL(blob);
        },
        error: () => {
          this.permitImagePreviewUrl = null;
        },
      });
  }

  private syncRentalTracking(): void {
    if (!this.reservation) {
      this.departureCountdown = '';
      this.returnCountdown = '';
      this.extensionRequest = null;
      this.etatDesLieuxPhotosFromApi = [];
      this.stopCountdown();
      return;
    }

    this.loadEtatDesLieuxPhotosFromApi();
    this.extensionRequest = this.locationService.getRentalExtensionRequest(
      this.reservation.idReservation,
    );
    this.refreshDepartureCountdown();
    this.refreshReturnCountdown();
    this.startCountdown();
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
          this.syncRentalTracking();
        },
        error: () => {
          // Keep previous state if refresh fails.
        },
      });
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.countdownTimer = setInterval(() => {
      this.refreshDepartureCountdown();
      this.refreshReturnCountdown();
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private setupRealtimeDepositNotifications(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      return;
    }

    this.websocketService.connect(currentUser.id);
    this.wsNotificationSub?.unsubscribe();
    this.wsNotificationSub =
      this.websocketService.driverNotifications$.subscribe(
        (notif: DriverNotificationDTO) => {
          const notifType = String(notif?.type || '').toUpperCase();
          const notifiedReservationId = Number(
            notif?.data?.reservationId ?? notif?.data?.idReservation ?? 0,
          );
          const currentReservationId = Number(
            this.reservation?.idReservation || 0,
          );

          if (
            !currentReservationId ||
            notifiedReservationId !== currentReservationId
          ) {
            return;
          }

          const isRefundOrCancellation =
            notifType === 'DEPOSIT_RELEASED' ||
            notifType === 'RESERVATION_CANCELLED_BY_AGENCY' ||
            notifType === 'RESERVATION_CANCELLED_BY_CLIENT' ||
            notifType === 'LICENSE_REJECTED_REFUND' ||
            notifType.includes('CANCEL');

          if (notifType === 'DEPOSIT_RELEASED') {
            this.notificationService.success(
              notif?.titre || 'Caution remboursée',
              notif?.message ||
                `La caution de la réservation #${currentReservationId} a été remboursée.`,
            );
          } else if (isRefundOrCancellation) {
            this.notificationService.info(
              notif?.titre || 'Mise à jour réservation',
              notif?.message ||
                `La réservation #${currentReservationId} a été mise à jour.`,
            );
          }

          this.refreshReservationAfterRealtimeEvent();
        },
      );
  }

  private refreshReservationAfterRealtimeEvent(): void {
    if (!this.reservation) {
      return;
    }

    this.locationService
      .getReservationById(this.reservation.idReservation)
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.hydrateAgencyDetails();
          this.hydrateClientNoteFromAgencyList();
          this.loadPermitPreview();
          this.syncRentalTracking();
        },
      });
  }

  private refreshReturnCountdown(): void {
    if (!this.reservation) {
      this.returnCountdown = '';
      return;
    }

    const deadline = this.parseReturnDeadline(this.reservation.dateFin);
    if (!deadline) {
      this.returnCountdown = 'Date de retour non disponible';
      return;
    }

    const diffMs = deadline.getTime() - Date.now();
    if (diffMs <= 0) {
      this.returnCountdown = 'Retour prévu dépassé';
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    this.returnCountdown = `${days}j ${hours}h ${minutes}m ${seconds}s`;
  }

  private refreshDepartureCountdown(): void {
    if (!this.reservation) {
      this.departureCountdown = '';
      return;
    }

    const departure = this.parseReturnDeadline(this.reservation.dateDebut);
    if (!departure) {
      this.departureCountdown = 'Date de départ non disponible';
      return;
    }

    const diffMs = departure.getTime() - Date.now();
    if (diffMs <= 0) {
      this.departureCountdown = 'Départ déjà effectué';
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    this.departureCountdown = `${days}j ${hours}h ${minutes}m ${seconds}s`;
  }

  private loadEtatDesLieuxPhotosFromApi(): void {
    const reservationId = this.reservation?.idReservation;
    if (!reservationId) {
      this.etatDesLieuxPhotosFromApi = [];
      return;
    }

    this.locationService
      .getEtatDesLieuxPhotosByReservation(reservationId)
      .subscribe({
        next: (photos) => {
          this.etatDesLieuxPhotosFromApi = photos;
        },
        error: () => {
          this.etatDesLieuxPhotosFromApi = [];
        },
      });
  }

  private parseReturnDeadline(raw: string | undefined): Date | null {
    const value = String(raw || '').trim();
    if (!value) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T23:59:59`);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private getPhotoTypeLabel(type: string): string {
    const normalized = String(type || '')
      .trim()
      .toUpperCase();

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

  private dedupePhotoEntries(
    photos: Array<{ url: string; label: string }>,
  ): Array<{ url: string; label: string }> {
    return photos.filter((photo, index, list) => {
      const key = this.normalizePhotoUrl(photo.url);
      if (!key) {
        return false;
      }

      return (
        list.findIndex(
          (candidate) => this.normalizePhotoUrl(candidate.url) === key,
        ) === index
      );
    });
  }

  private dedupeTypedPhotoEntriesByType(
    photos: Array<{ url: string; label: string; type: string }>,
    type: 'CHECK_IN' | 'CHECK_OUT',
  ): Array<{ url: string; label: string }> {
    const filtered = photos.filter((photo) => photo.type === type);

    const deduped = filtered.filter((photo, index, list) => {
      const key = `${this.normalizePhotoUrl(photo.url)}|${photo.type}`;

      return (
        !!this.normalizePhotoUrl(photo.url) &&
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
  }

  private normalizePhotoUrl(url: string): string {
    const trimmed = String(url || '').trim();
    if (!trimmed) {
      return '';
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

  private hydrateClientNoteFromAgencyList(): void {
    if (!this.reservation || this.clientNote) {
      return;
    }

    const rawAgenceId =
      this.reservation.agenceLocation?.idAgence ||
      this.reservation.vehiculeAgence?.agence?.idAgence ||
      Number((this.reservation as any)?.agenceId || 0);

    if (!rawAgenceId) {
      return;
    }

    const reservationId = this.reservation.idReservation;
    this.locationService.getReservationsByAgence(rawAgenceId).subscribe({
      next: (reservations) => {
        if (!this.reservation) {
          return;
        }

        const matching = reservations.find(
          (item) => item.idReservation === reservationId,
        );
        const note = matching ? this.extractNoteFromReservation(matching) : '';
        if (!note) {
          return;
        }

        this.reservation = {
          ...this.reservation,
          note,
        };
      },
      error: () => {
        // Keep existing reservation data.
      },
    });
  }

  private extractNoteFromReservation(
    value: ReservationLocation | (ReservationLocation & Record<string, any>),
  ): string {
    const raw = value as ReservationLocation & Record<string, any>;

    const directCandidates = [
      raw.note,
      raw['notes'],
      raw['noteClient'],
      raw['clientNote'],
      raw['reservationNote'],
      raw['commentaire'],
      raw['comment'],
      raw['messageClient'],
      raw['message'],
      raw['observation'],
      raw['remarque'],
      raw['note_client'],
      raw['client_note'],
    ];

    const nestedContainers = [
      raw['reservation'],
      raw['reservationLocation'],
      raw['dto'],
      raw['data'],
    ].filter((item) => item && typeof item === 'object') as Array<
      Record<string, any>
    >;

    for (const container of nestedContainers) {
      directCandidates.push(
        container['note'],
        container['notes'],
        container['noteClient'],
        container['clientNote'],
        container['reservationNote'],
        container['commentaire'],
        container['comment'],
        container['messageClient'],
        container['message'],
        container['observation'],
        container['remarque'],
      );
    }

    const normalizedCandidate = directCandidates
      .map((candidate) => String(candidate ?? '').trim())
      .find(
        (candidate) =>
          candidate.length > 0 &&
          candidate.toLowerCase() !== 'null' &&
          candidate.toLowerCase() !== 'undefined',
      );

    if (normalizedCandidate) {
      return normalizedCandidate;
    }

    const dynamicKey = Object.keys(raw).find((key) =>
      /note|comment|message/i.test(key),
    );
    if (!dynamicKey) {
      return '';
    }

    const dynamicValue = String(raw[dynamicKey] ?? '').trim();
    return dynamicValue.toLowerCase() === 'null' ||
      dynamicValue.toLowerCase() === 'undefined'
      ? ''
      : dynamicValue;
  }

  /**
   * Complète `vehiculeAgence` (photos, marque…) si l’API réservation ne renvoie qu’un id.
   */
  private ensureRentedVehicleLoaded(): void {
    if (!this.reservation) {
      return;
    }

    const raw = this.reservation as ReservationLocation & Record<string, any>;
    const reservationId = this.reservation.idReservation;
    const v = this.reservation.vehiculeAgence;
    const id = Number(
      raw.vehiculeAgenceId ??
        raw['idVehiculeAgence'] ??
        v?.idVehiculeAgence ??
        0,
    );
    if (!id) {
      return;
    }

    const hasUsefulPayload = !!(
      v &&
      (String(v.marque || '').trim() ||
        String(v.modele || '').trim() ||
        String(v.numeroPlaque || '').trim() ||
        (Array.isArray(v.photoUrls) && v.photoUrls.length > 0))
    );
    if (hasUsefulPayload) {
      return;
    }

    this.locationService.getVehiculeAgenceById(id).subscribe({
      next: (vehicule) => {
        if (
          !this.reservation ||
          this.reservation.idReservation !== reservationId
        ) {
          return;
        }
        this.reservation = {
          ...this.reservation,
          vehiculeAgence: vehicule,
        };
      },
      error: () => {
        /* garde l’état réservation */
      },
    });
  }
}

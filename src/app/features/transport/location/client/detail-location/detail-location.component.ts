import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, of, throwError } from 'rxjs';
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
  LocationExtensionRequest,
  LocationService,
} from '../../../core/services/location.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  PaymentIntentResponse,
  StripePaymentService,
} from '../../../core/services/stripe-payment.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { CardPaymentModalComponent } from '../../../core/components/card-payment-modal/card-payment-modal.component';

@Component({
  selector: 'app-detail-location',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CardPaymentModalComponent],
  templateUrl: './detail-location.component.html',
  styleUrl: './detail-location.component.css',
})
export class DetailLocationComponent implements OnInit, OnDestroy {
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

  private static readonly MAX_LICENSE_UPLOAD_CHARS = 850_000;
  private static readonly LICENSE_MAX_DIMENSION = 1400;

  @ViewChild('signatureCanvas') signatureCanvas?: ElementRef<HTMLCanvasElement>;

  reservation: ReservationLocation | null = null;
  isLoading = false;
  isSigning = false;
  isResubmitting = false;
  isPreparingFinalPayment = false;
  isSubmittingFinalPayment = false;
  acceptedTerms = false;
  error = '';
  success = '';
  finalPaymentModalOpen = false;
  finalPaymentError = '';
  finalPaymentDetails: PaymentIntentResponse | null = null;
  initialPaymentModalOpen = false;
  isSubmittingInitialPayment = false;
  permitImagePreviewUrl: string | null = null;
  selectedResubmissionFileName = '';
  departureCountdown = '';
  enlargedPhoto: { url: string; label: string } | null = null;
  returnCountdown = '';
  extensionDays = 1;
  extensionReason = '';
  extensionRequest: LocationExtensionRequest | null = null;
  isSubmittingExtension = false;
  resubmissionForm = {
    prenom: '',
    nom: '',
    dateNaiss: '',
    numeroPermis: '',
    licenseExpiryDate: '',
    licenseImageBase64: '',
  };

  private isDrawing = false;
  private hasDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private wsNotificationSub: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly locationService: LocationService,
    private readonly authService: AuthService,
    private readonly websocketService: WebsocketService,
    private readonly notificationService: NotificationService,
    private readonly stripePaymentService: StripePaymentService,
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
          this.populateResubmissionForm(reservation);
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
          setTimeout(() => this.prepareSignatureCanvas(), 0);
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

  getAgencyLabel(): string {
    if (this.reservation && this.reservation.agenceLocation) {
      return this.reservation.agenceLocation.nomAgence;
    }

    return 'Agence de location';
  }

  getAgencyAddress(): string {
    return (
      this.reservation?.agenceLocation?.adresse || 'Adresse non renseignée'
    );
  }

  getClientLabel(): string {
    if (this.reservation && this.reservation.client) {
      return this.reservation.client.username;
    }

    return 'Client';
  }

  getClientUsername(): string {
    return this.reservation?.client?.username || '-';
  }

  openContract(): void {
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

  get canSignContract(): boolean {
    return (
      this.reservation?.statut === ReservationStatus.DEPOSIT_HELD &&
      this.isAdvancePaymentCompleted
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

  get canCancelReservation(): boolean {
    if (!this.reservation) {
      return false;
    }

    return ![
      ReservationStatus.CANCELLED,
      ReservationStatus.IN_PROGRESS,
      ReservationStatus.ACTIVE,
      ReservationStatus.COMPLETED,
    ].includes(this.reservation.statut);
  }

  get cancelActionLabel(): string {
    if (!this.reservation) {
      return 'Annuler la réservation';
    }

    if (!this.isAdvancePaymentCompleted) {
      return 'Annuler - aucun remboursement';
    }

    if (this.reservation.statut === ReservationStatus.CONFIRMED) {
      return 'Annuler - caution remboursée';
    }

    return 'Annuler - remboursement total';
  }

  cancelReservation(): void {
    if (!this.reservation || !this.canCancelReservation) {
      return;
    }

    let confirmMessage = "Confirmer l'annulation de cette réservation ?";
    if (!this.isAdvancePaymentCompleted) {
      confirmMessage =
        "Confirmer l'annulation ? Annulation simple, aucun remboursement.";
    } else if (this.reservation.statut === ReservationStatus.CONFIRMED) {
      confirmMessage = `Confirmer l\'annulation ? La caution (${this.depositAmount} TND) sera remboursée et l\'avance sera perdue.`;
    } else {
      const refundAmount = this.upfrontPaymentAmount;
      confirmMessage = `Confirmer l\'annulation ? Remboursement total prévu de ${refundAmount} TND (avance + caution).`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    this.locationService
      .cancelReservation(this.reservation.idReservation, 'CLIENT')
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.populateResubmissionForm(reservation);
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();

          const phase = String(reservation.paymentPhase || '').toUpperCase();
          if (phase === 'CANCELLED_REFUNDED_TOTAL') {
            this.success = `✓ Remboursement total de ${this.upfrontPaymentAmount} TND en cours (3-5 jours).`;
          } else if (phase === 'CANCELLED_DEPOSIT_REFUNDED_ADVANCE_LOST') {
            this.success = `✓ Caution de ${this.depositAmount} TND remboursée. Avance de ${this.advanceAmount} TND conservée par l'agence.`;
          } else if (phase === 'CANCELLED_BY_AGENCY_REFUND_TOTAL') {
            this.success = `✓ Agence annulation. Remboursement total de ${this.upfrontPaymentAmount} TND en cours (3-5 jours).`;
          } else {
            this.success =
              '✓ Réservation annulée. Annulation simple, aucun remboursement.';
          }
          this.error = '';
        },
        error: (error) => {
          this.error = error?.message || "Impossible d'annuler la réservation.";
        },
      });
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

  get totalInvoiceAmount(): number {
    return this.displayTotalAmount + this.depositAmount;
  }

  get waitingMessage(): string {
    if (!this.reservation) {
      return '';
    }

    if (this.reservation.statut === ReservationStatus.DRAFT) {
      return 'Réservation en brouillon: avance de réservation en attente.';
    }

    if (this.reservation.paymentPhase === 'ADVANCE_PENDING') {
      return 'Paiement de l’avance en attente de confirmation carte.';
    }

    if (this.reservation.paymentPhase === 'ADVANCE_PAID') {
      return 'Avance confirmée. Réservation transmise à l’agence pour vérification.';
    }

    if (this.hasRejectedLicense) {
      return 'Permis rejete. Corrigez le document et re-soumettez-le.';
    }

    if (this.reservation.statut === ReservationStatus.KYC_PENDING) {
      return "Permis en cours de validation par l'agence.";
    }

    if (this.reservation.statut === ReservationStatus.DEPOSIT_HELD) {
      if (!this.isAdvancePaymentCompleted) {
        return 'Permis validé. Complétez maintenant le paiement initial (avance + caution).';
      }

      return 'Paiement initial confirmé. Signature requise pour débloquer la suite du dossier.';
    }

    if (this.reservation.statut === ReservationStatus.CONTRACT_SIGNED) {
      return 'Contrat signé. En attente de confirmation agence.';
    }

    if (this.reservation.statut === ReservationStatus.CONFIRMED) {
      if (this.isFinalPaymentRequired) {
        return 'Réservation confirmée. Complétez maintenant le paiement final avant le check-in.';
      }

      return "Réservation confirmée par l'agence. Vous pouvez télécharger le contrat.";
    }

    if (
      this.reservation.statut === ReservationStatus.IN_PROGRESS ||
      this.reservation.statut === ReservationStatus.ACTIVE
    ) {
      return (
        'Votre location a démarré. Retour prévu le ' +
        this.formatReturnDate(this.reservation.dateFin) +
        '.'
      );
    }

    if (this.reservation.statut === ReservationStatus.CANCELLED) {
      const phase = String(this.reservation.paymentPhase || '').toUpperCase();
      if (
        phase === 'CANCELLED_REFUNDED_TOTAL' ||
        phase === 'CANCELLED_BY_AGENCY_REFUND_TOTAL'
      ) {
        return 'Réservation annulée. Remboursement total (avance + caution) en cours.';
      }

      if (phase === 'CANCELLED_DEPOSIT_REFUNDED_ADVANCE_LOST') {
        return 'Réservation annulée. Caution remboursée, avance perdue.';
      }

      return 'Réservation annulée. Annulation simple, aucun remboursement.';
    }

    return '';
  }

  get rentalStartedInfo(): string {
    if (!this.reservation) {
      return '';
    }

    if (
      this.reservation.statut !== ReservationStatus.IN_PROGRESS &&
      this.reservation.statut !== ReservationStatus.ACTIVE
    ) {
      return '';
    }

    return `Location démarrée. Date de retour prévue: ${this.formatReturnDate(this.reservation.dateFin)}.`;
  }

  get canTrackActiveRental(): boolean {
    if (!this.reservation) {
      return false;
    }

    return [ReservationStatus.IN_PROGRESS, ReservationStatus.ACTIVE].includes(
      this.reservation.statut,
    );
  }

  get canRequestExtension(): boolean {
    if (!this.canTrackActiveRental) {
      return false;
    }

    return !this.extensionRequest || this.extensionRequest.status !== 'PENDING';
  }

  get extensionStatusLabel(): string {
    if (!this.extensionRequest) {
      return '';
    }

    if (this.extensionRequest.status === 'APPROVED') {
      return 'Approuvée';
    }

    if (this.extensionRequest.status === 'REJECTED') {
      return 'Refusée';
    }

    return 'En attente';
  }

  get extensionPriceDelta(): number {
    if (!this.extensionRequest || !this.reservation) {
      return 0;
    }

    return (
      Number(this.extensionRequest.proposedTotalPrice || 0) -
      Number(this.reservation.prixTotal || 0)
    );
  }

  get extensionDepositDelta(): number {
    if (!this.extensionRequest || !this.reservation) {
      return 0;
    }

    return (
      Number(this.extensionRequest.proposedDepositAmount || 0) -
      Number(this.reservation.depositAmount || 0)
    );
  }

  get advanceAmount(): number {
    return this.getDisplayedAdvanceAmount();
  }

  get displayTotalAmount(): number {
    return this.getDisplayedTotalAmount();
  }

  get remainingAmountToPay(): number {
    const total = this.getDisplayedTotalAmount();
    const advance = this.getDisplayedAdvanceAmount();
    return Math.max(0, Number((total - advance).toFixed(2)));
  }

  get depositAmount(): number {
    return this.getDisplayedDepositAmount();
  }

  get upfrontPaymentAmount(): number {
    return this.advanceAmount + this.depositAmount;
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
      phase === 'FINAL_PAID' ||
      phase === 'CONFIRMED_PENDING_FINAL_PAYMENT'
    );
  }

  get canPayInitialAdvance(): boolean {
    return (
      this.reservation?.statut === ReservationStatus.DEPOSIT_HELD &&
      this.reservation?.licenseStatus === 'APPROVED' &&
      !this.isAdvancePaymentCompleted &&
      this.upfrontPaymentAmount > 0
    );
  }

  get canCompleteFinalPayment(): boolean {
    if (!this.reservation) {
      return false;
    }

    return (
      this.reservation.statut === ReservationStatus.CONFIRMED &&
      !this.isFinalPaymentCompleted
    );
  }

  get showFinalPaymentSummary(): boolean {
    return (
      !!this.reservation &&
      (this.isFinalPaymentRequired || this.isFinalPaymentCompleted)
    );
  }

  get totalLocationPaidAmount(): number {
    return this.isFinalPaymentCompleted
      ? this.displayTotalAmount
      : this.advanceAmount;
  }

  get totalTransactionAmount(): number {
    if (!this.isAdvancePaymentCompleted) {
      return this.totalLocationPaidAmount;
    }

    return this.totalLocationPaidAmount + this.depositAmount;
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

  get isFinalPaymentRequired(): boolean {
    return (
      this.reservation?.statut === ReservationStatus.CONFIRMED &&
      !this.isFinalPaymentCompleted
    );
  }

  get paymentPhaseLabel(): string {
    if (!this.reservation) {
      return '-';
    }

    switch (this.reservation.paymentPhase) {
      case 'DRAFT':
        return 'Brouillon';
      case 'ADVANCE_PENDING':
        return 'Avance en attente';
      case 'ADVANCE_PAID':
        return 'Avance payée';
      case 'VERIFICATION_PENDING':
        return 'Vérification agence';
      case 'CONFIRMED_PENDING_FINAL_PAYMENT':
        return 'Paiement final à compléter';
      case 'FINAL_PAID':
        return 'Paiement final complété';
      case 'ACTIVE':
        return 'Location active';
      case 'COMPLETED':
        return 'Terminée';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return this.reservation.statut;
    }
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

  get hasEtatDesLieuxPhotos(): boolean {
    return this.getEtatDesLieuxPhotos().length > 0;
  }

  getEtatDesLieuxPhotos(): Array<{ url: string; label: string }> {
    if (!this.reservation) {
      return [];
    }

    const rawReservation = this.reservation as ReservationLocation &
      Record<string, any>;
    const backendCollected: Array<{ url: string; label: string }> = [];

    const preferredHasData = DetailLocationComponent.PHOTO_PREFERRED_KEYS.some(
      (key) => Array.isArray(rawReservation[key]) && rawReservation[key].length,
    );
    const keysToRead = preferredHasData
      ? DetailLocationComponent.PHOTO_PREFERRED_KEYS
      : DetailLocationComponent.PHOTO_COLLECTION_KEYS;

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

    const dedupedBackend = this.dedupePhotoEntries(backendCollected);
    if (dedupedBackend.length > 0) {
      return dedupedBackend;
    }

    return this.dedupePhotoEntries(
      this.locationService.getCachedEtatDesLieuxPhotos(
        this.reservation.idReservation,
      ),
    );
  }

  get hasRejectedLicense(): boolean {
    return this.reservation?.licenseStatus === 'REJECTED';
  }

  get licenseRejectionReason(): string {
    if (!this.reservation) {
      return '';
    }

    const raw = this.reservation as ReservationLocation & Record<string, any>;
    const reason =
      raw.licenseRejectionReason ??
      raw.rejectionReason ??
      raw['reason'] ??
      raw['motifRejetPermis'] ??
      raw['reasonRefusPermis'] ??
      raw.note ??
      raw['notes'] ??
      raw['noteClient'] ??
      raw['clientNote'] ??
      raw['reservationNote'] ??
      raw['commentaire'] ??
      raw['comment'] ??
      raw['messageClient'] ??
      raw['message'] ??
      raw['observation'] ??
      raw['remarque'] ??
      raw['note_client'] ??
      raw['client_note'] ??
      this.extractLicenseNoteFromReservation(raw);

    const normalizedReason = String(reason || '').trim();
    if (normalizedReason) {
      return normalizedReason;
    }

    return '';
  }

  get canResubmitLicense(): boolean {
    return this.hasRejectedLicense;
  }

  get processSteps(): Array<{ label: string; done: boolean; active: boolean }> {
    const status = this.reservation?.statut;
    const licenseApproved = this.reservation?.licenseStatus === 'APPROVED';

    const isReached = (targets: ReservationStatus[]) =>
      !!status && targets.includes(status);

    return [
      {
        label: 'Réservation créée',
        done: !!status,
        active: status === ReservationStatus.KYC_PENDING,
      },
      {
        label: 'Permis validé agence',
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
        active: status === ReservationStatus.KYC_PENDING && !licenseApproved,
      },
      {
        label: 'Paiement initial (avance + caution)',
        done: this.isAdvancePaymentCompleted,
        active:
          status === ReservationStatus.DEPOSIT_HELD &&
          !this.isAdvancePaymentCompleted,
      },
      {
        label: 'Contrat signé',
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
        label: 'Validation agence',
        done: isReached([
          ReservationStatus.CONFIRMED,
          ReservationStatus.IN_PROGRESS,
          ReservationStatus.ACTIVE,
          ReservationStatus.COMPLETED,
        ]),
        active: status === ReservationStatus.CONFIRMED,
      },
      {
        label: 'Paiement final complété',
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
        done: this.reservation?.depositStatus === DepositStatus.RELEASED,
        active:
          status === ReservationStatus.COMPLETED &&
          this.reservation?.depositStatus !== DepositStatus.RELEASED,
      },
    ];
  }

  openFinalPaymentModal(): void {
    if (!this.reservation || !this.canCompleteFinalPayment) {
      return;
    }

    this.finalPaymentError = '';
    this.error = '';
    this.success = '';
    this.isPreparingFinalPayment = true;

    this.stripePaymentService
      .createPaymentIntent(this.remainingAmountToPay, 'COURSE_FINAL_BALANCE')
      .pipe(finalize(() => (this.isPreparingFinalPayment = false)))
      .subscribe({
        next: (details) => {
          this.finalPaymentDetails = details;
          this.finalPaymentModalOpen = true;
          setTimeout(() => {
            this.stripePaymentService
              .setupPaymentForm('final-payment-card-element')
              .catch((err) => {
                this.finalPaymentError =
                  err?.message || 'Impossible de charger le formulaire carte.';
              });
          }, 0);
        },
        error: (err) => {
          this.finalPaymentError =
            err?.error?.message ||
            err?.message ||
            'Impossible de préparer le paiement final.';
        },
      });
  }

  cancelFinalPaymentModal(): void {
    this.finalPaymentModalOpen = false;
    this.finalPaymentError = '';
    this.finalPaymentDetails = null;
    this.stripePaymentService.cleanup();
  }

  openInitialAdvancePaymentStep(): void {
    if (!this.canPayInitialAdvance) {
      return;
    }

    this.initialPaymentModalOpen = true;
    this.error = '';
    this.success = '';
  }

  onInitialAdvanceCardConfirmed(paymentIntent: PaymentIntentResponse): void {
    if (!this.reservation || !paymentIntent?.paymentIntentId) {
      this.error = 'Confirmation carte invalide.';
      return;
    }

    this.isSubmittingInitialPayment = true;
    this.locationService
      .payReservationAdvance(
        this.reservation.idReservation,
        PaiementMethode.CARD,
        paymentIntent.paymentIntentId,
      )
      .pipe(finalize(() => (this.isSubmittingInitialPayment = false)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.populateResubmissionForm(reservation);
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
          this.initialPaymentModalOpen = false;
          this.error = '';
          this.success =
            'Paiement initial confirmé. Vous pouvez maintenant signer le contrat.';
        },
        error: (error) => {
          this.error =
            error?.error?.message ||
            error?.message ||
            "Impossible de confirmer le paiement d'avance.";
        },
      });
  }

  onInitialAdvanceCardCancelled(): void {
    if (this.isSubmittingInitialPayment) {
      return;
    }

    this.initialPaymentModalOpen = false;
  }

  submitFinalPayment(): void {
    if (!this.reservation || !this.finalPaymentDetails) {
      return;
    }

    this.finalPaymentError = '';
    this.isSubmittingFinalPayment = true;

    this.stripePaymentService
      .confirmPaymentWithCard(this.finalPaymentDetails)
      .then((stripeResult) => {
        const paymentIntentId = stripeResult?.paymentIntentId;

        this.locationService
          .completeReservation(
            this.reservation!.idReservation,
            PaiementMethode.CARD,
            paymentIntentId,
          )
          .pipe(finalize(() => (this.isSubmittingFinalPayment = false)))
          .subscribe({
            next: (reservation) => {
              this.reservation = reservation;
              this.populateResubmissionForm(reservation);
              this.hydrateAgencyDetails();
              this.loadPermitPreview();
              this.syncRentalTracking();
              this.cancelFinalPaymentModal();
              this.success =
                'Paiement final validé. Vous pouvez procéder au check-in.';
            },
            error: (err) => {
              this.finalPaymentError =
                err?.error?.message ||
                err?.message ||
                'Le paiement final a échoué.';
            },
          });
      })
      .catch((err) => {
        this.isSubmittingFinalPayment = false;
        this.finalPaymentError = err?.message || 'Le paiement final a échoué.';
      });
  }

  beginSignature(event: MouseEvent | TouchEvent): void {
    if (!this.canSignContract) {
      return;
    }

    const point = this.getCanvasPoint(event);
    if (!point) {
      return;
    }

    this.isDrawing = true;
    this.lastX = point.x;
    this.lastY = point.y;
  }

  drawSignature(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) {
      return;
    }

    const canvas = this.signatureCanvas?.nativeElement;
    const point = this.getCanvasPoint(event);
    if (!canvas || !point) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    this.lastX = point.x;
    this.lastY = point.y;
    this.hasDrawing = true;

    if ('preventDefault' in event) {
      event.preventDefault();
    }
  }

  endSignature(): void {
    this.isDrawing = false;
  }

  clearSignature(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasDrawing = false;
  }

  submitSignature(): void {
    if (!this.reservation) {
      return;
    }

    if (!this.acceptedTerms) {
      this.error =
        'Veuillez accepter les conditions générales avant signature.';
      return;
    }

    if (!this.hasDrawing || !this.signatureCanvas) {
      this.error = 'Veuillez signer dans la zone prévue.';
      return;
    }

    const signedBy =
      this.authService.getCurrentUser()?.username ||
      this.authService.getCurrentUser()?.email ||
      'Client';
    const signature = this.signatureCanvas.nativeElement.toDataURL('image/png');

    this.isSigning = true;
    this.error = '';
    this.success = '';
    this.locationService
      .signContract(this.reservation.idReservation, signature, signedBy)
      .pipe(
        catchError((error) =>
          this.locationService
            .getReservationById(this.reservation!.idReservation)
            .pipe(
              switchMap((reservation) => {
                const signedStatuses = [
                  ReservationStatus.CONTRACT_SIGNED,
                  ReservationStatus.CONFIRMED,
                  ReservationStatus.IN_PROGRESS,
                  ReservationStatus.ACTIVE,
                  ReservationStatus.COMPLETED,
                ];

                if (signedStatuses.includes(reservation.statut)) {
                  return of(reservation);
                }

                return throwError(() => error);
              }),
            ),
        ),
      )
      .pipe(finalize(() => (this.isSigning = false)))
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.populateResubmissionForm(reservation);
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
          this.error = '';
          this.success = 'Contrat signé avec succès.';
          this.clearSignature();
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de signer le contrat.';
        },
      });
  }

  submitLicenseResubmission(): void {
    if (!this.reservation || !this.canResubmitLicense) {
      return;
    }

    if (
      !this.resubmissionForm.prenom ||
      !this.resubmissionForm.nom ||
      !this.resubmissionForm.dateNaiss ||
      !this.resubmissionForm.numeroPermis ||
      !this.resubmissionForm.licenseExpiryDate
    ) {
      this.error =
        'Veuillez renseigner le prenom, le nom, la date de naissance, le numero et la date de validite du permis.';
      return;
    }

    if (!this.resubmissionForm.licenseImageBase64) {
      this.error = 'Veuillez joindre une image corrigee du permis.';
      return;
    }

    if (
      this.resubmissionForm.licenseImageBase64.length >
      DetailLocationComponent.MAX_LICENSE_UPLOAD_CHARS
    ) {
      this.error =
        'Image du permis trop lourde. Reduisez la taille puis reessayez.';
      return;
    }

    this.isResubmitting = true;
    this.error = '';
    this.success = '';

    this.locationService
      .uploadLicense(
        this.reservation.idReservation,
        this.resubmissionForm.numeroPermis,
        this.resubmissionForm.licenseImageBase64,
        this.resubmissionForm.licenseExpiryDate,
        this.resubmissionForm.prenom,
        this.resubmissionForm.nom,
        this.resubmissionForm.dateNaiss,
      )
      .pipe(
        catchError((error) => this.recoverAfterResubmissionError(error)),
        finalize(() => {
          this.isResubmitting = false;
        }),
      )
      .subscribe({
        next: (reservation) => {
          this.reservation = reservation;
          this.populateResubmissionForm(reservation);
          this.selectedResubmissionFileName = '';
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
          this.error = '';
          this.success =
            "Permis re-soumis avec succes. L'agence a ete notifiee pour revalidation.";
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de re-soumettre le permis.';
        },
      });
  }

  submitExtensionRequest(): void {
    if (!this.reservation || !this.canRequestExtension) {
      return;
    }

    const extraDays = Math.max(1, Math.floor(Number(this.extensionDays || 0)));
    const reason = this.extensionReason.trim();
    if (!reason) {
      this.error = 'Décrivez brièvement la raison de la prolongation.';
      return;
    }

    this.isSubmittingExtension = true;
    this.error = '';

    try {
      this.extensionRequest = this.locationService.requestRentalExtension(
        this.reservation,
        extraDays,
        reason,
      );
      this.success =
        "Demande de prolongation envoyée à l'agence. En attente de validation.";
      this.extensionDays = 1;
      this.extensionReason = '';
    } finally {
      this.isSubmittingExtension = false;
    }
  }

  onResubmissionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.error = 'Le fichier du permis doit etre une image.';
      return;
    }

    this.error = '';
    this.selectedResubmissionFileName = file.name;

    this.optimizeLicenseImage(file)
      .then((optimizedDataUrl) => {
        const normalized = this.normalizeDataUrl(optimizedDataUrl);
        if (!normalized) {
          this.resubmissionForm.licenseImageBase64 = '';
          this.error = 'Image du permis invalide.';
          return;
        }

        if (
          normalized.length > DetailLocationComponent.MAX_LICENSE_UPLOAD_CHARS
        ) {
          this.resubmissionForm.licenseImageBase64 = '';
          this.error =
            'Image du permis trop lourde apres compression. Choisissez une image plus legere.';
          return;
        }

        this.resubmissionForm.licenseImageBase64 = normalized;
      })
      .catch(() => {
        this.error = 'Impossible de lire le fichier du permis.';
        this.resubmissionForm.licenseImageBase64 = '';
      });
  }

  private hydrateAgencyDetails(): void {
    if (!this.reservation) {
      return;
    }

    const knownAgency = this.reservation.agenceLocation;
    const rawAgenceId =
      knownAgency?.idAgence ||
      this.reservation.vehiculeAgence?.agence?.idAgence ||
      Number((this.reservation as any)?.agenceId || 0);

    if (!rawAgenceId) {
      return;
    }

    if (knownAgency?.adresse) {
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
        // Keep existing reservation data when agence details are unavailable.
      },
    });
  }

  private populateResubmissionForm(reservation: ReservationLocation): void {
    this.resubmissionForm.prenom = reservation.prenom || '';
    this.resubmissionForm.nom = reservation.nom || '';
    this.resubmissionForm.dateNaiss = this.toDateInputValue(
      reservation.dateNaiss,
    );
    this.resubmissionForm.numeroPermis = reservation.numeroPermis || '';
    this.resubmissionForm.licenseExpiryDate = this.toDateInputValue(
      reservation.licenseExpiryDate,
    );
    this.resubmissionForm.licenseImageBase64 = '';
  }

  private recoverAfterResubmissionError(error: unknown) {
    if (!this.reservation) {
      return throwError(() => error);
    }

    return this.locationService
      .getReservationById(this.reservation.idReservation)
      .pipe(
        switchMap((freshReservation) => {
          const statusChanged = freshReservation.licenseStatus !== 'REJECTED';
          const permitUpdated =
            !!freshReservation.numeroPermis &&
            freshReservation.numeroPermis ===
              this.resubmissionForm.numeroPermis;

          if (statusChanged || permitUpdated) {
            return of(freshReservation);
          }

          return throwError(() => error);
        }),
      );
  }

  private prepareSignatureCanvas(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#183153';
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
        next: (blob) => {
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

  private async optimizeLicenseImage(file: File): Promise<string> {
    const originalDataUrl = await this.readFileAsDataUrl(file);
    const image = await this.loadImage(originalDataUrl);

    const maxDimension = DetailLocationComponent.LICENSE_MAX_DIMENSION;
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

  private formatReturnDate(value?: string): string {
    if (!value) {
      return 'non définie';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  private extractLicenseNoteFromReservation(
    value: ReservationLocation | (ReservationLocation & Record<string, any>),
  ): string {
    const raw = value as ReservationLocation & Record<string, any>;

    const candidates = [
      raw['reservation'],
      raw['reservationLocation'],
      raw['dto'],
      raw['data'],
      raw,
    ].filter((item) => item && typeof item === 'object') as Array<
      Record<string, any>
    >;

    const keys = [
      'note',
      'notes',
      'noteClient',
      'clientNote',
      'reservationNote',
      'commentaire',
      'comment',
      'messageClient',
      'message',
      'observation',
      'remarque',
      'note_client',
      'client_note',
      'reason',
      'motif',
      'motifRejetPermis',
      'reasonRefusPermis',
    ];

    for (const candidate of candidates) {
      for (const key of keys) {
        const value = String(candidate[key] ?? '').trim();
        if (
          value &&
          value.toLowerCase() !== 'null' &&
          value.toLowerCase() !== 'undefined'
        ) {
          return value;
        }
      }
    }

    const dynamicKey = Object.keys(raw).find((key) =>
      /note|comment|message|reason|motif/i.test(key),
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

  private syncRentalTracking(): void {
    if (!this.reservation) {
      this.departureCountdown = '';
      this.returnCountdown = '';
      this.extensionRequest = null;
      this.stopCountdown();
      return;
    }

    this.extensionRequest = this.locationService.getRentalExtensionRequest(
      this.reservation.idReservation,
    );
    this.refreshDepartureCountdown();
    this.refreshReturnCountdown();
    this.startCountdown();
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
          this.populateResubmissionForm(reservation);
          this.hydrateAgencyDetails();
          this.loadPermitPreview();
          this.syncRentalTracking();
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

  private refreshReturnCountdown(): void {
    if (!this.reservation) {
      this.returnCountdown = '';
      return;
    }

    const returnDate = this.parseReturnDeadline(this.reservation.dateFin);
    if (!returnDate) {
      this.returnCountdown = 'Date de retour non disponible';
      return;
    }

    const diffMs = returnDate.getTime() - Date.now();
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

    const departureDate = this.parseReturnDeadline(this.reservation.dateDebut);
    if (!departureDate) {
      this.departureCountdown = 'Date de départ non disponible';
      return;
    }

    const diffMs = departureDate.getTime() - Date.now();
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

  private getCanvasPoint(
    event: MouseEvent | TouchEvent,
  ): { x: number; y: number } | null {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const touch = 'touches' in event ? event.touches[0] : null;
    const clientX = touch ? touch.clientX : (event as MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (event as MouseEvent).clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }
}

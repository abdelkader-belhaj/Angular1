import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Logement, LogementService } from '../../../services/accommodation/logement.service';
import { AuthService } from '../../../services/auth.service';
import { ReservationRequest, ReservationResponse, ReservationService } from '../../../services/accommodation/reservation.service';
import { SmartAccessService } from '../../../services/accommodation/smart-access.service';

@Component({
  selector: 'app-logement-details',
  templateUrl: './logement-details.component.html',
  styleUrls: ['./logement-details.component.css']
})
export class LogementDetailsComponent implements OnInit, AfterViewChecked {
  logement?: Logement;
  cleanDescription: string = '';
  hostMeta: { nbChambres?: number; surfaceM2?: number; equipements?: string[]; placesDisponibles?: number } = {};
  imageUrls: string[] = [];
  activeImageIndex: number = 0;
  loading: boolean = true;
  error: string = '';
  showVideoModal: boolean = false;
  showReservationForm = false;
  showLoginDialog = false;
  showDatePicker = false;
  bookingError = '';
  bookingSuccess = '';
  isBooking = false;
  pendingReservation = false;
  selectedDateStart: Date | null = null;
  selectedDateEnd: Date | null = null;

  // Payment State
  lastReservation?: ReservationResponse;
  paymentRequest?: { reservationId: number; logementId: number; logementName: string; amountInCents: number; currency: string };

  // Agent AI State
  showNegotiator = false;
  aiMessages: { role: 'bot' | 'user', text: string }[] = [];
  userOfferAmount: number | null = null;
  isNegotiating = false;
  negotiatedPrice: number | null = null;
  negotiationStatus: 'IDLE' | 'ACCEPTED' | 'COUNTER_OFFER' | 'REJECTED' = 'IDLE';
  offerCount = 0; // Track how many offers the user has made
  minNegotiationPrice = 0;
  maxNegotiationPrice = 0;
  readonly fixedOfferStep = 10;
  private shouldScrollChat = false;

  // AI Negotiation Visuals/Logic
  negotiationInputError = '';
  quickSuggestions: { label: string; value: number; icon: string }[] = [];

  get heatLabel() {
    const original = this.getOriginalTotalPrice();
    if (!original) return { text: '...', color: '#94a3b8', bar: 20 };
    
    // Default or Idle if no offer yet
    if (this.negotiationStatus === 'IDLE' && !this.userOfferAmount) {
      return { text: 'En attente', color: '#6366f1', bar: 30 };
    }

    const offer = this.userOfferAmount || 0;
    const ratio = offer / original;

    if (ratio < 0.6) return { text: 'Glacial 🧊', color: '#3b82f6', bar: 20 };
    if (ratio < 0.75) return { text: 'Froid ❄️', color: '#60a5fa', bar: 40 };
    if (ratio < 0.85) return { text: 'Tiède 🌤️', color: '#10b981', bar: 60 };
    if (ratio < 0.95) return { text: 'Chaud 🔥', color: '#f59e0b', bar: 80 };
    return { text: 'Bouillant 🌋', color: '#ef4444', bar: 100 };
  }

  // Geo-Secured Access
  isVerifyingLocation = false;
  geoAccessStatus: 'idle' | 'success' | 'error' = 'idle';
  geoAccessMessage = '';
  geoUnlockCode = '';
  geoDistance = 0;

  @ViewChild('chatBody') private chatBodyRef!: ElementRef;

  public readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly reservationService = inject(ReservationService);
  private readonly smartAccessService = inject(SmartAccessService);

  readonly reservationForm = this.formBuilder.nonNullable.group({
    dateDebut: [''],
    dateFin: [''],
    nbPersonnes: [1, [Validators.required, Validators.min(1)]]
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private logementService: LogementService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (!id) {
        this.error = 'Logement introuvable.';
        this.loading = false;
        return;
      }
      this.loadLogement(id);
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollChat) {
      this.scrollChatToBottom();
      this.shouldScrollChat = false;
    }
  }

  private scrollChatToBottom(): void {
    setTimeout(() => {
      try {
        if (this.chatBodyRef?.nativeElement) {
          this.chatBodyRef.nativeElement.scrollTop = this.chatBodyRef.nativeElement.scrollHeight;
        }
      } catch {}
    }, 50);
  }

  loadLogement(id: number): void {
    this.loading = true;
    this.logementService.getLogementById(id).subscribe({
      next: (logement: Logement) => {
        this.logement = logement;
        this.cleanDescription = this.stripHostHubMeta(logement.description || '');
        this.hostMeta = this.parseHostHubMeta(logement.description || '');
        this.imageUrls = logement.imageUrls && logement.imageUrls.length > 0
          ? logement.imageUrls.map(img => this.processImageUrl(img))
          : logement.imageUrl
            ? [this.processImageUrl(logement.imageUrl)]
            : ['assets/images/default.jpg'];
        this.activeImageIndex = 0;
        this.loading = false;
        this.checkExistingReservations();
      },
      error: (err) => {
        this.error = err?.error?.message || err?.error || 'Impossible de charger ce logement.';
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/stays']);
  }

  prevImage(): void {
    if (this.imageUrls.length <= 1) return;
    this.activeImageIndex = (this.activeImageIndex + this.imageUrls.length - 1) % this.imageUrls.length;
  }

  nextImage(): void {
    if (this.imageUrls.length <= 1) return;
    this.activeImageIndex = (this.activeImageIndex + 1) % this.imageUrls.length;
  }

  selectImage(index: number): void {
    this.activeImageIndex = index;
  }

  getImageUrl(): string {
    return this.imageUrls[this.activeImageIndex] || 'assets/images/default.jpg';
  }

  isAvailable(): boolean {
    return this.logement?.disponible ?? false;
  }

  getPriceLabel(): string {
    const rawPrice = this.logement?.prixNuit;
    if (rawPrice === null || rawPrice === undefined) return '0 DT';

    const numericPrice = typeof rawPrice === 'number'
      ? rawPrice
      : parseFloat(String(rawPrice).replace(/[^0-9,.-]/g, '').replace(',', '.'));
    if (!Number.isFinite(numericPrice)) return `${String(rawPrice).replace(/€|\s/g, '')} DT`;
    return `${numericPrice.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })} DT`;
  }

  get isTouristUser(): boolean {
    return this.authService.getCurrentUser()?.role === 'CLIENT_TOURISTE';
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get isSaturatedNow(): boolean {
    if (!this.logement) return false;
    return !!this.logement.saturated || (this.logement.availablePlaces ?? 0) <= 0;
  }

  get canShowSmartLock(): boolean {
    return this.hasActiveReservation && !this.showNegotiator && !this.isSaturatedNow;
  }

  get nextAvailableDateLabel(): string {
    if (!this.logement?.nextAvailableDate) return '';
    const date = new Date(this.logement.nextAvailableDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  hasActiveReservation: boolean = false;

  checkExistingReservations(): void {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'CLIENT_TOURISTE') return;

    this.reservationService.getAllReservations().subscribe({
      next: (reservations) => {
        this.hasActiveReservation = reservations.some(r =>
          r.idLogement === this.logement?.idLogement &&
          (r.statut || '').toLowerCase() === 'confirmee'
        );
      },
      error: () => {
        this.hasActiveReservation = false;
      }
    });
  }

  onReserveClick(): void {
    this.bookingError = '';
    this.bookingSuccess = '';

    if (!this.isAvailable()) {
      this.bookingError = 'Ce logement est en maintenance. Coming soon.';
      return;
    }

    if (this.isSaturatedNow) {
      this.bookingError = this.nextAvailableDateLabel
        ? `Logement saturé pour le moment. Une place sera disponible le ${this.nextAvailableDateLabel}.`
        : 'Logement saturé pour le moment.';
      return;
    }

    if (!this.isAuthenticated) {
      this.pendingReservation = true;
      this.showLoginDialog = true;
      return;
    }

    if (!this.isTouristUser) {
      this.bookingError = 'Veuillez vous connecter avec un compte client touriste pour réserver.';
      return;
    }

    this.showReservationForm = true;
  }

  onLoginDialogClosed(): void {
    this.showLoginDialog = false;

    if (this.pendingReservation && this.isTouristUser) {
      this.showReservationForm = true;
    }

    this.pendingReservation = false;
  }

  goToSmartLockGuide(): void {
    this.router.navigate(['/mes-reservations-logement'], {
      queryParams: { openLockGuide: 1 }
    });
  }

  submitReservation(): void {
    if (!this.logement) {
      this.bookingError = 'Logement introuvable.';
      return;
    }

    if (!this.selectedDateStart || !this.selectedDateEnd) {
      this.bookingError = 'Veuillez sélectionner une période.';
      return;
    }

    if (this.reservationForm.invalid) {
      this.reservationForm.markAllAsTouched();
      return;
    }

    if (this.isSaturatedNow) {
      this.bookingError = this.nextAvailableDateLabel
        ? `Logement saturé pour le moment. Une place sera disponible le ${this.nextAvailableDateLabel}.`
        : 'Logement saturé pour le moment.';
      return;
    }

    // Validation: pas plus d'une réservation par jour
    if (this.isSameDay(this.selectedDateStart, this.selectedDateEnd)) {
      this.bookingError = 'Vous ne pouvez pas faire une réservation à la même date. Sélectionnez au moins une nuit.';
      return;
    }

    // Validation: pas de double réservation pour le même logement
    // TODO: Appeler un service pour vérifier les réservations existantes

    const payload: ReservationRequest = {
      idLogement: this.logement.idLogement,
      dateDebut: this.formatDateForAPI(this.selectedDateStart),
      dateFin: this.formatDateForAPI(this.selectedDateEnd),
      nbPersonnes: this.reservationForm.controls.nbPersonnes.value,
      prixFinalNegocie: this.negotiationStatus === 'ACCEPTED' ? this.negotiatedPrice || undefined : undefined
    };

    this.isBooking = true;
    this.bookingError = '';
    this.bookingSuccess = '';

    this.reservationService.createReservation(payload).subscribe({
      next: (reservation) => {
        this.lastReservation = reservation;
        this.bookingSuccess = 'Réservation confirmée! Email envoyé. Cliquez sur "Procéder au paiement" ci-dessous.';
        this.showReservationForm = false;
        this.showDatePicker = false;
        this.selectedDateStart = null;
        this.selectedDateEnd = null;
        this.reservationForm.reset({ nbPersonnes: 1 });
        this.preparePaymentModal(reservation);
      },
      error: (error) => {
        this.bookingError = error?.error?.message || 'Impossible d\'effectuer la réservation. Vérifiez vos dates et réessayez.';
      },
      complete: () => {
        this.isBooking = false;
      }
    });
  }

  private extractAmountInCents(rawAmount: string | number): number {
    if (typeof rawAmount === 'number') {
      return Math.round(rawAmount * 100);
    }

    const normalized = String(rawAmount)
      .replace(/\s/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.]/g, '');

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.round(parsed * 100);
  }

  onDateRangeSelected(range: { start: Date; end: Date }): void {
    this.selectedDateStart = range.start;
    this.selectedDateEnd = range.end;
    this.showDatePicker = false;
  }

  private formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateDisplay(date: Date | null): string {
    if (!date) return 'Sélectionner';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  calculateDays(): number {
    if (!this.selectedDateStart || !this.selectedDateEnd) return 1;
    const diffTime = Math.abs(this.selectedDateEnd.getTime() - this.selectedDateStart.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  }

  private formatPrice(value: number): string {
    return `${value.toFixed(2)} DT`;
  }

  private getOriginalTotalPrice(): number {
    const nbJours = this.calculateDays();
    return (this.logement?.prixNuit ?? 0) * nbJours;
  }

  private setupNegotiationBounds(originalTotalPrice: number): void {
    this.maxNegotiationPrice = Math.max(5, Math.round(originalTotalPrice / 5) * 5);
    this.minNegotiationPrice = Math.max(5, Math.round((originalTotalPrice * 0.5) / 5) * 5);
    this.userOfferAmount = this.minNegotiationPrice;
  }

  private clampOffer(value: number): number {
    if (!Number.isFinite(value)) return this.minNegotiationPrice;
    return Math.max(this.minNegotiationPrice, Math.min(this.maxNegotiationPrice, value));
  }

  increaseOfferByTen(): void {
    if (this.isNegotiating || !this.selectedDateStart || !this.selectedDateEnd) {
      return;
    }

    const current = this.userOfferAmount ?? this.minNegotiationPrice;
    const nextValue = this.clampOffer(current + this.fixedOfferStep);
    if (nextValue === current) {
      return;
    }

    this.userOfferAmount = nextValue;
    this.sendOffer();
  }

  private getNegotiationEquipements(limit: number = 4): string[] {
    const list = this.hostMeta.equipements || [];
    return list.slice(0, limit);
  }

  private buildPeriodArgument(): string {
    if (!this.selectedDateStart || !this.selectedDateEnd) {
      return 'La période demandée reste intéressante pour réserver maintenant.';
    }

    const today = new Date();
    const oneDay = 1000 * 60 * 60 * 24;
    const daysUntilStart = Math.max(0, Math.ceil((this.selectedDateStart.getTime() - today.getTime()) / oneDay));
    const stayLength = this.calculateDays();

    if (daysUntilStart <= 10) {
      return `Votre séjour commence bientôt (${daysUntilStart} jour(s)); c'est une période de demande active.`;
    }
    if (stayLength >= 5) {
      return `Vous avez choisi un séjour de ${stayLength} nuits, c'est une période stratégique pour sécuriser un bon rapport qualité/prix.`;
    }
    return 'La période que vous avez choisie est favorable: les meilleures options partent rapidement.';
  }

  private buildPersuasiveNegotiationMessage(
    status: 'ACCEPTED' | 'COUNTER_OFFER' | 'REJECTED' | 'IDLE',
    offeredPrice: number,
    originalTotalPrice: number,
    negotiatedPrice?: number,
    backendMessage?: string
  ): string {
    const equipements = this.getNegotiationEquipements();
    const equipementsLine = equipements.length
      ? `Ce logement inclut déjà ${equipements.join(', ')}.`
      : 'Ce logement garde un excellent niveau de confort pour son tarif.';
    const periodLine = this.buildPeriodArgument();
    const offeredRatio = originalTotalPrice > 0 ? offeredPrice / originalTotalPrice : 0;
    const isCloseOffer = offeredRatio >= 0.85;
    const toneIndex = Math.max(0, this.offerCount - 1);
    const acceptedOpener = [
      '✅ Super nouvelle !',
      '🎉 Excellente proposition !',
      '🤝 Parfait, on a un accord !'
    ][toneIndex % 3];
    const counterOpener = [
      '💡 Votre offre est intéressante.',
      '📊 Bonne tentative, on se rapproche.',
      '🔥 Belle proposition, je peux faire un effort.'
    ][toneIndex % 3];
    const rejectOpener = [
      '⚠️ Je comprends votre budget, mais',
      '🧠 Je préfère rester transparent:',
      '📉 Cette offre est trop basse pour ce niveau de logement.'
    ][toneIndex % 3];

    if (status === 'ACCEPTED') {
      const accepted = negotiatedPrice ?? offeredPrice;
      return [
        `${acceptedOpener} Votre offre est validée à ${this.formatPrice(accepted)}.`,
        equipementsLine,
        `${periodLine} 🚀 Vous sécurisez un tarif très compétitif pour ce niveau de prestation.`
      ].join(' ');
    }

    if (status === 'COUNTER_OFFER') {
      const counter = negotiatedPrice ?? offeredPrice;
      const effortPct = originalTotalPrice > 0 ? ((originalTotalPrice - counter) / originalTotalPrice) * 100 : 0;
      const closeHighlights = isCloseOffer
        ? `\n✅ Excellent positionnement prix\n✨ ${equipementsLine}`
        : '';
      return [
        `${counterOpener} Je peux vous proposer ${this.formatPrice(counter)} pour conclure maintenant.`,
        `${periodLine} ✨ Effort déjà accordé: ${Math.max(0, effortPct).toFixed(0)}% sur le tarif initial.${closeHighlights}`
      ].join(' ');
    }

    if (status === 'REJECTED') {
      const minimumFair = Math.max(originalTotalPrice * 0.78, offeredPrice);
      return `${rejectOpener} Offre refusée ❌. Essayez autour de ${this.formatPrice(minimumFair)}.`;
    }

    return backendMessage || '🤖 Je suis prêt à étudier votre offre avec une base de prix cohérente et compétitive.';
  }

  openNegotiator(): void {
    if (this.isSaturatedNow) {
      this.bookingError = this.nextAvailableDateLabel
        ? `Logement saturé pour le moment. Une place sera disponible le ${this.nextAvailableDateLabel}.`
        : 'Logement saturé pour le moment.';
      return;
    }

    if (!this.isAuthenticated) {
      this.pendingReservation = true;
      this.showLoginDialog = true;
      return;
    }

    // Reset negotiation state each time we open fresh
    this.negotiationStatus = 'IDLE';
    this.negotiatedPrice = null;
    this.userOfferAmount = null;
    this.isNegotiating = false;
    this.offerCount = 0;

    // Re-open reservation form if closed
    this.showReservationForm = true;

    // We must have dates to calculate original total
    if (!this.selectedDateStart || !this.selectedDateEnd) {
      this.showNegotiator = true;
      this.aiMessages = [{
        role: 'bot',
        text: `Bonjour ! Je suis l'Agent Négociateur IA. 🤖 Veuillez d'abord choisir vos dates d'arrivée et de départ dans le formulaire ci-dessus, puis revenez négocier le prix total.`
      }];
      this.shouldScrollChat = true;
      return;
    }

    const nbJours = this.calculateDays();
    const originalTotalPrice = this.getOriginalTotalPrice();
    this.setupNegotiationBounds(originalTotalPrice);
    const equipements = this.getNegotiationEquipements();
    const equipementsText = equipements.length ? ` Équipements clés: ${equipements.join(', ')}.` : '';

    this.showNegotiator = true;
    this.aiMessages = [{
      role: 'bot',
      text: `👋 Bonjour ! Je suis l'Agent Négociateur du propriétaire. Le tarif officiel pour ${nbJours} nuit(s) est ${this.formatPrice(originalTotalPrice)}.${equipementsText} 💬 On commence à partir de ${this.formatPrice(this.minNegotiationPrice)} (minimum négociable). Ensuite, chaque nouvelle proposition augmente de ${this.fixedOfferStep} DT jusqu'à accord.`
    }];
    this.updateQuickSuggestions();
    this.shouldScrollChat = true;
  }

  private updateQuickSuggestions(): void {
    const original = this.getOriginalTotalPrice();
    this.quickSuggestions = [
      { label: 'Offre Audacieuse', value: Math.round(original * 0.7 / 5) * 5, icon: '🚀' },
      { label: 'Offre Équilibrée', value: Math.round(original * 0.8 / 5) * 5, icon: '⚖️' },
      { label: 'Offre Directe', value: Math.round(original * 0.9 / 5) * 5, icon: '⚡' }
    ];
  }

  applyQuickSuggestion(value: number): void {
    if (this.isNegotiating) return;
    this.userOfferAmount = value;
    this.validateAndSendOffer();
  }

  validateAndSendOffer(): void {
    this.negotiationInputError = '';
    
    if (!this.userOfferAmount || this.userOfferAmount <= 0) {
      this.negotiationInputError = 'Veuillez saisir un montant valide.';
      return;
    }

    if (this.userOfferAmount < this.minNegotiationPrice) {
      this.negotiationInputError = `L'offre minimum est de ${this.minNegotiationPrice} DT.`;
      return;
    }

    this.sendOffer();
  }

  sendOffer(): void {
    if (this.isSaturatedNow) {
      this.aiMessages.push({ role: 'bot', text: this.nextAvailableDateLabel
        ? `❌ Logement saturé pour le moment. Une place sera disponible le ${this.nextAvailableDateLabel}.`
        : '❌ Logement saturé pour le moment.' });
      this.shouldScrollChat = true;
      return;
    }

    if (this.isNegotiating) return;
    if (!this.userOfferAmount || this.userOfferAmount <= 0) return;
    if (!this.selectedDateStart || !this.selectedDateEnd) {
      this.aiMessages.push({ role: 'bot', text: "❌ Veuillez d'abord sélectionner vos dates de réservation dans le formulaire." });
      this.shouldScrollChat = true;
      return;
    }

    if (!this.maxNegotiationPrice || !this.minNegotiationPrice) {
      this.setupNegotiationBounds(this.getOriginalTotalPrice());
    }

    this.userOfferAmount = this.clampOffer(this.userOfferAmount);

    this.offerCount++;
    const offer = this.userOfferAmount;
    this.aiMessages.push({ role: 'user', text: `💰 Je propose ${offer.toFixed(2)} DT` });
    this.isNegotiating = true;
    this.shouldScrollChat = true;

    const originalTotalPrice = this.getOriginalTotalPrice();

    this.reservationService.negotiateWithAI(this.logement!.idLogement, originalTotalPrice, offer, this.offerCount)
      .subscribe({
        next: (res) => {
          this.isNegotiating = false;
          this.negotiationStatus = res.status;
          if (res.status === 'ACCEPTED' || res.status === 'COUNTER_OFFER') {
            this.negotiatedPrice = res.negotiated_price;
          }
          const persuasiveMessage = this.buildPersuasiveNegotiationMessage(
            this.negotiationStatus,
            offer,
            originalTotalPrice,
            this.negotiatedPrice || undefined,
            res?.message
          );
          this.aiMessages.push({ role: 'bot', text: persuasiveMessage });
          if (this.negotiationStatus === 'REJECTED') {
            const nextSuggested = this.clampOffer(offer + this.fixedOfferStep);
            this.userOfferAmount = nextSuggested;
          } else if (this.negotiationStatus === 'COUNTER_OFFER') {
            this.userOfferAmount = this.clampOffer((this.negotiatedPrice ?? offer) + this.fixedOfferStep);
          } else {
            this.userOfferAmount = this.clampOffer(offer);
          }
          this.shouldScrollChat = true;
        },
        error: () => {
          this.isNegotiating = false;
          this.aiMessages.push({ role: 'bot', text: "🔌 Impossible de contacter le serveur d'IA. Vérifiez que l'API Python est bien lancée sur le port 8000." });
          this.userOfferAmount = null;
          this.shouldScrollChat = true;
        }
      });
  }

  acceptCounterOffer(): void {
    this.aiMessages.push({ role: 'user', text: "J'accepte votre contre-offre ! ✅" });
    this.negotiationStatus = 'ACCEPTED';
    const equipements = this.getNegotiationEquipements(3);
    const bonus = equipements.length ? ` Vous profitez en plus de ${equipements.join(', ')}.` : '';
    this.aiMessages.push({ role: 'bot', text: `🤝 Excellent ! L'accord est scellé à ${this.negotiatedPrice?.toFixed(2)} DT.${bonus} Confirmez maintenant pour sécuriser ce tarif avant évolution de disponibilité.` });
    this.shouldScrollChat = true;
  }

  confirmNegotiatedReservation(): void {
    if (!this.selectedDateStart || !this.selectedDateEnd) {
      // Close negotiator and show date form
      this.showNegotiator = false;
      this.bookingError = '📅 Veuillez sélectionner vos dates avant de confirmer la réservation.';
      return;
    }
    this.showNegotiator = false;
    this.submitReservation();
  }

  // --- SMART ACCESS CONTROL ---
  unlockSmartDoor(): void {
    if (!this.logement) return;

    if (!this.canShowSmartLock) {
      this.geoAccessStatus = 'error';
      this.geoAccessMessage = 'Accès Smart Lock indisponible pour ce logement.';
      return;
    }

    this.isVerifyingLocation = true;
    this.geoAccessStatus = 'idle';
    this.geoAccessMessage = 'Vérification de vos coordonnées GPS en cours...';
    
    if (!navigator.geolocation) {
      this.geoAccessStatus = 'error';
      this.geoAccessMessage = 'La géolocalisation n\'est pas supportée par votre navigateur.';
      this.isVerifyingLocation = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.processUnlockRequest(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        this.geoAccessStatus = 'error';
        this.geoAccessMessage = 'Impossible de récupérer votre position GPS. Veuillez autoriser l\'accès dans votre navigateur.';
        this.isVerifyingLocation = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private processUnlockRequest(lat: number, lng: number): void {
    this.smartAccessService.verifyLocation({
      logementId: this.logement!.idLogement,
      clientLatitude: lat,
      clientLongitude: lng
    }).subscribe({
      next: (response) => {
        this.isVerifyingLocation = false;
        if (response.success) {
          this.geoAccessStatus = 'success';
          this.geoUnlockCode = response.unlockCode || '';
          this.geoAccessMessage = response.message;
        } else {
          this.geoAccessStatus = 'error';
          this.geoAccessMessage = response.message;
          this.geoDistance = response.distanceMeters || 0;
        }
      },
      error: (err) => {
        this.isVerifyingLocation = false;
        this.geoAccessStatus = 'error';
        this.geoAccessMessage = 'Erreur de connexion avec la serrure intelligente.';
      }
    });
  }

  getVideoSource(): string {
    const videoUrl = this.logement?.videoUrl;
    if (!videoUrl) return '';
    
    // If it's already a full URL (http/https or embedded), return as is
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://') || videoUrl.includes('embed')) {
      return videoUrl;
    }
    
    // If it starts with assets/, return as is
    if (videoUrl.startsWith('assets/')) {
      return videoUrl;
    }
    
    // Otherwise, assume it's a filename in assets/images/ and add the path
    return `assets/images/${videoUrl}`;
  }

  private processImageUrl(imageUrl: string): string {
    if (!imageUrl) return 'assets/images/default.jpg';

    const isVideoAsset = /\.(mp4|mov|avi|mkv|webm|m4v)(\?.*)?$/i.test(imageUrl);
    if (isVideoAsset) {
      return 'assets/images/default.jpg';
    }
    
    // If it's already a full URL (http/https), return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // If it starts with assets/, return as is
    if (imageUrl.startsWith('assets/')) {
      return imageUrl;
    }
    
    // Otherwise, assume it's a filename and add the assets/images/ prefix
    return `assets/images/${imageUrl}`;
  }

  private stripHostHubMeta(description: string): string {
    return description.replace(/__HOSTHUB_META__[\s\S]*$/, '').trim();
  }

  private parseHostHubMeta(description: string): { nbChambres?: number; surfaceM2?: number; equipements?: string[]; placesDisponibles?: number } {
    const match = description.match(/__HOSTHUB_META__\s*(\{[\s\S]*\})$/);
    if (!match) return {};
    try {
      return JSON.parse(match[1]);
    } catch {
      return {};
    }
  }

  private preparePaymentModal(reservation: ReservationResponse): void {
    if (!this.logement) return;

    const amountInCents = this.extractAmountInCents(reservation.prixTotal);
    if (!amountInCents || amountInCents <= 0) {
      this.bookingError = 'Montant du paiement invalide.';
      return;
    }

    this.paymentRequest = {
      reservationId: reservation.idReservation,
      logementId: this.logement.idLogement,
      logementName: this.logement.nom,
      amountInCents,
      currency: 'eur'
    };
  }

  openPaymentModal(): void {
    if (!this.paymentRequest) return;
    void this.router.navigate(['/paiement'], {
      queryParams: this.paymentRequest
    });
  }
}

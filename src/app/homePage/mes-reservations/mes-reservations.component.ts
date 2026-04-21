import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ReservationService, ReservationResponse, ReservationRequest } from '../../services/accommodation/reservation.service';
import { NotificationClientService, BackendNotification } from '../../services/accommodation/notification-client.service';
import { SmartAccessService } from '../../services/accommodation/smart-access.service';
import { PaymentRecordsService } from '../../services/payment/payment-records.service';

@Component({
  selector: 'app-mes-reservations',
  templateUrl: './mes-reservations.component.html',
  styleUrl: './mes-reservations.component.css'
})
export class MesReservationsComponent implements OnInit, OnDestroy {
  clientReservations: ReservationResponse[] = [];
  hiddenReservationIds: Set<number> = new Set<number>();
  notifications: BackendNotification[] = [];
  paymentStatus: 'success' | 'cancel' | null = null;
  paymentReservationId: number | null = null;
  isDarkMode = false;
  editingReservationId: number | null = null;
  showNotificationsPanel = false;
  showSmartLockGuide = false;
  highlightedSmartLockReservationId: number | null = null;
  loading: boolean = true;
  apiErrorMessage = '';
  now: Date = new Date();
  paidReservationIds: Set<number> = new Set<number>();

  // Smart Lock State - Gestion de la serrure intelligente
  unlockedLocks: Set<number> = new Set<number>();
  verifyingLocks: Set<number> = new Set<number>();
  unlockErrors: Map<number, string> = new Map<number, string>();
  unlockedCodes: Map<number, string> = new Map<number, string>();
  private readonly notifRemovingIds = new Set<number>();
  private readonly notifSwipeOffsets = new Map<number, number>();
  private readonly notifSwipeStartX = new Map<number, number>();
  private readonly notifSwipeStartY = new Map<number, number>();
  private readonly notifSwipeArmed = new Set<number>();
  private activeNotifSwipeId: number | null = null;
  private readonly notifDeleteRevealPx = 104;
  private directedHighlightTimeout: any;

  private timerInt: any;

  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly reservationService = inject(ReservationService);
  private readonly notifService = inject(NotificationClientService);
  private readonly smartAccessService = inject(SmartAccessService);
  private readonly paymentRecordsService = inject(PaymentRecordsService);

  get visibleReservations(): ReservationResponse[] {
    return this.clientReservations.filter(r => !this.hiddenReservationIds.has(r.idReservation));
  }

  get countConfirmee(): number {
    return this.visibleReservations.filter(r => r.statut === 'confirmee').length;
  }

  get countModifiables(): number {
    return this.visibleReservations.filter(r => {
      if (r.statut !== 'confirmee' || !r.canCancelOrModify) return false;
      return this.getProgressPercentage(r.dateReservation) < 100;
    }).length;
  }

  get unreadNotifCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  editResForm = this.formBuilder.group({
    dateDebut: ['', Validators.required],
    dateFin: ['', Validators.required],
    nbPersonnes: [1, [Validators.required, Validators.min(1)]]
  });

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!this.authService.isAuthenticated() || !user || user.role !== 'CLIENT_TOURISTE') {
      this.router.navigate(['/']);
      return;
    }
    this.loadThemeMode();
    this.loadHiddenReservations();
    this.loadPaidReservationIds();
    this.loadReservations();

    this.route.queryParams.subscribe(params => {
      const paymentParam = params['payment'];
      if (paymentParam === 'success' || paymentParam === 'cancel') {
        this.paymentStatus = paymentParam;
        const reservationIdParam = Number(params['reservationId']);
        this.paymentReservationId = Number.isFinite(reservationIdParam) && reservationIdParam > 0
          ? reservationIdParam
          : null;
      }

      if (params['openLockGuide'] === '1') {
        this.showNotificationsPanel = false;
        this.showSmartLockGuide = true;

        const reservationIdParam = Number(params['reservationId']);
        if (Number.isFinite(reservationIdParam) && reservationIdParam > 0) {
          this.applyDirectedReservationHighlight(reservationIdParam);
          setTimeout(() => this.scrollToSmartLockCard(reservationIdParam, 0), 120);
          return;
        }

        setTimeout(() => this.openSmartLockGuideFromNotification(undefined, 1), 220);
      }
    });

    // Timer pour rafraîchir la barre de progression chaque seconde
    this.timerInt = setInterval(() => {
      this.now = new Date();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInt) clearInterval(this.timerInt);
  }

  loadReservations(): void {
    this.loading = true;
    this.apiErrorMessage = '';
    this.reservationService.getAllReservations().subscribe({
      next: (res) => {
        this.clientReservations = res.map(r => ({
          ...r,
          statut: (r.statut || '').toLowerCase()
        }));
        this.loading = false;
        this.loadPaidReservationIds();
      },
      error: (err) => {
        console.error('Erreur chargement reservations', err);
        this.apiErrorMessage = this.formatNetworkError(err, 'Impossible de charger les reservations.');
        this.clientReservations = [];
        this.loading = false;
      }
    });
  }

  private loadPaidReservationIds(): void {
    this.paidReservationIds = this.paymentRecordsService.getPaidReservationIds();
  }

  isReservationPaid(reservationId: number): boolean {
    return this.paidReservationIds.has(reservationId);
  }

  openInvoice(reservationId: number): void {
    void this.router.navigate(['/paiement/facture', reservationId]);
  }

  private getHiddenReservationsStorageKey(): string {
    const user = this.authService.getCurrentUser();
    const uid = user?.id ?? 'guest';
    return `mes_reservations_hidden_${uid}`;
  }

  private getThemeModeStorageKey(): string {
    const user = this.authService.getCurrentUser();
    const uid = user?.id ?? 'guest';
    return `mes_reservations_dark_mode_${uid}`;
  }

  private loadThemeMode(): void {
    try {
      const raw = localStorage.getItem(this.getThemeModeStorageKey());
      this.isDarkMode = raw === '1';
    } catch {
      this.isDarkMode = false;
    }
  }

  toggleThemeMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem(this.getThemeModeStorageKey(), this.isDarkMode ? '1' : '0');
  }

  private loadHiddenReservations(): void {
    try {
      const raw = localStorage.getItem(this.getHiddenReservationsStorageKey());
      if (!raw) {
        this.hiddenReservationIds = new Set<number>();
        return;
      }
      const ids = JSON.parse(raw) as number[];
      this.hiddenReservationIds = new Set<number>((ids || []).filter((x) => Number.isFinite(x)));
    } catch {
      this.hiddenReservationIds = new Set<number>();
    }
  }

  private persistHiddenReservations(): void {
    localStorage.setItem(
      this.getHiddenReservationsStorageKey(),
      JSON.stringify(Array.from(this.hiddenReservationIds))
    );
  }

  hideReservation(idReservation: number): void {
    this.hiddenReservationIds.add(idReservation);
    this.persistHiddenReservations();
  }

  loadNotifications(): void {
    this.notifService.getMyNotifications().subscribe({
      next: (ns) => {
        this.notifications = ns;
      },
      error: (e) => {
        console.error(e);
        this.notifications = [];
      }
    });
  }

  toggleNotificationsPanel(): void {
    this.showNotificationsPanel = !this.showNotificationsPanel;
  }

  closeNotificationsPanel(): void {
    this.showNotificationsPanel = false;
  }

  markAllNotificationsAsRead(): void {
    const unread = this.notifications.filter(n => !n.isRead);
    if (!unread.length) return;

    unread.forEach(notification => {
      this.notifService.markAsRead(notification.id).subscribe({
        next: () => {
          notification.isRead = true;
        },
        error: (e) => console.error(e)
      });
    });
  }

  markNotifAsRead(notif: BackendNotification): void {
    if (!notif.isRead) {
      this.notifService.markAsRead(notif.id).subscribe(() => notif.isRead = true);
    }
  }

  isSmartLockNotification(notif: BackendNotification): boolean {
    const message = (notif.message || '').toLowerCase();
    return message.includes('reservation') || message.includes('réservation') || message.includes('cle') || message.includes('clé');
  }

  openSmartLockGuideFromNotification(notif?: BackendNotification, attempt: number = 0): void {
    if (notif && attempt === 0) {
      this.markNotifAsRead(notif);
    }

    if (!this.clientReservations.length && attempt < 8) {
      this.loadReservations();
      setTimeout(() => this.openSmartLockGuideFromNotification(notif, attempt + 1), 220);
      return;
    }

    this.showNotificationsPanel = false;
    this.showSmartLockGuide = true;

    const targetReservation = this.findBestReservationForSmartLock(notif);
    if (!targetReservation) {
      setTimeout(() => {
        const fallbackElement = document.querySelector('[id^="reservation-card-"]') as HTMLElement | null;
        fallbackElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return;
    }

    this.applyDirectedReservationHighlight(targetReservation.idReservation);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        openLockGuide: '1',
        reservationId: targetReservation.idReservation
      },
      queryParamsHandling: 'merge'
    });
    this.scrollToSmartLockCard(targetReservation.idReservation, 0);
  }

  closeSmartLockGuide(): void {
    this.showSmartLockGuide = false;
    this.highlightedSmartLockReservationId = null;
  }

  private applyDirectedReservationHighlight(reservationId: number): void {
    this.highlightedSmartLockReservationId = reservationId;
    if (this.directedHighlightTimeout) {
      clearTimeout(this.directedHighlightTimeout);
    }
    this.directedHighlightTimeout = setTimeout(() => {
      if (this.highlightedSmartLockReservationId === reservationId) {
        this.highlightedSmartLockReservationId = null;
      }
    }, 4200);
  }

  private findBestReservationForSmartLock(notif?: BackendNotification): ReservationResponse | null {
    const confirmedReservations = this.clientReservations.filter(r => r.statut === 'confirmee');
    const pool = confirmedReservations.length ? confirmedReservations : this.clientReservations;
    if (!pool.length) return null;

    if (notif?.message) {
      const notifMessage = this.normalizeText(notif.message);
      const matched = pool.find(r => {
        const logementName = this.normalizeText(r.nomLogement || '');
        return logementName.length > 2 && notifMessage.includes(logementName);
      });
      if (matched) return matched;
    }

    return pool[0];
  }

  private scrollToSmartLockCard(reservationId: number, attempt: number): void {
    const element = document.getElementById(`smart-lock-${reservationId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const reservationElement = document.getElementById(`reservation-card-${reservationId}`);
    if (reservationElement) {
      reservationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (attempt >= 20) return;
    setTimeout(() => this.scrollToSmartLockCard(reservationId, attempt + 1), 150);
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private formatNetworkError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Backend reservations/notifications inaccessible. Demarrez votre API principale (port 8080), puis rechargez la page.';
    }
    return fallback;
  }

  deleteNotification(notif: BackendNotification): void {
    if (this.notifRemovingIds.has(notif.id)) return;
    this.notifRemovingIds.add(notif.id);

    setTimeout(() => {
    this.notifService.deleteNotification(notif.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notif.id);
        this.notifSwipeOffsets.delete(notif.id);
        this.notifSwipeStartX.delete(notif.id);
        this.notifSwipeStartY.delete(notif.id);
        this.notifSwipeArmed.delete(notif.id);
        this.notifRemovingIds.delete(notif.id);
      },
      error: (e) => {
        this.notifRemovingIds.delete(notif.id);
        console.error('Erreur supression notif', e);
      }
    });
    }, 220);
  }

  isNotifRemoving(notifId: number): boolean {
    return this.notifRemovingIds.has(notifId);
  }

  onNotifPointerDown(event: PointerEvent, notifId: number): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.isSwipeBlockedTarget(event.target)) return;
    this.beginNotifSwipe(notifId, event.clientX, event.clientY);
  }

  onNotifPointerMove(event: PointerEvent, notifId: number): void {
    this.updateNotifSwipe(notifId, event.clientX, event.clientY);
    if (this.activeNotifSwipeId === notifId) event.preventDefault();
  }

  onNotifPointerEnd(notifId: number): void {
    if (this.activeNotifSwipeId !== notifId) return;

    const currentOffset = this.notifSwipeOffsets.get(notifId) ?? 0;
    const shouldReveal = currentOffset <= -(this.notifDeleteRevealPx * 0.55);
    this.notifSwipeOffsets.set(notifId, shouldReveal ? -this.notifDeleteRevealPx : 0);

    this.activeNotifSwipeId = null;
    this.notifSwipeStartX.delete(notifId);
    this.notifSwipeStartY.delete(notifId);
    this.notifSwipeArmed.delete(notifId);
  }

  onNotifTouchStart(event: TouchEvent, notifId: number): void {
    const touch = event.touches[0];
    if (!touch) return;
    if (this.isSwipeBlockedTarget(event.target)) return;
    this.beginNotifSwipe(notifId, touch.clientX, touch.clientY);
  }

  onNotifTouchMove(event: TouchEvent, notifId: number): void {
    const touch = event.touches[0];
    if (!touch) return;
    this.updateNotifSwipe(notifId, touch.clientX, touch.clientY);
    if (this.activeNotifSwipeId === notifId) event.preventDefault();
  }

  onNotifTouchEnd(notifId: number): void {
    this.onNotifPointerEnd(notifId);
  }

  private beginNotifSwipe(notifId: number, x: number, y: number): void {
    this.activeNotifSwipeId = notifId;
    this.notifSwipeStartX.set(notifId, x);
    this.notifSwipeStartY.set(notifId, y);
    this.notifSwipeArmed.delete(notifId);
  }

  private updateNotifSwipe(notifId: number, x: number, y: number): void {
    if (this.activeNotifSwipeId !== notifId) return;

    const startX = this.notifSwipeStartX.get(notifId);
    const startY = this.notifSwipeStartY.get(notifId);
    if (startX === undefined || startY === undefined) return;

    const deltaX = x - startX;
    const deltaY = y - startY;

    if (!this.notifSwipeArmed.has(notifId)) {
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) + 4) {
        this.notifSwipeArmed.add(notifId);
      } else {
        return;
      }
    }

    const clamped = Math.max(-this.notifDeleteRevealPx, Math.min(0, deltaX));
    this.notifSwipeOffsets.set(notifId, clamped);
  }

  private isSwipeBlockedTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    return !!element.closest('[data-no-swipe="true"], button, a, input, textarea, select, label');
  }

  resetNotifSwipe(notifId: number): void {
    this.notifSwipeOffsets.set(notifId, 0);
  }

  getNotifSwipeTransform(notifId: number): string {
    return `translateX(${this.notifSwipeOffsets.get(notifId) ?? 0}px)`;
  }

  isNotifDeleteRevealed(notifId: number): boolean {
    return (this.notifSwipeOffsets.get(notifId) ?? 0) <= -(this.notifDeleteRevealPx * 0.55);
  }

  onNotifCardPrimaryAction(notif: BackendNotification): void {
    if (this.isNotifRemoving(notif.id)) return;

    if (this.isNotifDeleteRevealed(notif.id)) {
      this.resetNotifSwipe(notif.id);
      return;
    }

    if (this.isSmartLockNotification(notif)) {
      this.openSmartLockGuideFromNotification(notif);
      return;
    }

    this.markNotifAsRead(notif);
  }

  onGuideButtonClick(event: MouseEvent, notif: BackendNotification): void {
    event.preventDefault();
    event.stopPropagation();
    this.openSmartLockGuideFromNotification(notif);
  }

  deleteReservationHistory(id: number): void {
    this.reservationService.deleteReservation(id).subscribe({
      next: () => {
        this.clientReservations = this.clientReservations.filter(r => r.idReservation !== id);
      },
      error: (e) => console.error('Erreur supression reservation', e)
    });
  }

  cancelReservation(id: number): void {
    if (confirm('Ètes-vous sûr de vouloir annuler et supprimer cette réservation ?')) {
      this.reservationService.updateReservationStatus(id, 'annuler').subscribe({
        next: () => {
          this.loadReservations();
          alert('Réservation annulée avec succès');
        },
        error: (err) => alert(err?.error?.message || 'Erreur lors de l\'annulation')
      });
    }
  }

  startEditingRes(res: ReservationResponse): void {
    this.editingReservationId = res.idReservation;
    this.editResForm.patchValue({
      dateDebut: res.dateDebut,
      dateFin: res.dateFin,
      nbPersonnes: res.nbPersonnes
    });
  }

  cancelEditingRes(): void {
    this.editingReservationId = null;
  }

  saveReservation(res: ReservationResponse): void {
    if (this.editResForm.invalid) return;
    const vals = this.editResForm.value;
    const req: ReservationRequest = {
      idLogement: res.idLogement,
      dateDebut: vals.dateDebut!,
      dateFin: vals.dateFin!,
      nbPersonnes: vals.nbPersonnes!
    };

    this.reservationService.updateReservationDetails(res.idReservation, req).subscribe({
      next: () => {
        this.editingReservationId = null;
        this.loadReservations();
        alert('Réservation modifiée avec succès');
      },
      error: (err) => alert(err?.error?.message || 'Erreur modification')
    });
  }
  getProgressPercentage(dateStr: string): number {
    if (!dateStr) return 100;
    const resDateMs = this.parseReservationDateMs(dateStr);
    if (!Number.isFinite(resDateMs)) return 100;
    const elapsedMs = this.now.getTime() - resDateMs;
    const maxMs = 2 * 60 * 60 * 1000; // 2 heures
    const perc = (elapsedMs / maxMs) * 100;
    return Math.min(Math.max(perc, 0), 100);
  }

  getRemainingTimeText(dateStr: string): string {
    if (!dateStr) return '';
    const resDateMs = this.parseReservationDateMs(dateStr);
    if (!Number.isFinite(resDateMs)) return 'Délai expiré';
    const elapsedMs = this.now.getTime() - resDateMs;
    const remainingMs = (2 * 60 * 60 * 1000) - elapsedMs;

    if (remainingMs <= 0) return 'Délai expiré';

    const h = Math.floor(remainingMs / (60 * 60 * 1000));
    const m = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    return `${h}h ${m}m restantes`;
  }

  private parseReservationDateMs(dateStr: string): number {
    // Backend can return timestamp without timezone; interpret it as UTC first to avoid client-local drift.
    const raw = (dateStr || '').trim();
    if (!raw) return Number.NaN;

    const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
    const normalized = hasTimezone ? raw : `${raw}Z`;

    const parsedUtcMs = Date.parse(normalized);
    if (Number.isFinite(parsedUtcMs)) return parsedUtcMs;

    const parsedLocalMs = Date.parse(raw);
    return Number.isFinite(parsedLocalMs) ? parsedLocalMs : Number.NaN;
  }

  isSmartLockActive(res: ReservationResponse): boolean {
    if (!res.dateDebut) return false;
    // Activate from 00:00 on the day of check-in
    const checkInDate = new Date(res.dateDebut);
    checkInDate.setHours(0, 0, 0, 0);
    return this.now.getTime() >= checkInDate.getTime();
  }

  /**
   * Basculer la serrure intelligente (déverrouiller/verrouiller)
   */
  toggleLock(res: ReservationResponse): void {
    // Si déjà déverrouillée, verrouiller simplement
    if (this.unlockedLocks.has(res.idReservation)) {
      this.closeLock(res.idReservation);
      return;
    }

    // Initier le processus de déverrouillage
    this.requestGPSAndUnlock(res);
  }

  /**
   * Fermer la serrure et nettoyer l'état
   */
  private closeLock(reservationId: number): void {
    this.unlockedLocks.delete(reservationId);
    this.unlockErrors.delete(reservationId);
    this.unlockedCodes.delete(reservationId);
  }

  /**
   * Demander le GPS et procéder au déverrouillage
   */
  private requestGPSAndUnlock(res: ReservationResponse): void {
    // Nettoyer les états précédents
    this.verifyingLocks.add(res.idReservation);
    this.unlockErrors.delete(res.idReservation);
    this.unlockedLocks.delete(res.idReservation);
    this.unlockedCodes.delete(res.idReservation);

    // Vérifier la disponibilité du GPS
    if (!navigator.geolocation) {
      this.handleUnlockError(res.idReservation, 'Géolocalisation non supportée par votre navigateur.');
      return;
    }

    // Demander la position GPS
    navigator.geolocation.getCurrentPosition(
      (position) => this.performGPSVerification(res, position.coords),
      () => this.handleUnlockError(res.idReservation, 'Impossible de récupérer votre position GPS.')
    );
  }

  /**
   * Effectuer la vérification GPS auprès du backend
   */
  private performGPSVerification(res: ReservationResponse, coords: GeolocationCoordinates): void {
    this.smartAccessService.verifyLocation({
      logementId: res.idLogement,
      clientLatitude: coords.latitude,
      clientLongitude: coords.longitude
    }).subscribe({
      next: (response) => this.handleUnlockResponse(res, response),
      error: (err) => this.handleUnlockError(res.idReservation, err.error?.message || 'Erreur réseau avec la serrure.')
    });
  }

  /**
   * Traiter la réponse du déverrouillage
   */
  private handleUnlockResponse(res: ReservationResponse, response: any): void {
    this.verifyingLocks.delete(res.idReservation);

    if (response.success) {
      // Succès : enregistrer le code et déverrouiller
      this.unlockedLocks.add(res.idReservation);
      this.unlockedCodes.set(res.idReservation, response.unlockCode);
      this.unlockErrors.delete(res.idReservation);
    } else {
      // Échec : afficher l'erreur
      this.handleUnlockError(res.idReservation, response.message || 'Déverrouillage impossible.');
    }
  }

  /**
   * Gérer les erreurs de déverrouillage
   */
  private handleUnlockError(reservationId: number, errorMessage: string): void {
    this.verifyingLocks.delete(reservationId);
    this.unlockedLocks.delete(reservationId);
    this.unlockedCodes.delete(reservationId);
    this.unlockErrors.set(reservationId, errorMessage);
  }

  openPaymentModal(res: ReservationResponse): void {
    if (this.isReservationPaid(res.idReservation)) {
      this.openInvoice(res.idReservation);
      return;
    }

    const amountInCents = this.extractAmountInCents(res.prixTotal);
    if (!amountInCents || amountInCents <= 0) {
      alert('Montant invalide');
      return;
    }

    void this.router.navigate(['/paiement'], {
      queryParams: {
        reservationId: res.idReservation,
        logementId: res.idLogement,
        logementName: res.nomLogement,
        amountInCents,
        currency: 'eur'
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

}

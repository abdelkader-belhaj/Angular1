// src/app/features/transport/courses/chauffeur/course-active-chauffeur/course-active-chauffeur.component.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { interval } from 'rxjs';
import {
  catchError,
  filter,
  map,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import {
  CourseService,
  PaymentVerificationStatus,
} from '../../../core/services/course.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import {
  AnnulationTransport,
  AnnulePar,
  Course,
  CourseStatus,
  DriverNotificationDTO,
} from '../../../core/models';
import { AnnulationService } from '../../../core/services/annulation.service';
import { AuthService } from '../../../../../services/auth.service';

declare const L: any;

@Component({
  selector: 'app-course-active-chauffeur',
  templateUrl: './course-active-chauffeur.component.html',
  styleUrls: ['./course-active-chauffeur.component.css'],
})
export class CourseActiveChauffeurComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private static readonly FREE_MINUTES = 5;
  private static readonly PENALTY_RATE = 0.2;

  @ViewChild('rideMap', { static: false })
  rideMapRef?: ElementRef<HTMLDivElement>;
  @ViewChild('chatSection', { static: false })
  chatSectionRef?: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();

  course: Course | null = null;
  courseId!: number;
  currentUserId: number | null = null;
  chauffeurId: number | null = null;
  private estimatedPriceSnapshot = 0;

  isFollowingDriver = true;
  distanceToArrivalKm = 0;
  etaMinutes = 0;

  private map: any;
  private driverMarker: any;
  private clientMarker: any;
  private pickupMarker: any;
  private dropoffMarker: any;
  private routeLine: any;
  private driverGeoWatchId: number | null = null;
  private clientLivePosition: [number, number] | null = null;

  unreadChatCount = 0;
  cancelReason = '';
  annulationResult: AnnulationTransport | null = null;
  isCancelling = false;
  isStartingCourse = false;
  hasRealtimeCancelledRedirect = false;
  paymentCodeInput = '';
  paymentRecord: PaymentVerificationStatus | null = null;

  protected readonly courseStatus = CourseStatus;

  constructor(
    private courseService: CourseService,
    private chauffeurService: ChauffeurService,
    private websocketService: WebsocketService,
    private notificationService: NotificationService,
    private annulationService: AnnulationService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = currentUser?.id ?? null;

    if (this.currentUserId != null) {
      this.websocketService.connect(this.currentUserId);
      this.chauffeurService
        .resolveChauffeurIdByUserId(this.currentUserId)
        .pipe(takeUntil(this.destroy$))
        .subscribe((id) => {
          this.chauffeurId = id;
          this.startDriverLocationSharing();
        });
    }

    this.course = this.courseService.getCourseActive();
    if (!this.course) {
      this.notificationService.error('Erreur', 'Aucune course active');
      this.router.navigate(['/transport/chauffeur-dashboard']);
      return;
    }
    this.courseId = this.course.idCourse;
    this.captureEstimatedPrice(this.course);
    this.refreshPaymentRecord();

    this.subscribeToCourseUpdates();
    this.startCoursePolling();
    this.startRealtimeCourseLocation();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initRideMap();
      this.refreshMapData();
    }, 0);
  }

  private subscribeToCourseUpdates(): void {
    this.websocketService.driverNotifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notif: DriverNotificationDTO) => {
        const notifType = String(notif?.type || '').toUpperCase();
        const notifCourseId = this.extractNotificationCourseId(notif);
        const sameCourse = notifCourseId === Number(this.courseId);

        if (
          sameCourse &&
          (notifType === 'COURSE_CONFIRMATION_CANCELLED' ||
            notifType === 'COURSE_CANCELLED')
        ) {
          this.handleCancelledCourse(
            notif,
            notif?.message,
            'Le client a annulé cette course. Retour au dashboard.',
          );
        }
      });

    // Mise à jour statut en temps réel
    this.websocketService.subscribe(
      `/topic/course/${this.courseId}/status`,
      (msg) => {
        const update = JSON.parse(msg.body);
        const nextStatus = update?.statut ?? update?.status;
        if (this.course && nextStatus) {
          this.course.statut = nextStatus;

          if (
            String(nextStatus).toUpperCase() === CourseStatus.CANCELLED &&
            !this.hasRealtimeCancelledRedirect
          ) {
            this.handleCancelledCourse(
              update,
              update?.message,
              'Le client a annulé la demande. Retour au dashboard.',
            );
          }
        }
      },
    );

    this.websocketService.subscribe(
      `/topic/course/${this.courseId}/chat`,
      (msg) => {
        try {
          const chatMessage = JSON.parse(msg.body);
          const senderId = Number(chatMessage?.senderId);
          if (!Number.isFinite(senderId) || senderId === this.currentUserId) {
            return;
          }
          this.unreadChatCount += 1;
        } catch {
          // Ignore malformed frames to avoid breaking active-course updates.
        }
      },
    );
  }

  private extractCancellationReason(payload: any): string {
    return this.firstNonEmptyString(
      payload?.raison,
      payload?.reason,
      payload?.motif,
      payload?.motifRejet,
      payload?.rejectionReason,
      payload?.cancellationReason,
      payload?.annulationResult?.raison,
      payload?.data?.raison,
      payload?.data?.reason,
      payload?.data?.motif,
      payload?.data?.motifRejet,
      payload?.data?.rejectionReason,
      payload?.data?.cancellationReason,
      payload?.data?.annulation?.raison,
      payload?.data?.annulationTransport?.raison,
      payload?.annulationTransport?.raison,
      payload?.annulation?.raison,
      payload?.course?.annulation?.raison,
      payload?.course?.annulationTransport?.raison,
      payload?.course?.annulationResult?.raison,
      payload?.demande?.motifRejet,
      '',
    );
  }

  private buildCancellationToastMessage(
    mainMessage: string | undefined,
    reason: string,
    fallbackMessage: string,
  ): string {
    const base = this.firstNonEmptyString(mainMessage, fallbackMessage);

    if (!reason) {
      return base;
    }

    const normalizedBase = base.toLowerCase();
    const normalizedReason = reason.toLowerCase();

    if (normalizedBase.includes(normalizedReason)) {
      return base;
    }

    return `${base} Motif: ${reason}`;
  }

  private extractNotificationCourseId(notif: DriverNotificationDTO): number {
    return this.firstFiniteNumber(
      notif?.courseId,
      notif?.data?.courseId,
      notif?.data?.idCourse,
      notif?.data?.course?.idCourse,
      0,
    );
  }

  private handleCancelledCourse(
    payload: any,
    incomingMessage: string | undefined,
    fallbackMessage: string,
  ): void {
    if (this.hasRealtimeCancelledRedirect) {
      return;
    }

    this.hasRealtimeCancelledRedirect = true;
    this.courseService.clearActiveCourse();

    const cancelReason = this.extractCancellationReason(payload);
    this.notificationService.cancellation(
      'Course annulée',
      this.buildCancellationToastMessage(
        incomingMessage,
        cancelReason,
        fallbackMessage,
      ),
    );

    void this.router.navigate(['/transport/chauffeur-dashboard']);
  }

  private startRealtimeCourseLocation(): void {
    this.websocketService.connected$
      .pipe(
        filter((connected) => connected),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.websocketService.subscribeToCourseLocation(this.courseId);
      });

    this.websocketService.locationUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        if (Number(update?.courseId) !== Number(this.courseId)) {
          return;
        }

        const lat = Number(update.latitude);
        const lon = Number(update.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return;
        }

        const actorType = String(update.actorType || '').toUpperCase();

        if (actorType === 'CHAUFFEUR' || update.chauffeurId) {
          this.course = {
            ...(this.course as Course),
            chauffeur: {
              ...(this.course?.chauffeur as any),
              positionActuelle: {
                latitude: lat,
                longitude: lon,
              },
            },
          };
        }

        if (actorType === 'CLIENT' || update.clientId) {
          this.clientLivePosition = [lat, lon];
        }

        this.refreshMapData();
      });
  }

  private startDriverLocationSharing(): void {
    if (!navigator.geolocation || !this.chauffeurId) {
      return;
    }

    this.driverGeoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        this.websocketService.sendLocationUpdate({
          courseId: this.courseId,
          chauffeurId: this.chauffeurId!,
          actorType: 'CHAUFFEUR',
          latitude: lat,
          longitude: lon,
          timestamp: new Date().toISOString(),
        });

        this.course = {
          ...(this.course as Course),
          chauffeur: {
            ...(this.course?.chauffeur as any),
            positionActuelle: { latitude: lat, longitude: lon },
          },
        };
        this.refreshMapData();
      },
      () => {
        // Silent fallback: map still works with pickup/dropoff markers.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );
  }

  openChatSection(): void {
    this.unreadChatCount = 0;
    this.chatSectionRef?.nativeElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  clearUnreadChatBadge(): void {
    this.unreadChatCount = 0;
  }

  private startCoursePolling(): void {
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.loadLatestCourseState()),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (course) => {
          const merged = this.mergeCourseForDisplay(course);
          this.course = merged;
          this.refreshPaymentRecord();
          if (merged.statut === CourseStatus.CANCELLED) {
            this.handleCancelledCourse(
              merged,
              undefined,
              'Course annulée. Retour au dashboard.',
            );
          } else {
            this.courseService.setActiveCourse(merged);
          }
          this.refreshMapData();
        },
      });
  }

  private mergeCourseForDisplay(nextCourse: Course): Course {
    const previousCourse = this.course as any;
    const mergedCourse: any = { ...nextCourse };
    const previousEstimated = this.extractEstimatedPrice(previousCourse);

    if (!mergedCourse.demande && previousCourse?.demande) {
      mergedCourse.demande = previousCourse.demande;
    }

    const mergedEstimated = this.extractEstimatedPrice(mergedCourse);
    if (mergedCourse.demande && mergedEstimated <= 0 && previousEstimated > 0) {
      mergedCourse.demande = {
        ...mergedCourse.demande,
        prixEstime: previousEstimated,
      };
    }

    this.captureEstimatedPrice(mergedCourse);

    if (!mergedCourse.demande && this.estimatedPriceSnapshot > 0) {
      mergedCourse.demande = {
        ...(previousCourse?.demande || {}),
        prixEstime: this.estimatedPriceSnapshot,
      };
    }

    return mergedCourse as Course;
  }

  private firstFiniteNumber(...values: Array<unknown>): number {
    for (const value of values) {
      const numericValue = Number(value);
      if (value != null && Number.isFinite(numericValue) && numericValue > 0) {
        return numericValue;
      }
    }

    return 0;
  }

  private extractEstimatedPrice(course: any): number {
    return this.firstFiniteNumber(
      course?.demande?.prixEstime,
      course?.demande?.prixEstimeCalcule,
      course?.demandeCourse?.prixEstime,
      course?.demandeCourse?.prixEstimeCalcule,
      course?.prixEstime,
      course?.estimatedPrice,
      course?.matching?.prixEstime,
      course?.matching?.estimatedPrice,
      course?.matching?.demande?.prixEstime,
      course?.matching?.demandeCourse?.prixEstime,
      course?.matchingDetails?.prixEstime,
    );
  }

  private captureEstimatedPrice(course: any): void {
    const estimated = this.extractEstimatedPrice(course);

    if (Number.isFinite(estimated) && estimated > 0) {
      this.estimatedPriceSnapshot = estimated;
    }
  }

  private loadLatestCourseState(): Observable<Course> {
    return this.courseService.getCourseById(this.courseId).pipe(
      catchError(() => {
        if (!this.chauffeurId) {
          return of(this.toCancelledFallbackCourse());
        }

        return this.courseService.getCoursesByChauffeur(this.chauffeurId).pipe(
          map((courses) => {
            const currentCourse = courses.find(
              (course) => Number(course.idCourse) === Number(this.courseId),
            );

            if (currentCourse) {
              return currentCourse;
            }

            return this.toCancelledFallbackCourse();
          }),
          catchError(() => of(this.toCancelledFallbackCourse())),
        );
      }),
    );
  }

  private toCancelledFallbackCourse(): Course {
    return {
      ...(this.course as Course),
      idCourse: this.courseId,
      statut: CourseStatus.CANCELLED,
    };
  }

  // Boutons workflow
  demarrerCourse(): void {
    if (this.requiresClientConfirmationForStart || this.isStartingCourse) {
      this.notificationService.info(
        'En attente client',
        'Le client doit confirmer la course avant le demarrage.',
      );
      return;
    }

    this.isStartingCourse = true;
    this.courseService.startCourse(this.courseId).subscribe({
      next: (c) => {
        this.course = c;
        this.notificationService.success(
          'Course démarrée',
          'Le client est informé',
        );
        this.isStartingCourse = false;
      },
      error: (error) => {
        this.notificationService.error(
          'Demarrage impossible',
          this.extractApiErrorMessage(error) ||
            'Le client doit confirmer la course acceptee.',
        );
        this.isStartingCourse = false;
      },
    });
  }

  passerEnCours(): void {
    this.courseService.setInProgress(this.courseId).subscribe({
      next: (c) => (this.course = c),
    });
  }

  terminerCourse(): void {
    this.courseService.completeCourse(this.courseId).subscribe({
      next: (course) => {
        this.course = course;
        this.refreshPaymentRecord();
        this.notificationService.success(
          'Course terminée',
          'En attente de confirmation paiement client',
        );
      },
    });
  }

  refreshPaymentRecord(): void {
    if (!this.courseId) {
      this.paymentRecord = null;
      return;
    }

    this.courseService
      .getPaymentStatus(this.courseId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.paymentRecord = null;
          return of(null);
        }),
      )
      .subscribe((status) => {
        this.paymentRecord = status;
      });
  }

  validerPaiementParCode(): void {
    if (!this.courseId) {
      this.notificationService.error('Paiement', 'Course introuvable.');
      return;
    }

    this.courseService
      .verifyPaymentByDriver(this.courseId, this.paymentCodeInput)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.paymentRecord = status;
          this.paymentCodeInput = '';
          this.notificationService.success(
            'Paiement validé',
            'Le paiement client a été confirmé par code.',
          );
        },
        error: (error) => {
          this.notificationService.error(
            'Paiement',
            error?.error?.message || 'Code invalide.',
          );
        },
      });
  }

  annulerCourse(): void {
    if (!this.course || this.isCancelling) {
      return;
    }

    const reason = this.cancelReason.trim();

    this.isCancelling = true;
    this.annulationService
      .annulerCourse(
        this.course.idCourse,
        AnnulePar.CHAUFFEUR,
        reason || undefined,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (annulation) => {
          this.isCancelling = false;
          this.annulationResult = annulation;
          if (this.course) {
            this.course.statut = CourseStatus.CANCELLED;
          }
          this.courseService.clearActiveCourse();
          this.notificationService.cancellation(
            'Annulation confirmée',
            `Pénalité: ${Number(annulation?.montantPenalite ?? 0).toFixed(2)} TND | Remboursement: ${Number(annulation?.montantRemboursement ?? 0).toFixed(2)} TND`,
          );
        },
        error: () => {
          this.isCancelling = false;
          this.notificationService.error(
            'Erreur',
            "Impossible d'annuler la course.",
          );
        },
      });
  }

  retournerDashboardChauffeur(): void {
    this.router.navigate(['/transport/chauffeur-dashboard']);
  }

  toggleFollowDriver(): void {
    this.isFollowingDriver = !this.isFollowingDriver;
    if (this.isFollowingDriver) {
      this.centerOnDriver();
    }
  }

  private initRideMap(): void {
    if (!this.rideMapRef?.nativeElement || this.map) {
      return;
    }

    this.map = L.map(this.rideMapRef.nativeElement, {
      zoomControl: true,
      attributionControl: true,
    }).setView([36.8065, 10.1815], 13);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    ).addTo(this.map);
  }

  private refreshMapData(): void {
    if (!this.map || !this.course) {
      return;
    }

    const pickup = this.extractLatLng(this.course.localisationDepart);
    const dropoff = this.extractLatLng(this.course.localisationArrivee);
    const driver =
      this.extractLatLng(this.course.chauffeur?.positionActuelle) ?? pickup;
    const liveClient = this.clientLivePosition ?? pickup;

    if (pickup) {
      this.pickupMarker = this.upsertMarker(this.pickupMarker, pickup, {
        color: '#14b8a6',
        label: '📍 Départ',
      });
    }

    if (dropoff) {
      this.dropoffMarker = this.upsertMarker(this.dropoffMarker, dropoff, {
        color: '#ef4444',
        label: '🏁 Arrivée',
      });
    }

    if (driver) {
      this.driverMarker = this.upsertMarker(this.driverMarker, driver, {
        color: '#0f172a',
        label: '🚕 Vous',
      });
    }

    if (liveClient) {
      this.clientMarker = this.upsertMarker(this.clientMarker, liveClient, {
        color: '#f59e0b',
        label: '🙋 Client',
      });
    }

    const routePoints = [pickup, dropoff].filter(Boolean) as [number, number][];
    if (routePoints.length === 2) {
      if (!this.routeLine) {
        this.routeLine = L.polyline(routePoints, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.8,
        }).addTo(this.map);
      } else {
        this.routeLine.setLatLngs(routePoints);
      }
    }

    if (driver && dropoff) {
      const distance = this.computeDistanceKm(
        driver[0],
        driver[1],
        dropoff[0],
        dropoff[1],
      );
      this.distanceToArrivalKm = Math.round(distance * 10) / 10;
      this.etaMinutes = Math.max(1, Math.round((distance / 0.55) * 1));
    }

    if (this.isFollowingDriver) {
      this.centerOnDriver();
    } else if (pickup && dropoff) {
      this.map.fitBounds([pickup, dropoff] as any, { padding: [35, 35] });
    }
  }

  private centerOnDriver(): void {
    const driver =
      this.extractLatLng(this.course?.chauffeur?.positionActuelle) ??
      this.extractLatLng(this.course?.localisationDepart);

    if (driver) {
      this.map?.setView(driver, 15);
    }
  }

  private upsertMarker(
    marker: any,
    latLng: [number, number],
    options: { color: string; label: string },
  ): any {
    if (!marker) {
      const created = L.circleMarker(latLng, {
        radius: 8,
        color: options.color,
        fillColor: options.color,
        fillOpacity: 0.95,
      }).addTo(this.map);

      created.bindTooltip(options.label, {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'map-marker-tag',
      });

      return created;
    }

    marker.setLatLng(latLng);
    if (marker.getTooltip()) {
      marker.setTooltipContent(options.label);
    }
    return marker;
  }

  private extractLatLng(location: any): [number, number] | null {
    const lat = Number(location?.latitude);
    const lon = Number(location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return [lat, lon];
  }

  private computeDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  get canCancel(): boolean {
    return false;
  }

  get requiresClientConfirmationForStart(): boolean {
    return (
      this.course?.statut === this.courseStatus.ACCEPTED &&
      this.course?.demande?.approbationClientRequise === true
    );
  }

  get startButtonLabel(): string {
    if (this.isStartingCourse) {
      return 'Demarrage...';
    }

    if (this.requiresClientConfirmationForStart) {
      return 'En attente confirmation client';
    }

    return 'Démarrer la course';
  }

  get minutesSinceCourseCreation(): number {
    const createdAt = this.course?.dateCreation;
    if (!createdAt) {
      return 0;
    }

    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) {
      return 0;
    }

    const diffMs = Date.now() - created;
    if (diffMs <= 0) {
      return 0;
    }

    return Math.floor(diffMs / 60000);
  }

  get estimatedFreeWindowActive(): boolean {
    return (
      this.minutesSinceCourseCreation <=
      CourseActiveChauffeurComponent.FREE_MINUTES
    );
  }

  get estimatedBaseAmount(): number {
    const courseAmount = Number(this.course?.prixFinal);
    if (Number.isFinite(courseAmount) && courseAmount > 0) {
      return courseAmount;
    }

    const estimatedDemandAmount = Number(this.course?.demande?.prixEstime);
    if (Number.isFinite(estimatedDemandAmount) && estimatedDemandAmount > 0) {
      return estimatedDemandAmount;
    }

    return 0;
  }

  get estimatedPenaltyAmount(): number {
    const baseAmount = this.estimatedBaseAmount;
    if (baseAmount <= 0) {
      return 0;
    }

    let penalty = 0;
    if (!this.estimatedFreeWindowActive) {
      penalty +=
        Math.round(
          baseAmount * CourseActiveChauffeurComponent.PENALTY_RATE * 100,
        ) / 100;
    }

    return Math.round(penalty * 100) / 100;
  }

  get estimatedRefundAmount(): number {
    const refund = this.estimatedBaseAmount - this.estimatedPenaltyAmount;
    return Math.max(0, Math.round(refund * 100) / 100);
  }

  get isPenaltyLikely(): boolean {
    return this.estimatedPenaltyAmount > 0;
  }

  get hasAnnulationResult(): boolean {
    return !!this.annulationResult;
  }

  get hasClientPayment(): boolean {
    return !!this.paymentRecord?.clientConfirmed;
  }

  get isPaymentDriverVerified(): boolean {
    return !!this.paymentRecord?.driverVerified;
  }

  get cancellationPenaltyAmount(): number {
    return Number(this.paymentRecord?.penaltyAmount ?? 0);
  }

  get cancellationRefundAmount(): number {
    return Number(this.paymentRecord?.refundAmount ?? 0);
  }

  get isCancellationPenaltyPaid(): boolean {
    return (
      this.cancellationPenaltyAmount > 0 &&
      this.paymentRecord?.paymentStatut === 'COMPLETED'
    );
  }

  get hasCancellationFinancialData(): boolean {
    return !!this.paymentRecord?.cancelled;
  }

  get estimatedRidePrice(): number {
    const estimated = this.extractEstimatedPrice(this.course);
    if (estimated > 0) {
      return estimated;
    }

    return this.estimatedPriceSnapshot;
  }

  get finalRidePrice(): number {
    const finalAmount = Number(this.course?.prixFinal);
    return Number.isFinite(finalAmount) && finalAmount > 0 ? finalAmount : 0;
  }

  get hasFinalRidePrice(): boolean {
    return this.finalRidePrice > 0;
  }

  get displayedRidePrice(): number {
    return this.hasFinalRidePrice
      ? this.finalRidePrice
      : this.estimatedRidePrice;
  }

  get displayedRidePriceLabel(): string {
    return this.hasFinalRidePrice ? 'Prix final' : 'Prix';
  }

  get showCompletedPriceDifference(): boolean {
    return (
      this.course?.statut === CourseStatus.COMPLETED &&
      this.finalRidePrice > 0 &&
      this.estimatedRidePrice > 0 &&
      Math.abs(this.finalRidePrice - this.estimatedRidePrice) >= 0.01
    );
  }

  get completedPriceDifference(): number {
    return this.finalRidePrice - this.estimatedRidePrice;
  }

  private extractApiErrorMessage(error: any): string {
    const message =
      error?.error?.message ??
      error?.error?.error ??
      error?.message ??
      error?.statusText;

    return typeof message === 'string' ? message : '';
  }

  private firstNonEmptyString(...values: Array<unknown>): string {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  ngOnDestroy(): void {
    if (this.driverGeoWatchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.driverGeoWatchId);
    }

    if (this.map) {
      this.map.remove();
    }

    this.destroy$.next();
    this.destroy$.complete();
  }
}

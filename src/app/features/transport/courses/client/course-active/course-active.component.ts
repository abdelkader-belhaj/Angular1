// src/app/features/transport/courses/client/course-active/course-active.component.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { of } from 'rxjs';
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
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AnnulationService } from '../../../core/services/annulation.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import {
  Course,
  CourseStatus,
  AnnulePar,
  EvaluationType,
  AnnulationTransport,
} from '../../../core/models';
import { AuthService } from '../../../../../services/auth.service';

declare const L: any;

@Component({
  selector: 'app-course-active',
  templateUrl: './course-active.component.html',
  styleUrls: ['./course-active.component.css'],
})
export class CourseActiveComponent implements OnInit, AfterViewInit, OnDestroy {
  private static readonly FREE_MINUTES = 5;
  private static readonly PENALTY_RATE = 0.2;

  @ViewChild('rideMap', { static: false })
  rideMapRef?: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();

  course: Course | null = null;
  courseId!: number;
  currentUserId: number | null = null;
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
  private clientGeoWatchId: number | null = null;
  private clientLivePosition: [number, number] | null = null;

  cancelReason = '';
  annulationResult: AnnulationTransport | null = null;
  evaluationNote = 5;
  hoveredEvaluationNote = 0;
  readonly evaluationStars = [1, 2, 3, 4, 5];
  evaluationComment = '';
  paymentCompleted = false;
  paymentVerificationCode: string | null = null;
  paymentStatus: PaymentVerificationStatus | null = null;
  private evaluationStateLoaded = false;
  isEvaluationStateLoading = false;

  isCancelling = false;
  isSubmittingEvaluation = false;
  evaluationDone = false;

  protected readonly courseStatus = CourseStatus;

  constructor(
    private courseService: CourseService,
    private chauffeurService: ChauffeurService,
    private websocketService: WebsocketService,
    private notificationService: NotificationService,
    private annulationService: AnnulationService,
    private evaluationService: EvaluationService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = currentUser?.id ?? null;

    if (this.currentUserId != null) {
      this.websocketService.connect(this.currentUserId);
    }

    this.course = this.courseService.getCourseActive();
    if (!this.course) {
      this.notificationService.error('Erreur', 'Aucune course active');
      this.router.navigate(['/transport/demander-course']);
      return;
    }

    this.courseId = this.course.idCourse;
    this.captureEstimatedPrice(this.course);
    this.refreshPaymentStatus();

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
      const paymentSuccess = qp.get('paymentSuccess') === 'true';
      if (paymentSuccess && !this.paymentCompleted) {
        this.refreshPaymentStatus();
        this.notificationService.success(
          'Paiement',
          'Paiement confirmé avec succès.',
        );
      }
    });

    this.subscribeToCourseUpdates();
    this.startCoursePolling();
    this.startRealtimeCourseLocation();
    this.startClientLocationSharing();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initRideMap();
      this.refreshMapData();
    }, 0);
  }

  private subscribeToCourseUpdates(): void {
    this.websocketService.subscribe(
      `/topic/course/${this.courseId}/status`,
      (msg) => {
        const update = JSON.parse(msg.body);
        const nextStatus = update?.statut ?? update?.status;
        if (this.course && nextStatus) {
          this.course.statut = nextStatus;
        }
      },
    );

    this.websocketService.subscribe(
      `/topic/course/${this.courseId}/chat`,
      (msg) => {
        console.log('💬 Message du chauffeur:', msg.body);
      },
    );
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

        if (
          actorType === 'CLIENT' &&
          (!update.clientId ||
            Number(update.clientId) === Number(this.currentUserId))
        ) {
          this.clientLivePosition = [lat, lon];
        }

        this.refreshMapData();
      });
  }

  private startClientLocationSharing(): void {
    if (this.currentUserId == null || !navigator.geolocation) {
      return;
    }

    this.clientGeoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const update = {
          courseId: this.courseId,
          clientId: this.currentUserId!,
          actorType: 'CLIENT' as const,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        };

        this.clientLivePosition = [update.latitude, update.longitude];
        this.websocketService.sendLocationUpdate(update);
        this.refreshMapData();
      },
      () => {
        // Silent fallback: pickup marker remains visible even without live client GPS.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );
  }

  private startCoursePolling(): void {
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.courseService.getCourseById(this.courseId)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (course) => {
          const merged = this.mergeCourseForDisplay(course);
          this.course = merged;
          this.courseService.setActiveCourse(merged);
          this.refreshPaymentStatus();
          this.refreshMapData();
        },
      });
  }

  private refreshPaymentStatus(): void {
    if (!this.courseId) {
      this.paymentCompleted = false;
      this.paymentVerificationCode = null;
      this.paymentStatus = null;
      return;
    }

    this.courseService
      .getPaymentStatus(this.courseId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.paymentCompleted = false;
          this.paymentVerificationCode = null;
          this.paymentStatus = null;
          return of(null);
        }),
      )
      .subscribe((status) => {
        if (!status) {
          return;
        }

        this.paymentStatus = status;
        this.paymentCompleted = !!status.clientConfirmed;
        this.paymentVerificationCode = status.verificationCode ?? null;

        if (this.paymentCompleted && !this.evaluationStateLoaded) {
          this.isEvaluationStateLoading = true;
          this.loadExistingEvaluationState();
        } else if (!this.paymentCompleted) {
          this.isEvaluationStateLoading = false;
        }
      });
  }

  private loadExistingEvaluationState(): void {
    if (!this.courseId || this.currentUserId == null) {
      return;
    }

    this.evaluationStateLoaded = true;

    this.evaluationService
      .getAllEvaluations()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([])),
      )
      .subscribe((evaluations) => {
        const existingEvaluation = (evaluations || []).find((evaluation) => {
          const courseMatches =
            Number(evaluation?.course?.idCourse) === Number(this.courseId) ||
            Number((evaluation as any)?.courseId) === Number(this.courseId);

          const typeMatches =
            String(evaluation?.type || '').toUpperCase() ===
            EvaluationType.CLIENT_TO_DRIVER;

          const evaluatorMatches =
            Number(evaluation?.evaluateur?.id) === Number(this.currentUserId) ||
            Number((evaluation as any)?.evaluateurId) ===
              Number(this.currentUserId);

          return courseMatches && typeMatches && evaluatorMatches;
        });

        if (!existingEvaluation) {
          this.isEvaluationStateLoading = false;
          return;
        }

        const existingNote = Number(existingEvaluation.note);
        this.evaluationDone = true;
        if (
          Number.isFinite(existingNote) &&
          existingNote >= 1 &&
          existingNote <= 5
        ) {
          this.evaluationNote = existingNote;
        }
        this.evaluationComment = existingEvaluation.commentaire ?? '';
        this.isEvaluationStateLoading = false;
      });
  }

  private mergeCourseForDisplay(nextCourse: Course): Course {
    const previousCourse = this.course as any;
    const mergedCourse: any = { ...nextCourse };
    const previousEstimated = this.extractEstimatedPrice(previousCourse);

    // Some backend payloads omit demande before COMPLETED; keep previous demande snapshot for UI continuity.
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

  annulerCourse(): void {
    if (!this.course || this.isCancelling) {
      return;
    }

    const reason = this.cancelReason.trim();

    this.isCancelling = true;
    this.annulationService
      .annulerCourse(
        this.course.idCourse,
        AnnulePar.CLIENT,
        reason || undefined,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (annulation) => {
          this.isCancelling = false;
          this.annulationResult = annulation;
          this.course!.statut = CourseStatus.CANCELLED;
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

  retournerDemandeCourse(): void {
    this.router.navigate(['/transport/demander-course']);
  }

  payerCourse(): void {
    if (!this.course?.idCourse) {
      this.notificationService.error('Paiement', 'Course introuvable.');
      return;
    }

    this.router.navigate(['/transport/paiement-course'], {
      queryParams: { courseId: this.course.idCourse },
    });
  }

  evaluerChauffeur(): void {
    console.log('[EVAL DEBUG][CLIENT] click evaluerChauffeur', {
      courseId: this.course?.idCourse,
      statut: this.course?.statut,
      note: this.evaluationNote,
      isSubmittingEvaluation: this.isSubmittingEvaluation,
      evaluationDone: this.evaluationDone,
      currentUserId: this.currentUserId,
    });

    if (!this.course) {
      console.warn('[EVAL DEBUG][CLIENT] blocked: no active course');
      this.notificationService.warning('Évaluation', 'Aucune course active.');
      return;
    }

    if (this.isSubmittingEvaluation) {
      console.warn(
        '[EVAL DEBUG][CLIENT] blocked: submission already in progress',
      );
      this.notificationService.info('Évaluation', 'Envoi en cours...');
      return;
    }

    if (this.evaluationDone) {
      console.warn('[EVAL DEBUG][CLIENT] blocked: evaluation already done');
      this.notificationService.info('Évaluation', 'Déjà envoyée.');
      return;
    }

    if (this.currentUserId == null) {
      console.warn('[EVAL DEBUG][CLIENT] blocked: current user is null');
      this.notificationService.error('Erreur', 'Utilisateur non authentifié.');
      return;
    }

    if (!this.paymentCompleted) {
      this.notificationService.info(
        'Évaluation',
        'L évaluation est disponible après confirmation du paiement.',
      );
      return;
    }

    if (this.isEvaluationStateLoading) {
      this.notificationService.info(
        'Évaluation',
        'Vérification de votre évaluation existante en cours...',
      );
      return;
    }

    if (this.evaluationNote < 1 || this.evaluationNote > 5) {
      console.warn(
        '[EVAL DEBUG][CLIENT] blocked: invalid note',
        this.evaluationNote,
      );
      this.notificationService.warning(
        'Évaluation',
        'La note doit être entre 1 et 5.',
      );
      return;
    }

    this.resolveChauffeurUserIdForEvaluation()
      .pipe(takeUntil(this.destroy$))
      .subscribe((chauffeurUserId) => {
        if (!chauffeurUserId) {
          const debugCourse: any = this.course;
          console.warn(
            '[EVAL DEBUG][CLIENT] blocked: chauffeur user id not found after fallback',
            {
              chauffeur: debugCourse?.chauffeur,
              matching: debugCourse?.matching,
              topLevelHints: {
                idChauffeur: debugCourse?.idChauffeur,
                chauffeurId: debugCourse?.chauffeurId,
                chauffeurUserId: debugCourse?.chauffeurUserId,
                idUserChauffeur: debugCourse?.idUserChauffeur,
              },
            },
          );
          this.notificationService.error(
            'Erreur',
            'Impossible de trouver le chauffeur à évaluer.',
          );
          return;
        }

        console.log('[EVAL DEBUG][CLIENT] resolved chauffeur user id', {
          chauffeurUserId,
        });

        this.isSubmittingEvaluation = true;
        this.notificationService.info(
          'Évaluation',
          'Envoi de votre évaluation...',
        );
        this.evaluationService
          .addEvaluation({
            course: { idCourse: this.course!.idCourse },
            evaluateur: { id: this.currentUserId },
            evalue: { id: chauffeurUserId },
            type: EvaluationType.CLIENT_TO_DRIVER,
            note: Number(this.evaluationNote),
            commentaire: this.evaluationComment,
          } as any)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              console.log('[EVAL DEBUG][CLIENT] evaluation success');
              this.isSubmittingEvaluation = false;
              this.evaluationDone = true;
              this.evaluationStateLoaded = true;
              this.notificationService.success(
                'Merci',
                'Évaluation du chauffeur enregistrée.',
              );
            },
            error: (err) => {
              const errorMessage = String(
                err?.error?.message ?? err?.error?.error ?? err?.message ?? '',
              );
              if (
                /duplicate entry|duplicate|UK93n4mud3vpldmemgyrn75im74/i.test(
                  errorMessage,
                )
              ) {
                this.isSubmittingEvaluation = false;
                this.evaluationDone = true;
                this.evaluationStateLoaded = true;
                this.notificationService.cancellation(
                  'Évaluation déjà enregistrée',
                  'Cette course a déjà reçu votre évaluation.',
                );
                return;
              }

              console.error('[EVAL DEBUG][CLIENT] evaluation error', err);
              this.isSubmittingEvaluation = false;
              this.notificationService.error(
                'Erreur',
                err?.message || 'Évaluation impossible.',
              );
            },
          });
      });
  }

  private resolveChauffeurUserIdForEvaluation() {
    const initialCourse = this.course as any;
    const directInitial = this.extractChauffeurUserIdFromCourse(initialCourse);
    if (directInitial) {
      return of(directInitial);
    }

    const initialChauffeurId =
      this.extractChauffeurEntityIdFromCourse(initialCourse);
    if (initialChauffeurId) {
      return this.resolveUserIdFromChauffeurProfile(initialChauffeurId);
    }

    return this.courseService.getCourseById(this.courseId).pipe(
      map((freshCourse: any) => {
        this.course = freshCourse;
        return freshCourse;
      }),
      switchMap((freshCourse: any) => {
        const directFresh = this.extractChauffeurUserIdFromCourse(freshCourse);
        if (directFresh) {
          return of(directFresh);
        }

        const freshChauffeurId =
          this.extractChauffeurEntityIdFromCourse(freshCourse);
        if (freshChauffeurId) {
          return this.resolveUserIdFromChauffeurProfile(freshChauffeurId);
        }

        return of(null);
      }),
      catchError(() => of(null)),
    );
  }

  private resolveUserIdFromChauffeurProfile(chauffeurId: number) {
    return this.chauffeurService.resolveUserIdByChauffeurId(chauffeurId).pipe(
      map((resolvedUserId) => {
        if (resolvedUserId) {
          return resolvedUserId;
        }

        // Backend now accepts chauffeur id and resolves linked user internally.
        return chauffeurId;
      }),
      catchError(() => of(null)),
    );
  }

  private extractChauffeurUserIdFromCourse(course: any): number | null {
    const explicitUserId = this.toPositiveNumber(
      course?.chauffeurUserId ??
        course?.chauffeur_user_id ??
        course?.idUserChauffeur ??
        course?.idUtilisateurChauffeur,
    );
    if (explicitUserId) {
      return explicitUserId;
    }

    const matchingUserId = this.toPositiveNumber(
      course?.matching?.chauffeurUserId ??
        course?.matching?.chauffeur_user_id ??
        course?.matching?.idUserChauffeur ??
        course?.matching?.idUtilisateurChauffeur,
    );
    if (matchingUserId) {
      return matchingUserId;
    }

    const candidates = [
      course?.chauffeur,
      course?.matching?.chauffeur,
      course?.matching?.course?.chauffeur,
      course?.demande?.course?.chauffeur,
    ];

    for (const candidate of candidates) {
      const id = this.extractUserLikeId(candidate);
      if (id) {
        return id;
      }
    }

    return null;
  }

  private extractChauffeurEntityIdFromCourse(course: any): number | null {
    const explicitChauffeurId = this.toPositiveNumber(
      course?.idChauffeur ??
        course?.chauffeurId ??
        course?.id_chauffeur ??
        course?.idChauffeurTransport,
    );
    if (explicitChauffeurId) {
      return explicitChauffeurId;
    }

    const matchingChauffeurId = this.toPositiveNumber(
      course?.matching?.idChauffeur ??
        course?.matching?.chauffeurId ??
        course?.matching?.id_chauffeur ??
        course?.matching?.idChauffeurTransport,
    );
    if (matchingChauffeurId) {
      return matchingChauffeurId;
    }

    const candidates = [
      course?.chauffeur,
      course?.matching?.chauffeur,
      course?.matching?.course?.chauffeur,
      course?.demande?.course?.chauffeur,
    ];

    for (const candidate of candidates) {
      const id = this.toPositiveNumber(
        candidate?.idChauffeur ??
          candidate?.chauffeur?.idChauffeur ??
          candidate?.chauffeurId ??
          candidate?.id_chauffeur ??
          candidate?.idChauffeurTransport,
      );

      if (id) {
        return id;
      }
    }

    return null;
  }

  private extractUserLikeId(entity: any): number | null {
    const userShapedDirectId = this.toPositiveNumber(entity?.id);
    const isLikelyUserObject = !!(
      entity?.email ??
      entity?.username ??
      entity?.nom ??
      entity?.prenom ??
      entity?.role
    );

    if (isLikelyUserObject && userShapedDirectId) {
      return userShapedDirectId;
    }

    return this.toPositiveNumber(
      entity?.idUser ??
        entity?.userId ??
        entity?.utilisateurId ??
        entity?.id_utilisateur ??
        entity?.idUtilisateur ??
        entity?.chauffeurUserId ??
        entity?.utilisateur?.id ??
        entity?.utilisateur?.idUser ??
        entity?.user?.id ??
        entity?.compte?.id,
    );
  }

  private toPositiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  toggleFollowDriver(): void {
    this.isFollowingDriver = !this.isFollowingDriver;
    if (this.isFollowingDriver) {
      this.centerOnDriver();
    }
  }

  setEvaluationNote(note: number): void {
    this.evaluationNote = note;
  }

  setHoveredEvaluationNote(note: number): void {
    this.hoveredEvaluationNote = note;
  }

  clearHoveredEvaluationNote(): void {
    this.hoveredEvaluationNote = 0;
  }

  isEvaluationStarActive(star: number): boolean {
    const reference = this.hoveredEvaluationNote || this.evaluationNote;
    return star <= reference;
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
    const driver = this.extractLatLng(this.course.chauffeur?.positionActuelle);
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
        label: '🚕 Chauffeur',
      });
    }

    if (liveClient) {
      this.clientMarker = this.upsertMarker(this.clientMarker, liveClient, {
        color: '#f59e0b',
        label: '🙋 Vous',
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
    const driver = this.extractLatLng(this.course?.chauffeur?.positionActuelle);
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
    return this.course?.statut === CourseStatus.ACCEPTED;
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
      this.minutesSinceCourseCreation <= CourseActiveComponent.FREE_MINUTES
    );
  }

  get remainingGraceMinutes(): number {
    const remaining =
      CourseActiveComponent.FREE_MINUTES - this.minutesSinceCourseCreation;
    return Math.max(0, remaining);
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
        Math.round(baseAmount * CourseActiveComponent.PENALTY_RATE * 100) / 100;
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

  get canRateDriver(): boolean {
    return (
      this.course?.statut === CourseStatus.COMPLETED &&
      this.paymentCompleted &&
      !this.isEvaluationStateLoading &&
      !this.evaluationDone
    );
  }

  get canPayCourse(): boolean {
    if (this.course?.statut !== CourseStatus.COMPLETED) {
      return false;
    }

    if (this.paymentStatus?.cancelled) {
      return false;
    }

    return !this.paymentStatus?.clientConfirmed;
  }

  get cancellationPenaltyAmount(): number {
    return Number(this.paymentStatus?.penaltyAmount ?? 0);
  }

  get cancellationRefundAmount(): number {
    return Number(this.paymentStatus?.refundAmount ?? 0);
  }

  get isCancellationPenaltyPaid(): boolean {
    return (
      this.cancellationPenaltyAmount > 0 &&
      this.paymentStatus?.paymentStatut === 'COMPLETED'
    );
  }

  get hasCancellationFinancialData(): boolean {
    return !!this.paymentStatus?.cancelled;
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

  get preauthorizedPenaltyHoldAmount(): number {
    const backendPreauth = Number(this.paymentStatus?.montantPreautorise);
    if (Number.isFinite(backendPreauth) && backendPreauth > 0) {
      return backendPreauth;
    }

    const base = this.displayedRidePrice;
    if (!Number.isFinite(base) || base <= 0) {
      return 0;
    }

    return Math.round(base * CourseActiveComponent.PENALTY_RATE * 100) / 100;
  }

  get remainingPaymentAfterPreauth(): number {
    const backendRemaining = Number(this.paymentStatus?.montantRestant);
    if (Number.isFinite(backendRemaining)) {
      return Math.max(0, Math.round(backendRemaining * 100) / 100);
    }

    const base = this.displayedRidePrice;
    if (!Number.isFinite(base) || base <= 0) {
      return 0;
    }

    const remaining = base - this.preauthorizedPenaltyHoldAmount;
    return Math.max(0, Math.round(remaining * 100) / 100);
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

  ngOnDestroy(): void {
    if (this.clientGeoWatchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.clientGeoWatchId);
    }

    if (this.map) {
      this.map.remove();
    }

    this.destroy$.next();
    this.destroy$.complete();
  }
}

// src/app/features/transport/courses/chauffeur/tableau-bord-chauffeur/tableau-bord-chauffeur.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MatchingService } from '../../../core/services/matching.service';
import { DemandeCourseService } from '../../../core/services/demande-course.service';
import { CourseService } from '../../../core/services/course.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { ReviewSummaryAiService } from '../../../core/services/review-summary-ai.service';
import { SmartReviewSummary } from '../../../core/services/review-summary.service';
import {
  Chauffeur,
  ChauffeurDashboardStats,
  EvaluationTransport,
  EvaluationType,
  DisponibiliteStatut,
  MatchingNotification,
  DriverNotificationDTO,
  Matching,
  VehiculeStatut,
} from '../../../core/models';
import { AuthService } from '../../../../../services/auth.service';

// 1. Ajoute interval et switchMap dans tes imports rxjs
import { interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-tableau-bord-chauffeur',
  templateUrl: './tableau-bord-chauffeur.component.html',
  styleUrls: ['./tableau-bord-chauffeur.component.css'],
})
export class TableauBordChauffeurComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly mapDelta = 0.02;
  private driverGeoWatchId: number | null = null;
  private lastLocationPushAt = 0;
  private lastPushedCoords: { lat: number; lon: number } | null = null;
  private readonly minLocationPushIntervalMs = 4000;
  private readonly minLocationPushDistanceMeters = 8;

  chauffeur: Chauffeur | null = null;
  chauffeurId: number | null = null;
  currentUserId: number | null = null;

  stats: ChauffeurDashboardStats = {
    totalCoursesAujourdhui: 0,
    totalCoursesSemaine: 0,
    revenusAujourdhui: 0,
    revenusSemaine: 0,
    noteMoyenne: 0,
    tempsEnLigneMinutes: 0,
  };

  isLoading = true;
  isOnline = false;
  hasActiveCourse = false;
  pendingMatchings: MatchingNotification[] = [];
  isLoadingMatchings = false;
  acceptingMatchingId: number | null = null;
  private demandeDetailsCache = new Map<number, any>();
  private matchingDetailsCache = new Map<number, any>();
  recentEvaluations: EvaluationTransport[] = [];
  isLoadingEvaluations = false;
  smartReviewSummary: SmartReviewSummary | null = null;

  private onlineTimer: any;
  tempsEnLigneDisplay = '00:00';
  private activeVehicleTypes = new Set<string>();

  constructor(
    private chauffeurService: ChauffeurService,
    private websocketService: WebsocketService,
    private notificationService: NotificationService,
    private matchingService: MatchingService,
    private demandeCourseService: DemandeCourseService,
    private courseService: CourseService,
    private evaluationService: EvaluationService,
    private reviewSummaryAiService: ReviewSummaryAiService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initializeDashboard();
  }

  ngOnDestroy(): void {
    this.stopLiveLocationTracking();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.onlineTimer) clearInterval(this.onlineTimer);
  }
  //
  private initializeDashboard(): void {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      this.notificationService.warning(
        'Authentification',
        'Veuillez vous connecter pour acceder au dashboard chauffeur.',
      );
      this.isLoading = false;
      return;
    }

    this.currentUserId = currentUser.id;

    this.chauffeurService
      .resolveChauffeurIdByUserId(currentUser.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (chauffeurId) => {
          this.chauffeurId = chauffeurId;

          if (!this.chauffeurId) {
            this.notificationService.warning(
              'Profil chauffeur',
              'Aucun profil chauffeur lie a cet utilisateur.',
            );
            this.isLoading = false;
            return;
          }

          this.connectWebSocket();
          this.loadChauffeurData();
          this.refreshActiveVehicleTypes();
          this.loadRecentEvaluations();
          this.startLiveLocationTracking();
          this.startPollingDriverLocation();
          this.startPollingStats();
          this.startPollingMatchings();
          this.setupNotifications();
        },
        error: () => {
          this.notificationService.error(
            'Erreur',
            'Impossible de charger le profil chauffeur courant.',
          );
          this.isLoading = false;
        },
      });
  }

  private startPollingMatchings(): void {
    if (!this.chauffeurId) {
      return;
    }

    this.isLoadingMatchings = true;
    interval(5000)
      .pipe(
        startWith(0),
        takeUntil(this.destroy$),
        switchMap(() =>
          this.matchingService.getMatchingsByChauffeur(this.chauffeurId!),
        ),
      )
      .subscribe({
        next: (allMatchings: Matching[]) => {
          this.applyMatchings(allMatchings);
          this.isLoadingMatchings = false;
        },
        error: (err) => {
          console.error('Erreur polling matchings:', err);
          this.isLoadingMatchings = false;
        },
      });
  }

  private startPollingDriverLocation(): void {
    if (!this.chauffeurId) {
      return;
    }

    interval(8000)
      .pipe(
        startWith(0),
        takeUntil(this.destroy$),
        switchMap(() => this.chauffeurService.getProfil(this.chauffeurId!)),
      )
      .subscribe({
        next: (chauffeur) => {
          this.chauffeur = chauffeur;
          this.isOnline =
            chauffeur.disponibilite === DisponibiliteStatut.AVAILABLE;
        },
      });
  }

  private startLiveLocationTracking(): void {
    if (
      !this.chauffeurId ||
      !navigator.geolocation ||
      this.driverGeoWatchId != null
    ) {
      return;
    }

    this.driverGeoWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = Number(position.coords.latitude);
        const lon = Number(position.coords.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return;
        }

        this.chauffeur = {
          ...(this.chauffeur as Chauffeur),
          positionActuelle: {
            ...(this.chauffeur?.positionActuelle ?? {}),
            latitude: lat,
            longitude: lon,
          },
        };

        if (!this.shouldPushLocation(lat, lon)) {
          return;
        }

        const positionUpdate = {
          idLocalisation: this.chauffeur?.positionActuelle?.idLocalisation,
          latitude: lat,
          longitude: lon,
        };

        this.chauffeurService
          .updatePosition(this.chauffeurId!, positionUpdate)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (updated) => {
              this.chauffeur = updated;
            },
          });

        this.websocketService.sendLocationUpdate({
          chauffeurId: this.chauffeurId!,
          actorType: 'CHAUFFEUR',
          latitude: lat,
          longitude: lon,
          timestamp: new Date().toISOString(),
        });

        this.lastLocationPushAt = Date.now();
        this.lastPushedCoords = { lat, lon };
      },
      () => {
        // Ignore geolocation errors to avoid interrupting dashboard usage.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    );
  }

  private stopLiveLocationTracking(): void {
    if (this.driverGeoWatchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.driverGeoWatchId);
      this.driverGeoWatchId = null;
    }
  }

  private shouldPushLocation(lat: number, lon: number): boolean {
    const now = Date.now();
    if (now - this.lastLocationPushAt < this.minLocationPushIntervalMs) {
      return false;
    }

    if (!this.lastPushedCoords) {
      return true;
    }

    const movedMeters = this.calculateDistanceMeters(
      this.lastPushedCoords.lat,
      this.lastPushedCoords.lon,
      lat,
      lon,
    );

    return movedMeters >= this.minLocationPushDistanceMeters;
  }

  private calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadius = 6371000;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  }
  private loadChauffeurData(): void {
    if (!this.chauffeurId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.chauffeurService
      .getProfil(this.chauffeurId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ch) => {
          this.chauffeur = ch;
          this.isOnline = ch.disponibilite === DisponibiliteStatut.AVAILABLE;
          this.updateOnlineDisplay();
          this.loadStats();
          this.checkActiveCourse();
          this.isLoading = false;
        },
        error: () => {
          this.notificationService.error(
            'Erreur',
            'Impossible de charger le profil',
          );
          this.isLoading = false;
        },
      });
  }

  private loadStats(): void {
    if (!this.chauffeurId) {
      return;
    }

    this.chauffeurService
      .getDashboardStats(this.chauffeurId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((stats) => (this.stats = stats));
  }

  private loadRecentEvaluations(): void {
    if (!this.currentUserId && !this.chauffeurId) {
      return;
    }

    this.isLoadingEvaluations = true;
    const historyCourses$ = this.chauffeurId
      ? this.chauffeurService.getHistoriqueCourses(this.chauffeurId)
      : of([] as any[]);

    forkJoin({
      evaluations: this.evaluationService.getAllEvaluations(),
      courses: historyCourses$,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ evaluations, courses }) => {
          const chauffeurCourseIds = new Set(
            (courses ?? [])
              .map((course: any) => Number(course?.idCourse))
              .filter((id: number) => id > 0),
          );

          const filtered = (evaluations ?? [])
            .filter((evaluation) => {
              const evaluationCourseId =
                this.resolveEvaluationCourseId(evaluation);
              const evaluatedUserId = this.resolveEvaluatedUserId(evaluation);
              const type = this.normalizeEvaluationType(evaluation);
              const isForChauffeurCourses =
                Number.isFinite(evaluationCourseId) &&
                chauffeurCourseIds.has(evaluationCourseId);

              return (
                type === EvaluationType.CLIENT_TO_DRIVER &&
                (evaluatedUserId === Number(this.currentUserId) ||
                  isForChauffeurCourses)
              );
            })
            .sort((a, b) => {
              const left = new Date(a.dateCreation ?? '').getTime() || 0;
              const right = new Date(b.dateCreation ?? '').getTime() || 0;
              return right - left;
            });

          this.recentEvaluations = filtered.slice(0, 3);
          if (!filtered.length || !this.chauffeurId) {
            this.smartReviewSummary = null;
            this.isLoadingEvaluations = false;
            return;
          }

          this.reviewSummaryAiService
            .summarizeDriverReviews(
              this.chauffeurId,
              filtered,
              'vos avis clients',
            )
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (summary) => {
                this.smartReviewSummary = summary;
                this.isLoadingEvaluations = false;
              },
              error: () => {
                this.smartReviewSummary = null;
                this.isLoadingEvaluations = false;
              },
            });
        },
        error: () => {
          this.recentEvaluations = [];
          this.smartReviewSummary = null;
          this.isLoadingEvaluations = false;
        },
      });
  }

  private resolveEvaluationCourseId(evaluation: EvaluationTransport): number {
    const anyEvaluation = evaluation as any;
    const directCandidates = [
      anyEvaluation?.course?.idCourse,
      anyEvaluation?.courseId,
      anyEvaluation?.idCourse,
    ];

    for (const candidate of directCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return NaN;
  }

  private resolveEvaluatedUserId(evaluation: EvaluationTransport): number {
    const anyEvaluation = evaluation as any;
    const directCandidates = [
      anyEvaluation?.evalue?.id,
      anyEvaluation?.evalue?.idUser,
      anyEvaluation?.evalue?.idUtilisateur,
      anyEvaluation?.evalue?.utilisateur?.id,
      anyEvaluation?.evalueId,
      anyEvaluation?.idEvalue,
    ];

    for (const candidate of directCandidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    const courseUserId = Number(
      anyEvaluation?.course?.chauffeur?.utilisateur?.id ??
        anyEvaluation?.course?.chauffeur?.utilisateurId ??
        anyEvaluation?.course?.demande?.chauffeur?.utilisateur?.id ??
        0,
    );

    return Number.isFinite(courseUserId) && courseUserId > 0
      ? courseUserId
      : NaN;
  }

  private normalizeEvaluationType(evaluation: EvaluationTransport): string {
    const anyEvaluation = evaluation as any;
    return String(
      anyEvaluation?.type ??
        anyEvaluation?.evaluationType ??
        anyEvaluation?.typeEvaluation ??
        '',
    ).toUpperCase();
  }

  private startPollingStats(): void {
    if (!this.chauffeurId) {
      return;
    }

    interval(15000)
      .pipe(
        startWith(0),
        takeUntil(this.destroy$),
        switchMap(() =>
          this.chauffeurService.getDashboardStats(this.chauffeurId!),
        ),
      )
      .subscribe({
        next: (stats) => {
          this.stats = stats;
        },
        error: (err) => {
          console.error('Erreur polling stats chauffeur:', err);
        },
      });
  }

  private checkActiveCourse(): void {
    if (!this.chauffeurId) {
      return;
    }

    this.chauffeurService
      .getCourseActive(this.chauffeurId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((course) => (this.hasActiveCourse = !!course));
  }

  private connectWebSocket(): void {
    if (!this.chauffeurId) {
      return;
    }

    this.websocketService.connect(this.chauffeurId);
  }

  private setupNotifications(): void {
    this.websocketService.driverNotifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notif: DriverNotificationDTO) => {
        const notifType = String(notif.type || '').toUpperCase();
        const isCourseProposal = [
          'NEW_COURSE',
          'COURSE_PROPOSED',
          'MATCHING_PROPOSED',
        ].includes(notifType);

        if (isCourseProposal && notif.data) {
          this.handleNewMatching(
            this.normalizeIncomingNotification(notif.data),
          );
        } else if (isCourseProposal) {
          this.refreshMatchingsOnce();
        } else if (notifType === 'COURSE_CANCELLED') {
          const cancelledDemandeId = this.extractDemandeId(notif.data);
          const cancelledMatchingId = Number(
            notif.data?.idMatching ??
              notif.data?.matchingId ??
              notif.data?.id ??
              0,
          );

          if (cancelledMatchingId > 0) {
            this.removeMatching(cancelledMatchingId);
          }

          if (cancelledDemandeId > 0) {
            this.pendingMatchings = this.pendingMatchings.filter(
              (item) => item.idDemande !== cancelledDemandeId,
            );
          }
        }
        this.notificationService.handleDriverNotification(notif);
      });
  }

  private refreshMatchingsOnce(): void {
    if (!this.chauffeurId) {
      return;
    }

    this.matchingService
      .getMatchingsByChauffeur(this.chauffeurId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (all) => this.applyMatchings(all),
      });
  }

  private applyMatchings(allMatchings: Matching[]): void {
    const currentMatchings = allMatchings.filter((m) =>
      this.isMatchingForCurrentDriver(m),
    );

    this.pendingMatchings = currentMatchings
      .map((m) => this.toMatchingNotification(m))
      .filter((item) => item.idDemande > 0)
      .filter((item) => this.isMatchingNotificationTypeAllowed(item));
    this.enrichPendingMatchingsDetails();
  }

  private refreshActiveVehicleTypes(): void {
    if (!this.chauffeurId) {
      return;
    }

    this.chauffeurService
      .getVehicules(this.chauffeurId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vehicules) => {
          const types = (vehicules || [])
            .filter((v) => v?.statut === VehiculeStatut.ACTIVE)
            .map((v) => this.normalizeVehicleType(v?.typeVehicule))
            .filter((t): t is string => !!t);

          this.activeVehicleTypes = new Set(types);
          this.pendingMatchings = this.pendingMatchings.filter((item) =>
            this.isMatchingNotificationTypeAllowed(item),
          );
        },
      });
  }

  private normalizeVehicleType(value: unknown): string | null {
    if (value == null) {
      return null;
    }

    const normalized = String(value).trim().toUpperCase();
    if (
      normalized === 'ECONOMY' ||
      normalized === 'PREMIUM' ||
      normalized === 'VAN'
    ) {
      return normalized;
    }

    return null;
  }

  private isMatchingNotificationTypeAllowed(
    matching: MatchingNotification,
  ): boolean {
    if (this.activeVehicleTypes.size === 0) {
      return true;
    }

    const requestedType = this.normalizeVehicleType(matching.typeVehicule);
    if (!requestedType) {
      return true;
    }

    return this.activeVehicleTypes.has(requestedType);
  }

  private extractMatchingIds(m: Matching): {
    driverId: unknown;
    userId: unknown;
  } {
    const driverId =
      m.chauffeur?.idChauffeur ??
      (m as any).chauffeurId ??
      (m as any).idChauffeur ??
      (m as any).id_chauffeur ??
      (m as any).chauffeur?.id ??
      (m.demande as any)?.chauffeurId ??
      (m.demande as any)?.idChauffeur ??
      null;

    const userId =
      m.chauffeur?.utilisateurId ??
      (m as any).chauffeur?.utilisateurId ??
      (m as any).chauffeur?.id_utilisateur ??
      (m as any).chauffeur?.utilisateur?.id ??
      null;

    return { driverId, userId };
  }

  private isMatchingForCurrentDriver(m: Matching): boolean {
    const rawStatus = String((m as any).statut ?? '').toUpperCase();
    const isProposedStatus = [
      'PROPOSED',
      'MATCHING',
      'PENDING',
      'PENDING_MATCHING',
      'WAITING',
    ].includes(rawStatus);

    const ids = this.extractMatchingIds(m);
    const matchingDriverId = ids.driverId;
    const matchingUserId = ids.userId;

    const normalizedDriverId =
      matchingDriverId != null ? Number(matchingDriverId) : null;
    const normalizedCurrentDriverId =
      this.chauffeurId != null ? Number(this.chauffeurId) : null;

    const normalizedUserId =
      matchingUserId != null ? Number(matchingUserId) : null;
    const normalizedCurrentUserId =
      this.currentUserId != null ? Number(this.currentUserId) : null;

    const fromScopedEndpoint = (m as any).__scopedToChauffeur === true;
    const hasNoDriverOrUserId =
      normalizedDriverId == null && normalizedUserId == null;

    if (isProposedStatus && fromScopedEndpoint && hasNoDriverOrUserId) {
      return true;
    }

    return (
      isProposedStatus &&
      ((normalizedDriverId != null &&
        normalizedCurrentDriverId != null &&
        normalizedDriverId === normalizedCurrentDriverId) ||
        (normalizedUserId != null &&
          normalizedCurrentUserId != null &&
          normalizedUserId === normalizedCurrentUserId))
    );
  }

  private toMatchingNotification(m: Matching): MatchingNotification {
    const raw = m as any;
    const extractedDemandeId = this.extractDemandeId(raw);
    const demande =
      raw?.demande ?? raw?.demandeCourse ?? raw?.courseRequest ?? {};
    const localisationDepart =
      demande?.localisationDepart ??
      demande?.depart ??
      raw?.localisationDepart ??
      raw?.depart ??
      {};
    const localisationArrivee =
      demande?.localisationArrivee ??
      demande?.arrivee ??
      raw?.localisationArrivee ??
      raw?.arrivee ??
      {};

    return {
      idMatching: m.idMatching,
      idDemande: extractedDemandeId,
      adresseDepart: this.firstNonEmptyString(
        demande?.localisationDepart?.adresse,
        localisationDepart?.adresse,
        localisationDepart?.address,
        raw?.adresseDepart,
        raw?.departureAddress,
        raw?.pickupAddress,
      ),
      adresseArrivee: this.firstNonEmptyString(
        demande?.localisationArrivee?.adresse,
        localisationArrivee?.adresse,
        localisationArrivee?.address,
        raw?.adresseArrivee,
        raw?.arrivalAddress,
        raw?.dropoffAddress,
      ),
      prixEstime: this.firstFiniteNumber(
        demande?.prixEstime,
        raw?.prixEstime,
        raw?.estimatedPrice,
        raw?.montant,
        0,
      ),
      typeVehicule: this.firstNonEmptyString(
        demande?.typeVehiculeDemande,
        raw?.typeVehicule,
        raw?.vehicleType,
        'Standard',
      ),
      clientNom: this.firstNonEmptyString(
        demande?.client?.username,
        demande?.client?.nom,
        raw?.clientNom,
        raw?.clientName,
        raw?.client?.username,
        raw?.client?.nom,
        'Client anonyme',
      ),
      distanceKm: this.firstFiniteNumber(raw?.distanceKm, raw?.distance, 0),
      tempsEstimeMinutes: this.firstFiniteNumber(
        raw?.tempsEstimeMinutes,
        raw?.dureeEstimeeMinutes,
        raw?.estimatedDurationMinutes,
        0,
      ),
    };
  }

  private normalizeIncomingNotification(data: any): MatchingNotification {
    const extractedDemandeId = this.extractDemandeId(data);
    const demande =
      data?.demande ?? data?.demandeCourse ?? data?.courseRequest ?? {};
    const localisationDepart =
      demande?.localisationDepart ??
      demande?.depart ??
      data?.localisationDepart ??
      data?.depart ??
      {};
    const localisationArrivee =
      demande?.localisationArrivee ??
      demande?.arrivee ??
      data?.localisationArrivee ??
      data?.arrivee ??
      {};

    return {
      idMatching: Number(data?.idMatching ?? data?.id ?? 0),
      idDemande: extractedDemandeId,
      adresseDepart: this.firstNonEmptyString(
        data?.adresseDepart,
        data?.departureAddress,
        data?.pickupAddress,
        demande?.localisationDepart?.adresse,
        localisationDepart?.adresse,
        localisationDepart?.address,
      ),
      adresseArrivee: this.firstNonEmptyString(
        data?.adresseArrivee,
        data?.arrivalAddress,
        data?.dropoffAddress,
        demande?.localisationArrivee?.adresse,
        localisationArrivee?.adresse,
        localisationArrivee?.address,
      ),
      prixEstime: this.firstFiniteNumber(
        data?.prixEstime,
        data?.estimatedPrice,
        data?.montant,
        demande?.prixEstime,
        0,
      ),
      typeVehicule: this.firstNonEmptyString(
        data?.typeVehicule,
        data?.vehicleType,
        demande?.typeVehiculeDemande,
        'Standard',
      ),
      clientNom: this.firstNonEmptyString(
        data?.clientNom,
        data?.clientName,
        demande?.client?.username,
        demande?.client?.nom,
        data?.client?.username,
        data?.client?.nom,
        'Client anonyme',
      ),
      distanceKm: this.firstFiniteNumber(data?.distanceKm, data?.distance, 0),
      tempsEstimeMinutes: this.firstFiniteNumber(
        data?.tempsEstimeMinutes,
        data?.dureeEstimeeMinutes,
        data?.estimatedDurationMinutes,
        0,
      ),
    };
  }

  private firstNonEmptyString(...values: unknown[]): string {
    for (const value of values) {
      if (value == null) {
        continue;
      }

      const normalized = String(value).trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }

    return 'Non disponible';
  }

  private firstFiniteNumber(...values: unknown[]): number {
    for (const value of values) {
      if (value == null || value === '') {
        continue;
      }

      const normalized = Number(value);
      if (Number.isFinite(normalized)) {
        return normalized;
      }
    }

    return 0;
  }

  private extractDemandeId(source: any): number {
    const demandeValue = source?.demande;

    return this.firstFiniteNumber(
      source?.idDemande,
      source?.demandeId,
      source?.id_demande,
      source?.demande_course_id,
      source?.demandeCourseId,
      typeof demandeValue === 'number' || typeof demandeValue === 'string'
        ? demandeValue
        : null,
      source?.demande?.idDemande,
      source?.demande?.id,
      source?.demande?.id_demande,
      source?.demandeCourse?.idDemande,
      source?.demandeCourse?.id,
      source?.courseRequest?.idDemande,
      source?.courseRequest?.id,
      0,
    );
  }

  private handleNewMatching(matching: MatchingNotification): void {
    if (!this.isMatchingNotificationTypeAllowed(matching)) {
      return;
    }

    this.pendingMatchings.unshift(matching);
    if (this.pendingMatchings.length > 5) this.pendingMatchings.pop();
    this.enrichPendingMatchingsDetails();
    this.notificationService.playNewRideSound();
  }

  private enrichPendingMatchingsDetails(): void {
    const missingInfoDemandes = Array.from(
      new Set(
        this.pendingMatchings
          .filter((m) => this.needsDemandeEnrichment(m) && m.idDemande > 0)
          .map((m) => m.idDemande),
      ),
    );

    const missingInfoMatchings = Array.from(
      new Set(
        this.pendingMatchings
          .filter((m) => this.needsDemandeEnrichment(m) && m.idMatching > 0)
          .map((m) => m.idMatching),
      ),
    );

    for (const demandeId of missingInfoDemandes) {
      const cached = this.demandeDetailsCache.get(demandeId);
      if (cached) {
        this.applyDemandeToPendingMatchings(demandeId, cached);
        continue;
      }

      this.demandeCourseService
        .getDemandeById(demandeId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (demande) => {
            this.demandeDetailsCache.set(demandeId, demande);
            this.applyDemandeToPendingMatchings(demandeId, demande);
          },
          error: () => {},
        });
    }

    for (const matchingId of missingInfoMatchings) {
      const cached = this.matchingDetailsCache.get(matchingId);
      if (cached) {
        this.applyMatchingDetailsToPending(matchingId, cached);
        continue;
      }

      this.matchingService
        .getMatchingById(matchingId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (matchingDetails) => {
            this.matchingDetailsCache.set(matchingId, matchingDetails);
            this.applyMatchingDetailsToPending(matchingId, matchingDetails);

            const resolvedDemandeId = Number(
              this.extractDemandeId(matchingDetails),
            );

            if (
              resolvedDemandeId > 0 &&
              !this.demandeDetailsCache.has(resolvedDemandeId)
            ) {
              this.demandeCourseService
                .getDemandeById(resolvedDemandeId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (demande) => {
                    this.demandeDetailsCache.set(resolvedDemandeId, demande);
                    this.applyDemandeToPendingMatchings(
                      resolvedDemandeId,
                      demande,
                    );
                  },
                });
            } else if (!this.demandeDetailsCache.has(matchingId)) {
              // Some backends return matching.id and demande.id with same numeric value.
              this.demandeCourseService
                .getDemandeById(matchingId)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: (demande) => {
                    this.demandeDetailsCache.set(matchingId, demande);
                    this.applyDemandeToPendingMatchings(matchingId, demande);
                  },
                });
            }
          },
          error: () => {},
        });
    }
  }

  private needsDemandeEnrichment(m: MatchingNotification): boolean {
    return (
      !m.adresseDepart ||
      m.adresseDepart === 'Non disponible' ||
      !m.adresseArrivee ||
      m.adresseArrivee === 'Non disponible' ||
      !m.clientNom ||
      m.clientNom === 'Client anonyme' ||
      m.prixEstime <= 0 ||
      !m.typeVehicule ||
      m.typeVehicule === 'Standard'
    );
  }

  private applyDemandeToPendingMatchings(
    demandeId: number,
    demande: any,
  ): void {
    const demandePayload =
      demande?.demande ?? demande?.data?.demande ?? demande?.data ?? demande;

    const demandeStatus = String(
      demandePayload?.statut ?? demandePayload?.status ?? '',
    ).toUpperCase();

    if (demandeStatus === 'CANCELLED') {
      this.pendingMatchings = this.pendingMatchings.filter(
        (item) => item.idDemande !== demandeId,
      );
      return;
    }

    this.pendingMatchings = this.pendingMatchings.map((item) => {
      if (item.idDemande !== demandeId) {
        return item;
      }

      const depart = this.firstNonEmptyString(
        demandePayload?.localisationDepart?.adresse,
        demandePayload?.localisationDepart?.address,
        item.adresseDepart,
      );

      const arrivee = this.firstNonEmptyString(
        demandePayload?.localisationArrivee?.adresse,
        demandePayload?.localisationArrivee?.address,
        item.adresseArrivee,
      );

      const prix = this.firstFiniteNumber(
        demandePayload?.prixEstime,
        item.prixEstime,
        0,
      );

      const client = this.firstNonEmptyString(
        demandePayload?.client?.username,
        demandePayload?.client?.nom,
        item.clientNom,
      );

      const typeVehicule = this.firstNonEmptyString(
        demandePayload?.typeVehiculeDemande,
        item.typeVehicule,
      );

      return {
        ...item,
        adresseDepart: depart,
        adresseArrivee: arrivee,
        prixEstime: prix,
        clientNom: client,
        typeVehicule,
      };
    });
  }

  private applyMatchingDetailsToPending(
    matchingId: number,
    matchingDetails: any,
  ): void {
    const demande =
      matchingDetails?.demande ??
      matchingDetails?.demandeCourse ??
      matchingDetails?.courseRequest ??
      {};

    const demandeStatus = String(
      demande?.statut ??
        demande?.status ??
        matchingDetails?.demandeStatut ??
        '',
    ).toUpperCase();

    if (demandeStatus === 'CANCELLED') {
      this.removeMatching(matchingId);
      return;
    }

    this.pendingMatchings = this.pendingMatchings.map((item) => {
      if (item.idMatching !== matchingId) {
        return item;
      }

      const demandeId = this.firstFiniteNumber(
        item.idDemande,
        this.extractDemandeId(matchingDetails),
        demande?.idDemande,
        demande?.id,
        matchingDetails?.idDemande,
        matchingDetails?.demandeId,
        0,
      );

      const depart = this.firstNonEmptyString(
        demande?.localisationDepart?.adresse,
        demande?.localisationDepart?.address,
        matchingDetails?.adresseDepart,
        matchingDetails?.pickupAddress,
        item.adresseDepart,
      );

      const arrivee = this.firstNonEmptyString(
        demande?.localisationArrivee?.adresse,
        demande?.localisationArrivee?.address,
        matchingDetails?.adresseArrivee,
        matchingDetails?.dropoffAddress,
        item.adresseArrivee,
      );

      const prix = this.firstFiniteNumber(
        demande?.prixEstime,
        matchingDetails?.prixEstime,
        matchingDetails?.estimatedPrice,
        item.prixEstime,
        0,
      );

      const client = this.firstNonEmptyString(
        demande?.client?.username,
        demande?.client?.nom,
        matchingDetails?.clientNom,
        matchingDetails?.clientName,
        item.clientNom,
      );

      const typeVehicule = this.firstNonEmptyString(
        demande?.typeVehiculeDemande,
        matchingDetails?.typeVehicule,
        matchingDetails?.vehicleType,
        item.typeVehicule,
      );

      return {
        ...item,
        idDemande: Number(demandeId || 0),
        adresseDepart: depart,
        adresseArrivee: arrivee,
        prixEstime: prix,
        clientNom: client,
        typeVehicule,
      };
    });
  }

  toggleDisponibilite(): void {
    if (!this.chauffeurId) {
      return;
    }

    const action = this.isOnline
      ? this.chauffeurService.goOffline(this.chauffeurId)
      : this.chauffeurService.goOnline(this.chauffeurId);

    action.pipe(takeUntil(this.destroy$)).subscribe({
      next: (ch) => {
        this.chauffeur = ch;
        this.isOnline = ch.disponibilite === DisponibiliteStatut.AVAILABLE;
        this.updateOnlineDisplay();
        this.notificationService.success(
          'Statut',
          this.isOnline ? '✅ En ligne' : '⛔ Hors ligne',
        );
      },
      error: () =>
        this.notificationService.error(
          'Erreur',
          'Impossible de changer le statut',
        ),
    });
  }

  accepterMatching(m: MatchingNotification): void {
    if (this.acceptingMatchingId != null) {
      return;
    }

    this.acceptingMatchingId = m.idMatching;
    this.matchingService
      .acceptMatching(m.idMatching)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (course) => {
          this.courseService.setActiveCourse(course);
          this.notificationService.success(
            'Course acceptée !',
            'En attente de confirmation client',
          );
          this.removeMatching(m.idMatching);
          this.router.navigate(
            ['/transport/chauffeur-attente-confirmation-client'],
            {
              state: {
                course,
                courseId: course?.idCourse,
                demandeId: m.idDemande,
              },
              queryParams: {
                courseId: course?.idCourse,
                demandeId: m.idDemande,
              },
            },
          );
          this.acceptingMatchingId = null;
        },
        error: () => {
          this.notificationService.error('Erreur', 'Course déjà prise');
          this.removeMatching(m.idMatching);
          this.acceptingMatchingId = null;
        },
      });
  }

  rejeterMatching(m: MatchingNotification): void {
    this.matchingService
      .rejectMatching(m.idMatching)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.removeMatching(m.idMatching);
        this.notificationService.info('Refusé', 'Demande rejetée');
      });
  }

  private removeMatching(id: number): void {
    this.pendingMatchings = this.pendingMatchings.filter(
      (m) => m.idMatching !== id,
    );
  }

  private updateOnlineDisplay(): void {
    if (this.isOnline) this.startOnlineTimer();
    else this.stopOnlineTimer();
  }

  private startOnlineTimer(): void {
    let min = 0;
    this.onlineTimer = setInterval(() => {
      min++;
      const h = Math.floor(min / 60);
      const m = min % 60;
      this.tempsEnLigneDisplay = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }, 60000);
  }

  private stopOnlineTimer(): void {
    if (this.onlineTimer) clearInterval(this.onlineTimer);
    this.tempsEnLigneDisplay = '00:00';
  }

  getMapEmbedUrl(location: any): SafeResourceUrl | null {
    const lat = Number(location?.latitude);
    const lon = Number(location?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://maps.google.com/maps?hl=fr&q=${lat},${lon}&z=15&output=embed`,
    );
  }

  getMapLinkUrl(location: any): string | null {
    const lat = Number(location?.latitude);
    const lon = Number(location?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return `https://www.google.com/maps?hl=fr&q=${lat},${lon}`;
  }

  // ==================== FORMATTED VALUES ====================

  get revenusAujourdhuiFormatted(): string {
    return this.stats.revenusAujourdhui.toFixed(2);
  }

  get revenusSemaineFormatted(): string {
    return this.stats.revenusSemaine.toFixed(2);
  }

  get noteMoyenneFormatted(): string {
    return this.stats.noteMoyenne.toFixed(1);
  }

  getRatingStars(note: number): boolean[] {
    const rating = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
    return [1, 2, 3, 4, 5].map((star) => star <= rating);
  }

  formatReviewTopicLabel(value: string): string {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    const dictionary: Record<string, string> = {
      'la ponctualite': 'Ponctualité',
      'la proprete du vehicule': 'Propreté du véhicule',
      "l'accueil du chauffeur": 'Accueil du chauffeur',
      'la climatisation': 'Climatisation',
      'la conduite': 'Conduite',
      'la connaissance de la ville': 'Connaissance de la ville',
      'la connaissance locale du chauffeur': 'Connaissance locale du chauffeur',
      'le confort a bord': 'Confort à bord',
      'la conduite souple': 'Conduite souple',
      'le rapport qualite-prix': 'Rapport qualité-prix',
    };

    if (dictionary[normalized]) {
      return dictionary[normalized];
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  get soldeFormatted(): string {
    return this.chauffeur?.solde ? this.chauffeur.solde.toFixed(2) : '0.00';
  }

  // Navigation
  goToProfile() {
    this.router.navigate(['/transport/profil-chauffeur']);
  }
  goToVehicles(): void {
    this.router.navigate(['/transport/gestion-vehicules']);
  }
  goToEarnings() {
    this.router.navigate(['/transport/chauffeur-dashboard']);
  }
  goToWallet() {
    this.router.navigate(['/transport/chauffeur-portefeuille']);
  }
  goToActiveCourse() {
    if (this.hasActiveCourse)
      this.router.navigate(['/transport/chauffeur-course-active']);
  }
}

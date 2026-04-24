// src/app/features/transport/courses/client/attente-chauffeur/attente-chauffeur.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, interval, forkJoin } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { IMessage } from '@stomp/stompjs'; // ← AJOUTÉ

import { DemandeCourseService } from '../../../core/services/demande-course.service';
import { CourseService } from '../../../core/services/course.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import {
  ReviewSummaryAiService,
  DriverReviewDetail,
} from '../../../core/services/review-summary-ai.service';
import { SmartReviewSummary } from '../../../core/services/review-summary.service';
import {
  DemandeCourse,
  DemandeStatus,
  TypeVehicule,
} from '../../../core/models';

@Component({
  selector: 'app-attente-chauffeur',
  templateUrl: './attente-chauffeur.component.html',
  styleUrls: ['./attente-chauffeur.component.css'],
})
export class AttenteChauffeurComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private initialStateDemandeId?: number;
  private readonly mapDelta = 0.02;
  private readonly waitTimeoutSeconds = 60;
  private waitTickHandle: ReturnType<typeof setInterval> | null = null;
  private waitStartedAtMs: number | null = null;
  private isAutoCancelling = false;

  demande: DemandeCourse | null = null;
  demandeId!: number;
  isLoading = true;
  isConfirmingAcceptance = false;
  hasClientConfirmedAcceptance = false;
  isVehicleGalleryOpen = false;
  vehicleGalleryPhotos: string[] = [];
  vehicleGalleryIndex = 0;
  driverSmartReviewSummary: SmartReviewSummary | null = null;
  driverReviewsCount = 0;
  driverDetailedReviews: DriverReviewDetail[] = [];
  showAllDriverReviews = false;
  isLoadingDriverReviews = false;
  private loadedDriverId: number | null = null;

  // Final UI-friendly aliases requested for the clean summary block.
  smartSummary = '';
  nombreAvis = 0;
  noteMoyenne = 0;
  pointsForts: string[] = [];
  pointsSurveiller: string[] = [];
  reviews: Array<{
    email: string;
    date?: string;
    note: number;
    commentaire: string;
  }> = [];
  showAllReviews = false;
  isLoadingSummary = false;

  readonly DemandeStatus = DemandeStatus;

  /** Libellés pour l’affichage */
  readonly libelleStatut: Record<DemandeStatus, string> = {
    [DemandeStatus.PENDING]: 'En attente',
    [DemandeStatus.MATCHING]: 'Recherche de chauffeur',
    [DemandeStatus.ACCEPTED]: 'Acceptée',
    [DemandeStatus.CANCELLED]: 'Annulée',
    [DemandeStatus.EXPIRED]: 'Expirée',
  };

  readonly libelleTypeVehicule: Record<TypeVehicule, string> = {
    [TypeVehicule.ECONOMY]: 'Économie',
    [TypeVehicule.PREMIUM]: 'Premium',
    [TypeVehicule.VAN]: 'Van',
  };

  constructor(
    private demandeService: DemandeCourseService,
    private courseService: CourseService,
    private notificationService: NotificationService,
    private websocketService: WebsocketService,
    private chauffeurService: ChauffeurService,
    private reviewSummaryAiService: ReviewSummaryAiService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    const nav = this.router.getCurrentNavigation();
    this.initialStateDemandeId = nav?.extras?.state?.['demandeId'] as
      | number
      | undefined;
  }

  ngOnInit(): void {
    const fromState =
      this.initialStateDemandeId ??
      (history.state && (history.state as { demandeId?: number }).demandeId);
    const active = this.demandeService.getDemandeActive();
    const idFromActive = active?.idDemande ?? active?.id;
    const fromQuery = this.route.snapshot.queryParamMap.get('id');
    const parsed =
      fromState ??
      idFromActive ??
      (fromQuery != null ? Number(fromQuery) : NaN);

    this.demandeId = Number(parsed);
    if (!Number.isFinite(this.demandeId) || this.demandeId <= 0) {
      this.isLoading = false;
      this.notificationService.warning(
        'Demande',
        'Aucune demande identifiée. Créez une nouvelle demande.',
      );
      void this.router.navigate(['/transport/demander-course']);
      return;
    }

    this.hasClientConfirmedAcceptance = this.isAcceptanceConfirmed(
      this.demandeId,
    );

    this.loadDemande();
    this.connectWebSocketForDemande();
    this.startPolling();
  }

  private loadDemande(): void {
    this.demandeService.getDemandeById(this.demandeId).subscribe({
      next: (d) => {
        this.demande = d;
        this.isLoading = false;
        this.refreshDriverReviewSummary(d);
        this.syncWaitCountdownWithDemande(d);
        this.handleAcceptedDemande(d);
      },
      error: () => {
        this.isLoading = false;
        this.notificationService.error('Erreur', 'Demande introuvable');
      },
    });
  }

  private connectWebSocketForDemande(): void {
    this.websocketService.connect();

    // Attendre que la connexion soit établie avant de s'abonner
    this.websocketService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isConnected) => {
        if (isConnected) {
          this.websocketService.subscribe(
            `/topic/demande/${this.demandeId}`,
            (msg: IMessage) => {
              const update = JSON.parse(msg.body) as { statut?: string };
              this.demandeService
                .getDemandeById(this.demandeId)
                .subscribe((d) => {
                  this.demande = d;
                  this.refreshDriverReviewSummary(d);
                  this.syncWaitCountdownWithDemande(d);

                  if (update.statut === DemandeStatus.ACCEPTED) {
                    this.notificationService.success(
                      'Course trouvée !',
                      'Un chauffeur a accepté',
                    );
                  }

                  this.handleAcceptedDemande(d);
                });
            },
          );
        }
      });
  }

  // attente-chauffeur.component.ts
  private startPolling(): void {
    interval(5000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.demandeService.getDemandeById(this.demandeId)),
      )
      .subscribe((d) => {
        console.log('DEMANDE REÇUE DU POLLING :', d);
        console.log('OBJET COURSE DANS LA DEMANDE :', d.course); // <-- Si c'est null ici, le problème est à 100% le point n°1 ci-dessus.

        this.demande = d;
        this.refreshDriverReviewSummary(d);
        this.syncWaitCountdownWithDemande(d);
        this.handleAcceptedDemande(d);
      });
  }

  private refreshDriverReviewSummary(d: DemandeCourse | null): void {
    const driverId = this.resolveDriverId(d);

    if (!driverId) {
      this.loadedDriverId = null;
      this.driverSmartReviewSummary = null;
      this.driverReviewsCount = 0;
      this.driverDetailedReviews = [];
      this.showAllDriverReviews = false;
      this.isLoadingDriverReviews = false;
      return;
    }

    if (this.loadedDriverId === driverId) {
      return;
    }

    this.isLoadingDriverReviews = true;
    this.loadedDriverId = driverId;
    this.showAllDriverReviews = false;

    forkJoin({
      summary: this.reviewSummaryAiService.summarizeDriverReviews(
        driverId,
        [],
        'ce chauffeur',
      ),
      reviews: this.reviewSummaryAiService.getDriverClientReviews(driverId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ summary, reviews }) => {
          this.driverSmartReviewSummary = summary;
          this.driverDetailedReviews = reviews;
          this.driverReviewsCount = summary?.sourceCount ?? reviews.length ?? 0;
          this.syncSummaryViewModel(summary, reviews);
          void this.generateSmartSummary();
          this.isLoadingDriverReviews = false;
          this.isLoadingSummary = false;
        },
        error: () => {
          this.driverSmartReviewSummary = null;
          this.driverReviewsCount = 0;
          this.driverDetailedReviews = [];
          this.showAllDriverReviews = false;
          this.isLoadingDriverReviews = false;
          this.isLoadingSummary = false;
          this.syncSummaryViewModel(null, []);
        },
      });
  }

  toggleAllDriverReviews(): void {
    this.showAllDriverReviews = !this.showAllDriverReviews;
    this.showAllReviews = this.showAllDriverReviews;
  }

  toggleReviews(): void {
    this.toggleAllDriverReviews();
  }

  getStars(note: number): string {
    const safeNote = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
    return '★'.repeat(safeNote) + '☆'.repeat(5 - safeNote);
  }

  async generateSmartSummary(): Promise<void> {
    this.isLoadingSummary = true;
    const reviewPayload = this.reviews
      .map((review) => ({ commentaire: review.commentaire, note: review.note }))
      .filter((item) => !!String(item.commentaire || '').trim());

    try {
      const response = await fetch(
        'http://127.0.0.1:5000/summarize_driver_reviews',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviews: reviewPayload }),
        },
      );

      const data = await response.json();
      if (data?.success) {
        this.smartSummary = String(data.summary ?? this.smartSummary).trim();
        this.nombreAvis = Number(data.nombre_avis ?? this.reviews.length) || 0;
        this.noteMoyenne = this.reviews.length
          ? this.reviews.reduce((sum, review) => sum + (review.note || 0), 0) /
            this.reviews.length
          : 0;

        this.pointsForts = Array.isArray(data.points_forts)
          ? data.points_forts.map((value: string) =>
              this.formatTopicLabel(value),
            )
          : Array.isArray(data.highlights)
            ? data.highlights.map((value: string) =>
                this.formatTopicLabel(value),
              )
            : [];

        this.pointsSurveiller = Array.isArray(data.points_a_surveiller)
          ? data.points_a_surveiller.map((value: string) =>
              this.formatTopicLabel(value),
            )
          : Array.isArray(data.concerns)
            ? data.concerns.map((value: string) => this.formatTopicLabel(value))
            : [];
      }
    } catch {
      this.smartSummary = 'Erreur de connexion au serveur IA';
    } finally {
      this.isLoadingSummary = false;
    }
  }

  private syncSummaryViewModel(
    summary: SmartReviewSummary | null,
    reviews: DriverReviewDetail[],
  ): void {
    this.reviews = reviews.map((review) => ({
      email: review.evaluator || 'Client',
      date: review.dateCreation,
      note: review.note,
      commentaire: review.commentaire,
    }));
    this.nombreAvis = summary?.sourceCount ?? reviews.length ?? 0;
    this.noteMoyenne = summary?.averageNote ?? 0;
    this.smartSummary = summary?.summary ?? '';
    this.pointsForts = (summary?.highlights ?? []).map((item) =>
      this.formatTopicLabel(item),
    );
    this.pointsSurveiller = (summary?.concerns ?? []).map((item) =>
      this.formatTopicLabel(item),
    );
    this.showAllReviews = this.showAllDriverReviews;
  }

  private formatTopicLabel(value: string): string {
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
    };

    return (
      dictionary[normalized] ??
      normalized.charAt(0).toUpperCase() + normalized.slice(1)
    );
  }

  private resolveDriverId(d: DemandeCourse | null): number | null {
    const chauffeur: any = d?.course?.chauffeur;
    const candidates = [
      chauffeur?.idChauffeur,
      chauffeur?.id,
      chauffeur?.utilisateur?.id,
      chauffeur?.utilisateurId,
      chauffeur?.idUtilisateur,
      chauffeur?.userId,
    ];

    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  get showWaitCountdown(): boolean {
    return (
      !this.isLoading &&
      !this.isAutoCancelling &&
      !!this.demande &&
      (this.demande.statut === DemandeStatus.PENDING ||
        this.demande.statut === DemandeStatus.MATCHING)
    );
  }

  get waitSecondsLeft(): number {
    if (!this.waitStartedAtMs) {
      return this.waitTimeoutSeconds;
    }

    const elapsedSeconds = Math.floor(
      (Date.now() - this.waitStartedAtMs) / 1000,
    );
    const remaining = this.waitTimeoutSeconds - elapsedSeconds;
    return remaining > 0 ? remaining : 0;
  }

  confirmerCourseAcceptee(): void {
    if (
      !this.demande ||
      this.demande.statut !== DemandeStatus.ACCEPTED ||
      this.isConfirmingAcceptance
    ) {
      return;
    }

    this.isConfirmingAcceptance = true;
    this.demandeService.confirmAcceptedByClient(this.demandeId).subscribe({
      next: (updatedDemande) => {
        this.demande = updatedDemande;
        this.hasClientConfirmedAcceptance = true;
        this.saveAcceptanceConfirmation(this.demandeId);
        this.notificationService.success(
          'Confirmation reçue',
          'Votre course est confirmée. Redirection en cours...',
        );
        this.goToCourseActive(updatedDemande);
        this.isConfirmingAcceptance = false;
      },
      error: (err: Error) => {
        this.notificationService.error(
          'Confirmation',
          err?.message ?? 'Impossible de confirmer la course pour le moment.',
        );
        this.isConfirmingAcceptance = false;
      },
    });
  }

  annulerConfirmationCourseAcceptee(): void {
    if (
      !this.demande ||
      this.demande.statut !== DemandeStatus.ACCEPTED ||
      this.isConfirmingAcceptance
    ) {
      return;
    }

    this.isConfirmingAcceptance = true;
    this.demandeService.cancelAcceptedByClient(this.demandeId).subscribe({
      next: (updatedDemande) => {
        this.demande = updatedDemande;
        this.hasClientConfirmedAcceptance = false;
        this.notificationService.cancellation(
          'Proposition annulée',
          'Nous relançons la recherche d’autres chauffeurs.',
        );
        this.isConfirmingAcceptance = false;
      },
      error: (err: Error) => {
        this.notificationService.error(
          'Annulation',
          err?.message ?? 'Impossible d’annuler cette proposition.',
        );
        this.isConfirmingAcceptance = false;
      },
    });
  }

  get requiresAcceptanceConfirmation(): boolean {
    return (
      this.demande?.statut === DemandeStatus.ACCEPTED &&
      !this.hasClientConfirmedAcceptance
    );
  }

  annulerDemande(): void {
    if (confirm('Voulez-vous vraiment annuler la demande ?')) {
      this.stopWaitCountdown();
      this.demandeService
        .updateStatut(this.demandeId, DemandeStatus.CANCELLED)
        .subscribe({
          next: () => {
            this.demandeService.clearDemandeActive();
            this.notificationService.cancellation(
              'Annulée',
              'Votre demande a été annulée',
            );
            void this.router.navigate(['/transport/demander-course']);
          },
          error: (err: Error) => {
            this.notificationService.error(
              'Annulation',
              err?.message ?? 'Impossible d’annuler la demande.',
            );
          },
        });
    }
  }

  private syncWaitCountdownWithDemande(d: DemandeCourse): void {
    const waitingForDriver =
      d.statut === DemandeStatus.PENDING || d.statut === DemandeStatus.MATCHING;

    if (!waitingForDriver) {
      this.clearWaitStartStorage();
      this.stopWaitCountdown();
      return;
    }

    this.ensureWaitCountdownStarted();
  }

  private ensureWaitCountdownStarted(): void {
    if (!this.waitStartedAtMs) {
      const storageValue = this.readWaitStartStorage();
      this.waitStartedAtMs =
        storageValue && Number.isFinite(storageValue)
          ? storageValue
          : Date.now();
      this.saveWaitStartStorage(this.waitStartedAtMs);
    }

    if (this.waitTickHandle) {
      return;
    }

    this.waitTickHandle = setInterval(() => {
      if (this.waitSecondsLeft <= 0) {
        this.handleWaitTimeoutReached();
      }
    }, 1000);
  }

  private stopWaitCountdown(): void {
    if (this.waitTickHandle) {
      clearInterval(this.waitTickHandle);
      this.waitTickHandle = null;
    }
    this.waitStartedAtMs = null;
  }

  private handleWaitTimeoutReached(): void {
    if (
      this.isAutoCancelling ||
      !this.demande ||
      (this.demande.statut !== DemandeStatus.PENDING &&
        this.demande.statut !== DemandeStatus.MATCHING)
    ) {
      return;
    }

    this.isAutoCancelling = true;
    this.stopWaitCountdown();

    this.demandeService
      .updateStatut(this.demandeId, DemandeStatus.CANCELLED)
      .subscribe({
        next: () => {
          this.clearWaitStartStorage();
          this.demandeService.clearDemandeActive();
          this.notificationService.cancellation(
            'Temps dépassé',
            'Aucun chauffeur trouvé en 60 secondes. Vous pouvez refaire une demande.',
          );
          void this.router.navigate(['/transport/demander-course']);
        },
        error: (err: Error) => {
          this.isAutoCancelling = false;
          this.notificationService.error(
            'Expiration',
            err?.message ?? 'Impossible d annuler automatiquement la demande.',
          );
        },
      });
  }

  private getWaitStartStorageKey(): string {
    return `transport:demande:${this.demandeId}:wait-start-ms`;
  }

  private readWaitStartStorage(): number | null {
    try {
      const raw = localStorage.getItem(this.getWaitStartStorageKey());
      if (!raw) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private saveWaitStartStorage(value: number): void {
    try {
      localStorage.setItem(this.getWaitStartStorageKey(), String(value));
    } catch {
      // Ignore storage failures.
    }
  }

  private clearWaitStartStorage(): void {
    try {
      localStorage.removeItem(this.getWaitStartStorageKey());
    } catch {
      // Ignore storage failures.
    }
  }

  private goToCourseActive(d?: DemandeCourse | null): void {
    const demande = d ?? this.demande;
    console.log('Tentative de redirection. Objet demande complet :', demande);
    const course = demande?.course;

    if (course) {
      console.log('Course trouvée, ID:', course.idCourse);
      this.courseService.setActiveCourse(course);
      void this.router.navigate(['/transport/course-active']);
    } else {
      console.error(
        "ERREUR : La demande est ACCEPTED mais l'objet 'course' est NULL ou UNDEFINED",
      );
    }
  }

  private handleAcceptedDemande(d: DemandeCourse): void {
    if (d.statut !== DemandeStatus.ACCEPTED) {
      return;
    }

    this.hasClientConfirmedAcceptance =
      this.hasClientConfirmedAcceptance ||
      this.isAcceptanceConfirmed(this.demandeId);

    if (!this.hasClientConfirmedAcceptance) {
      return;
    }

    if (d.course) {
      this.goToCourseActive(d);
    }
  }

  private getAcceptanceStorageKey(demandeId: number): string {
    return `transport:demande:${demandeId}:accepted-confirmed`;
  }

  private isAcceptanceConfirmed(demandeId: number): boolean {
    try {
      return (
        localStorage.getItem(this.getAcceptanceStorageKey(demandeId)) === '1'
      );
    } catch {
      return false;
    }
  }

  private saveAcceptanceConfirmation(demandeId: number): void {
    try {
      localStorage.setItem(this.getAcceptanceStorageKey(demandeId), '1');
    } catch {
      // Ignore storage failures and keep in-memory confirmation only.
    }
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

  getDriverDisplayName(d: DemandeCourse | null): string {
    const chauffeur: any = d?.course?.chauffeur;
    const displayName =
      chauffeur?.nomAffichage ??
      chauffeur?.utilisateur?.username ??
      (chauffeur?.idChauffeur ? `Chauffeur #${chauffeur.idChauffeur}` : null);

    return displayName || 'Chauffeur';
  }

  getDriverVehiclePhotoUrl(d: DemandeCourse | null): string | null {
    const photos = this.getDriverVehiclePhotos(d);
    const firstPhoto = photos.length > 0 ? photos[0] : null;

    if (!firstPhoto) {
      return null;
    }

    return firstPhoto;
  }

  getDriverVehiclePhotos(d: DemandeCourse | null): string[] {
    const vehicule: any = d?.course?.vehicule;
    return this.extractVehiculePhotos(vehicule).map((path) =>
      this.resolveUploadUrl(path),
    );
  }

  openDriverVehicleGallery(d: DemandeCourse | null, startIndex = 0): void {
    const photos = this.getDriverVehiclePhotos(d);
    if (!photos.length) {
      return;
    }

    this.vehicleGalleryPhotos = photos;
    this.vehicleGalleryIndex = Math.max(
      0,
      Math.min(startIndex, photos.length - 1),
    );
    this.isVehicleGalleryOpen = true;
  }

  closeDriverVehicleGallery(): void {
    this.isVehicleGalleryOpen = false;
    this.vehicleGalleryPhotos = [];
    this.vehicleGalleryIndex = 0;
  }

  prevVehicleGalleryPhoto(): void {
    if (!this.vehicleGalleryPhotos.length) {
      return;
    }

    this.vehicleGalleryIndex =
      (this.vehicleGalleryIndex - 1 + this.vehicleGalleryPhotos.length) %
      this.vehicleGalleryPhotos.length;
  }

  nextVehicleGalleryPhoto(): void {
    if (!this.vehicleGalleryPhotos.length) {
      return;
    }

    this.vehicleGalleryIndex =
      (this.vehicleGalleryIndex + 1) % this.vehicleGalleryPhotos.length;
  }

  getCurrentVehicleGalleryPhoto(): string {
    if (!this.vehicleGalleryPhotos.length) {
      return '';
    }

    return this.vehicleGalleryPhotos[this.vehicleGalleryIndex];
  }

  private extractVehiculePhotos(vehicule: any): string[] {
    const current = vehicule?.photoUrls;
    const serialized = vehicule?.photoUrlsSerialized;

    const fromArray = Array.isArray(current)
      ? (current.filter((p: unknown) => typeof p === 'string') as string[])
      : [];

    // Happy path: proper array of file paths.
    const directArrayPaths = fromArray
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p.includes('/'));
    if (directArrayPaths.length > 0) {
      return Array.from(new Set(directArrayPaths));
    }

    // Build raw payload from known sources and extract paths with regex fallback.
    const rawCandidates: string[] = [];

    if (fromArray.length > 0) {
      rawCandidates.push(fromArray.join(''));
    }

    if (typeof current === 'string' && current.trim().length > 0) {
      rawCandidates.push(current);
    }

    if (typeof serialized === 'string' && serialized.trim().length > 0) {
      rawCandidates.push(serialized);
    }

    const extractedPaths: string[] = [];
    const pathRegex = /vehicules\/\d+\/[^|\s]+?\.(?:png|jpe?g|webp|gif)/gi;

    for (const raw of rawCandidates) {
      if (!raw) {
        continue;
      }

      const splitPaths = raw
        .split('||')
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.includes('/') && p.includes('.'));

      if (splitPaths.length > 0) {
        extractedPaths.push(...splitPaths);
      }

      const regexMatches = raw.match(pathRegex) || [];
      if (regexMatches.length > 0) {
        extractedPaths.push(...regexMatches);
      }

      const compacted = raw.replace(/\|\|/g, '');
      const compactedMatches = compacted.match(pathRegex) || [];
      if (compactedMatches.length > 0) {
        extractedPaths.push(...compactedMatches);
      }
    }

    const normalized = Array.from(
      new Set(extractedPaths.map((p) => p.trim()).filter((p) => p.length > 0)),
    );

    return normalized;
  }

  private resolveUploadUrl(path: string): string {
    if (!path) {
      return '';
    }

    return this.chauffeurService.getPublicUploadUrl(path);
  }

  ngOnDestroy(): void {
    this.stopWaitCountdown();
    this.destroy$.next();
    this.destroy$.complete();
  }
}

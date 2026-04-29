import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, interval, of } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { CourseService } from '../../../core/services/course.service';
import { DemandeCourseService } from '../../../core/services/demande-course.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WebsocketService } from '../../../core/services/websocket.service';
import { Course, CourseStatus } from '../../../core/models';
import { AuthService } from '../../../../../services/auth.service';

@Component({
  selector: 'app-attente-confirmation-client',
  templateUrl: './attente-confirmation-client.component.html',
  styleUrls: ['./attente-confirmation-client.component.css'],
})
export class AttenteConfirmationClientComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly confirmationTimeoutSeconds = 60;
  private timeoutHandle: ReturnType<typeof setInterval> | null = null;

  course: Course | null = null;
  courseId = 0;
  demandeId = 0;
  isLoading = true;
  hasRedirected = false;
  secondsLeft = 60;
  isAutoCancelling = false;

  protected readonly courseStatus = CourseStatus;

  constructor(
    private courseService: CourseService,
    private demandeCourseService: DemandeCourseService,
    private websocketService: WebsocketService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const stateCourse = history.state?.course as Course | undefined;
    const stateCourseId = Number(
      history.state?.courseId ?? stateCourse?.idCourse ?? 0,
    );

    const activeCourse = this.courseService.getCourseActive();
    const activeCourseId = Number(activeCourse?.idCourse ?? 0);

    const queryCourseId = Number(
      this.route.snapshot.queryParamMap.get('courseId') ?? 0,
    );
    const stateDemandeId = Number(history.state?.demandeId ?? 0);
    const queryDemandeId = Number(
      this.route.snapshot.queryParamMap.get('demandeId') ?? 0,
    );

    this.course = stateCourse ?? activeCourse ?? null;
    this.courseId = stateCourseId || activeCourseId || queryCourseId;
    this.demandeId =
      stateDemandeId || queryDemandeId || this.extractDemandeId(this.course);

    if (!this.courseId) {
      this.notificationService.warning(
        'Course',
        'Aucune course acceptée trouvée. Retour au dashboard.',
      );
      void this.router.navigate(['/transport/chauffeur-dashboard']);
      return;
    }

    this.refreshCourse();
    this.setupRealtimeDemandeUpdates();
    this.startPollingConfirmation();
    this.startConfirmationTimeout();
  }

  refreshCourse(): void {
    this.courseService
      .getCourseById(this.courseId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.isLoading = false;
          this.notificationService.error(
            'Course',
            error?.error?.message ?? 'Impossible de charger la course.',
          );
          return of(null);
        }),
      )
      .subscribe((course) => {
        if (!course) {
          return;
        }

        this.course = course;
        this.demandeId = this.demandeId || this.extractDemandeId(course);
        this.courseService.setActiveCourse(course);
        this.isLoading = false;

        if (course.statut !== CourseStatus.ACCEPTED) {
          this.stopConfirmationTimeout();
        }

        if (this.canRedirectToActive(course) && !this.hasRedirected) {
          this.redirectToCourseActive();
        }
      });
  }

  private setupRealtimeDemandeUpdates(): void {
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (currentUserId) {
      this.websocketService.connect(currentUserId);
    } else {
      this.websocketService.connect();
    }

    this.websocketService.driverNotifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notif) => {
        const notifType = String(notif?.type || '').toUpperCase();
        const sameCourse = Number(notif?.courseId) === Number(this.courseId);

        if (
          sameCourse &&
          (notifType === 'COURSE_CONFIRMATION_CANCELLED' ||
            notifType === 'COURSE_CANCELLED')
        ) {
          this.stopConfirmationTimeout();
          this.hasRedirected = true;
          this.courseService.clearActiveCourse();
          this.notificationService.cancellation(
            'Course annulée',
            notif?.message ||
              'Le client a annulé cette proposition. Retour au dashboard.',
          );
          void this.router.navigate(['/transport/chauffeur-dashboard']);
        }
      });

    this.websocketService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected) => {
        if (!connected) {
          return;
        }

        this.websocketService.subscribe(
          `/topic/course/${this.courseId}/status`,
          (msg) => {
            try {
              const update = JSON.parse(msg.body) as {
                clientConfirmed?: boolean;
                statut?: string;
                confirmationCancelled?: boolean;
              };

              if (
                update?.statut === 'CANCELLED' ||
                update?.confirmationCancelled === true
              ) {
                if (!this.hasRedirected) {
                  this.stopConfirmationTimeout();
                  this.hasRedirected = true;
                  this.courseService.clearActiveCourse();
                  this.notificationService.cancellation(
                    'Proposition annulée',
                    'Le client a refusé cette proposition. Retour au dashboard.',
                  );
                  void this.router.navigate(['/transport/chauffeur-dashboard']);
                }
                return;
              }

              if (
                update?.statut === CourseStatus.ACCEPTED ||
                update?.statut === 'ACCEPTED'
              ) {
                const isApproved = update?.clientConfirmed === true;
                if (isApproved && !this.hasRedirected) {
                  this.stopConfirmationTimeout();
                  this.notificationService.success(
                    'Confirmation reçue',
                    'Le client a confirmé. Redirection vers la course active.',
                  );
                  this.redirectToCourseActive();
                }
              }
            } catch {
              // Ignore malformed updates.
            }
          },
        );
      });
  }

  private startPollingConfirmation(): void {
    interval(4000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => {
          if (this.demandeId > 0) {
            return this.demandeCourseService.getDemandeById(this.demandeId);
          }

          return this.courseService.getClientConfirmationStatus(this.courseId);
        }),
        catchError(() => of(null)),
      )
      .subscribe((payload: any) => {
        if (!payload || this.hasRedirected) {
          return;
        }

        const demandeStatut = String(payload?.statut || '').toUpperCase();
        const confirmationClientStatut = String(
          payload?.confirmationClientStatut || '',
        ).toUpperCase();

        if (
          demandeStatut === 'MATCHING' &&
          confirmationClientStatut === 'CANCELLED'
        ) {
          this.stopConfirmationTimeout();
          this.hasRedirected = true;
          this.courseService.clearActiveCourse();
          this.notificationService.cancellation(
            'Proposition refusée',
            'Le client a refusé cette proposition. Retour au dashboard.',
          );
          void this.router.navigate(['/transport/chauffeur-dashboard']);
          return;
        }

        const clientConfirmed =
          typeof payload?.clientConfirmed === 'boolean'
            ? payload.clientConfirmed
            : payload?.approbationClientRequise === false ||
              confirmationClientStatut === 'CONFIRMED';

        if (clientConfirmed) {
          this.stopConfirmationTimeout();
          this.notificationService.success(
            'Confirmation reçue',
            'Le client a confirmé. Redirection vers la course active.',
          );
          this.redirectToCourseActive();
        }
      });
  }

  private canRedirectToActive(course: Course): boolean {
    return (
      course.statut === CourseStatus.ACCEPTED &&
      course.demande?.approbationClientRequise === false
    );
  }

  private redirectToCourseActive(): void {
    this.stopConfirmationTimeout();
    this.hasRedirected = true;
    void this.router.navigate(['/transport/chauffeur-course-active']);
  }

  private startConfirmationTimeout(): void {
    this.stopConfirmationTimeout();
    this.secondsLeft = this.confirmationTimeoutSeconds;

    this.timeoutHandle = setInterval(() => {
      if (this.hasRedirected || this.isAutoCancelling) {
        this.stopConfirmationTimeout();
        return;
      }

      if (this.course?.statut !== CourseStatus.ACCEPTED) {
        this.stopConfirmationTimeout();
        return;
      }

      this.secondsLeft -= 1;

      if (this.secondsLeft <= 0) {
        this.handleConfirmationTimeout();
      }
    }, 1000);
  }

  private stopConfirmationTimeout(): void {
    if (this.timeoutHandle) {
      clearInterval(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private handleConfirmationTimeout(): void {
    this.stopConfirmationTimeout();

    if (this.isAutoCancelling || this.hasRedirected) {
      return;
    }

    if (!this.demandeId) {
      this.notificationService.warning(
        'Expiration',
        'Temps de confirmation dépassé. Retour au dashboard.',
      );
      this.hasRedirected = true;
      this.courseService.clearActiveCourse();
      void this.router.navigate(['/transport/chauffeur-dashboard']);
      return;
    }

    this.isAutoCancelling = true;
    this.demandeCourseService.cancelAcceptedByClient(this.demandeId).subscribe({
      next: () => {
        this.hasRedirected = true;
        this.courseService.clearActiveCourse();
        this.notificationService.cancellation(
          'Temps expiré',
          'Le client n a pas confirmé en 60s. Proposition relancée.',
        );
        void this.router.navigate(['/transport/chauffeur-dashboard']);
      },
      error: (err: Error) => {
        this.isAutoCancelling = false;
        this.notificationService.error(
          'Expiration',
          err?.message ??
            'Impossible d annuler automatiquement la proposition.',
        );
      },
    });
  }

  private extractDemandeId(course: Course | null): number {
    if (!course) {
      return 0;
    }

    return Number(course.demande?.idDemande ?? course.demande?.id ?? 0);
  }

  retournerDashboard(): void {
    void this.router.navigate(['/transport/chauffeur-dashboard']);
  }

  ngOnDestroy(): void {
    this.stopConfirmationTimeout();
    this.destroy$.next();
    this.destroy$.complete();
  }
}

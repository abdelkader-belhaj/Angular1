import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  Course,
  CourseStatus,
  EvaluationTransport,
  EvaluationType,
} from '../../../core/models';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../../../services/auth.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-historique-courses',
  templateUrl: './historique-courses.component.html',
  styleUrl: './historique-courses.component.css',
})
export class HistoriqueCoursesComponent implements OnInit {
  readonly CourseStatus = CourseStatus;
  readonly ratingStars = [1, 2, 3, 4, 5];

  courses: Course[] = [];
  evaluations: EvaluationTransport[] = [];
  isLoading = false;
  error = '';

  constructor(
    private readonly courseService: CourseService,
    private readonly authService: AuthService,
    private readonly evaluationService: EvaluationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadHistorique();
  }

  loadHistorique(): void {
    const clientId = this.authService.getCurrentUser()?.id;

    if (!clientId) {
      this.error = 'Session client introuvable.';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.courseService
      .getCoursesByClient(clientId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (courses) => {
          const ordered = [...(courses ?? [])]
            .map((course) => ({
              ...course,
              statut: this.normalizeStatus(course),
            }))
            .sort((a, b) => {
              const left = this.resolveCourseDate(a)?.getTime() ?? 0;
              const right = this.resolveCourseDate(b)?.getTime() ?? 0;
              return right - left;
            });
          this.courses = ordered;
          this.loadEvaluations(clientId);
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de charger l’historique des courses.';
          this.courses = [];
        },
      });
  }

  goToNewCourse(): void {
    this.router.navigate(['/transport/demander-course']);
  }

  private loadEvaluations(clientId: number): void {
    this.evaluationService.getAllEvaluations().subscribe({
      next: (evaluations) => {
        this.evaluations = (evaluations ?? [])
          .filter((evaluation) => {
            const evaluatorId = Number(
              evaluation?.evaluateur?.id ?? (evaluation as any)?.evaluateurId,
            );
            const type = String(evaluation?.type || '').toUpperCase();

            return (
              evaluatorId === Number(clientId) &&
              type === EvaluationType.CLIENT_TO_DRIVER
            );
          })
          .sort((a, b) => {
            const left = new Date(a.dateCreation ?? '').getTime() || 0;
            const right = new Date(b.dateCreation ?? '').getTime() || 0;
            return right - left;
          });
      },
      error: () => {
        this.evaluations = [];
      },
    });
  }

  getEvaluationForCourse(course: Course): EvaluationTransport | null {
    const courseId = Number(course.idCourse);

    return (
      this.evaluations.find((evaluation) => {
        const evaluationCourseId = Number(
          evaluation?.course?.idCourse ?? (evaluation as any)?.courseId,
        );
        return evaluationCourseId === courseId;
      }) ?? null
    );
  }

  getRatingStars(note: number): boolean[] {
    const rating = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
    return this.ratingStars.map((star) => star <= rating);
  }

  hasEvaluation(course: Course): boolean {
    return !!this.getEvaluationForCourse(course);
  }

  getStatusLabel(status: CourseStatus): string {
    switch (status) {
      case CourseStatus.ACCEPTED:
        return 'Acceptée';
      case CourseStatus.STARTED:
        return 'Démarrée';
      case CourseStatus.IN_PROGRESS:
        return 'En cours';
      case CourseStatus.COMPLETED:
        return 'Terminée';
      case CourseStatus.CANCELLED:
        return 'Annulée';
      default:
        return status;
    }
  }

  getStatusClass(status: CourseStatus): string {
    switch (status) {
      case CourseStatus.COMPLETED:
        return 'status-completed';
      case CourseStatus.CANCELLED:
        return 'status-cancelled';
      case CourseStatus.IN_PROGRESS:
      case CourseStatus.STARTED:
        return 'status-progress';
      default:
        return 'status-default';
    }
  }

  getDeparture(course: Course): string {
    return course.localisationDepart?.adresse || 'Départ inconnu';
  }

  getArrival(course: Course): string {
    return course.localisationArrivee?.adresse || 'Arrivée inconnue';
  }

  formatCourseWhen(course: Course): string {
    return this.formatWhen(this.resolveCourseDate(course)?.toISOString());
  }

  formatWhen(value?: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private normalizeStatus(course: Course): CourseStatus {
    if (
      course.statut === CourseStatus.CANCELLED ||
      course.annulationTransport
    ) {
      return CourseStatus.CANCELLED;
    }

    if (
      course.statut === CourseStatus.COMPLETED ||
      course.paiementTransport?.datePaiement
    ) {
      return CourseStatus.COMPLETED;
    }

    return course.statut;
  }

  private resolveCourseDate(course: Course): Date | null {
    const candidates = [
      course.annulationTransport?.dateModification,
      course.annulationTransport?.dateCreation,
      course.paiementTransport?.datePaiement,
      course.paiementTransport?.dateModification,
      course.paiementTransport?.dateCreation,
      course.dateModification,
      course.dateCreation,
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  }
}

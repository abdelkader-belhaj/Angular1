import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../../../../../services/auth.service';
import {
  Course,
  CourseStatus,
  EvaluationTransport,
  EvaluationType,
} from '../../../core/models';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import { EvaluationService } from '../../../core/services/evaluation.service';

@Component({
  selector: 'app-historique-courses-chauffeur',
  templateUrl: './historique-courses-chauffeur.component.html',
  styleUrl: './historique-courses-chauffeur.component.css',
})
export class HistoriqueCoursesChauffeurComponent implements OnInit {
  courses: Course[] = [];
  evaluations: EvaluationTransport[] = [];
  isLoading = false;
  error = '';
  readonly ratingStars = [1, 2, 3, 4, 5];

  constructor(
    private readonly authService: AuthService,
    private readonly chauffeurService: ChauffeurService,
    private readonly evaluationService: EvaluationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadHistorique();
  }

  goToDashboard(): void {
    this.router.navigate(['/transport/chauffeur-dashboard']);
  }

  loadHistorique(): void {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error = 'Session chauffeur introuvable.';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.chauffeurService
      .resolveChauffeurIdByUserId(userId)
      .pipe(
        switchMap((chauffeurId) => {
          if (!chauffeurId) {
            this.error = 'Profil chauffeur introuvable.';
            return of([] as Course[]);
          }

          return this.chauffeurService.getHistoriqueCourses(chauffeurId);
        }),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: (courses) => {
          this.courses = [...(courses ?? [])].sort((a, b) => {
            const left = this.resolveCourseDate(a)?.getTime() ?? 0;
            const right = this.resolveCourseDate(b)?.getTime() ?? 0;
            return right - left;
          });
          this.loadEvaluations(userId);
        },
        error: (error) => {
          this.error =
            error?.message || "Impossible de charger l'historique chauffeur.";
          this.courses = [];
        },
      });
  }

  private loadEvaluations(userId: number): void {
    const chauffeurCourseIds = new Set(
      this.courses
        .map((course) => Number(course.idCourse))
        .filter((id) => id > 0),
    );

    this.evaluationService.getAllEvaluations().subscribe({
      next: (evaluations) => {
        this.evaluations = (evaluations ?? [])
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
              (evaluatedUserId === Number(userId) || isForChauffeurCourses)
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
        const evaluationCourseId = this.resolveEvaluationCourseId(evaluation);
        return evaluationCourseId === courseId;
      }) ?? null
    );
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

  private normalizeEvaluationType(evaluation: EvaluationTransport): string {
    const anyEvaluation = evaluation as any;
    return String(
      anyEvaluation?.type ??
        anyEvaluation?.evaluationType ??
        anyEvaluation?.typeEvaluation ??
        '',
    ).toUpperCase();
  }

  getRatingStars(note: number): boolean[] {
    const rating = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
    return this.ratingStars.map((star) => star <= rating);
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

  getStatusLabel(status: CourseStatus): string {
    switch (status) {
      case CourseStatus.ACCEPTED:
        return 'Acceptee';
      case CourseStatus.STARTED:
        return 'Demarree';
      case CourseStatus.IN_PROGRESS:
        return 'En cours';
      case CourseStatus.COMPLETED:
        return 'Terminee';
      case CourseStatus.CANCELLED:
        return 'Annulee';
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

  getClientName(course: Course): string {
    return (
      (course.demande as any)?.client?.username ||
      (course.demande as any)?.client?.email ||
      'Client'
    );
  }

  getDeparture(course: Course): string {
    return course.localisationDepart?.adresse || 'Depart inconnu';
  }

  getArrival(course: Course): string {
    return course.localisationArrivee?.adresse || 'Arrivee inconnue';
  }

  formatCourseWhen(course: Course): string {
    const value = this.resolveCourseDate(course)?.toISOString();
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
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
}

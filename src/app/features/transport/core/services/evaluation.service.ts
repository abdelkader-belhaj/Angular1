// src/app/features/transport/core/services/evaluation.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { EvaluationTransport } from '../models';

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  constructor(private api: ApiService) {}

  private toFiniteNote(note: unknown): number {
    const n = Number(note);
    if (!Number.isFinite(n)) {
      return 5;
    }

    return Math.max(1, Math.min(5, Math.round(n)));
  }

  // Extract IDs from evaluation object with multiple fallback patterns
  private extractIds(evaluation: Partial<EvaluationTransport>): {
    courseId: number | undefined;
    evaluateurId: number | undefined;
    evalueId: number | undefined;
  } {
    const anyEval = evaluation as any;
    const courseId =
      anyEval?.course?.idCourse ??
      anyEval?.courseId ??
      anyEval?.idCourse ??
      undefined;
    const evaluateurId =
      anyEval?.evaluateur?.id ??
      anyEval?.evaluateurId ??
      anyEval?.idEvaluateur ??
      undefined;
    const evalueId =
      anyEval?.evalue?.id ??
      anyEval?.evalueId ??
      anyEval?.idEvalue ??
      undefined;

    return {
      courseId: courseId ? Number(courseId) : undefined,
      evaluateurId: evaluateurId ? Number(evaluateurId) : undefined,
      evalueId: evalueId ? Number(evalueId) : undefined,
    };
  }

  // PRIMARY: Structure that respects Spring JPA (@ManyToOne course)
  private buildJpaPayload(evaluation: Partial<EvaluationTransport>): any {
    const anyEval = evaluation as any;
    const { courseId, evaluateurId, evalueId } = this.extractIds(evaluation);

    return {
      course: courseId ? { idCourse: courseId } : undefined,
      evaluateurId,
      evalueId,
      type: anyEval?.type,
      note: this.toFiniteNote(anyEval?.note),
      commentaire: anyEval?.commentaire ?? '',
    };
  }

  // FALLBACK 1: Simple flat payload with just IDs
  private buildFlatPayload(evaluation: Partial<EvaluationTransport>): any {
    const anyEval = evaluation as any;
    const { courseId, evaluateurId, evalueId } = this.extractIds(evaluation);

    return {
      idCourse: courseId,
      idEvaluateur: evaluateurId,
      idEvalue: evalueId,
      type: anyEval?.type,
      note: this.toFiniteNote(anyEval?.note),
      commentaire: anyEval?.commentaire ?? '',
    };
  }

  // FALLBACK 2: Alternative field names variation
  private buildIdPayload(evaluation: Partial<EvaluationTransport>): any {
    const anyEval = evaluation as any;
    const { courseId, evaluateurId, evalueId } = this.extractIds(evaluation);

    return {
      courseId,
      evaluateurId,
      evalueId,
      type: anyEval?.type,
      note: this.toFiniteNote(anyEval?.note),
      commentaire: anyEval?.commentaire ?? '',
    };
  }

  // FALLBACK 3: Entity structure
  private buildEntityPayload(evaluation: Partial<EvaluationTransport>): any {
    const anyEval = evaluation as any;
    const { courseId, evaluateurId, evalueId } = this.extractIds(evaluation);

    return {
      course: courseId ? { id: courseId, idCourse: courseId } : undefined,
      evaluateurId,
      evalueId,
      type: anyEval?.type,
      note: this.toFiniteNote(anyEval?.note),
      commentaire: anyEval?.commentaire ?? '',
    };
  }

  // FALLBACK 4: All variations for maximum compatibility
  private buildLegacyPayload(evaluation: Partial<EvaluationTransport>): any {
    const anyEval = evaluation as any;
    const { courseId, evaluateurId, evalueId } = this.extractIds(evaluation);
    const note = this.toFiniteNote(anyEval?.note);
    const commentaire = anyEval?.commentaire ?? anyEval?.comment ?? '';

    return {
      // Course ID variations
      courseId,
      idCourse: courseId,
      course: courseId ? { id: courseId, idCourse: courseId } : undefined,
      // Evaluator ID variations
      evaluateurId,
      idEvaluateur: evaluateurId,
      // Evaluated person ID variations
      evalueId,
      idEvalue: evalueId,
      // Type variations
      type: anyEval?.type,
      evaluationType: anyEval?.type,
      typeEvaluation: anyEval?.type,
      // Note variations
      note,
      score: note,
      // Comment variations
      commentaire,
      comment: commentaire,
    };
  }

  // POST /hypercloud/evaluations
  addEvaluation(
    evaluation: Partial<EvaluationTransport>,
  ): Observable<EvaluationTransport> {
    const { courseId, evaluateurId, evalueId } = this.extractIds(evaluation);
    const jpaPayload = this.buildJpaPayload(evaluation);
    const flatPayload = this.buildFlatPayload(evaluation);
    const idPayload = this.buildIdPayload(evaluation);
    const entityPayload = this.buildEntityPayload(evaluation);
    const legacyPayload = this.buildLegacyPayload(evaluation);

    console.log('[EVAL DEBUG] ID Extraction:', {
      courseId,
      evaluateurId,
      evalueId,
    });

    console.log('[EVAL DEBUG] Payload to send (JPA-first order):', {
      jpaPayload,
      flatPayload,
      idPayload,
      entityPayload,
      legacyPayload,
    });

    // Try JPA structure first (course as object)
    return this.api.post<EvaluationTransport>('/evaluations', jpaPayload).pipe(
      tap(() => console.log('[EVAL DEBUG] ✓ JPA payload success')),
      catchError((err) => {
        console.warn('[EVAL DEBUG] ✗ JPA payload failed', {
          jpaPayload,
          error: err?.error,
        });
        // Try flat IDs format
        return this.api
          .post<EvaluationTransport>('/evaluations', flatPayload)
          .pipe(
            tap(() => console.log('[EVAL DEBUG] ✓ flat payload success')),
            catchError((err2) => {
              console.warn('[EVAL DEBUG] ✗ flat payload failed', {
                flatPayload,
                error: err2?.error,
              });
              // Try alternative ID format
              return this.api
                .post<EvaluationTransport>('/evaluations', idPayload)
                .pipe(
                  tap(() => console.log('[EVAL DEBUG] ✓ id payload success')),
                  catchError((err3) => {
                    console.warn('[EVAL DEBUG] ✗ id payload failed', {
                      idPayload,
                      error: err3?.error,
                    });
                    // Try entity format
                    return this.api
                      .post<EvaluationTransport>('/evaluations', entityPayload)
                      .pipe(
                        tap(() =>
                          console.log('[EVAL DEBUG] ✓ entity payload success'),
                        ),
                        catchError((err4) => {
                          console.warn(
                            '[EVAL DEBUG] ✗ entity payload failed, trying legacy',
                            { entityPayload, error: err4?.error },
                          );
                          // Last resort: legacy with all variations
                          return this.api.post<EvaluationTransport>(
                            '/evaluations',
                            legacyPayload,
                          );
                        }),
                      );
                  }),
                );
            }),
          );
      }),
    );
  }

  getEvaluationById(id: number): Observable<EvaluationTransport> {
    return this.api.get<EvaluationTransport>(`/evaluations/${id}`);
  }

  getAllEvaluations(): Observable<EvaluationTransport[]> {
    return this.api.get<EvaluationTransport[]>('/evaluations');
  }

  updateEvaluation(
    id: number,
    evaluation: Partial<EvaluationTransport>,
  ): Observable<EvaluationTransport> {
    return this.api.put<EvaluationTransport>(`/evaluations/${id}`, {
      ...evaluation,
      idEvaluation: id,
    });
  }

  deleteEvaluation(id: number): Observable<void> {
    return this.api.delete<void>(`/evaluations/${id}`);
  }
}

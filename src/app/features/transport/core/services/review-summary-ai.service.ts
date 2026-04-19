import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { EvaluationTransport } from '../models';
import { ApiService } from './api.service';
import {
  ReviewSummaryService,
  SmartReviewSummary,
} from './review-summary.service';

interface DriverReviewSummaryApiResponse {
  success: boolean;
  chauffeurId?: number;
  summary?: string;
  nombreAvis?: number;
  nombre_avis?: number;
  averageNote?: number;
  average_note?: number;
  highlights?: string[];
  concerns?: string[];
  confidence?: string;
  message?: string;
}

interface DriverReviewSummaryPythonResponse {
  success: boolean;
  chauffeurId?: number;
  summary?: string;
  nombre_avis?: number;
  average_note?: number;
  highlights?: string[];
  concerns?: string[];
  confidence?: string;
  message?: string;
}

export interface DriverReviewDetail {
  idEvaluation: number;
  evaluator: string;
  note: number;
  commentaire: string;
  dateCreation?: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewSummaryAiService {
  private readonly pythonSummaryUrl =
    'http://127.0.0.1:5000/summarize_driver_reviews';

  constructor(
    private http: HttpClient,
    private api: ApiService,
    private reviewSummaryService: ReviewSummaryService,
  ) {}

  summarizeDriverReviews(
    chauffeurId: number,
    evaluations: EvaluationTransport[] = [],
    context = 'ce chauffeur',
  ): Observable<SmartReviewSummary | null> {
    if (!chauffeurId || !Number.isFinite(chauffeurId)) {
      return of(null);
    }

    // Priority: use Python model with real chauffeur reviews from Spring.
    return this.getDriverClientReviews(chauffeurId).pipe(
      switchMap((detailedReviews) => {
        if (detailedReviews.length < 2) {
          console.info(
            '[ReviewSummaryAiService] avis insuffisants pour Python, fallback Spring',
          );
          return this.callSpringSummary(chauffeurId, evaluations, context);
        }

        return this.http
          .post<DriverReviewSummaryPythonResponse>(this.pythonSummaryUrl, {
            chauffeurId,
            reviews: detailedReviews,
          })
          .pipe(
            map((response) => {
              if (!response?.success || !response.summary) {
                console.info(
                  '[ReviewSummaryAiService] reponse Python non exploitable, fallback local/Spring',
                );
                return null;
              }

              console.info(
                '[ReviewSummaryAiService] synthese generee via modele Python',
              );

              const mappedResponse: DriverReviewSummaryApiResponse = {
                success: true,
                chauffeurId: response.chauffeurId,
                summary: response.summary,
                nombre_avis: response.nombre_avis,
                average_note: response.average_note,
                highlights: response.highlights,
                concerns: response.concerns,
                confidence: response.confidence,
                message: response.message,
              };

              return this.reviewSummaryService.buildFromAiResponse(
                mappedResponse,
                evaluations,
                context,
              );
            }),
            catchError(() =>
              this.callSpringSummary(chauffeurId, evaluations, context),
            ),
          );
      }),
      catchError(() =>
        this.callSpringSummary(chauffeurId, evaluations, context),
      ),
    );
  }

  private callSpringSummary(
    chauffeurId: number,
    evaluations: EvaluationTransport[],
    context: string,
  ): Observable<SmartReviewSummary | null> {
    return this.api
      .get<DriverReviewSummaryApiResponse>(
        `/evaluations/chauffeur/${chauffeurId}/summary-ai`,
      )
      .pipe(
        map((response) => {
          if (!response?.success || !response.summary) {
            if (evaluations.length < 2) {
              return null;
            }

            return this.reviewSummaryService.buildFromEvaluations(
              evaluations,
              context,
            );
          }

          return this.reviewSummaryService.buildFromAiResponse(
            response,
            evaluations,
            context,
          );
        }),
        catchError(() => {
          if (evaluations.length < 2) {
            return of(null);
          }

          return of(
            this.reviewSummaryService.buildFromEvaluations(
              evaluations,
              context,
            ),
          );
        }),
      );
  }

  getDriverClientReviews(
    chauffeurId: number,
  ): Observable<DriverReviewDetail[]> {
    if (!chauffeurId || !Number.isFinite(chauffeurId)) {
      return of([]);
    }

    return this.api
      .get<
        EvaluationTransport[]
      >(`/evaluations/chauffeur/${chauffeurId}/client-reviews`)
      .pipe(
        map((rows) =>
          (rows ?? []).map((evaluation: any) => ({
            idEvaluation: Number(evaluation?.idEvaluation ?? 0),
            evaluator: String(
              evaluation?.evaluateurNom ??
                evaluation?.evaluator ??
                evaluation?.clientName ??
                'Client',
            ).trim(),
            note: Number(evaluation?.note ?? 0) || 0,
            commentaire: String(evaluation?.commentaire ?? '').trim(),
            dateCreation: evaluation?.dateCreation,
          })),
        ),
        catchError(() => of([])),
      );
  }
}

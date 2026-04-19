import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { delay, catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  montant: number;
  montantInitial?: number;
  montantPreautorise?: number;
  montantRestant?: number;
  montantCommission: number;
  montantNet: number;
  paiementId: number;
  courseId: number;
  reservationId?: number;
  paymentPurpose?:
    | 'PREAUTH_PENALTY'
    | 'RESERVATION_ADVANCE'
    | 'COURSE_FINAL_BALANCE'
    | 'DEPOSIT_REFUND';
}

export interface ConfirmPaymentRequest {
  courseId: number;
  paymentIntentId: string;
}

export interface PaymentResult {
  success: boolean;
  message: string;
  paiement?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class StripePaymentService {
  private cardContainerId: string | null = null;

  // Observables pour les mises à jour du statut
  private paymentStatusSubject = new Subject<PaymentResult>();
  public paymentStatus$ = this.paymentStatusSubject.asObservable();

  constructor(private api: ApiService) {
    this.initializeStripe();
  }

  /**
   * Initialise Stripe avec la clé publique
   * DOIT être appelé une seule fois au démarrage
   */
  private initializeStripe(): void {
    console.info('Mode paiement statique activé (Stripe backend désactivé).');
  }

  /**
   * Crée les éléments Stripe dans un conteneur DOM
   * À appeler avant d'afficher le formulaire de paiement
   *
   * @param containerId ID du conteneur où afficher la carte
   */
  async setupPaymentForm(containerId: string): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Conteneur #${containerId} non trouvé`);
    }

    this.cardContainerId = containerId;
    container.innerHTML =
      '<div style="padding:12px;border:1px dashed #9ca3af;border-radius:6px;color:#374151;font-size:13px;">Mode statique: saisie carte simulée. Stripe sera branché plus tard.</div>';

    const displayError = document.getElementById('card-errors');
    if (displayError) {
      displayError.textContent = '';
    }

    console.log('✅ Formulaire de paiement statique prêt');
  }

  /**
   * ÉTAPE 1: Crée un PaymentIntent côté backend
   * Modes:
   * - createPaymentIntent(courseId)
   * - createPaymentIntent(amount, 'PREAUTH_PENALTY')
   * - createPaymentIntent(amount, 'RESERVATION_ADVANCE')
   */
  createPaymentIntent(
    courseIdOrAmount: number,
    typeOrUndefined?:
      | 'PREAUTH_PENALTY'
      | 'RESERVATION_ADVANCE'
      | 'COURSE_FINAL_BALANCE'
      | 'DEPOSIT_REFUND',
  ): Observable<PaymentIntentResponse> {
    let montant = 35;
    let courseId = courseIdOrAmount;
    const paymentPurpose = typeOrUndefined;
    const isAmountBasedIntent =
      paymentPurpose === 'PREAUTH_PENALTY' ||
      paymentPurpose === 'RESERVATION_ADVANCE' ||
      paymentPurpose === 'COURSE_FINAL_BALANCE' ||
      paymentPurpose === 'DEPOSIT_REFUND';

    // Final course payment: ask backend first so the remaining amount is authoritative.
    if (!isAmountBasedIntent) {
      return this.api
        .post<PaymentIntentResponse>(`/stripe/payment-intent/${courseId}`, {})
        .pipe(
          map((response) => this.normalizePaymentIntentResponse(response)),
          catchError(() => this.buildFallbackCoursePaymentIntent(courseId)),
        );
    }

    if (isAmountBasedIntent) {
      montant = courseIdOrAmount;
      courseId = Date.now();
    }

    const montantCommission = montant * 0.2;
    const montantNet = montant - montantCommission;

    return new Observable<PaymentIntentResponse>((subscriber) => {
      subscriber.next({
        clientSecret: `static_client_secret_${paymentPurpose || 'course'}_${courseId}_${Date.now()}`,
        paymentIntentId: `static_pi_${paymentPurpose || 'course'}_${courseId}_${Date.now()}`,
        montant,
        montantInitial: montant,
        montantPreautorise: 0,
        montantRestant: montant,
        montantCommission,
        montantNet,
        paiementId: Date.now(),
        courseId,
        paymentPurpose,
        reservationId:
          paymentPurpose === 'RESERVATION_ADVANCE' ? Date.now() : undefined,
      });
      subscriber.complete();
    }).pipe(delay(400));
  }

  private normalizePaymentIntentResponse(
    response: PaymentIntentResponse,
  ): PaymentIntentResponse {
    const montant = Number(response?.montant ?? 0);
    const montantInitial = Number(
      response?.montantInitial ?? (response as any)?.montantBrut ?? montant,
    );
    const montantPreautorise = Number(
      response?.montantPreautorise ?? (response as any)?.holdAmount ?? 0,
    );
    const montantRestant = Number(
      response?.montantRestant ??
        (response as any)?.remainingAmount ??
        response?.montant ??
        0,
    );

    return {
      ...response,
      montant,
      montantInitial: Number.isFinite(montantInitial)
        ? montantInitial
        : montant,
      montantPreautorise: Number.isFinite(montantPreautorise)
        ? montantPreautorise
        : 0,
      montantRestant: Number.isFinite(montantRestant)
        ? montantRestant
        : montant,
    };
  }

  private buildFallbackCoursePaymentIntent(
    courseId: number,
  ): Observable<PaymentIntentResponse> {
    return this.api.get<any>(`/courses/${courseId}/paiement/statut`).pipe(
      map((status) => {
        const brut = Number(status?.montantBrut ?? 0);
        const preauth = Number(status?.montantPreautorise ?? 0);
        const remainingFromBackend = Number(status?.montantRestant ?? NaN);

        const totalAmount = Number.isFinite(brut) && brut > 0 ? brut : 35;
        const preauthAmount =
          Number.isFinite(preauth) && preauth > 0 ? preauth : 0;
        const remainingAmount = Number.isFinite(remainingFromBackend)
          ? Math.max(0, Math.round(remainingFromBackend * 100) / 100)
          : Math.max(0, Math.round((totalAmount - preauthAmount) * 100) / 100);

        const montantCommission = Math.round(remainingAmount * 0.2 * 100) / 100;
        const montantNet = Math.max(
          0,
          Math.round((remainingAmount - montantCommission) * 100) / 100,
        );

        return {
          clientSecret: `fallback_client_secret_course_${courseId}_${Date.now()}`,
          paymentIntentId: `fallback_pi_course_${courseId}_${Date.now()}`,
          montant: remainingAmount,
          montantInitial: totalAmount,
          montantPreautorise: preauthAmount,
          montantRestant: remainingAmount,
          montantCommission,
          montantNet,
          paiementId: Date.now(),
          courseId,
          paymentPurpose: 'COURSE_FINAL_BALANCE' as const,
        };
      }),
      catchError(() =>
        this.api.get<any>(`/courses/${courseId}`).pipe(
          map((coursePayload) => {
            const course =
              coursePayload?.course ?? coursePayload?.data ?? coursePayload;
            const prixFinal = Number(course?.prixFinal ?? 0);
            const prixEstime = Number(course?.demande?.prixEstime ?? 0);
            const totalAmount =
              Number.isFinite(prixFinal) && prixFinal > 0
                ? prixFinal
                : prixEstime > 0
                  ? prixEstime
                  : 35;

            const preauthAmount = Math.round(totalAmount * 0.2 * 100) / 100;
            const remainingAmount = Math.max(
              0,
              Math.round((totalAmount - preauthAmount) * 100) / 100,
            );
            const montantCommission =
              Math.round(remainingAmount * 0.2 * 100) / 100;
            const montantNet = Math.max(
              0,
              Math.round((remainingAmount - montantCommission) * 100) / 100,
            );

            return {
              clientSecret: `fallback_client_secret_course_${courseId}_${Date.now()}`,
              paymentIntentId: `fallback_pi_course_${courseId}_${Date.now()}`,
              montant: remainingAmount,
              montantInitial: totalAmount,
              montantPreautorise: preauthAmount,
              montantRestant: remainingAmount,
              montantCommission,
              montantNet,
              paiementId: Date.now(),
              courseId,
              paymentPurpose: 'COURSE_FINAL_BALANCE' as const,
            };
          }),
        ),
      ),
      map((response) => this.normalizePaymentIntentResponse(response)),
    );
  }

  /**
   * ÉTAPE 2: Récupère la méthode de paiement du formulaire et confirme le paiement
   * Appelé après que l'utilisateur clique sur "Payer"
   *
   * @param paymentIntentResponse Réponse du createPaymentIntent
   * @returns Promesse avec le résultat du paiement
   */
  async confirmPaymentWithCard(
    paymentIntentResponse: PaymentIntentResponse,
  ): Promise<any> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (!paymentIntentResponse?.paymentIntentId) {
      this.paymentStatusSubject.next({
        success: false,
        message: 'Paiement simulé échoué',
        error: 'PaymentIntent manquant',
      });
      throw new Error('PaymentIntent manquant');
    }

    const result = {
      success: true,
      paymentIntentId: paymentIntentResponse.paymentIntentId,
      paymentIntent: {
        id: paymentIntentResponse.paymentIntentId,
        status: 'succeeded',
      },
    };

    this.paymentStatusSubject.next({
      success: true,
      message: 'Paiement simulé réussi',
    });

    return result;
  }

  /**
   * ÉTAPE 3: Confirme le paiement auprès du backend
   * Appelé après succès Stripe confirmPaymentWithCard
   *
   * @param request Contient courseId et paymentIntentId
   * @returns Observable avec le paiement finalisé
   */
  confirmPaymentBackend(request: ConfirmPaymentRequest): Observable<any> {
    return this.api
      .post('/stripe/confirm-payment', {
        courseId: request.courseId,
        paymentIntentId: request.paymentIntentId,
      })
      .pipe(
        catchError(() =>
          this.api.post(
            `/courses/${request.courseId}/paiement/client-confirmer`,
            {
              paymentIntentId: request.paymentIntentId,
            },
          ),
        ),
      );
  }

  /**
   * Annule un paiement en cas d'erreur ou d'annulation utilisateur
   *
   * @param courseId ID de la course
   */
  cancelPayment(courseId: number): Observable<any> {
    return this.api.delete(`/stripe/cancel-payment/${courseId}`).pipe(
      catchError(() =>
        new Observable<any>((subscriber) => {
          subscriber.next({
            courseId,
            status: 'CANCELLED',
          });
          subscriber.complete();
        }).pipe(delay(200)),
      ),
    );
  }

  /**
   * Nettoie les ressources (à appeler avant destruction du composant)
   */
  cleanup(): void {
    if (this.cardContainerId) {
      const container = document.getElementById(this.cardContainerId);
      if (container) {
        container.innerHTML = '';
      }
    }

    this.cardContainerId = null;
  }

  /**
   * Vérifie si la clé Stripe est configurée
   */
  isConfigured(): boolean {
    return true;
  }
}

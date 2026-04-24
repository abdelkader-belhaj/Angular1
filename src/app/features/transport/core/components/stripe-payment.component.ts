import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PaymentIntentResponse,
  StripePaymentService,
} from '../services/stripe-payment.service';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

interface PaymentState {
  loading: boolean;
  error: string | null;
  success: boolean;
  step: 'init' | 'form' | 'processing' | 'success' | 'error';
}

@Component({
  selector: 'app-stripe-payment',
  templateUrl: './stripe-payment.component.html',
  styleUrls: ['./stripe-payment.component.css'],
})
export class StripePaymentComponent implements OnInit, OnDestroy {
  @Input() courseId!: number;

  // État du paiement
  state: PaymentState = {
    loading: true,
    error: null,
    success: false,
    step: 'init',
  };

  // Détails du paiement
  paymentDetails: PaymentIntentResponse | null = null;

  // Destruction automatique
  private destroy$ = new Subject<void>();

  // Formulaire
  customerEmail = '';
  customerName = '';
  verificationCode: string | null = null;

  get payableAmount(): number {
    if (!this.paymentDetails) {
      return 0;
    }

    const remaining = Number(
      this.paymentDetails.montantRestant ?? this.paymentDetails.montant,
    );
    return Number.isFinite(remaining) && remaining > 0 ? remaining : 0;
  }

  get grossAmount(): number {
    if (!this.paymentDetails) {
      return 0;
    }

    const gross = Number(
      this.paymentDetails.montantInitial ??
        (this.paymentDetails as any).montantBrut ??
        this.paymentDetails.montant,
    );
    return Number.isFinite(gross) && gross > 0 ? gross : 0;
  }

  get preauthorizedAmount(): number {
    if (!this.paymentDetails) {
      return 0;
    }

    const preauth = Number(this.paymentDetails.montantPreautorise ?? 0);
    return Number.isFinite(preauth) && preauth > 0 ? preauth : 0;
  }

  constructor(
    private stripeService: StripePaymentService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Récupérer courseId depuis les routes ou l'input
    if (!this.courseId) {
      const courseIdParam = this.route.snapshot.queryParamMap.get('courseId');
      this.courseId = Number(courseIdParam ?? 0);
    }

    if (!this.courseId) {
      this.setState({
        error: 'ID de course manquant',
        step: 'error',
        loading: false,
      });
      return;
    }

    // Vérifier que Stripe est configuré
    if (!this.stripeService.isConfigured()) {
      this.setState({
        error:
          '❌ Stripe non configuré. Vérifiez la clé publique dans stripe-payment.config.ts',
        step: 'error',
        loading: false,
      });
      return;
    }

    // Charger les détails du PaymentIntent
    this.loadPaymentIntent();
  }

  /**
   * ÉTAPE 1: Charger les détails du PaymentIntent côté backend
   */
  loadPaymentIntent(): void {
    this.stripeService
      .createPaymentIntent(this.courseId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.setState({ loading: false });
        }),
      )
      .subscribe({
        next: (response) => {
          console.log('✅ PaymentIntent créé:', response);
          this.paymentDetails = response;
          this.setState({ step: 'form' });

          // Attendre que le DOM soit mis à jour
          setTimeout(() => {
            this.setupPaymentForm();
          }, 100);
        },
        error: (error) => {
          console.error('❌ Erreur chargement PaymentIntent:', error);
          this.setState({
            error:
              error.error?.message || 'Erreur lors du chargement du paiement',
            step: 'error',
          });
        },
      });
  }

  /**
   * Configure le formulaire Stripe
   */
  private setupPaymentForm(): void {
    try {
      this.stripeService.setupPaymentForm('card-element').then(() => {
        console.log('✅ Formulaire Stripe prêt');
      });
    } catch (error: any) {
      console.error('❌ Erreur configuration formulaire:', error);
      this.setState({
        error: error.message || 'Erreur configuration du formulaire',
        step: 'error',
      });
    }
  }

  /**
   * ÉTAPE 2: Traiter le paiement (appelé lors du clic "Payer")
   */
  async onPayClick(): Promise<void> {
    if (!this.paymentDetails) {
      this.setState({
        error: 'Détails paiement manquants',
      });
      return;
    }

    if (this.payableAmount <= 0) {
      this.setState({
        error: 'Aucun montant restant à payer.',
        step: 'error',
      });
      return;
    }

    this.setState({
      step: 'processing',
      loading: true,
      error: null,
    });

    try {
      // Confirmer le paiement avec Stripe
      const stripeResult = await this.stripeService.confirmPaymentWithCard(
        this.paymentDetails,
      );

      if (!stripeResult.success) {
        throw new Error(stripeResult.message || 'Paiement échoué');
      }

      // ÉTAPE 3: Confirmer auprès du backend
      this.confirmPaymentBackend(stripeResult.paymentIntentId);
    } catch (error: any) {
      console.error('❌ Erreur paiement:', error);
      this.setState({
        error: error.message || 'Erreur lors du paiement',
        step: 'error',
        loading: false,
      });
    }
  }

  /**
   * Confirme le paiement auprès du backend
   */
  private confirmPaymentBackend(paymentIntentId: string): void {
    this.stripeService
      .confirmPaymentBackend({
        courseId: this.courseId,
        paymentIntentId: paymentIntentId,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paiement) => {
          console.log('✅ Paiement confirmé:', paiement);
          this.verificationCode = paiement?.verificationCode ?? null;

          this.setState({
            step: 'success',
            success: true,
            loading: false,
          });

          // Rediriger après succès
          setTimeout(() => {
            this.router.navigate(['/transport/course-active'], {
              queryParams: { paymentSuccess: true },
            });
          }, 3500);
        },
        error: (error) => {
          console.error('❌ Erreur confirmation backend:', error);
          this.setState({
            error: error.error?.message || 'Erreur lors de la confirmation',
            step: 'error',
            loading: false,
          });
        },
      });
  }

  /**
   * Annuler le paiement
   */
  onCancel(): void {
    this.stripeService
      .cancelPayment(this.courseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('✅ Paiement annulé');
          this.router.navigate(['/transport/course-active']);
        },
        error: (error) => {
          console.error('❌ Erreur annulation:', error);
          this.setState({
            error: error.error?.message || 'Erreur annulation paiement',
          });
        },
      });
  }

  /**
   * Met à jour l'état du composant
   */
  private setState(partial: Partial<PaymentState>): void {
    this.state = { ...this.state, ...partial };
  }

  ngOnDestroy(): void {
    this.stripeService.cleanup();
    this.destroy$.next();
    this.destroy$.complete();
  }
}

import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  StripePaymentService,
  PaymentIntentResponse,
} from '../../services/stripe-payment.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-card-payment-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card-payment-modal.component.html',
  styleUrls: ['./card-payment-modal.component.css'],
})
export class CardPaymentModalComponent implements OnChanges {
  @Input() estimatedPrice: number | null = null;
  @Input() isOpen = false;
  @Input() holdPercentage = 20;
  @Input() paymentPurpose:
    | 'PREAUTH_PENALTY'
    | 'RESERVATION_ADVANCE'
    | 'DEPOSIT_REFUND' = 'PREAUTH_PENALTY';

  @Output() cardConfirmed = new EventEmitter<PaymentIntentResponse>();
  @Output() cardCancelled = new EventEmitter<void>();

  isLoading = false;
  paymentDetails: PaymentIntentResponse | null = null;
  step: 'init' | 'processing' | 'success' | 'error' = 'init';
  errorMessage = '';

  // Simulated form fields (static mode)
  cardNumber = '4242 4242 4242 4242';
  cardExpiry = '12/25';
  cardCvc = '123';

  constructor(
    private stripeService: StripePaymentService,
    private notificationService: NotificationService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.onOpenModal();
    }
  }

  /**
   * Initialize payment for 20% penalty hold
   */
  async onOpenModal(): Promise<void> {
    if (!this.estimatedPrice) {
      this.notificationService.error('Erreur', 'Prix estimé manquant.');
      return;
    }

    this.isLoading = true;
    this.step = 'init';
    this.errorMessage = '';

    try {
      // Calculate hold amount based on flow type (course penalty or reservation advance)
      const holdAmount = this.holdAmount;

      // Create PaymentIntent on backend for the requested hold flow
      this.stripeService
        .createPaymentIntent(holdAmount, this.paymentPurpose)
        .subscribe({
          next: (response) => {
            console.log('✅ PaymentIntent créé:', response);
            this.paymentDetails = response;
            this.step = 'processing';
            this.isLoading = false;

            // Setup card form (static mode)
            setTimeout(() => {
              this.setupPaymentForm();
            }, 200);
          },
          error: (error) => {
            console.error('❌ Erreur création PaymentIntent:', error);
            this.errorMessage = error.error?.message || 'Erreur serveur';
            this.step = 'error';
            this.isLoading = false;
          },
        });
    } catch (error: any) {
      console.error('❌ Erreur:', error);
      this.errorMessage =
        error.message || 'Erreur lors de la création du paiement';
      this.step = 'error';
      this.isLoading = false;
    }
  }

  /**
   * Setup payment form (static mode simulates Stripe Elements)
   */
  private setupPaymentForm(): void {
    try {
      this.stripeService.setupPaymentForm('card-element-modal').then(() => {
        console.log('✅ Formulaire Stripe prêt (mode statique)');
      });
    } catch (error: any) {
      console.error('❌ Erreur form setup:', error);
      this.errorMessage = error.message;
      this.step = 'error';
    }
  }

  /**
   * Confirm card (static mode)
   */
  async onConfirmCard(): Promise<void> {
    if (!this.paymentDetails) {
      this.notificationService.error('Erreur', 'Détails paiement manquants');
      return;
    }

    this.isLoading = true;

    try {
      // Simulate card confirmation (real Stripe later)
      const result = await this.stripeService.confirmPaymentWithCard(
        this.paymentDetails,
      );

      if (!result.success) {
        throw new Error(result.message || 'Confirmation échouée');
      }

      console.log('✅ Carte confirmée:', result);
      this.step = 'success';

      // Auto-close after success
      setTimeout(() => {
        this.cardConfirmed.emit(this.paymentDetails!);
        this.close();
        const isDepositRefund = this.paymentPurpose === 'DEPOSIT_REFUND';
        this.notificationService.success(
          isDepositRefund ? 'Remboursement confirmé' : 'Succès',
          isDepositRefund
            ? 'Le remboursement de la caution a été confirmé.'
            : 'Carte ajoutée. Montant pré-autorisé en attente.',
        );
      }, 1500);
    } catch (error: any) {
      console.error('❌ Erreur confirmation:', error);
      this.errorMessage = error.message || 'Erreur lors de la confirmation';
      this.step = 'error';
      this.isLoading = false;
    }
  }

  /**
   * Cancel modal
   */
  onCancel(): void {
    this.close();
    this.cardCancelled.emit();
  }

  /**
   * Close modal
   */
  close(): void {
    this.isOpen = false;
    this.step = 'init';
    this.errorMessage = '';
    this.paymentDetails = null;
    this.stripeService.cleanup();
  }

  /**
   * Getters for display
   */
  get holdAmount(): number {
    if (!this.estimatedPrice) {
      return 0;
    }

    return Number(
      ((this.estimatedPrice * this.holdPercentage) / 100).toFixed(2),
    );
  }

  get totalAmount(): number {
    return this.estimatedPrice || 0;
  }

  get holdLabel(): string {
    if (this.paymentPurpose === 'DEPOSIT_REFUND') {
      return 'Remboursement caution';
    }

    if (this.paymentPurpose === 'RESERVATION_ADVANCE') {
      if (this.holdPercentage >= 100) {
        return 'Paiement initial (avance + caution)';
      }

      return `Avance réservation (${this.holdPercentage}%)`;
    }

    return `Hold pénalité (${this.holdPercentage}%)`;
  }

  get holdDescription(): string {
    if (this.paymentPurpose === 'DEPOSIT_REFUND') {
      return `💡 Cette action confirme le remboursement de ${this.holdAmount.toFixed(2)} TND au client après check-out.`;
    }

    if (this.paymentPurpose === 'RESERVATION_ADVANCE') {
      if (this.holdPercentage >= 100) {
        return `💡 Un paiement initial de ${this.holdAmount.toFixed(2)} TND (avance + caution) sera pré-autorisé dans la même transaction.`;
      }

      return `💡 Une pré-autorisation de ${this.holdAmount.toFixed(2)} TND sera appliquée pour l'avance de réservation.`;
    }

    return `💡 Une pré-autorisation de ${this.holdAmount.toFixed(2)} TND sera débloquée pour couvrir la pénalité d'annulation après 2 minutes. À la fin de la course, le montant final sera débité automatiquement.`;
  }
}

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, AfterViewChecked, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';

interface PaymentRequest {
  reservationId: number;
  logementId: number;
  amountInCents: number;
  currency: string;
}

@Component({
  selector: 'app-stripe-payment-modal',
  templateUrl: './stripe-payment-modal.component.html',
  styleUrls: ['./stripe-payment-modal.component.css']
})
export class StripePaymentModalComponent implements OnInit, OnChanges, AfterViewChecked {
  @Input() isOpen = false;
  @Input() paymentRequest?: PaymentRequest;
  @Output() close = new EventEmitter<void>();
  @Output() paymentSuccess = new EventEmitter<{ clientSecret: string }>();
  @Output() paymentError = new EventEmitter<{ message: string }>();

  @ViewChild('cardElement', { read: ElementRef }) cardElementRef?: ElementRef;

  stripe?: Stripe | null;
  cardElement?: StripeCardElement;
  isProcessing = false;
  errorMessage = '';
  successMessage = '';
  clientSecret = '';
  amount = 0;
  amountFormatted = '0.00 EUR';
  private didInitForCurrentOpen = false;

  constructor(private readonly http: HttpClient) {}

  async ngOnInit(): Promise<void> {
    this.stripe = await loadStripe(environment.stripePublishableKey);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.resetForOpen();
        setTimeout(() => {
          void this.initializeForOpen();
        }, 0);
      } else {
        this.didInitForCurrentOpen = false;
      }
    }
  }

  ngAfterViewChecked(): void {
    if (this.isOpen && this.cardElementRef && !this.cardElement && this.stripe) {
      this.mountCardElement();
    }
  }

  private resetForOpen(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.clientSecret = '';
    this.isProcessing = false;
    this.didInitForCurrentOpen = false;

    if (this.paymentRequest) {
      this.amount = this.paymentRequest.amountInCents / 100;
      this.amountFormatted = `${this.amount.toFixed(2)} ${this.paymentRequest.currency.toUpperCase()}`;
    }
  }

  private async initializeForOpen(): Promise<void> {
    if (!this.isOpen || this.didInitForCurrentOpen || !this.paymentRequest) return;

    if (!this.stripe) {
      this.stripe = await loadStripe(environment.stripePublishableKey);
    }

    if (this.cardElementRef && !this.cardElement && this.stripe) {
      this.mountCardElement();
    }

    this.didInitForCurrentOpen = true;
    await this.initiatePayment();
  }

  private mountCardElement(): void {
    if (!this.stripe || !this.cardElementRef || this.cardElement) return;

    const elements = this.stripe.elements();
    this.cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#1e293b',
          fontFamily: '"Inter", "Helvetica Neue", sans-serif',
          '::placeholder': {
            color: '#94a3b8'
          }
        },
        invalid: {
          color: '#ef4444'
        }
      }
    });
    this.cardElement.mount(this.cardElementRef.nativeElement);
  }

  async initiatePayment(): Promise<void> {
    if (!this.paymentRequest) return;

    this.isProcessing = true;
    this.errorMessage = '';

    try {
      // 1. Create payment intent backend side
      const response = await this.http.post<{ clientSecret: string }>(
        `${environment.stripeBackendBaseUrl}/api/payments/create-payment-intent`,
        this.paymentRequest
      ).toPromise();

      if (!response?.clientSecret) {
        throw new Error('Server did not return a client secret');
      }

      this.clientSecret = response.clientSecret;
      this.amount = this.paymentRequest.amountInCents / 100;
      this.amountFormatted = `${this.amount.toFixed(2)} ${this.paymentRequest.currency.toUpperCase()}`;
    } catch (error: unknown) {
      this.errorMessage = this.getErrorMessage(error, 'Failed to initialize payment');
      this.paymentError.emit({ message: this.errorMessage });
      this.isProcessing = false;
    }
  }

  async confirmPayment(): Promise<void> {
    if (!this.stripe || !this.cardElement || !this.clientSecret || !this.paymentRequest) return;

    this.isProcessing = true;
    this.errorMessage = '';

    try {
      const result = await this.stripe.confirmCardPayment(this.clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: {
            name: 'Customer'
          }
        }
      });

      if (result.error) {
        this.errorMessage = result.error.message || 'Payment failed';
        this.paymentError.emit({ message: this.errorMessage });
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        this.successMessage = '✅ Paiement confirmé avec succès!';
        this.paymentSuccess.emit({ clientSecret: this.clientSecret });
        setTimeout(() => this.closeModal(), 2000);
      }
    } catch (error: unknown) {
      this.errorMessage = this.getErrorMessage(error, 'Payment processing failed');
      this.paymentError.emit({ message: this.errorMessage });
    } finally {
      this.isProcessing = false;
    }
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  closeModal(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.clientSecret = '';
    this.didInitForCurrentOpen = false;
    this.close.emit();
  }
}

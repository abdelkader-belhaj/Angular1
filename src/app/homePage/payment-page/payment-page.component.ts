import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';
import { FormBuilder, Validators } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentRecordsService } from '../../services/payment/payment-records.service';

interface PaymentRequest {
  reservationId: number;
  logementId: number;
  logementName: string;
  amountInCents: number;
  currency: string;
}

@Component({
  selector: 'app-payment-page',
  templateUrl: './payment-page.component.html',
  styleUrls: ['./payment-page.component.css']
})
export class PaymentPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('cardElement', { read: ElementRef }) cardElementRef?: ElementRef;

  stripe?: Stripe | null;
  cardElement?: StripeCardElement;
  paymentRequest?: PaymentRequest;
  isProcessing = false;
  errorMessage = '';
  successMessage = '';
  clientSecret = '';
  amountFormatted = '0.00 EUR';
  cardReady = false;
  countries = [
    'Tunisie',
    'France',
    'Belgique',
    'Algerie',
    'Maroc',
    'Italie',
    'Espagne',
    'Allemagne',
    'Autre'
  ];

  readonly paymentForm;
  private queryParamsSubscription?: Subscription;
  private isViewInitialized = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly formBuilder: FormBuilder,
    private readonly paymentRecordsService: PaymentRecordsService
  ) {
    this.paymentForm = this.formBuilder.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\s()-]{8,20}$/)]],
      addressLine1: ['', [Validators.required, Validators.minLength(5)]],
      city: ['', [Validators.required, Validators.minLength(2)]],
      postalCode: ['', [Validators.required, Validators.minLength(3)]],
      country: ['Tunisie', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    });
  }

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      const reservationId = Number(params['reservationId']);
      const logementId = Number(params['logementId']);
      const logementName = typeof params['logementName'] === 'string' && params['logementName'].trim()
        ? params['logementName']
        : 'Logement reserve';
      const amountInCents = Number(params['amountInCents']);
      const currency = typeof params['currency'] === 'string' ? params['currency'] : 'eur';

      if (!reservationId || !logementId || !amountInCents || amountInCents <= 0) {
        this.errorMessage = 'Informations de paiement invalides.';
        return;
      }

      this.paymentRequest = {
        reservationId,
        logementId,
        logementName,
        amountInCents,
        currency
      };

      this.amountFormatted = `${(amountInCents / 100).toFixed(2)} DT`;
      setTimeout(() => {
        void this.initializePaymentPage();
      });
    });
  }

  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    setTimeout(() => {
      this.mountCardElementIfNeeded();
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.cardElement?.unmount();
    this.cardElement?.destroy();
  }

  private async initializePaymentPage(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    this.clientSecret = '';
    this.cardReady = false;

    if (this.cardElement) {
      this.cardElement.unmount();
      this.cardElement.destroy();
      this.cardElement = undefined;
    }

    try {
      this.stripe = await loadStripe(environment.stripePublishableKey);
      await this.initiatePayment();
      this.mountCardElementIfNeeded();
    } catch (error: unknown) {
      this.errorMessage = this.getErrorMessage(error, 'Initialisation du paiement impossible.');
    }
  }

  private mountCardElementIfNeeded(): void {
    if (!this.isViewInitialized || !this.stripe || !this.cardElementRef || this.cardElement) {
      return;
    }

    const elements = this.stripe.elements();
    this.cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#0f172a',
          fontFamily: '"Inter", "Segoe UI", sans-serif',
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
    setTimeout(() => {
      this.cardReady = true;
    });
  }

  private async initiatePayment(): Promise<void> {
    if (!this.paymentRequest) {
      return;
    }

    this.isProcessing = true;

    try {
      const response = await firstValueFrom(
        this.http.post<{ clientSecret: string }>(
          `${environment.stripeBackendBaseUrl}/api/payments/create-payment-intent`,
          this.paymentRequest
        )
      );

      if (!response?.clientSecret) {
        throw new Error('Le serveur de paiement ne retourne pas de client secret.');
      }

      this.clientSecret = response.clientSecret;
    } finally {
      this.isProcessing = false;
    }
  }

  async confirmPayment(): Promise<void> {
    if (!this.stripe || !this.cardElement || !this.clientSecret || !this.paymentRequest) {
      this.errorMessage = 'Paiement non prêt. Veuillez réessayer.';
      return;
    }

    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.errorMessage = 'Veuillez remplir correctement tous les champs obligatoires.';
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';
    const formValue = this.paymentForm.getRawValue();

    try {
      const result = await this.stripe.confirmCardPayment(this.clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: {
            name: formValue.fullName,
            email: formValue.email,
            phone: formValue.phone,
            address: {
              line1: formValue.addressLine1,
              city: formValue.city,
              postal_code: formValue.postalCode,
              country: this.toCountryCode(formValue.country)
            }
          }
        }
      });

      if (result.error) {
        this.errorMessage = result.error.message || 'Paiement refusé.';
        return;
      }

      if (result.paymentIntent?.status === 'succeeded') {
        this.successMessage = 'Paiement confirmé avec succès.';
        this.paymentRecordsService.saveReceipt({
          reservationId: this.paymentRequest.reservationId,
          logementId: this.paymentRequest.logementId,
          logementName: this.paymentRequest.logementName,
          amountInCents: this.paymentRequest.amountInCents,
          currency: this.paymentRequest.currency,
          displayCurrency: 'DT',
          paidAtIso: new Date().toISOString(),
          paymentIntentId: result.paymentIntent.id,
          customerFullName: formValue.fullName,
          customerEmail: formValue.email,
          customerPhone: formValue.phone,
          addressLine1: formValue.addressLine1,
          city: formValue.city,
          postalCode: formValue.postalCode,
          country: formValue.country
        });

        setTimeout(() => {
          void this.router.navigate(['/paiement/succes'], {
            queryParams: {
              reservationId: this.paymentRequest?.reservationId,
              logementName: this.paymentRequest?.logementName
            }
          });
        }, 1200);
      }
    } catch (error: unknown) {
      this.errorMessage = this.getErrorMessage(error, 'Erreur pendant le paiement.');
    } finally {
      this.isProcessing = false;
    }
  }

  backToReservations(): void {
    void this.router.navigate(['/mes-reservations']);
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Serveur de paiement inaccessible. Lancez le backend Stripe avec npm run stripe:server puis reessayez.';
      }

      const serverMessage = typeof error.error?.message === 'string' ? error.error.message : '';
      return serverMessage || fallback;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }

  private toCountryCode(country: string): string {
    const mapping: Record<string, string> = {
      Tunisie: 'TN',
      France: 'FR',
      Belgique: 'BE',
      Algerie: 'DZ',
      Maroc: 'MA',
      Italie: 'IT',
      Espagne: 'ES',
      Allemagne: 'DE',
      Autre: 'TN'
    };

    return mapping[country] || 'TN';
  }
}

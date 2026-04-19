import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CheckoutSessionRequest {
  reservationId: number;
  logementId: number;
  amountInCents: number;
  currency: string;
}

interface CheckoutSessionResponse {
  sessionId: string;
  sessionUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StripeCheckoutService {
  constructor(private readonly http: HttpClient) {}

  async redirectToCheckout(request: CheckoutSessionRequest): Promise<void> {
    if (!environment.stripePublishableKey) {
      throw new Error('Stripe publishable key is missing in Angular environment config.');
    }

    const response = await firstValueFrom(
      this.http.post<CheckoutSessionResponse>(
        `${environment.stripeBackendBaseUrl}/api/payments/create-checkout-session`,
        request
      )
    );

    if (response.sessionUrl) {
      window.location.assign(response.sessionUrl);
      return;
    }

    throw new Error(`Stripe session URL missing for session ${response.sessionId}.`);
  }
}

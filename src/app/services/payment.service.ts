import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = 'http://localhost:8080/api/payments';

  constructor(private http: HttpClient) {}

  // Create a payment intent on the backend
  createPaymentIntent(amount: number, currency: string = 'TND'): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-intent`, {
      amount,
      currency
    });
  }

  // Process the payment with Stripe
  processPayment(paymentIntentId: string, paymentMethodId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/process-payment`, {
      paymentIntentId,
      paymentMethodId
    });
  }

  // Get payment status
  getPaymentStatus(paymentIntentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/payment-status/${paymentIntentId}`);
  }
}

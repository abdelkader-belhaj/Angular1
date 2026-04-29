import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentReceipt, PaymentRecordsService } from '../../services/payment/payment-records.service';

@Component({
  selector: 'app-payment-success',
  templateUrl: './payment-success.component.html',
  styleUrls: ['./payment-success.component.css']
})
export class PaymentSuccessComponent implements OnInit {
  reservationId: number | null = null;
  receipt: PaymentReceipt | null = null;
  fallbackLogementName = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paymentRecordsService: PaymentRecordsService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const reservationId = Number(params['reservationId']);
      this.fallbackLogementName = typeof params['logementName'] === 'string' ? params['logementName'].trim() : '';
      if (!Number.isFinite(reservationId) || reservationId <= 0) {
        this.reservationId = null;
        this.receipt = null;
        return;
      }

      this.reservationId = reservationId;
      this.receipt = this.paymentRecordsService.getReceiptByReservationId(reservationId);
    });
  }

  get displayLogementName(): string {
    if (this.receipt?.logementName?.trim()) {
      return this.receipt.logementName.trim();
    }

    if (this.fallbackLogementName) {
      return this.fallbackLogementName;
    }

    return 'Logement reserve et paye';
  }

  viewInvoice(): void {
    if (!this.reservationId) return;
    void this.router.navigate(['/paiement/facture', this.reservationId]);
  }

  backToReservations(): void {
    void this.router.navigate(['/mes-reservations'], {
      queryParams: {
        payment: 'success',
        reservationId: this.reservationId || undefined
      }
    });
  }
}

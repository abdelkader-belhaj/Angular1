import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventReservation } from '../../models/event.model';
import { PaymentService } from '../../../services/events/Payment.service';
import { ReservationService } from '../../../services/events/reservation.service';

@Component({
  selector: 'app-payment-page',
  templateUrl: './payment-page.component.html',
  styleUrls: ['./payment-page.component.css'],
})
export class PaymentPageComponent implements OnInit {
  reservation: EventReservation | null = null;
  loading = true;
  errorMsg = '';
  processing = false;
  paid = false;

  selectedMethod: 'CARTE' | 'PAYPAL' | 'VIREMENT' = 'CARTE';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paymentService: PaymentService,
    private readonly resService: ReservationService,
  ) {}

  ngOnInit(): void {
    const id = Number(
      this.route.snapshot.paramMap.get('reservationId') ??
      this.route.snapshot.queryParamMap.get('reservationId')
    );

    if (!id) {
      this.errorMsg = 'Identifiant de reservation manquant.';
      this.loading = false;
      return;
    }

    this.resService.getById(id).subscribe({
      next: (reservation: EventReservation) => {
        this.reservation = reservation;
        this.paid = reservation.status === 'CONFIRMED';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Reservation introuvable.';
      },
    });
  }

  confirmPayment(): void {
    if (!this.reservation || this.processing || this.paid) {
      return;
    }

    this.processing = true;
    this.errorMsg = '';

    this.paymentService.create({
      amount: this.reservation.totalPrice,
      paymentMethod: this.selectedMethod,
      currency: 'TND',
      reservationId: this.reservation.id,
    }).subscribe({
      next: (payment) => {
        this.paymentService.success(payment.id).subscribe({
          next: () => {
            this.paid = true;
            this.processing = false;
            if (this.reservation) {
              this.reservation = { ...this.reservation, status: 'CONFIRMED' };
            }
          },
          error: (err) => {
            this.processing = false;
            this.errorMsg = err?.error?.message ?? 'Erreur de confirmation du paiement.';
          },
        });
      },
      error: (err) => {
        this.processing = false;
        this.errorMsg = err?.error?.message ?? 'Erreur de paiement.';
      },
    });
  }

  goToTicket(): void {
    if (this.reservation) {
      void this.router.navigate(['/ticket', this.reservation.id]);
    }
  }

  goBack(): void {
    void this.router.navigate(['/events']);
  }
}

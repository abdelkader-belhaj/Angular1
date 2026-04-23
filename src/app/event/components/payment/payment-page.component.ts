import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EventReservation } from '../../models/event.model';
import { PaymentService } from '../../../services/events/Payment.service';
import { ReservationService } from '../../../services/events/reservation.service';
import { EventService } from '../../../services/events/event.service';
import { calculateDiscount } from '../../utils/discount.util';
import { StripeCheckoutSessionResponse } from '../../../services/events/Payment.service';

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
  promoCodeInput = '';
  promoApplied = false;
  promoError = '';
  promoPercent = 0;
  discountedTotal: number | null = null;
  stripeSessionId = '';

  selectedMethod: 'STRIPE' | 'PAYPAL' | 'VIREMENT' = 'STRIPE';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paymentService: PaymentService,
    private readonly resService: ReservationService,
    private readonly eventService: EventService,
  ) {}

  ngOnInit(): void {
    const id = Number(
      this.route.snapshot.paramMap.get('reservationId') ??
      this.route.snapshot.queryParamMap.get('reservationId')
    );
    this.stripeSessionId = this.route.snapshot.queryParamMap.get('stripeSessionId') ?? '';

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

        if (this.paid) {
          return;
        }

        if (this.stripeSessionId.trim().length > 0) {
          void this.confirmStripeReturn();
        }
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Reservation introuvable.';
      },
    });
  }

  async confirmPayment(): Promise<void> {
    if (!this.reservation || this.processing || this.paid) {
      return;
    }

    if (this.selectedMethod !== 'STRIPE') {
      this.errorMsg = 'Seul le paiement Stripe est activé pour cette réservation.';
      return;
    }

    if (this.promoCodeInput.trim().length > 0 && !this.promoApplied) {
      this.errorMsg = 'Appliquez d’abord le code promo avant de payer.';
      return;
    }

    this.processing = true;
    this.errorMsg = '';

    this.paymentService.createStripeSession({
      reservationId: this.reservation.id,
      promoCode: this.promoApplied ? this.promoCodeInput.trim() : null,
    }).subscribe({
      next: (session: StripeCheckoutSessionResponse) => {
        this.processing = false;
        if (!session.checkoutUrl) {
          this.errorMsg = 'Stripe n’a pas renvoyé d’URL de paiement.';
          return;
        }
        window.location.assign(session.checkoutUrl);
      },
      error: (err) => {
        this.processing = false;
        this.errorMsg = err?.error?.message ?? 'Impossible d’ouvrir Stripe.';
      },
    });
  }

  private confirmStripeReturn(): void {
    if (!this.reservation || this.processing || this.paid || !this.stripeSessionId.trim()) {
      return;
    }

    this.processing = true;
    this.errorMsg = '';

    this.paymentService.confirmStripeSession({
      reservationId: this.reservation.id,
      sessionId: this.stripeSessionId.trim(),
    }).subscribe({
      next: () => {
        this.paid = true;
        this.processing = false;
        if (this.reservation) {
          this.reservation = { ...this.reservation, status: 'CONFIRMED' };
        }
      },
      error: (err) => {
        this.processing = false;
        this.errorMsg = err?.error?.message ?? 'Paiement Stripe non confirmé.';
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

  get payableAmount(): number {
    return this.discountedTotal ?? this.reservation?.totalPrice ?? 0;
  }

  applyPromoCode(): void {
    if (!this.reservation) return;

    const code = this.promoCodeInput.trim();
    if (!code) {
      this.promoError = 'Saisissez un code promo.';
      this.promoApplied = false;
      this.discountedTotal = null;
      return;
    }

    this.eventService.getPublishedById(this.reservation.eventId).subscribe({
      next: (event) => {
        const discount = calculateDiscount(event.price, event.startDate, event.categoryName, {
          promoType: event.promoType,
          promoPercent: event.promoPercent,
          promoCode: event.promoCode,
          promoStartDate: event.promoStartDate,
          promoEndDate: event.promoEndDate,
        });

        const expected = (event.promoCode ?? '').trim().toLowerCase();
        if (!discount.hasDiscount || !expected || expected !== code.toLowerCase()) {
          this.promoError = 'Code promo invalide ou expiré.';
          this.promoApplied = false;
          this.discountedTotal = null;
          return;
        }

        this.promoPercent = discount.discountPercent;
        this.discountedTotal = +(discount.finalPrice * this.reservation!.numberOfTickets).toFixed(2);
        this.promoApplied = true;
        this.promoError = '';
      },
      error: () => {
        this.promoError = 'Impossible de vérifier le code promo.';
        this.promoApplied = false;
        this.discountedTotal = null;
      },
    });
  }
}
